import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { galaxySignals } from '../galaxySignals';

const MOTES_COUNT = 320;

const INTRO_MOTES_VERTEX = /* glsl */ `
  attribute float aRadius;
  attribute float aAngle;
  attribute float aHeight;
  attribute float aScale;
  attribute float aSpeed;
  attribute float aSeed;

  uniform float uTime;
  uniform float uCharge;
  uniform float uPixelRatio;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    // Gently spiral & pull faint starlight particles inward toward the center heart as Intro charge builds 0 -> 1
    float pull = pow(uCharge, 1.35);
    float swirl = uTime * aSpeed + pull * (2.4 + aSeed * 1.8);
    float r = mix(aRadius, 0.35 + aSeed * 1.15, pull * 0.86);
    float z = mix(aHeight, 0.0, pull * 0.78);

    vec3 pos = vec3(
      cos(aAngle + swirl) * r,
      sin(aAngle + swirl) * r * 0.72 + sin(uTime * 0.65 + aSeed * 6.2831) * 0.25 * (1.0 - pull * 0.6),
      z - 2.0 + pull * 2.4
    );

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPos;

    float twinkle = 0.55 + 0.45 * sin(uTime * (1.8 + aSeed * 2.5) + aSeed * 12.0);
    float innerFade = smoothstep(0.25, 1.4, r);
    vAlpha = (0.28 + pull * 0.58) * twinkle * innerFade;

    vec3 cPearl = vec3(1.15, 1.05, 1.25);
    vec3 cRose = vec3(1.48, 0.55, 1.05);
    vColor = mix(cPearl, cRose, clamp(aSeed * 0.65 + pull * 0.45, 0.0, 1.0));

    float atten = 28.0 / max(-mvPos.z, 2.5);
    gl_PointSize = clamp(aScale * (1.0 + pull * 0.65) * uPixelRatio * atten, 1.4, 12.0);
  }
`;

const INTRO_MOTES_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    if (vAlpha <= 0.004) discard;
    vec2 uv = gl_PointCoord - vec2(0.5);
    float d = length(uv);
    if (d > 0.5) discard;

    float core = exp(-d * d * 18.0);
    float halo = smoothstep(0.5, 0.08, d) * 0.45;
    gl_FragColor = vec4(vColor * (core * 1.2 + halo * 0.8), clamp((core + halo) * vAlpha, 0.0, 1.0));
  }
`;

/**
 * Stage 1 (Intro) atmospheric 3D starlight field that gently orbits and spirals inward
 * toward the center heart as the user holds to charge (100% GPU, zero per-frame allocations).
 */
export function IntroScene() {
  const chargeSmoothRef = useRef(0);

  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(MOTES_COUNT * 3);
    const radii = new Float32Array(MOTES_COUNT);
    const angles = new Float32Array(MOTES_COUNT);
    const heights = new Float32Array(MOTES_COUNT);
    const scales = new Float32Array(MOTES_COUNT);
    const speeds = new Float32Array(MOTES_COUNT);
    const seeds = new Float32Array(MOTES_COUNT);

    let s = 12302007;
    const rand = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };

    for (let i = 0; i < MOTES_COUNT; i++) {
      radii[i] = 2.6 + Math.pow(rand(), 0.7) * 9.5;
      angles[i] = rand() * Math.PI * 2;
      heights[i] = (rand() - 0.5) * 9.0;
      scales[i] = 0.75 + rand() * 1.35;
      speeds[i] = (0.04 + rand() * 0.09) * (rand() > 0.5 ? 1 : -1);
      seeds[i] = rand();
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aRadius', new THREE.BufferAttribute(radii, 1));
    geo.setAttribute('aAngle', new THREE.BufferAttribute(angles, 1));
    geo.setAttribute('aHeight', new THREE.BufferAttribute(heights, 1));
    geo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

    const mat = new THREE.ShaderMaterial({
      vertexShader: INTRO_MOTES_VERTEX,
      fragmentShader: INTRO_MOTES_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uCharge: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return { geometry: geo, material: mat };
  }, []);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
      galaxySignals.introCharge = 0;
    };
  }, [geometry, material]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    chargeSmoothRef.current = THREE.MathUtils.lerp(
      chargeSmoothRef.current,
      galaxySignals.introCharge,
      Math.min(1, dt * 8)
    );
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uCharge.value = chargeSmoothRef.current;
    material.uniforms.uPixelRatio.value = state.gl.getPixelRatio();
  });

  return (
    <group name="stage-intro">
      <points geometry={geometry} material={material} frustumCulled={false} />
    </group>
  );
}
