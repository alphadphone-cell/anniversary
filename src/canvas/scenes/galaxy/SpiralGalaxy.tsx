import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface SpiralGalaxyProps {
  quality?: number;
  reducedMotion?: boolean;
}

const GALAXY_PARTICLES = 5600;
const FOUNTAIN_PARTICLES = 420;

const GALAXY_VERTEX_SHADER = /* glsl */ `
  attribute float aScale;
  attribute float aPhase;
  attribute vec3 aColor;

  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uReducedMotion;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float motion = 1.0 - uReducedMotion;
    float twinkle = 0.72 + 0.28 * sin(uTime * 1.9 * motion + aPhase);
    vColor = aColor;
    vAlpha = twinkle;

    float atten = 28.0 / max(-mvPosition.z, 2.0);
    gl_PointSize = clamp(aScale * uPixelRatio * atten, 1.4, 15.0);
  }
`;

const GALAXY_FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float dist = length(uv);
    if (dist > 0.5) discard;

    float core = exp(-dist * dist * 20.0);
    float halo = smoothstep(0.5, 0.05, dist) * 0.48;
    float intensity = (core + halo) * vAlpha;

    gl_FragColor = vec4(vColor * (core * 1.2 + halo * 0.85), intensity);
  }
`;

const FOUNTAIN_VERTEX_SHADER = /* glsl */ `
  attribute float aProgress;
  attribute float aAngle;
  attribute float aSpread;
  attribute float aScale;
  attribute vec3 aColor;

  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uReducedMotion;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float motion = 1.0 - uReducedMotion;
    float p = fract(aProgress + uTime * 0.24 * motion);

    // Rising vortex stream from accretion core up into the floating heart base
    float y = 0.25 + p * 2.45;
    float radius = 0.18 + pow(p, 1.35) * aSpread;
    float angle = aAngle + p * 4.5 + uTime * 0.9 * motion;

    vec3 pos = vec3(cos(angle) * radius, y, sin(angle) * radius);
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float fadeIn = smoothstep(0.0, 0.15, p);
    float fadeOut = 1.0 - smoothstep(0.75, 1.0, p);
    vAlpha = fadeIn * fadeOut * 0.85;
    vColor = aColor;

    float atten = 26.0 / max(-mvPosition.z, 2.0);
    gl_PointSize = clamp(aScale * uPixelRatio * atten, 1.4, 12.0);
  }
`;

const ACCRETION_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ACCRETION_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);
    if (r > 1.0 || r < 0.24) discard;

    float angle = atan(p.y, p.x);
    float swirl = sin(angle * 4.0 - r * 12.0 + uTime * 2.6) * 0.5 + 0.5;

    // Bright luminous inner accretion ring fading smoothly into magenta rim
    float innerEdge = smoothstep(0.24, 0.36, r);
    float outerEdge = 1.0 - smoothstep(0.42, 0.98, r);
    float ringBand = exp(-pow((r - 0.44) * 5.2, 2.0));

    vec3 innerWhite = vec3(1.45, 1.32, 1.65);
    vec3 midPink = vec3(1.25, 0.35, 0.95);
    vec3 outerViolet = vec3(0.68, 0.24, 1.25);

    vec3 col = mix(innerWhite, midPink, smoothstep(0.32, 0.62, r));
    col = mix(col, outerViolet, smoothstep(0.62, 0.95, r));

    float alpha = (ringBand * 0.92 + innerEdge * outerEdge * (0.42 + 0.28 * swirl)) * outerEdge;
    gl_FragColor = vec4(col * (0.85 + 0.3 * swirl), clamp(alpha, 0.0, 0.95));
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

export function SpiralGalaxy({ quality = 1, reducedMotion = false }: SpiralGalaxyProps) {
  const galaxyGroupRef = useRef<THREE.Group>(null);

  const resources = useMemo(() => {
    const rand = mulberry32(20260520);

    const positions = new Float32Array(GALAXY_PARTICLES * 3);
    const colors = new Float32Array(GALAXY_PARTICLES * 3);
    const scales = new Float32Array(GALAXY_PARTICLES);
    const phases = new Float32Array(GALAXY_PARTICLES);

    const cCore = new THREE.Color('#f7ecff');
    const cPink = new THREE.Color('#ff3ea5');
    const cMagenta = new THREE.Color('#d946ef');
    const cViolet = new THREE.Color('#8b5cf6');
    const tmpColor = new THREE.Color();

    const branches = 4;
    const maxRadius = 11.4;
    const spinFactor = 1.25;

    for (let i = 0; i < GALAXY_PARTICLES; i++) {
      const i3 = i * 3;
      const isOuterDust = rand() < 0.16;

      // Concentrate denser luminous arms inside radius 1.4..8.5 with delicate outer halo to 11.4
      const t = isOuterDust ? Math.pow(rand(), 0.55) : Math.pow(rand(), 1.15);
      const radius = 1.38 + t * (maxRadius - 1.38);
      const branchAngle = ((i % branches) / branches) * Math.PI * 2;
      const spinAngle = radius * spinFactor;

      const spreadPower = isOuterDust ? 1.8 : 2.8;
      const scatterScale = (0.14 + t * 1.15) * (isOuterDust ? 1.9 : 1.0);
      const rx = Math.pow(rand(), spreadPower) * (rand() < 0.5 ? 1 : -1) * scatterScale;
      const rz = Math.pow(rand(), spreadPower) * (rand() < 0.5 ? 1 : -1) * scatterScale;
      const ry = (rand() - 0.5) * (0.18 + (1 - t) * 0.42) * (isOuterDust ? 1.6 : 1.0);

      const angle = branchAngle + spinAngle;
      positions[i3] = Math.cos(angle) * radius + rx;
      positions[i3 + 1] = ry;
      positions[i3 + 2] = Math.sin(angle) * radius + rz;

      // Radial color gradient: luminous white-lavender core -> magenta/pink mid arms -> violet edge
      const normR = (radius - 1.38) / (maxRadius - 1.38);
      if (normR < 0.28) {
        tmpColor.copy(cCore).lerp(cMagenta, normR / 0.28);
      } else if (normR < 0.68) {
        tmpColor.copy(cMagenta).lerp(rand() < 0.55 ? cPink : cViolet, (normR - 0.28) / 0.4);
      } else {
        tmpColor.copy(cViolet).lerp(cPink, (normR - 0.68) / 0.32 * 0.45);
      }

      // Selective HDR boost near inner spiral ridges so Bloom catches the arms gracefully
      const ridgeBoost = normR < 0.38 ? 1.35 : isOuterDust ? 0.65 : 0.92 + rand() * 0.28;
      colors[i3] = tmpColor.r * ridgeBoost;
      colors[i3 + 1] = tmpColor.g * ridgeBoost;
      colors[i3 + 2] = tmpColor.b * ridgeBoost;

      scales[i] = isOuterDust ? 0.6 + rand() * 0.85 : 0.85 + (1 - normR * 0.45) * rand() * 1.65;
      phases[i] = rand() * Math.PI * 2;
    }

    const galaxyGeo = new THREE.BufferGeometry();
    galaxyGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    galaxyGeo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    galaxyGeo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    galaxyGeo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

    const galaxyMat = new THREE.ShaderMaterial({
      vertexShader: GALAXY_VERTEX_SHADER,
      fragmentShader: GALAXY_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
        uReducedMotion: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    // Rising stardust vortex stream connecting galaxy core up to the 3D heart tip
    const fPos = new Float32Array(FOUNTAIN_PARTICLES * 3);
    const fProg = new Float32Array(FOUNTAIN_PARTICLES);
    const fAng = new Float32Array(FOUNTAIN_PARTICLES);
    const fSpr = new Float32Array(FOUNTAIN_PARTICLES);
    const fSca = new Float32Array(FOUNTAIN_PARTICLES);
    const fCol = new Float32Array(FOUNTAIN_PARTICLES * 3);

    for (let i = 0; i < FOUNTAIN_PARTICLES; i++) {
      const i3 = i * 3;
      fProg[i] = rand();
      fAng[i] = rand() * Math.PI * 2;
      fSpr[i] = 0.25 + rand() * 1.15;
      fSca[i] = 0.8 + rand() * 1.2;

      tmpColor.copy(cCore).lerp(rand() < 0.5 ? cPink : cMagenta, 0.35 + rand() * 0.55);
      fCol[i3] = tmpColor.r * 1.25;
      fCol[i3 + 1] = tmpColor.g * 1.25;
      fCol[i3 + 2] = tmpColor.b * 1.25;
    }

    const fountainGeo = new THREE.BufferGeometry();
    fountainGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
    fountainGeo.setAttribute('aProgress', new THREE.BufferAttribute(fProg, 1));
    fountainGeo.setAttribute('aAngle', new THREE.BufferAttribute(fAng, 1));
    fountainGeo.setAttribute('aSpread', new THREE.BufferAttribute(fSpr, 1));
    fountainGeo.setAttribute('aScale', new THREE.BufferAttribute(fSca, 1));
    fountainGeo.setAttribute('aColor', new THREE.BufferAttribute(fCol, 3));

    const fountainMat = new THREE.ShaderMaterial({
      vertexShader: FOUNTAIN_VERTEX_SHADER,
      fragmentShader: GALAXY_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
        uReducedMotion: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const accretionGeo = new THREE.PlaneGeometry(3.7, 3.7);
    const accretionMat = new THREE.ShaderMaterial({
      vertexShader: ACCRETION_VERTEX_SHADER,
      fragmentShader: ACCRETION_FRAGMENT_SHADER,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });

    const coreGeo = new THREE.SphereGeometry(0.62, 24, 24);
    const coreMat = new THREE.MeshBasicMaterial({ color: '#05020a' });

    return {
      galaxyGeo,
      galaxyMat,
      fountainGeo,
      fountainMat,
      accretionGeo,
      accretionMat,
      coreGeo,
      coreMat,
    };
  }, []);

  // Adaptive vertex count driven by PerformanceMonitor quality (4,000-5,600 desktop -> ~3,400 mobile low)
  useEffect(() => {
    const clamped = THREE.MathUtils.clamp(quality, 0.6, 1);
    resources.galaxyGeo.setDrawRange(0, Math.floor(GALAXY_PARTICLES * clamped));
    resources.fountainGeo.setDrawRange(0, Math.floor(FOUNTAIN_PARTICLES * clamped));
  }, [quality, resources]);

  // Strict GPU disposal on unmount
  useEffect(() => {
    return () => {
      resources.galaxyGeo.dispose();
      resources.galaxyMat.dispose();
      resources.fountainGeo.dispose();
      resources.fountainMat.dispose();
      resources.accretionGeo.dispose();
      resources.accretionMat.dispose();
      resources.coreGeo.dispose();
      resources.coreMat.dispose();
    };
  }, [resources]);

  useFrame((state, delta) => {
    const elapsed = state.clock.elapsedTime;
    const dpr = state.gl.getPixelRatio();
    const rm = reducedMotion ? 1 : 0;

    resources.galaxyMat.uniforms.uTime.value = elapsed;
    resources.galaxyMat.uniforms.uPixelRatio.value = dpr;
    resources.galaxyMat.uniforms.uReducedMotion.value = rm;

    resources.fountainMat.uniforms.uTime.value = elapsed;
    resources.fountainMat.uniforms.uPixelRatio.value = dpr;
    resources.fountainMat.uniforms.uReducedMotion.value = rm;

    resources.accretionMat.uniforms.uTime.value = elapsed * (1 - rm * 0.7);

    if (galaxyGroupRef.current && !reducedMotion) {
      galaxyGroupRef.current.rotation.y += Math.min(delta, 0.05) * 0.14;
    }
  });

  return (
    <group name="spiral-galaxy">
      <group ref={galaxyGroupRef}>
        <points
          geometry={resources.galaxyGeo}
          material={resources.galaxyMat}
          frustumCulled={false}
        />
      </group>

      {/* Central cosmic event-horizon sphere + luminous accretion disc */}
      <mesh geometry={resources.coreGeo} material={resources.coreMat} position={[0, 0.08, 0]} />
      <mesh
        geometry={resources.accretionGeo}
        material={resources.accretionMat}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 0]}
      />

      {/* Rising stardust vortex connecting accretion core to the floating 3D heart */}
      <points
        geometry={resources.fountainGeo}
        material={resources.fountainMat}
        frustumCulled={false}
      />
    </group>
  );
}
