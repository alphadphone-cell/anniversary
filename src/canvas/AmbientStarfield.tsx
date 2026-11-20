import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface AmbientStarfieldProps {
  /** Multiplier from PerformanceMonitor (0.55..1.0) to adapt density/size smoothly */
  quality?: number;
  reducedMotion?: boolean;
}

const STAR_COUNT = 2600;
const DUST_COUNT = 350;

const STAR_VERTEX_SHADER = /* glsl */ `
  attribute float aScale;
  attribute float aPhase;
  attribute float aSpeed;
  attribute vec3 aColor;

  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uReducedMotion;

  varying vec3 vColor;
  varying float vTwinkle;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float motionFactor = 1.0 - uReducedMotion;
    float twinkle = 0.68 + 0.32 * sin(uTime * aSpeed * motionFactor + aPhase);
    vTwinkle = twinkle;
    vColor = aColor;

    float distanceAtten = 28.0 / max(-mvPosition.z, 2.0);
    gl_PointSize = clamp(aScale * uPixelRatio * distanceAtten * (0.85 + 0.15 * twinkle), 1.2, 18.0);
  }
`;

const STAR_FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vColor;
  varying float vTwinkle;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float dist = length(uv);
    if (dist > 0.5) discard;

    // Soft radial star core + delicate outer halo
    float core = exp(-dist * dist * 26.0);
    float halo = pow(max(0.0, 1.0 - dist * 2.0), 2.4) * 0.45;
    float alpha = (core + halo) * vTwinkle;

    gl_FragColor = vec4(vColor * (core * 1.35 + halo), alpha);
  }
`;

const DUST_VERTEX_SHADER = /* glsl */ `
  attribute float aScale;
  attribute float aPhase;
  attribute vec3 aColor;

  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uReducedMotion;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec3 pos = position;
    float motion = 1.0 - uReducedMotion;
    pos.y += sin(uTime * 0.18 * motion + aPhase) * 0.25;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    vColor = aColor;
    vAlpha = 0.14 + 0.06 * sin(uTime * 0.35 * motion + aPhase);

    float distanceAtten = 52.0 / max(-mvPosition.z, 3.0);
    gl_PointSize = clamp(aScale * uPixelRatio * distanceAtten, 6.0, 64.0);
  }
`;

const DUST_FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float dist = length(uv);
    if (dist > 0.5) discard;

    float falloff = smoothstep(0.5, 0.0, dist);
    float glow = falloff * falloff * vAlpha;
    gl_FragColor = vec4(vColor, glow);
  }
`;

/** Deterministic PRNG (Mulberry32) so starfield layout stays crisp across renders. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function AmbientStarfield({ quality = 1, reducedMotion = false }: AmbientStarfieldProps) {
  const groupRef = useRef<THREE.Group>(null);

  const { starGeometry, starMaterial, dustGeometry, dustMaterial } = useMemo(() => {
    const rand = mulberry32(20261120);

    // Palette tuned for selective bloom (luminanceThreshold 0.85):
    // Most background stars stay below bloom threshold; rare hero stars exceed 1.15 HDR.
    const palette = [
      new THREE.Color('#f8f4ff'), // starlight white
      new THREE.Color('#cbbde6'), // soft lavender
      new THREE.Color('#8b5cf6'), // astral violet
      new THREE.Color('#d946ef'), // magenta glow
      new THREE.Color('#ff3ea5'), // neon rose
    ];

    const starPositions = new Float32Array(STAR_COUNT * 3);
    const starColors = new Float32Array(STAR_COUNT * 3);
    const starScales = new Float32Array(STAR_COUNT);
    const starPhases = new Float32Array(STAR_COUNT);
    const starSpeeds = new Float32Array(STAR_COUNT);

    for (let i = 0; i < STAR_COUNT; i++) {
      // Spherical shell biased slightly toward an equatorial galactic band
      const u = rand();
      const v = rand();
      const theta = u * Math.PI * 2;
      const phi = Math.acos(2 * v - 1);
      const radius = 9 + Math.pow(rand(), 0.72) * 44;

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.cos(phi) * (rand() < 0.48 ? 0.42 : 0.92);
      const z = radius * Math.sin(phi) * Math.sin(theta);

      const i3 = i * 3;
      starPositions[i3] = x;
      starPositions[i3 + 1] = y;
      starPositions[i3 + 2] = z;

      const pick = rand();
      const baseColor =
        pick < 0.46
          ? palette[0]
          : pick < 0.68
            ? palette[1]
            : pick < 0.82
              ? palette[2]
              : pick < 0.92
                ? palette[3]
                : palette[4];

      // Promote ~14% of accent stars into HDR range so Bloom catches them selectively
      const hdrBoost = pick > 0.86 ? 1.55 + rand() * 0.55 : 0.58 + rand() * 0.32;
      starColors[i3] = baseColor.r * hdrBoost;
      starColors[i3 + 1] = baseColor.g * hdrBoost;
      starColors[i3 + 2] = baseColor.b * hdrBoost;

      starScales[i] = pick > 0.9 ? 1.9 + rand() * 1.8 : 0.65 + rand() * 1.15;
      starPhases[i] = rand() * Math.PI * 2;
      starSpeeds[i] = 0.7 + rand() * 1.8;
    }

    const sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    sGeo.setAttribute('aColor', new THREE.BufferAttribute(starColors, 3));
    sGeo.setAttribute('aScale', new THREE.BufferAttribute(starScales, 1));
    sGeo.setAttribute('aPhase', new THREE.BufferAttribute(starPhases, 1));
    sGeo.setAttribute('aSpeed', new THREE.BufferAttribute(starSpeeds, 1));

    const sMat = new THREE.ShaderMaterial({
      vertexShader: STAR_VERTEX_SHADER,
      fragmentShader: STAR_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
        uReducedMotion: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    // Subtle cosmic nebula dust ring
    const dustPositions = new Float32Array(DUST_COUNT * 3);
    const dustColors = new Float32Array(DUST_COUNT * 3);
    const dustScales = new Float32Array(DUST_COUNT);
    const dustPhases = new Float32Array(DUST_COUNT);

    const dustPalette = [
      new THREE.Color('#6d28d9'),
      new THREE.Color('#a21caf'),
      new THREE.Color('#db2777'),
    ];

    for (let i = 0; i < DUST_COUNT; i++) {
      const angle = rand() * Math.PI * 2;
      const dist = 4.5 + rand() * 20;
      const i3 = i * 3;
      dustPositions[i3] = Math.cos(angle) * dist + (rand() - 0.5) * 4;
      dustPositions[i3 + 1] = (rand() - 0.5) * 7.5;
      dustPositions[i3 + 2] = Math.sin(angle) * dist + (rand() - 0.5) * 4;

      const c = dustPalette[Math.floor(rand() * dustPalette.length)];
      dustColors[i3] = c.r * 0.7;
      dustColors[i3 + 1] = c.g * 0.7;
      dustColors[i3 + 2] = c.b * 0.7;

      dustScales[i] = 2.6 + rand() * 3.4;
      dustPhases[i] = rand() * Math.PI * 2;
    }

    const dGeo = new THREE.BufferGeometry();
    dGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    dGeo.setAttribute('aColor', new THREE.BufferAttribute(dustColors, 3));
    dGeo.setAttribute('aScale', new THREE.BufferAttribute(dustScales, 1));
    dGeo.setAttribute('aPhase', new THREE.BufferAttribute(dustPhases, 1));

    const dMat = new THREE.ShaderMaterial({
      vertexShader: DUST_VERTEX_SHADER,
      fragmentShader: DUST_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
        uReducedMotion: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return {
      starGeometry: sGeo,
      starMaterial: sMat,
      dustGeometry: dGeo,
      dustMaterial: dMat,
    };
  }, []);

  // Dynamically draw fewer vertices when PerformanceMonitor reduces quality without reallocating buffers
  useEffect(() => {
    const clamped = THREE.MathUtils.clamp(quality, 0.5, 1);
    starGeometry.setDrawRange(0, Math.floor(STAR_COUNT * clamped));
    dustGeometry.setDrawRange(0, Math.floor(DUST_COUNT * clamped));
  }, [quality, starGeometry, dustGeometry]);

  // Strict GPU memory disposal on unmount
  useEffect(() => {
    return () => {
      starGeometry.dispose();
      starMaterial.dispose();
      dustGeometry.dispose();
      dustMaterial.dispose();
    };
  }, [starGeometry, starMaterial, dustGeometry, dustMaterial]);

  useFrame((state, delta) => {
    const elapsed = state.clock.elapsedTime;
    const dpr = state.gl.getPixelRatio();
    const rm = reducedMotion ? 1 : 0;

    starMaterial.uniforms.uTime.value = elapsed;
    starMaterial.uniforms.uPixelRatio.value = dpr;
    starMaterial.uniforms.uReducedMotion.value = rm;

    dustMaterial.uniforms.uTime.value = elapsed;
    dustMaterial.uniforms.uPixelRatio.value = dpr;
    dustMaterial.uniforms.uReducedMotion.value = rm;

    if (groupRef.current && !reducedMotion) {
      groupRef.current.rotation.y += delta * 0.014;
      groupRef.current.rotation.x = Math.sin(elapsed * 0.07) * 0.03;
    }
  });

  return (
    <group ref={groupRef} name="ambient-starfield">
      <points geometry={starGeometry} material={starMaterial} frustumCulled={false} />
      <points geometry={dustGeometry} material={dustMaterial} frustumCulled={false} />
    </group>
  );
}
