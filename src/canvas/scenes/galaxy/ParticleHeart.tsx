import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface ParticleHeartProps {
  quality?: number;
  reducedMotion?: boolean;
}

const HEART_PARTICLES = 2200;

const HEART_VERTEX_SHADER = /* glsl */ `
  attribute float aScale;
  attribute float aPhase;
  attribute vec3 aColor;

  uniform float uTime;
  uniform float uPulse;
  uniform float uPixelRatio;
  uniform float uReducedMotion;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float motion = 1.0 - uReducedMotion;

    // Gentle organic shimmer along surface normal direction
    vec3 pos = position * (1.0 + uPulse * 0.045);
    pos.x += sin(uTime * 1.4 * motion + aPhase) * 0.025 * motion;
    pos.y += cos(uTime * 1.2 * motion + aPhase) * 0.025 * motion;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float sparkle = 0.72 + 0.28 * sin(uTime * 2.6 * motion + aPhase);
    vColor = aColor * (0.94 + uPulse * 0.2);
    vAlpha = sparkle;

    float atten = 30.0 / max(-mvPosition.z, 2.0);
    gl_PointSize = clamp(aScale * uPixelRatio * atten, 1.6, 15.0);
  }
`;

const HEART_FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float dist = length(uv);
    if (dist > 0.5) discard;

    float core = exp(-dist * dist * 18.0);
    float halo = smoothstep(0.5, 0.08, dist) * 0.52;
    float alpha = (core + halo) * vAlpha;

    gl_FragColor = vec4(vColor * (core * 1.25 + halo * 0.8), alpha);
  }
`;

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

export function ParticleHeart({ quality = 1, reducedMotion = false }: ParticleHeartProps) {
  const heartGroupRef = useRef<THREE.Group>(null);

  const { geometry, material } = useMemo(() => {
    const rand = mulberry32(771120);

    const positions = new Float32Array(HEART_PARTICLES * 3);
    const colors = new Float32Array(HEART_PARTICLES * 3);
    const scales = new Float32Array(HEART_PARTICLES);
    const phases = new Float32Array(HEART_PARTICLES);

    const cWhite = new THREE.Color('#fff5fb');
    const cBlossom = new THREE.Color('#ff8ec9');
    const cRose = new THREE.Color('#ff3ea5');
    const cMagenta = new THREE.Color('#e879f9');
    const tmp = new THREE.Color();

    const scale = 0.165;

    for (let i = 0; i < HEART_PARTICLES; i++) {
      const i3 = i * 3;
      const t = rand() * Math.PI * 2;

      // 2D classic parametric heart curve
      const hx = 16 * Math.pow(Math.sin(t), 3);
      const hy =
        13 * Math.cos(t) -
        5 * Math.cos(2 * t) -
        2 * Math.cos(3 * t) -
        Math.cos(4 * t);

      // 58% dense luminous rim shell, 42% sculpted volumetric interior
      const isShell = rand() < 0.58;
      const radialFill = isShell ? 0.88 + rand() * 0.16 : Math.pow(rand(), 0.52) * 0.92;

      // True 3D depth puffiness: thickest in the middle lobes, tapering cleanly to zero at the edge
      const edgeTaper = Math.sqrt(Math.max(0.02, 1.0 - radialFill * radialFill * 0.82));
      const zSign = rand() < 0.5 ? 1 : -1;
      const zDepth = (isShell ? 0.45 + rand() * 0.65 : rand()) * 7.8 * edgeTaper * zSign;

      const x = hx * radialFill * scale;
      // Offset Y slightly so heart bottom tip hovers cleanly above the galaxy fountain
      const y = (hy * radialFill + 2.4) * scale;
      const z = zDepth * scale;

      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;

      // Highlight upper cleft & lower tip in luminous starlight white like the reference
      const isHighlightZone =
        (Math.abs(x) < 0.55 && y > 0.6 && y < 1.9) ||
        (Math.abs(x) < 0.45 && y < -1.55) ||
        (isShell && rand() < 0.2);

      if (isHighlightZone) {
        tmp.copy(cWhite).lerp(cBlossom, rand() * 0.35);
      } else if (isShell) {
        tmp.copy(cBlossom).lerp(cRose, 0.35 + rand() * 0.55);
      } else {
        tmp.copy(cRose).lerp(cMagenta, rand() * 0.45);
      }

      const hdrBoost = isHighlightZone ? 1.48 : isShell ? 1.18 : 0.9;
      colors[i3] = tmp.r * hdrBoost;
      colors[i3 + 1] = tmp.g * hdrBoost;
      colors[i3 + 2] = tmp.b * hdrBoost;

      scales[i] = isShell ? 1.05 + rand() * 1.45 : 0.75 + rand() * 1.1;
      phases[i] = rand() * Math.PI * 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

    const mat = new THREE.ShaderMaterial({
      vertexShader: HEART_VERTEX_SHADER,
      fragmentShader: HEART_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uPulse: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
        uReducedMotion: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return { geometry: geo, material: mat };
  }, []);

  useEffect(() => {
    const clamped = THREE.MathUtils.clamp(quality, 0.6, 1);
    geometry.setDrawRange(0, Math.floor(HEART_PARTICLES * clamped));
  }, [quality, geometry]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame((state, delta) => {
    const elapsed = state.clock.elapsedTime;
    const dpr = state.gl.getPixelRatio();
    const rm = reducedMotion ? 1 : 0;

    // Gentle double-beat heartbeat rhythm
    const beatCycle = (elapsed * 0.9) % 1;
    const pulse =
      reducedMotion
        ? 0
        : Math.exp(-Math.pow((beatCycle - 0.16) * 11, 2)) +
          0.55 * Math.exp(-Math.pow((beatCycle - 0.34) * 12, 2));

    material.uniforms.uTime.value = elapsed;
    material.uniforms.uPulse.value = pulse;
    material.uniforms.uPixelRatio.value = dpr;
    material.uniforms.uReducedMotion.value = rm;

    if (heartGroupRef.current && !reducedMotion) {
      heartGroupRef.current.rotation.y += Math.min(delta, 0.05) * 0.32;
      heartGroupRef.current.position.y = 4.25 + Math.sin(elapsed * 1.15) * 0.18;
    }
  });

  return (
    <group ref={heartGroupRef} position={[0, 4.25, 0]} name="particle-heart">
      <points geometry={geometry} material={material} frustumCulled={false} />
    </group>
  );
}
