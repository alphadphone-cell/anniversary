import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { galaxySignals } from '../../galaxySignals';
import { useAppStore } from '../../../store/useAppStore';
import { sfxEngine } from '../../../utils/sfxEngine';

interface ParticleHeartProps {
  interactive?: boolean;
  quality?: number;
  reducedMotion?: boolean;
}

const HEART_PARTICLES = 2200;
const SUPERNOVA_HOLD_SEC = 3.0;
const DRAG_CANCEL_PX_SQ = 14 * 14;

const HEART_VERTEX_SHADER = /* glsl */ `
  attribute float aScale;
  attribute float aPhase;
  attribute vec3 aColor;
  attribute vec3 aBurstDir;

  uniform float uTime;
  uniform float uPulse;
  uniform float uBass;
  uniform float uPixelRatio;
  uniform float uReducedMotion;
  uniform vec3 uPointerLocal;
  uniform float uPointerStrength;
  uniform float uSupernovaCharge;
  uniform float uSupernovaBurst;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float motion = 1.0 - uReducedMotion;

    // 1. Audio-reactive pulse + subtle charge compression inward before Supernova
    float chargePull = 1.0 - uSupernovaCharge * 0.24;
    float chargeTremor = sin(uTime * (22.0 + uSupernovaCharge * 34.0) + aPhase) * 0.06 * uSupernovaCharge * motion;
    float beatScale = 1.0 + uPulse * 0.04 + uBass * 0.085;

    vec3 pos = position * (beatScale * chargePull + chargeTremor);
    pos.x += sin(uTime * 1.4 * motion + aPhase) * 0.025 * motion;
    pos.y += cos(uTime * 1.2 * motion + aPhase) * 0.025 * motion;

    // 2. Supernova radial explosion & silky swirl reformation
    if (uSupernovaBurst > 0.001) {
      float blast = pow(uSupernovaBurst, 0.72);
      float curlAngle = blast * 2.8;
      float cs = cos(curlAngle);
      float sn = sin(curlAngle);
      vec3 dir = vec3(
        aBurstDir.x * cs - aBurstDir.z * sn,
        aBurstDir.y,
        aBurstDir.x * sn + aBurstDir.z * cs
      );
      pos += dir * (blast * 9.5);
    }

    // 3. GPU Cursor Gravity Pull & gentle swirl with elastic spring-back
    if (uPointerStrength > 0.005) {
      vec3 toPtr = uPointerLocal - pos;
      float dist = length(toPtr);
      float radius = 2.85;
      if (dist < radius && dist > 0.001) {
        float falloff = pow(1.0 - dist / radius, 2.0) * uPointerStrength;
        vec3 pullDir = toPtr / dist;
        vec3 swirl = normalize(vec3(-pullDir.z, 0.25, pullDir.x));
        pos += (pullDir * 0.58 + swirl * 0.34) * falloff;
      }
    }

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float sparkle = 0.72 + 0.28 * sin(uTime * (2.6 + uSupernovaCharge * 6.0) * motion + aPhase);
    float energyGlow = 0.94 + uPulse * 0.16 + uBass * 0.36 + uSupernovaCharge * 0.58 + uSupernovaBurst * 0.85;
    vColor = aColor * energyGlow;
    vAlpha = clamp(sparkle + uSupernovaCharge * 0.2, 0.0, 1.0);

    float atten = 30.0 / max(-mvPosition.z, 2.0);
    gl_PointSize = clamp(aScale * (1.0 + uBass * 0.16 + uSupernovaBurst * 0.35) * uPixelRatio * atten, 1.6, 17.0);
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

export function ParticleHeart({
  interactive = true,
  quality = 1,
  reducedMotion = false,
}: ParticleHeartProps) {
  const heartGroupRef = useRef<THREE.Group>(null);

  // Pre-allocated math objects (ZERO per-frame allocations)
  const invMatrixRef = useRef(new THREE.Matrix4());
  const localPointerRef = useRef(new THREE.Vector3());

  // Secret Supernova 3.0s hold tracking refs
  const isHoldingRef = useRef(false);
  const holdStartPosRef = useRef({ x: 0, y: 0 });
  const holdStartMsRef = useRef(0);
  const holdTimeRef = useRef(0);
  const heartbeatAccumRef = useRef(0);
  const burstValueRef = useRef(0);
  const flashTimerRef = useRef<number | null>(null);
  const modalTimerRef = useRef<number | null>(null);

  const { geometry, material, hitGeo, hitMat } = useMemo(() => {
    const rand = mulberry32(771120);

    const positions = new Float32Array(HEART_PARTICLES * 3);
    const colors = new Float32Array(HEART_PARTICLES * 3);
    const scales = new Float32Array(HEART_PARTICLES);
    const phases = new Float32Array(HEART_PARTICLES);
    const burstDirs = new Float32Array(HEART_PARTICLES * 3);

    const cWhite = new THREE.Color('#fff5fb');
    const cBlossom = new THREE.Color('#ff8ec9');
    const cRose = new THREE.Color('#ff3ea5');
    const cMagenta = new THREE.Color('#e879f9');
    const tmp = new THREE.Color();
    const dirVec = new THREE.Vector3();

    const scale = 0.165;

    for (let i = 0; i < HEART_PARTICLES; i++) {
      const i3 = i * 3;
      const t = rand() * Math.PI * 2;

      const hx = 16 * Math.pow(Math.sin(t), 3);
      const hy =
        13 * Math.cos(t) -
        5 * Math.cos(2 * t) -
        2 * Math.cos(3 * t) -
        Math.cos(4 * t);

      const isShell = rand() < 0.58;
      const radialFill = isShell ? 0.88 + rand() * 0.16 : Math.pow(rand(), 0.52) * 0.92;
      const edgeTaper = Math.sqrt(Math.max(0.02, 1.0 - radialFill * radialFill * 0.82));
      const zSign = rand() < 0.5 ? 1 : -1;
      const zDepth = (isShell ? 0.45 + rand() * 0.65 : rand()) * 7.8 * edgeTaper * zSign;

      const x = hx * radialFill * scale;
      const y = (hy * radialFill + 2.4) * scale;
      const z = zDepth * scale;

      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;

      // Deterministic radial burst vector for Secret Supernova explosion
      dirVec
        .set(x + (rand() - 0.5) * 0.8, y + (rand() - 0.5) * 0.8, z + (rand() - 0.5) * 1.4)
        .normalize()
        .multiplyScalar(0.55 + rand() * 1.15);
      burstDirs[i3] = dirVec.x;
      burstDirs[i3 + 1] = dirVec.y;
      burstDirs[i3 + 2] = dirVec.z;

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
    geo.setAttribute('aBurstDir', new THREE.BufferAttribute(burstDirs, 3));

    const mat = new THREE.ShaderMaterial({
      vertexShader: HEART_VERTEX_SHADER,
      fragmentShader: HEART_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uPulse: { value: 0 },
        uBass: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
        uReducedMotion: { value: 0 },
        uPointerLocal: { value: new THREE.Vector3(0, 100, 0) },
        uPointerStrength: { value: 0 },
        uSupernovaCharge: { value: 0 },
        uSupernovaBurst: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    // Invisible raycast hit-sphere over the heart center for Secret Supernova hold
    const sphereGeo = new THREE.SphereGeometry(2.55, 16, 16);
    const sphereMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    return { geometry: geo, material: mat, hitGeo: sphereGeo, hitMat: sphereMat };
  }, []);

  const cancelHold = useCallback(() => {
    isHoldingRef.current = false;
    galaxySignals.isHoldingHeart = false;
  }, []);

  // Cancel Supernova hold cleanly if the user drags the camera or releases early
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (!isHoldingRef.current) return;
      const dx = e.clientX - holdStartPosRef.current.x;
      const dy = e.clientY - holdStartPosRef.current.y;
      if (dx * dx + dy * dy > DRAG_CANCEL_PX_SQ) {
        cancelHold();
      }
    };

    const onPointerUp = () => {
      if (isHoldingRef.current) {
        cancelHold();
      }
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [cancelHold]);

  useEffect(() => {
    const clamped = THREE.MathUtils.clamp(quality, 0.6, 1);
    geometry.setDrawRange(0, Math.floor(HEART_PARTICLES * clamped));
  }, [quality, geometry]);

  useEffect(() => {
    return () => {
      cancelHold();
      geometry.dispose();
      material.dispose();
      hitGeo.dispose();
      hitMat.dispose();
      if (flashTimerRef.current !== null) window.clearTimeout(flashTimerRef.current);
      if (modalTimerRef.current !== null) window.clearTimeout(modalTimerRef.current);
      galaxySignals.supernovaCharge = 0;
      galaxySignals.supernovaBurst = 0;
      galaxySignals.isHoldingHeart = false;
    };
  }, [cancelHold, geometry, material, hitGeo, hitMat]);

  const handleHeartPointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!interactive) return;
      if (useAppStore.getState().activeModal !== null) return;
      if (burstValueRef.current > 0.12) return;

      // Do NOT stopPropagation so OrbitControls can still smoothly orbit if the user drags (>14px)
      sfxEngine.unlock();
      isHoldingRef.current = true;
      galaxySignals.isHoldingHeart = true;
      holdStartPosRef.current.x = event.nativeEvent.clientX;
      holdStartPosRef.current.y = event.nativeEvent.clientY;
      holdStartMsRef.current = performance.now();
      holdTimeRef.current = 0;
      heartbeatAccumRef.current = 0;
      sfxEngine.playHeartbeatPulse(0.15);
    },
    [interactive]
  );

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const elapsed = state.clock.elapsedTime;
    const dpr = state.gl.getPixelRatio();
    const rm = reducedMotion ? 1 : 0;

    // 1. Secret Supernova 3.0s real wall-clock hold progression & accelerating rhythmic heartbeat SFX
    if (isHoldingRef.current && interactive && useAppStore.getState().activeModal === null) {
      holdTimeRef.current = (performance.now() - holdStartMsRef.current) / 1000;
      const charge = THREE.MathUtils.clamp(holdTimeRef.current / SUPERNOVA_HOLD_SEC, 0, 1);
      galaxySignals.supernovaCharge = charge;

      // Accelerating heartbeat cadence: ~0.68s interval at 0% -> ~0.22s interval at 95%
      const beatInterval = THREE.MathUtils.lerp(0.68, 0.22, charge);
      heartbeatAccumRef.current += dt;
      if (heartbeatAccumRef.current >= beatInterval && charge < 0.99) {
        heartbeatAccumRef.current = 0;
        sfxEngine.playHeartbeatPulse(charge);
      }

      if (holdTimeRef.current >= SUPERNOVA_HOLD_SEC) {
        // Trigger Secret Supernova Burst!
        cancelHold();
        holdTimeRef.current = 0;
        galaxySignals.supernovaCharge = 0;
        burstValueRef.current = 1.0;
        galaxySignals.supernovaBurst = 1.0;

        sfxEngine.playSupernovaBurst();
        useAppStore.getState().setTransitionFlashing(true);

        if (flashTimerRef.current !== null) window.clearTimeout(flashTimerRef.current);
        flashTimerRef.current = window.setTimeout(() => {
          useAppStore.getState().setTransitionFlashing(false);
        }, 360);

        if (modalTimerRef.current !== null) window.clearTimeout(modalTimerRef.current);
        modalTimerRef.current = window.setTimeout(() => {
          useAppStore.getState().setActiveModal('secret');
        }, 560);
      }
    } else if (galaxySignals.supernovaCharge > 0.001) {
      galaxySignals.supernovaCharge = THREE.MathUtils.lerp(
        galaxySignals.supernovaCharge,
        0,
        Math.min(1, dt * 6)
      );
      holdTimeRef.current = galaxySignals.supernovaCharge * SUPERNOVA_HOLD_SEC;
    }

    // 2. Smoothly reform heart particles after Supernova burst
    if (burstValueRef.current > 0.001) {
      burstValueRef.current = Math.max(0, burstValueRef.current - dt * 0.42);
      galaxySignals.supernovaBurst = burstValueRef.current;
    } else {
      galaxySignals.supernovaBurst = 0;
    }

    // 3. Organic double-beat pulse + audio bass + supernova acceleration
    const beatSpeed = 0.9 + galaxySignals.supernovaCharge * 2.2;
    const beatCycle = (elapsed * beatSpeed) % 1;
    const pulse = reducedMotion
      ? 0
      : Math.exp(-Math.pow((beatCycle - 0.16) * 11, 2)) +
        0.55 * Math.exp(-Math.pow((beatCycle - 0.34) * 12, 2));

    // Transform world pointer into heart's local coordinates (zero allocations)
    if (heartGroupRef.current && galaxySignals.pointerStrength > 0.005) {
      invMatrixRef.current.copy(heartGroupRef.current.matrixWorld).invert();
      localPointerRef.current.copy(galaxySignals.pointerWorld).applyMatrix4(invMatrixRef.current);
      material.uniforms.uPointerLocal.value.copy(localPointerRef.current);
    }

    material.uniforms.uTime.value = elapsed;
    material.uniforms.uPulse.value = pulse;
    material.uniforms.uBass.value = galaxySignals.bassEnergy;
    material.uniforms.uPixelRatio.value = dpr;
    material.uniforms.uReducedMotion.value = rm;
    material.uniforms.uPointerStrength.value =
      quality < 0.65 || reducedMotion ? 0 : galaxySignals.pointerStrength;
    material.uniforms.uSupernovaCharge.value = galaxySignals.supernovaCharge;
    material.uniforms.uSupernovaBurst.value = galaxySignals.supernovaBurst;

    if (heartGroupRef.current && !reducedMotion) {
      const spinSpeed = 0.32 + galaxySignals.supernovaCharge * 1.45;
      heartGroupRef.current.rotation.y += dt * spinSpeed;
      heartGroupRef.current.position.y = 4.25 + Math.sin(elapsed * 1.15) * 0.18;
    }
  });

  return (
    <group ref={heartGroupRef} position={[0, 4.25, 0]} name="particle-heart">
      <points geometry={geometry} material={material} frustumCulled={false} />
      {/* Invisible raycast hit-sphere over heart center for 3.0s Secret Supernova Easter Egg */}
      <mesh
        geometry={hitGeo}
        material={hitMat}
        onPointerDown={handleHeartPointerDown}
        name="heart-supernova-trigger"
      />
    </group>
  );
}
