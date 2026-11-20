import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '../../store/useAppStore';

interface WarpSpeedSceneProps {
  quality?: number;
  reducedMotion?: boolean;
}

const TUNNEL_PARTICLES = 3000;
const TUNNEL_DEPTH = 108;
const TUNNEL_Z_MIN = -94;
const WARP_DURATION = 2.55; // seconds
const FLASH_LEAD_TIME = 2.12;
const BASE_FOV = 46;
const PEAK_FOV = 80;

const TUNNEL_VERTEX_SHADER = /* glsl */ `
  attribute float aScale;
  attribute float aRadius;
  attribute float aAngle;
  attribute vec3 aColor;

  uniform float uTravel;
  uniform float uTwist;
  uniform float uSpeed;
  uniform float uPixelRatio;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    // Wrap particles endlessly forward along +Z toward camera
    float z = mod(position.z + uTravel - (${TUNNEL_Z_MIN.toFixed(1)}), ${TUNNEL_DEPTH.toFixed(1)}) + (${TUNNEL_Z_MIN.toFixed(1)});

    // Depth factor: 0 deep inside portal, 1 rushing past camera
    float depthNorm = clamp((z - (${TUNNEL_Z_MIN.toFixed(1)})) / ${TUNNEL_DEPTH.toFixed(1)}, 0.0, 1.0);

    // Spiraling radial arms curving outward from central vortex
    float spiralAngle = aAngle + (1.0 - depthNorm) * 2.45 + uTwist;
    float radialExpand = aRadius * (0.28 + pow(depthNorm, 1.18) * 1.38);

    vec3 transformed = vec3(
      cos(spiralAngle) * radialExpand,
      sin(spiralAngle) * radialExpand,
      z
    );

    vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float fadeIn = smoothstep(0.0, 0.16, depthNorm);
    float fadeOut = 1.0 - smoothstep(0.93, 1.0, depthNorm);
    vAlpha = fadeIn * fadeOut * (0.68 + 0.32 * uSpeed);

    // Subtle HDR lift on foreground stars for clean selective bloom
    vColor = aColor * (0.78 + depthNorm * 0.52 + uSpeed * 0.25);

    float perspectiveScale = 64.0 / max(-mvPosition.z, 2.2);
    gl_PointSize = clamp(aScale * uPixelRatio * perspectiveScale * (0.85 + 0.45 * uSpeed), 2.4, 24.0);
  }
`;

const TUNNEL_FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float dist = length(uv);
    if (dist > 0.5) discard;

    // Crisp luminous bokeh star disc with soft feathered rim
    float disc = smoothstep(0.5, 0.22, dist);
    float core = exp(-dist * dist * 10.0) * 0.55;
    float alpha = (disc * 0.85 + core) * vAlpha;

    gl_FragColor = vec4(vColor * (0.85 + core * 0.65), alpha);
  }
`;

const PORTAL_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const PORTAL_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  varying vec2 vUv;

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);
    if (r > 1.0) discard;

    float angle = atan(p.y, p.x);

    // Delicate swirling multi-arm magenta/violet plasma vortex streaks
    float swirlA = sin(angle * 9.0 - r * 16.0 + uTime * 5.0) * 0.5 + 0.5;
    float swirlB = sin(angle * 15.0 - r * 22.0 + uTime * 7.2) * 0.5 + 0.5;
    float filaments = pow(swirlA * 0.6 + swirlB * 0.4, 2.4);

    // Deep obsidian event-horizon center ringed by rich pink/purple vortex rays
    float innerHole = smoothstep(0.18, 0.34, r);
    float outerFade = 1.0 - smoothstep(0.28, 0.96, r);
    float rim = exp(-pow((r - 0.31) * 8.5, 2.0));

    // Razor-sharp tiny white center star inside the dark portal eye
    float centerSpark = exp(-r * r * 2400.0) * 1.9;

    vec3 colorPink = vec3(1.18, 0.2, 0.78);
    vec3 colorViolet = vec3(0.56, 0.22, 1.32);
    vec3 colorStar = vec3(1.5, 1.38, 1.75);

    vec3 vortexColor = mix(colorPink, colorViolet, smoothstep(0.25, 0.76, r));
    vortexColor = mix(vortexColor, colorStar, rim * 0.24);

    float glowMask = (rim * 0.62 + filaments * innerHole * 0.78) * outerFade * uIntensity;
    vec3 finalColor = vortexColor * glowMask + colorStar * centerSpark * uIntensity;
    float alpha = clamp(glowMask + centerSpark, 0.0, 0.95);

    gl_FragColor = vec4(finalColor, alpha);
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

export function WarpSpeedScene({ quality = 1, reducedMotion = false }: WarpSpeedSceneProps) {
  const { camera } = useThree();
  const elapsedRef = useRef(0);
  const travelRef = useRef(0);
  const flashTriggeredRef = useRef(false);
  const finishedRef = useRef(false);
  const flashClearTimerRef = useRef<number | null>(null);
  const portalMeshRef = useRef<THREE.Mesh>(null);

  const { tunnelGeometry, tunnelMaterial, portalGeometry, portalMaterial } = useMemo(() => {
    const rand = mulberry32(88421);

    const positions = new Float32Array(TUNNEL_PARTICLES * 3);
    const colors = new Float32Array(TUNNEL_PARTICLES * 3);
    const scales = new Float32Array(TUNNEL_PARTICLES);
    const radii = new Float32Array(TUNNEL_PARTICLES);
    const angles = new Float32Array(TUNNEL_PARTICLES);

    const palette = [
      new THREE.Color('#ffffff'), // crisp starlight white
      new THREE.Color('#efe4ff'), // bright lavender white
      new THREE.Color('#d8b4fe'), // soft astral violet
      new THREE.Color('#f472b6'), // luminous rose pink
      new THREE.Color('#d946ef'), // neon magenta
    ];

    const armCount = 18;

    for (let i = 0; i < TUNNEL_PARTICLES; i++) {
      const arm = i % armCount;
      const baseArmAngle = (arm / armCount) * Math.PI * 2;
      const jitter = (rand() - 0.5) * 0.19;
      const angle = baseArmAngle + jitter;

      // Dense funnel streams framing the dark portal eye out to viewport edges
      const radius = 1.45 + Math.pow(rand(), 0.85) * 11.6;
      const z = TUNNEL_Z_MIN + rand() * TUNNEL_DEPTH;

      const i3 = i * 3;
      positions[i3] = Math.cos(angle) * radius;
      positions[i3 + 1] = Math.sin(angle) * radius;
      positions[i3 + 2] = z;

      radii[i] = radius;
      angles[i] = angle;

      const pick = rand();
      const base =
        pick < 0.5
          ? palette[0]
          : pick < 0.76
            ? palette[1]
            : pick < 0.88
              ? palette[2]
              : pick < 0.95
                ? palette[3]
                : palette[4];

      const boost = pick > 0.84 ? 1.28 : 0.96;
      colors[i3] = base.r * boost;
      colors[i3 + 1] = base.g * boost;
      colors[i3 + 2] = base.b * boost;

      scales[i] = 1.05 + rand() * 1.95;
    }

    const tGeo = new THREE.BufferGeometry();
    tGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    tGeo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    tGeo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    tGeo.setAttribute('aRadius', new THREE.BufferAttribute(radii, 1));
    tGeo.setAttribute('aAngle', new THREE.BufferAttribute(angles, 1));

    const tMat = new THREE.ShaderMaterial({
      vertexShader: TUNNEL_VERTEX_SHADER,
      fragmentShader: TUNNEL_FRAGMENT_SHADER,
      uniforms: {
        uTravel: { value: 0 },
        uTwist: { value: 0 },
        uSpeed: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const pGeo = new THREE.PlaneGeometry(16, 16);
    const pMat = new THREE.ShaderMaterial({
      vertexShader: PORTAL_VERTEX_SHADER,
      fragmentShader: PORTAL_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0.2 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return {
      tunnelGeometry: tGeo,
      tunnelMaterial: tMat,
      portalGeometry: pGeo,
      portalMaterial: pMat,
    };
  }, []);

  // Scale vertex count cleanly with PerformanceMonitor quality without reallocating
  useEffect(() => {
    const clamped = THREE.MathUtils.clamp(quality, 0.55, 1);
    tunnelGeometry.setDrawRange(0, Math.floor(TUNNEL_PARTICLES * clamped));
  }, [quality, tunnelGeometry]);

  // Center camera cleanly at Warp entry & restore cleanly + dispose GPU resources on exit
  useEffect(() => {
    elapsedRef.current = 0;
    travelRef.current = 0;
    flashTriggeredRef.current = false;
    finishedRef.current = false;

    camera.position.set(0, 0, 12);
    camera.rotation.set(0, 0, 0);
    camera.lookAt(0, 0, -26);

    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = BASE_FOV;
      camera.updateProjectionMatrix();
    }

    return () => {
      tunnelGeometry.dispose();
      tunnelMaterial.dispose();
      portalGeometry.dispose();
      portalMaterial.dispose();

      if (flashClearTimerRef.current !== null) {
        window.clearTimeout(flashClearTimerRef.current);
      }

      if (camera instanceof THREE.PerspectiveCamera) {
        camera.fov = BASE_FOV;
        camera.updateProjectionMatrix();
      }
      camera.position.set(0, 0.8, 13);
      camera.rotation.set(0, 0, 0);
      camera.lookAt(0, 0, 0);
    };
  }, [camera, tunnelGeometry, tunnelMaterial, portalGeometry, portalMaterial]);

  useFrame((state, delta) => {
    if (finishedRef.current) return;

    const clampedDelta = Math.min(delta, 0.05);
    elapsedRef.current += clampedDelta;
    const t = elapsedRef.current;
    const progress = THREE.MathUtils.clamp(t / WARP_DURATION, 0, 1);

    // Smooth acceleration curve: rapid ignition -> sustained hyperspace rush
    const easedSpeed = Math.pow(progress, 1.55);
    const motionScale = reducedMotion ? 0.35 : 1;
    const velocity = (16 + easedSpeed * 114) * motionScale;

    travelRef.current += velocity * clampedDelta;

    const dpr = state.gl.getPixelRatio();
    tunnelMaterial.uniforms.uTravel.value = travelRef.current;
    tunnelMaterial.uniforms.uTwist.value = t * (0.48 + easedSpeed * 1.1) * motionScale;
    tunnelMaterial.uniforms.uSpeed.value = easedSpeed;
    tunnelMaterial.uniforms.uPixelRatio.value = dpr;

    portalMaterial.uniforms.uTime.value = t * motionScale;
    portalMaterial.uniforms.uIntensity.value =
      THREE.MathUtils.smoothstep(progress, 0.0, 0.22) * (0.95 + easedSpeed * 0.45);

    if (portalMeshRef.current) {
      const portalScale = 0.85 + easedSpeed * 0.55;
      portalMeshRef.current.scale.setScalar(portalScale);
    }

    // Smooth camera FOV expansion and subtle forward glide
    if (camera instanceof THREE.PerspectiveCamera) {
      const targetFov = reducedMotion
        ? BASE_FOV + easedSpeed * 10
        : THREE.MathUtils.lerp(BASE_FOV, PEAK_FOV, Math.pow(progress, 1.35));
      camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 0.16);
      camera.updateProjectionMatrix();
    }

    camera.position.z = THREE.MathUtils.lerp(12, 5.5, easedSpeed * motionScale);
    if (!reducedMotion) {
      camera.rotation.z = Math.sin(t * 2.1) * 0.032 * easedSpeed;
    }

    // Trigger soft rose-starlight flash right before switching into Galaxy
    if (!flashTriggeredRef.current && t >= FLASH_LEAD_TIME) {
      flashTriggeredRef.current = true;
      useAppStore.getState().setTransitionFlashing(true);
    }

    if (t >= WARP_DURATION) {
      finishedRef.current = true;
      const store = useAppStore.getState();
      store.setStage('galaxy');
      // Let flash dissolve smoothly over the newly mounted Galaxy stage
      window.setTimeout(() => {
        useAppStore.getState().setTransitionFlashing(false);
      }, 260);
    }
  });

  return (
    <group name="stage-warp">
      <points
        geometry={tunnelGeometry}
        material={tunnelMaterial}
        frustumCulled={false}
      />
      <mesh
        ref={portalMeshRef}
        position={[0, 0, -26]}
        geometry={portalGeometry}
        material={portalMaterial}
      />
    </group>
  );
}
