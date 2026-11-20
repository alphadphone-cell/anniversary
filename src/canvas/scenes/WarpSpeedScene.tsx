import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '../../store/useAppStore';
import { sfxEngine } from '../../utils/sfxEngine';

interface WarpSpeedSceneProps {
  quality?: number;
  reducedMotion?: boolean;
}

const STREAK_COUNT = 1400;
const SPARK_COUNT = 900;
const TUNNEL_DEPTH = 112;
const TUNNEL_Z_MIN = -98;
const WARP_DURATION = 2.55;
const FLASH_LEAD_TIME = 2.08;
const BASE_FOV = 45;
const PEAK_FOV = 75;

const STREAK_VERTEX_SHADER = /* glsl */ `
  attribute float aRadius;
  attribute float aAngle;
  attribute float aEnd;
  attribute float aLenScale;
  attribute vec3 aColor;

  uniform float uTravel;
  uniform float uTwist;
  uniform float uSpeed;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float zHead = mod(position.z + uTravel - (${TUNNEL_Z_MIN.toFixed(1)}), ${TUNNEL_DEPTH.toFixed(1)}) + (${TUNNEL_Z_MIN.toFixed(1)});
    float depthNorm = clamp((zHead - (${TUNNEL_Z_MIN.toFixed(1)})) / ${TUNNEL_DEPTH.toFixed(1)}, 0.0, 1.0);

    // Velocity-based Z-axis streak elongation (from crisp stars into sleek hyperspace light streaks)
    float streakLen = (0.55 + uSpeed * 11.5) * aLenScale * (0.45 + depthNorm * 0.85);
    float z = zHead - aEnd * streakLen;
    float segDepth = clamp((z - (${TUNNEL_Z_MIN.toFixed(1)})) / ${TUNNEL_DEPTH.toFixed(1)}, 0.0, 1.0);

    float spiralAngle = aAngle + (1.0 - segDepth) * 2.15 + uTwist;
    float radialExpand = aRadius * (0.24 + pow(segDepth, 1.15) * 1.42);

    vec3 transformed = vec3(
      cos(spiralAngle) * radialExpand,
      sin(spiralAngle) * radialExpand,
      z
    );

    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);

    float fadeIn = smoothstep(0.0, 0.14, depthNorm);
    float fadeOut = 1.0 - smoothstep(0.94, 1.0, depthNorm);
    float tailFade = mix(1.0, 0.04, aEnd);

    vAlpha = fadeIn * fadeOut * tailFade * (0.58 + 0.42 * uSpeed);
    vColor = aColor * (mix(1.38, 0.72, aEnd) * (0.85 + uSpeed * 0.45));
  }
`;

const STREAK_FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    gl_FragColor = vec4(vColor, vAlpha);
  }
`;

const SPARK_VERTEX_SHADER = /* glsl */ `
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
    float z = mod(position.z + uTravel - (${TUNNEL_Z_MIN.toFixed(1)}), ${TUNNEL_DEPTH.toFixed(1)}) + (${TUNNEL_Z_MIN.toFixed(1)});
    float depthNorm = clamp((z - (${TUNNEL_Z_MIN.toFixed(1)})) / ${TUNNEL_DEPTH.toFixed(1)}, 0.0, 1.0);

    float spiralAngle = aAngle + (1.0 - depthNorm) * 2.35 + uTwist;
    float radialExpand = aRadius * (0.26 + pow(depthNorm, 1.18) * 1.38);

    vec3 transformed = vec3(
      cos(spiralAngle) * radialExpand,
      sin(spiralAngle) * radialExpand,
      z
    );

    vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float fadeIn = smoothstep(0.0, 0.16, depthNorm);
    float fadeOut = 1.0 - smoothstep(0.92, 1.0, depthNorm);
    vAlpha = fadeIn * fadeOut * (0.65 + 0.35 * uSpeed);
    vColor = aColor * (0.9 + depthNorm * 0.45 + uSpeed * 0.25);

    float perspectiveScale = 58.0 / max(-mvPosition.z, 2.2);
    gl_PointSize = clamp(aScale * uPixelRatio * perspectiveScale, 2.0, 18.0);
  }
`;

const SPARK_FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float dist = length(uv);
    if (dist > 0.5) discard;

    float disc = smoothstep(0.5, 0.2, dist);
    float core = exp(-dist * dist * 12.0) * 0.6;
    gl_FragColor = vec4(vColor * (0.88 + core * 0.5), (disc * 0.8 + core) * vAlpha);
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
    float swirlA = sin(angle * 9.0 - r * 16.0 + uTime * 5.2) * 0.5 + 0.5;
    float swirlB = sin(angle * 15.0 - r * 22.0 + uTime * 7.4) * 0.5 + 0.5;
    float filaments = pow(swirlA * 0.6 + swirlB * 0.4, 2.3);

    float innerHole = smoothstep(0.16, 0.33, r);
    float outerFade = 1.0 - smoothstep(0.28, 0.96, r);
    float rim = exp(-pow((r - 0.3) * 8.0, 2.0));
    float centerSpark = exp(-r * r * 2200.0) * 2.0;

    vec3 colorPink = vec3(1.22, 0.22, 0.8);
    vec3 colorViolet = vec3(0.58, 0.24, 1.38);
    vec3 colorStar = vec3(1.55, 1.42, 1.8);

    vec3 vortexColor = mix(colorPink, colorViolet, smoothstep(0.24, 0.76, r));
    vortexColor = mix(vortexColor, colorStar, rim * 0.28);

    float glowMask = (rim * 0.68 + filaments * innerHole * 0.82) * outerFade * uIntensity;
    vec3 finalColor = vortexColor * glowMask + colorStar * centerSpark * uIntensity;
    float alpha = clamp(glowMask + centerSpark, 0.0, 0.96);

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
  const portalMeshRef = useRef<THREE.Mesh>(null);

  const resources = useMemo(() => {
    const rand = mulberry32(88421);
    const palette = [
      new THREE.Color('#ffffff'),
      new THREE.Color('#efe4ff'),
      new THREE.Color('#d8b4fe'),
      new THREE.Color('#ff5ab8'),
      new THREE.Color('#d946ef'),
    ];

    // 1. Velocity-stretched Z-axis hyperspace light streaks (2 vertices per streak)
    const vertexCount = STREAK_COUNT * 2;
    const sPos = new Float32Array(vertexCount * 3);
    const sCol = new Float32Array(vertexCount * 3);
    const sRad = new Float32Array(vertexCount);
    const sAng = new Float32Array(vertexCount);
    const sEnd = new Float32Array(vertexCount);
    const sLen = new Float32Array(vertexCount);

    const arms = 18;
    for (let i = 0; i < STREAK_COUNT; i++) {
      const arm = i % arms;
      const angle = (arm / arms) * Math.PI * 2 + (rand() - 0.5) * 0.22;
      const radius = 1.35 + Math.pow(rand(), 0.82) * 12.2;
      const z = TUNNEL_Z_MIN + rand() * TUNNEL_DEPTH;
      const lenScale = 0.65 + rand() * 1.15;

      const pick = rand();
      const base =
        pick < 0.45
          ? palette[0]
          : pick < 0.72
            ? palette[1]
            : pick < 0.85
              ? palette[2]
              : pick < 0.94
                ? palette[3]
                : palette[4];

      for (let end = 0; end < 2; end++) {
        const vIdx = i * 2 + end;
        const v3 = vIdx * 3;
        sPos[v3] = Math.cos(angle) * radius;
        sPos[v3 + 1] = Math.sin(angle) * radius;
        sPos[v3 + 2] = z;

        sRad[vIdx] = radius;
        sAng[vIdx] = angle;
        sEnd[vIdx] = end;
        sLen[vIdx] = lenScale;

        sCol[v3] = base.r;
        sCol[v3 + 1] = base.g;
        sCol[v3 + 2] = base.b;
      }
    }

    const streakGeo = new THREE.BufferGeometry();
    streakGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    streakGeo.setAttribute('aColor', new THREE.BufferAttribute(sCol, 3));
    streakGeo.setAttribute('aRadius', new THREE.BufferAttribute(sRad, 1));
    streakGeo.setAttribute('aAngle', new THREE.BufferAttribute(sAng, 1));
    streakGeo.setAttribute('aEnd', new THREE.BufferAttribute(sEnd, 1));
    streakGeo.setAttribute('aLenScale', new THREE.BufferAttribute(sLen, 1));

    const streakMat = new THREE.ShaderMaterial({
      vertexShader: STREAK_VERTEX_SHADER,
      fragmentShader: STREAK_FRAGMENT_SHADER,
      uniforms: {
        uTravel: { value: 0 },
        uTwist: { value: 0 },
        uSpeed: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    // 2. Bokeh star sparks framing the streaks
    const pPos = new Float32Array(SPARK_COUNT * 3);
    const pCol = new Float32Array(SPARK_COUNT * 3);
    const pSca = new Float32Array(SPARK_COUNT);
    const pRad = new Float32Array(SPARK_COUNT);
    const pAng = new Float32Array(SPARK_COUNT);

    for (let i = 0; i < SPARK_COUNT; i++) {
      const arm = i % arms;
      const angle = (arm / arms) * Math.PI * 2 + (rand() - 0.5) * 0.28;
      const radius = 1.5 + Math.pow(rand(), 0.85) * 11.4;
      const z = TUNNEL_Z_MIN + rand() * TUNNEL_DEPTH;

      const i3 = i * 3;
      pPos[i3] = Math.cos(angle) * radius;
      pPos[i3 + 1] = Math.sin(angle) * radius;
      pPos[i3 + 2] = z;

      pRad[i] = radius;
      pAng[i] = angle;
      pSca[i] = 0.9 + rand() * 1.6;

      const base = palette[Math.floor(rand() * palette.length)];
      pCol[i3] = base.r;
      pCol[i3 + 1] = base.g;
      pCol[i3 + 2] = base.b;
    }

    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    sparkGeo.setAttribute('aColor', new THREE.BufferAttribute(pCol, 3));
    sparkGeo.setAttribute('aScale', new THREE.BufferAttribute(pSca, 1));
    sparkGeo.setAttribute('aRadius', new THREE.BufferAttribute(pRad, 1));
    sparkGeo.setAttribute('aAngle', new THREE.BufferAttribute(pAng, 1));

    const sparkMat = new THREE.ShaderMaterial({
      vertexShader: SPARK_VERTEX_SHADER,
      fragmentShader: SPARK_FRAGMENT_SHADER,
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

    // 3. Central glowing pink/purple vortex portal
    const portalGeo = new THREE.PlaneGeometry(16, 16);
    const portalMat = new THREE.ShaderMaterial({
      vertexShader: PORTAL_VERTEX_SHADER,
      fragmentShader: PORTAL_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0.15 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return { streakGeo, streakMat, sparkGeo, sparkMat, portalGeo, portalMat };
  }, []);

  // Adaptive draw range without reallocating buffers
  useEffect(() => {
    const clamped = THREE.MathUtils.clamp(quality, 0.55, 1);
    const evenStreakVerts = Math.floor(STREAK_COUNT * clamped) * 2;
    resources.streakGeo.setDrawRange(0, evenStreakVerts);
    resources.sparkGeo.setDrawRange(0, Math.floor(SPARK_COUNT * clamped));
  }, [quality, resources]);

  // Center camera at Warp ignition + launch procedural warp whoosh SFX; dispose cleanly on exit
  useEffect(() => {
    elapsedRef.current = 0;
    travelRef.current = 0;
    flashTriggeredRef.current = false;
    finishedRef.current = false;

    camera.position.set(0, 0, 12.5);
    camera.rotation.set(0, 0, 0);
    camera.lookAt(0, 0, -26);

    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = BASE_FOV;
      camera.updateProjectionMatrix();
    }

    sfxEngine.playWarpWhoosh(WARP_DURATION);

    return () => {
      resources.streakGeo.dispose();
      resources.streakMat.dispose();
      resources.sparkGeo.dispose();
      resources.sparkMat.dispose();
      resources.portalGeo.dispose();
      resources.portalMat.dispose();

      if (camera instanceof THREE.PerspectiveCamera) {
        camera.fov = BASE_FOV;
        camera.updateProjectionMatrix();
      }
      camera.rotation.set(0, 0, 0);
    };
  }, [camera, resources]);

  useFrame((state, delta) => {
    if (finishedRef.current) return;

    const clampedDelta = Math.min(delta, 0.05);
    elapsedRef.current += clampedDelta;
    const t = elapsedRef.current;
    const progress = THREE.MathUtils.clamp(t / WARP_DURATION, 0, 1);

    const easedSpeed = Math.pow(progress, 1.45);
    const motionScale = reducedMotion ? 0.35 : 1;
    const velocity = (18 + easedSpeed * 124) * motionScale;

    travelRef.current += velocity * clampedDelta;

    const dpr = state.gl.getPixelRatio();
    const twist = t * (0.45 + easedSpeed * 1.1) * motionScale;

    resources.streakMat.uniforms.uTravel.value = travelRef.current;
    resources.streakMat.uniforms.uTwist.value = twist;
    resources.streakMat.uniforms.uSpeed.value = easedSpeed;

    resources.sparkMat.uniforms.uTravel.value = travelRef.current;
    resources.sparkMat.uniforms.uTwist.value = twist;
    resources.sparkMat.uniforms.uSpeed.value = easedSpeed;
    resources.sparkMat.uniforms.uPixelRatio.value = dpr;

    resources.portalMat.uniforms.uTime.value = t * motionScale;
    resources.portalMat.uniforms.uIntensity.value =
      THREE.MathUtils.smoothstep(progress, 0.0, 0.2) * (1.0 + easedSpeed * 0.55);

    if (portalMeshRef.current) {
      portalMeshRef.current.scale.setScalar(0.35 + THREE.MathUtils.smoothstep(progress, 0, 0.25) * 0.55 + easedSpeed * 0.65);
    }

    // Smoothly widen FOV from 45 -> 75 during hyperspace tunnel flight
    if (camera instanceof THREE.PerspectiveCamera) {
      const targetFov = reducedMotion
        ? BASE_FOV + easedSpeed * 10
        : THREE.MathUtils.lerp(BASE_FOV, PEAK_FOV, Math.pow(progress, 1.3));
      camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 0.16);
      camera.updateProjectionMatrix();
    }

    camera.position.z = THREE.MathUtils.lerp(12.5, 4.8, easedSpeed * motionScale);
    if (!reducedMotion) {
      camera.rotation.z = Math.sin(t * 2.1) * 0.03 * easedSpeed;
    }

    // Trigger pink/white warp peak flash right before cross-dissolving directly into pre-mounted Galaxy
    if (!flashTriggeredRef.current && t >= FLASH_LEAD_TIME) {
      flashTriggeredRef.current = true;
      useAppStore.getState().setTransitionFlashing(true);
    }

    if (t >= WARP_DURATION) {
      finishedRef.current = true;
      useAppStore.getState().setStage('galaxy');
      // Dissolve flash smoothly over the expanding pre-mounted LoveGalaxy
      window.setTimeout(() => {
        useAppStore.getState().setTransitionFlashing(false);
      }, 220);
    }
  });

  return (
    <group name="stage-warp">
      <lineSegments
        geometry={resources.streakGeo}
        material={resources.streakMat}
        frustumCulled={false}
      />
      <points
        geometry={resources.sparkGeo}
        material={resources.sparkMat}
        frustumCulled={false}
      />
      <mesh
        ref={portalMeshRef}
        position={[0, 0, -26]}
        geometry={resources.portalGeo}
        material={resources.portalMat}
      />
    </group>
  );
}
