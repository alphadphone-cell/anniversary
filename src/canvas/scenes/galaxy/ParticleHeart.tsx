import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { galaxySignals } from '../../galaxySignals';
import { useAppStore } from '../../../store/useAppStore';
import { sfxEngine } from '../../../utils/sfxEngine';

interface ParticleHeartProps {
  active: boolean;
  interactive?: boolean;
  quality?: number;
  reducedMotion?: boolean;
}

const HEART_PARTICLES = 2200;
const HEART_BASE_Y = 4.25;
const MORPH_DURATION = 2.8;
const SUPERNOVA_HOLD_SEC = 3.0;
const DRAG_CANCEL_PX_SQ = 14 * 14;

const HEART_VERTEX_SHADER = /* glsl */ `
  attribute float aScale;
  attribute float aPhase;
  attribute vec3 aColor;
  attribute vec3 aBurstDir;
  attribute vec3 aOriginPos;
  attribute vec3 aScatterPos;
  attribute float aDelay;
  attribute float aRandom;

  uniform float uActive;
  uniform float uMorphTime;
  uniform float uTime;
  uniform float uPulse;
  uniform float uBass;
  uniform float uDim;
  uniform float uPixelRatio;
  uniform float uReducedMotion;
  uniform vec3 uPointerLocal;
  uniform float uPointerStrength;
  uniform float uSupernovaCharge;
  uniform float uSupernovaBurst;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vSparkBoost;

  void main() {
    // Keep pre-mounted shader compiled in VRAM but hidden before Stage 3 begins
    if (uActive < 0.5) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      vAlpha = 0.0;
      vColor = aColor;
      vSparkBoost = 0.0;
      return;
    }

    float motion = 1.0 - uReducedMotion;

    // Final idle target position (with audio-reactive beat & Supernova charge modulation)
    float handOff = smoothstep(2.42, 2.8, uMorphTime);
    float chargePull = 1.0 - uSupernovaCharge * 0.24 * handOff;
    float chargeTremor = sin(uTime * (22.0 + uSupernovaCharge * 34.0) + aPhase) * 0.06 * uSupernovaCharge * motion * handOff;
    float beatScale = 1.0 + (uPulse * 0.04 + uBass * 0.085) * handOff;

    vec3 targetPos = position * (beatScale * chargePull + chargeTremor);
    targetPos.x += sin(uTime * 1.4 * motion + aPhase) * 0.025 * motion * handOff;
    targetPos.y += cos(uTime * 1.2 * motion + aPhase) * 0.025 * motion * handOff;

    vec3 pos = targetPos;
    float sparkBoost = 0.0;
    float lockPulse = 0.0;

    if (uMorphTime < 2.85 && uReducedMotion < 0.5) {
      // Phase A (0.0s -> 0.8s): Explosive shooting-star burst from warp core to wide 3D scatter
      float tBurst = clamp(uMorphTime / 0.8, 0.0, 1.0);
      float easeBurst = 1.0 - pow(1.0 - tBurst, 3.2);
      float burstVel = pow(1.0 - tBurst, 1.8) * smoothstep(0.0, 0.08, tBurst);
      vec3 burstPos = mix(aOriginPos, aScatterPos, easeBurst);

      // Phase B (0.72s + aDelay -> 2.15s + aDelay <= 2.60s): Swirling quadratic Bezier coalescence
      float tStart = 0.72 + aDelay;
      float tEnd = 2.15 + aDelay;
      float u = clamp((uMorphTime - tStart) / max(0.01, tEnd - tStart), 0.0, 1.0);
      float s = u * u * (3.0 - 2.0 * u);

      // Quadratic Bezier arc with tangential Y-axis vortex curl
      vec3 ctrl = mix(aScatterPos, targetPos, 0.46) + vec3(
        -aScatterPos.z * 0.44,
        1.7 + aRandom * 2.1,
        aScatterPos.x * 0.44
      );
      vec3 p01 = mix(aScatterPos, ctrl, s);
      vec3 p12 = mix(ctrl, targetPos, s);
      vec3 coalPos = mix(p01, p12, s);

      // Organic spiral swirl around Y-axis mid-flight
      float swirlSign = aRandom > 0.5 ? 1.0 : -1.0;
      float swirlAngle = sin(s * 3.14159265) * (1.25 + aRandom * 0.95) * swirlSign;
      float ca = cos(swirlAngle);
      float sa = sin(swirlAngle);
      coalPos.xz = vec2(
        coalPos.x * ca - coalPos.z * sa,
        coalPos.x * sa + coalPos.z * ca
      );

      // Blend seamlessly from Phase A into Phase B as each particle's delay kicks in
      pos = uMorphTime < tStart ? burstPos : coalPos;

      // Velocity-based shooting-star sparkle boost during Phase A eruption & Phase B flight
      float flightVel = sin(s * 3.14159265) * step(tStart, uMorphTime) * step(uMorphTime, tEnd);
      sparkBoost = clamp(burstVel * 1.35 + flightVel * 0.85, 0.0, 1.4);

      // Phase C (~2.6s -> 2.8s): Soft luminous bloom lock-in pulse across the assembled heart
      lockPulse = exp(-pow((uMorphTime - 2.66) * 7.2, 2.0));
      pos *= (1.0 + lockPulse * 0.055);
    }

    // Supernova radial explosion & silky swirl reformation (post hand-off)
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

    // GPU Cursor Gravity Pull & gentle swirl with elastic spring-back (active once assembled)
    if (uPointerStrength > 0.005 && handOff > 0.5) {
      vec3 toPtr = uPointerLocal - pos;
      float dist = length(toPtr);
      float radius = 2.85;
      if (dist < radius && dist > 0.001) {
        float falloff = pow(1.0 - dist / radius, 2.0) * uPointerStrength * handOff;
        vec3 pullDir = toPtr / dist;
        vec3 swirl = normalize(vec3(-pullDir.z, 0.25, pullDir.x));
        pos += (pullDir * 0.58 + swirl * 0.34) * falloff;
      }
    }

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float sparkle = 0.72 + 0.28 * sin(uTime * (2.6 + uSupernovaCharge * 6.0) * motion + aPhase);
    float dimMul = 1.0 - uDim * 0.72;
    float energyGlow =
      (0.94 + uPulse * 0.16 + uBass * 0.36 + uSupernovaCharge * 0.58 + uSupernovaBurst * 0.85 + lockPulse * 0.78) *
      dimMul;

    // White-pink shooting-star sparkle boost during high-velocity scatter & swirl
    vec3 starHighlight = vec3(1.85, 1.48, 1.82);
    vColor = mix(aColor * energyGlow, starHighlight * (1.0 + sparkBoost * 0.35), clamp(sparkBoost * 0.62, 0.0, 0.78));
    vAlpha = clamp(sparkle + sparkBoost * 0.35 + lockPulse * 0.28 + uSupernovaCharge * 0.2, 0.0, 1.0) * (1.0 - uDim * 0.45);
    vSparkBoost = sparkBoost;

    float sizeBoost = 1.0 + uBass * 0.16 + sparkBoost * 0.52 + lockPulse * 0.28 + uSupernovaBurst * 0.35;
    float atten = 30.0 / max(-mvPosition.z, 2.0);
    gl_PointSize = clamp(aScale * sizeBoost * uPixelRatio * atten, 1.6, 20.0);
  }
`;

const HEART_FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vSparkBoost;

  void main() {
    if (vAlpha <= 0.004) discard;
    vec2 uv = gl_PointCoord - vec2(0.5);

    // Subtle comet-like diamond sparkle flare while particles streak at high velocity
    float dist = length(uv);
    if (dist > 0.5) discard;

    float core = exp(-dist * dist * 18.0);
    float halo = smoothstep(0.5, 0.08, dist) * 0.52;
    float starCross = max(
      exp(-abs(uv.x) * 28.0) * exp(-abs(uv.y) * 6.5),
      exp(-abs(uv.y) * 28.0) * exp(-abs(uv.x) * 6.5)
    ) * vSparkBoost * 0.65;

    float alpha = clamp((core + halo + starCross) * vAlpha, 0.0, 1.0);
    gl_FragColor = vec4(vColor * (core * 1.25 + halo * 0.8 + starCross), alpha);
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
  active,
  interactive = true,
  quality = 1,
  reducedMotion = false,
}: ParticleHeartProps) {
  const heartGroupRef = useRef<THREE.Group>(null);

  // Pre-allocated math objects (ZERO per-frame allocations)
  const invMatrixRef = useRef(new THREE.Matrix4());
  const localPointerRef = useRef(new THREE.Vector3());

  // 3-phase morph timeline ref
  const morphTimeRef = useRef(0);
  const morphStartedRef = useRef(false);

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
    const origins = new Float32Array(HEART_PARTICLES * 3);
    const scatters = new Float32Array(HEART_PARTICLES * 3);
    const delays = new Float32Array(HEART_PARTICLES);
    const randoms = new Float32Array(HEART_PARTICLES);
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

      // 1. Final 3D Parametric Heart coordinates (targetPos)
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

      // 2. originPos: tightly clustered at world warp portal core (0, 0, 0) -> local (0, -HEART_BASE_Y, 0)
      origins[i3] = (rand() - 0.5) * 0.45;
      origins[i3 + 1] = -HEART_BASE_Y + (rand() - 0.5) * 0.45;
      origins[i3 + 2] = (rand() - 0.5) * 0.45;

      // 3. scatterPos: wide asymmetrical 3D spherical burst (radius 6..14, slightly wider horizontally)
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      const radius = 6.0 + Math.pow(rand(), 0.72) * 8.0;
      const asymX = 1.24 + (rand() - 0.5) * 0.28;
      const asymY = 0.78 + (rand() - 0.5) * 0.24;
      const asymZ = 1.08 + (rand() - 0.5) * 0.24;

      scatters[i3] = Math.sin(phi) * Math.cos(theta) * radius * asymX;
      scatters[i3 + 1] = Math.cos(phi) * radius * asymY - 0.6;
      scatters[i3 + 2] = Math.sin(phi) * Math.sin(theta) * radius * asymZ;

      // 4. Per-particle stagger delay (0.0 -> 0.45s) & swirl randomness
      delays[i] = rand() * 0.45;
      randoms[i] = rand();

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
    geo.setAttribute('aOriginPos', new THREE.BufferAttribute(origins, 3));
    geo.setAttribute('aScatterPos', new THREE.BufferAttribute(scatters, 3));
    geo.setAttribute('aDelay', new THREE.BufferAttribute(delays, 1));
    geo.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aBurstDir', new THREE.BufferAttribute(burstDirs, 3));

    const mat = new THREE.ShaderMaterial({
      vertexShader: HEART_VERTEX_SHADER,
      fragmentShader: HEART_FRAGMENT_SHADER,
      uniforms: {
        uActive: { value: 0 },
        uMorphTime: { value: 0 },
        uTime: { value: 0 },
        uPulse: { value: 0 },
        uBass: { value: 0 },
        uDim: { value: 0 },
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

    const sphereGeo = new THREE.SphereGeometry(2.55, 16, 16);
    const sphereMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    return { geometry: geo, material: mat, hitGeo: sphereGeo, hitMat: sphereMat };
  }, []);

  // Trigger 3-phase morph + synced SFX the exact frame Stage 3 starts
  useEffect(() => {
    if (!active) {
      morphStartedRef.current = false;
      morphTimeRef.current = 0;
      material.uniforms.uActive.value = 0;
      material.uniforms.uMorphTime.value = 0;
      return;
    }

    material.uniforms.uActive.value = 1;
    if (!morphStartedRef.current) {
      morphStartedRef.current = true;
      morphTimeRef.current = reducedMotion ? MORPH_DURATION + 0.2 : 0;
      material.uniforms.uMorphTime.value = morphTimeRef.current;

      if (!reducedMotion) {
        sfxEngine.playHeartCoalescenceSequence();
      }
    }
  }, [active, reducedMotion, material]);

  const cancelHold = useCallback(() => {
    isHoldingRef.current = false;
    galaxySignals.isHoldingHeart = false;
  }, []);

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
      sfxEngine.stopHeartCoalescence();
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
      if (!interactive || !active) return;
      if (morphTimeRef.current < 2.65) return; // Wait for heart lock-in before enabling Supernova hold
      if (useAppStore.getState().activeModal !== null) return;
      if (useAppStore.getState().viewMode !== 'galaxy') return;
      if (burstValueRef.current > 0.12) return;

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
    [interactive, active]
  );

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const elapsed = state.clock.elapsedTime;
    const dpr = state.gl.getPixelRatio();
    const rm = reducedMotion ? 1 : 0;

    // 0. Advance 3-phase Shooting Star Scatter -> Coalescence -> Lock-In timeline
    if (active) {
      if (reducedMotion) {
        morphTimeRef.current = MORPH_DURATION + 0.2;
      } else if (morphTimeRef.current < MORPH_DURATION + 0.25) {
        morphTimeRef.current += dt;
      }
      material.uniforms.uActive.value = 1;
      material.uniforms.uMorphTime.value = morphTimeRef.current;
    } else {
      material.uniforms.uActive.value = 0;
      return;
    }

    // 1. Secret Supernova 3.0s real wall-clock hold progression & accelerating rhythmic heartbeat SFX
    if (isHoldingRef.current && interactive && useAppStore.getState().activeModal === null) {
      holdTimeRef.current = (performance.now() - holdStartMsRef.current) / 1000;
      const charge = THREE.MathUtils.clamp(holdTimeRef.current / SUPERNOVA_HOLD_SEC, 0, 1);
      galaxySignals.supernovaCharge = charge;

      const beatInterval = THREE.MathUtils.lerp(0.68, 0.22, charge);
      heartbeatAccumRef.current += dt;
      if (heartbeatAccumRef.current >= beatInterval && charge < 0.99) {
        heartbeatAccumRef.current = 0;
        sfxEngine.playHeartbeatPulse(charge);
      }

      if (holdTimeRef.current >= SUPERNOVA_HOLD_SEC) {
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
    material.uniforms.uDim.value = galaxySignals.galaxyDim;
    material.uniforms.uPixelRatio.value = dpr;
    material.uniforms.uReducedMotion.value = rm;
    material.uniforms.uPointerStrength.value =
      quality < 0.65 || reducedMotion ? 0 : galaxySignals.pointerStrength;
    material.uniforms.uSupernovaCharge.value = galaxySignals.supernovaCharge;
    material.uniforms.uSupernovaBurst.value = galaxySignals.supernovaBurst;

    // Gentle idle rotation & float fade in seamlessly as heart completes Phase C lock-in
    if (heartGroupRef.current && !reducedMotion) {
      const idleWeight = THREE.MathUtils.smoothstep(morphTimeRef.current, 2.25, 2.8);
      const spinSpeed = (0.32 + galaxySignals.supernovaCharge * 1.45) * idleWeight;
      heartGroupRef.current.rotation.y += dt * spinSpeed;
      heartGroupRef.current.position.y = HEART_BASE_Y + Math.sin(elapsed * 1.15) * 0.18 * idleWeight;
    }
  });

  // Container stays permanently at scale 1.0 — individual GPU particles drive the entire reveal
  return (
    <group ref={heartGroupRef} position={[0, HEART_BASE_Y, 0]} scale={1} name="particle-heart">
      <points geometry={geometry} material={material} frustumCulled={false} />
      <mesh
        geometry={hitGeo}
        material={hitMat}
        onPointerDown={handleHeartPointerDown}
        name="heart-supernova-trigger"
      />
    </group>
  );
}
