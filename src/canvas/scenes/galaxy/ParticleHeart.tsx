import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
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
const ENERGY_RAY_COUNT = 44;
const HEART_BASE_Y = 4.25;
const MORPH_DURATION = 2.8;

// 3-Beat Secret Supernova Timing
const IMPLOSION_END_SEC = 2.85; // Beat 1: isotropic implosion + converging beams
const FREEZE_END_SEC = 3.0; // Beat 1b: 150ms razor-sharp breath-hold vacuum freeze
const MODAL_DELAY_MS = 1320; // Beat 3: wait ~1.3s after detonation so full shockwave plays uninterrupted
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
  uniform float uSupernovaFreeze;
  uniform float uDetonateTime;
  uniform float uReformFactor;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vSparkBoost;

  void main() {
    if (uActive < 0.5) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      vAlpha = 0.0;
      vColor = aColor;
      vSparkBoost = 0.0;
      return;
    }

    float motion = 1.0 - uReducedMotion;
    vec3 heartCenter = vec3(0.0, 0.28, 0.0);

    // Base idle target position (audio-reactive breathing)
    float handOff = smoothstep(2.42, 2.8, uMorphTime);
    float beatScale = 1.0 + (uPulse * 0.04 + uBass * 0.085) * handOff;
    vec3 targetPos = position * beatScale;
    targetPos.x += sin(uTime * 1.4 * motion + aPhase) * 0.025 * motion * handOff;
    targetPos.y += cos(uTime * 1.2 * motion + aPhase) * 0.025 * motion * handOff;

    vec3 pos = targetPos;
    float sparkBoost = 0.0;
    float lockPulse = 0.0;

    // Initial Warp -> Galaxy 3-Phase Shooting Star Coalescence
    if (uMorphTime < 2.85 && uReducedMotion < 0.5) {
      float tBurst = clamp(uMorphTime / 0.8, 0.0, 1.0);
      float easeBurst = 1.0 - pow(1.0 - tBurst, 3.2);
      float burstVel = pow(1.0 - tBurst, 1.8) * smoothstep(0.0, 0.08, tBurst);
      vec3 burstPos = mix(aOriginPos, aScatterPos, easeBurst);

      float tStart = 0.72 + aDelay;
      float tEnd = 2.15 + aDelay;
      float u = clamp((uMorphTime - tStart) / max(0.01, tEnd - tStart), 0.0, 1.0);
      float s = u * u * (3.0 - 2.0 * u);

      vec3 ctrl = mix(aScatterPos, targetPos, 0.46) + vec3(
        -aScatterPos.z * 0.44,
        1.7 + aRandom * 2.1,
        aScatterPos.x * 0.44
      );
      vec3 p01 = mix(aScatterPos, ctrl, s);
      vec3 p12 = mix(ctrl, targetPos, s);
      vec3 coalPos = mix(p01, p12, s);

      float swirlSign = aRandom > 0.5 ? 1.0 : -1.0;
      float swirlAngle = sin(s * 3.14159265) * (1.25 + aRandom * 0.95) * swirlSign;
      float ca = cos(swirlAngle);
      float sa = sin(swirlAngle);
      coalPos.xz = vec2(
        coalPos.x * ca - coalPos.z * sa,
        coalPos.x * sa + coalPos.z * ca
      );

      pos = uMorphTime < tStart ? burstPos : coalPos;

      float flightVel = sin(s * 3.14159265) * step(tStart, uMorphTime) * step(uMorphTime, tEnd);
      sparkBoost = clamp(burstVel * 1.35 + flightVel * 0.85, 0.0, 1.4);

      lockPulse = exp(-pow((uMorphTime - 2.66) * 7.2, 2.0));
      pos *= (1.0 + lockPulse * 0.055);
    }

    // BEAT 1 & 1b: Uniform 3D Isotropic Singularity Implosion (zero horizontal squishing!)
    float singularityGlow = 0.0;
    if ((uSupernovaCharge > 0.001 || uSupernovaFreeze > 0.001) && uDetonateTime < 0.0) {
      float c = clamp(max(uSupernovaCharge, uSupernovaFreeze), 0.0, 1.0);
      vec3 offset = pos - heartCenter;

      // Uniform isotropic contraction on X, Y, Z toward exact heart center
      float isoScale = mix(1.0, 0.035, pow(c, 1.75));
      if (uSupernovaFreeze > 0.01) {
        isoScale = mix(isoScale, 0.018, uSupernovaFreeze);
      }

      // Tight 3D vortex twist around Y while pulling smoothly inward
      float twistAngle = pow(c, 1.55) * 4.6 * (0.7 + aRandom * 0.6);
      float ct = cos(twistAngle);
      float st = sin(twistAngle);
      vec3 twisted = vec3(
        offset.x * ct - offset.z * st,
        offset.y,
        offset.x * st + offset.z * ct
      );

      // Subtle high-energy vibration right before freeze
      float tremorAmp = c * (1.0 - uSupernovaFreeze) * 0.035 * motion;
      vec3 tremor = vec3(
        sin(uTime * 42.0 + aPhase),
        cos(uTime * 39.0 + aPhase * 1.3),
        sin(uTime * 45.0 + aPhase * 0.7)
      ) * tremorAmp;

      pos = heartCenter + twisted * isoScale + tremor;
      singularityGlow = pow(c, 1.35) * 1.4 + uSupernovaFreeze * 0.9;
    }

    // BEAT 2 & 3: 360° Explosive Detonation with Exponential Air-Drag -> Glittering Shower -> Reformation
    float detGlow = 0.0;
    if (uDetonateTime >= 0.0) {
      // Fast violent burst slowing smoothly via exponential air-drag (1 - e^-kt)
      float dragExpand = 1.0 - exp(-uDetonateTime * 4.2);
      float burstRadius = (8.5 + aRandom * 7.2) * dragExpand;

      // Subtle glittering drift while suspended in the aftermath shower
      vec3 drift = vec3(
        sin(uTime * 1.6 + aPhase) * 0.35,
        -0.14 * min(uDetonateTime, 3.0) + cos(uTime * 1.3 + aPhase) * 0.25,
        cos(uTime * 1.5 + aPhase) * 0.35
      ) * dragExpand;

      vec3 explodedPos = heartCenter + aBurstDir * burstRadius + drift;

      // Smoothly reform back into the heart when uReformFactor sweeps 0 -> 1
      float rf = uReformFactor * uReformFactor * (3.0 - 2.0 * uReformFactor);
      pos = mix(explodedPos, targetPos, rf);

      float initFlash = exp(-uDetonateTime * 2.8);
      detGlow = (initFlash * 1.7 + (1.0 - rf) * 0.45);
      sparkBoost = max(sparkBoost, initFlash * 1.35);
    }

    // GPU Cursor Gravity Pull (active during idle heart state)
    if (uPointerStrength > 0.005 && handOff > 0.5 && uSupernovaCharge < 0.05 && uDetonateTime < 0.0) {
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
      (0.94 + uPulse * 0.16 + uBass * 0.36 + lockPulse * 0.78 + singularityGlow + detGlow) * dimMul;

    vec3 starHighlight = vec3(1.92, 1.55, 1.88);
    float hotMix = clamp(sparkBoost * 0.62 + singularityGlow * 0.45 + detGlow * 0.4, 0.0, 0.85);
    vColor = mix(aColor * energyGlow, starHighlight * (1.0 + hotMix * 0.4), hotMix);
    vAlpha = clamp(sparkle + sparkBoost * 0.35 + lockPulse * 0.28 + singularityGlow * 0.4, 0.0, 1.0) * (1.0 - uDim * 0.45);
    vSparkBoost = sparkBoost;

    float sizeBoost = 1.0 + uBass * 0.16 + sparkBoost * 0.52 + lockPulse * 0.28 + detGlow * 0.25;
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

/**
 * Dual-mode object-pooled 3D energy rays (44 beams):
 * - Beat 1 (Charge): rapidly sucked inward into the singularity core, vanishing at 100%
 * - Beat 2 (Detonation): violently blasted outward 360° with exponential drag deceleration
 */
const RAYS_VERTEX_SHADER = /* glsl */ `
  attribute vec3 aDir;
  attribute float aEnd;
  attribute float aPhase;
  attribute float aLen;

  uniform float uTime;
  uniform float uCharge;
  uniform float uFreeze;
  uniform float uDetonateTime;

  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    vec3 center = vec3(0.0, 0.28, 0.0);
    vec3 pos = center;
    float alpha = 0.0;
    vec3 col = vec3(1.8, 0.72, 1.45);

    // Beat 1: Converging beams accelerating inward into core, disappearing right at breath-hold
    if (uCharge > 0.02 && uFreeze < 0.05 && uDetonateTime < 0.0) {
      float speed = 0.9 + uCharge * 2.8;
      float cycle = fract(aPhase + uTime * speed);
      float headR = mix(7.8, 0.12, pow(cycle, 1.35));
      float beamLen = (0.75 + uCharge * 2.1) * aLen;
      float r = headR + aEnd * beamLen;

      pos = center + aDir * r;
      float fadeNear = smoothstep(0.08, 0.55, headR);
      float fadeFar = 1.0 - smoothstep(6.2, 8.6, r);
      float vanishAtCap = 1.0 - smoothstep(0.92, 1.0, uCharge);
      alpha = fadeNear * fadeFar * mix(1.0, 0.08, aEnd) * smoothstep(0.02, 0.22, uCharge) * vanishAtCap;
      col = mix(vec3(1.95, 1.65, 2.0), vec3(1.45, 0.28, 1.05), aEnd);
    }
    // Beat 2: 360° Supernova explosive light-ray streaks with exponential air-drag
    else if (uDetonateTime >= 0.0 && uDetonateTime < 1.35) {
      float t = uDetonateTime;
      float headR = 0.25 + (14.5 + aLen * 4.5) * (1.0 - exp(-t * 4.6));
      float tailLag = (3.4 + aLen * 2.6) * exp(-t * 2.2);
      float r = max(0.05, headR - aEnd * tailLag);

      pos = center + aDir * r;
      float env = exp(-t * 2.35) * smoothstep(0.0, 0.03, t);
      alpha = env * mix(1.0, 0.04, aEnd);
      col = mix(vec3(2.0, 1.85, 2.0), vec3(1.65, 0.3, 1.05), aEnd);
    }

    vAlpha = alpha;
    vColor = col;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const RAYS_FRAGMENT_SHADER = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    if (vAlpha <= 0.004) discard;
    gl_FragColor = vec4(vColor, vAlpha);
  }
`;

const SHOCKWAVE_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SHOCKWAVE_FRAGMENT_SHADER = /* glsl */ `
  uniform float uProgress;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    if (uOpacity <= 0.004) discard;
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);
    if (r > 1.0) discard;

    // Crisp glowing expanding shockwave ring with white-hot core to magenta rim
    float ringPos = 0.12 + uProgress * 0.84;
    float width = mix(0.065, 0.032, uProgress);
    float ring = exp(-pow((r - ringPos) / width, 2.0));
    float innerTrail = smoothstep(ringPos - 0.22, ringPos, r) * step(r, ringPos) * 0.26;

    vec3 whiteHot = vec3(2.0, 1.88, 2.0);
    vec3 magentaEdge = vec3(1.45, 0.25, 0.98);
    vec3 col = mix(magentaEdge, whiteHot, ring * (1.0 - uProgress * 0.45));

    float alpha = (ring + innerTrail) * uOpacity;
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
  }
`;

const SINGULARITY_FRAGMENT_SHADER = /* glsl */ `
  uniform float uIntensity;
  uniform float uSharpness;
  varying vec2 vUv;

  void main() {
    if (uIntensity <= 0.004) discard;
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);
    if (r > 1.0) discard;

    // Blinding pinpoint core + subtle star diffraction cross during breath-hold & detonation flash
    float core = exp(-r * r * mix(22.0, 68.0, uSharpness));
    float halo = pow(max(0.0, 1.0 - r), 2.8) * 0.55;
    float crossFlare = max(
      exp(-abs(p.x) * 32.0) * exp(-abs(p.y) * 4.5),
      exp(-abs(p.y) * 32.0) * exp(-abs(p.x) * 4.5)
    ) * 0.72;

    vec3 col = mix(vec3(1.55, 0.35, 1.05), vec3(2.0, 1.92, 2.0), clamp(core + crossFlare * 0.5, 0.0, 1.0));
    float alpha = clamp((core + halo + crossFlare) * uIntensity, 0.0, 1.0);
    gl_FragColor = vec4(col * (1.0 + core * 0.65), alpha);
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
  const shockRingARef = useRef<THREE.Mesh>(null);
  const shockRingBRef = useRef<THREE.Mesh>(null);

  // Pre-allocated math objects (ZERO per-frame allocations)
  const invMatrixRef = useRef(new THREE.Matrix4());
  const localPointerRef = useRef(new THREE.Vector3());

  // Initial 3-phase morph timeline refs (wall-clock synced to Web Audio)
  const morphTimeRef = useRef(0);
  const morphStartMsRef = useRef(0);
  const morphStartedRef = useRef(false);

  // 3-Beat Supernova state machine refs
  // 'idle' | 'imploding' | 'freezing' | 'detonated' | 'reforming'
  const snPhaseRef = useRef<'idle' | 'imploding' | 'freezing' | 'detonated' | 'reforming'>('idle');
  const holdStartPosRef = useRef({ x: 0, y: 0 });
  const holdStartMsRef = useRef(0);
  const freezeStartMsRef = useRef(0);
  const detonateStartMsRef = useRef(0);
  const reformStartMsRef = useRef(0);
  const heartbeatAccumRef = useRef(0);
  const modalOpenedForBurstRef = useRef(false);
  const flashTimerRef = useRef<number | null>(null);
  const modalTimerRef = useRef<number | null>(null);

  const resources = useMemo(() => {
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

      origins[i3] = (rand() - 0.5) * 0.45;
      origins[i3 + 1] = -HEART_BASE_Y + (rand() - 0.5) * 0.45;
      origins[i3 + 2] = (rand() - 0.5) * 0.45;

      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      const radius = 6.0 + Math.pow(rand(), 0.72) * 8.0;

      scatters[i3] = Math.sin(phi) * Math.cos(theta) * radius * (1.24 + (rand() - 0.5) * 0.28);
      scatters[i3 + 1] = Math.cos(phi) * radius * (0.78 + (rand() - 0.5) * 0.24) - 0.6;
      scatters[i3 + 2] = Math.sin(phi) * Math.sin(theta) * radius * (1.08 + (rand() - 0.5) * 0.24);

      delays[i] = rand() * 0.45;
      randoms[i] = rand();

      // Uniform 360° spherical unit direction for violent Supernova blast
      const bTheta = rand() * Math.PI * 2;
      const bPhi = Math.acos(2 * rand() - 1);
      dirVec
        .set(
          Math.sin(bPhi) * Math.cos(bTheta),
          Math.cos(bPhi),
          Math.sin(bPhi) * Math.sin(bTheta)
        )
        .normalize();
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

    const heartGeo = new THREE.BufferGeometry();
    heartGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    heartGeo.setAttribute('aOriginPos', new THREE.BufferAttribute(origins, 3));
    heartGeo.setAttribute('aScatterPos', new THREE.BufferAttribute(scatters, 3));
    heartGeo.setAttribute('aDelay', new THREE.BufferAttribute(delays, 1));
    heartGeo.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));
    heartGeo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    heartGeo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    heartGeo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    heartGeo.setAttribute('aBurstDir', new THREE.BufferAttribute(burstDirs, 3));

    const heartMat = new THREE.ShaderMaterial({
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
        uSupernovaFreeze: { value: 0 },
        uDetonateTime: { value: -1 },
        uReformFactor: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    // 44 dual-mode energy rays (implosion converging beams -> 360° detonation streaks)
    const rayVerts = ENERGY_RAY_COUNT * 2;
    const rPos = new Float32Array(rayVerts * 3);
    const rDir = new Float32Array(rayVerts * 3);
    const rEnd = new Float32Array(rayVerts);
    const rPhase = new Float32Array(rayVerts);
    const rLen = new Float32Array(rayVerts);

    for (let i = 0; i < ENERGY_RAY_COUNT; i++) {
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      const dx = Math.sin(phi) * Math.cos(theta);
      const dy = Math.cos(phi);
      const dz = Math.sin(phi) * Math.sin(theta);
      const ph = rand();
      const ln = 0.65 + rand() * 0.9;

      for (let e = 0; e < 2; e++) {
        const idx = i * 2 + e;
        const idx3 = idx * 3;
        rDir[idx3] = dx;
        rDir[idx3 + 1] = dy;
        rDir[idx3 + 2] = dz;
        rEnd[idx] = e;
        rPhase[idx] = ph;
        rLen[idx] = ln;
      }
    }

    const raysGeo = new THREE.BufferGeometry();
    raysGeo.setAttribute('position', new THREE.BufferAttribute(rPos, 3));
    raysGeo.setAttribute('aDir', new THREE.BufferAttribute(rDir, 3));
    raysGeo.setAttribute('aEnd', new THREE.BufferAttribute(rEnd, 1));
    raysGeo.setAttribute('aPhase', new THREE.BufferAttribute(rPhase, 1));
    raysGeo.setAttribute('aLen', new THREE.BufferAttribute(rLen, 1));

    const raysMat = new THREE.ShaderMaterial({
      vertexShader: RAYS_VERTEX_SHADER,
      fragmentShader: RAYS_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uCharge: { value: 0 },
        uFreeze: { value: 0 },
        uDetonateTime: { value: -1 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    // Two expanding 3D additive shockwave rings
    const shockGeo = new THREE.PlaneGeometry(24, 24);
    const shockMatA = new THREE.ShaderMaterial({
      vertexShader: SHOCKWAVE_VERTEX_SHADER,
      fragmentShader: SHOCKWAVE_FRAGMENT_SHADER,
      uniforms: { uProgress: { value: 0 }, uOpacity: { value: 0 } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const shockMatB = new THREE.ShaderMaterial({
      vertexShader: SHOCKWAVE_VERTEX_SHADER,
      fragmentShader: SHOCKWAVE_FRAGMENT_SHADER,
      uniforms: { uProgress: { value: 0 }, uOpacity: { value: 0 } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });

    // Blinding pinpoint singularity core & detonation flash sprite
    const singularityGeo = new THREE.PlaneGeometry(5.2, 5.2);
    const singularityMat = new THREE.ShaderMaterial({
      vertexShader: SHOCKWAVE_VERTEX_SHADER,
      fragmentShader: SINGULARITY_FRAGMENT_SHADER,
      uniforms: { uIntensity: { value: 0 }, uSharpness: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const hitGeo = new THREE.SphereGeometry(2.55, 16, 16);
    const hitMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    return {
      heartGeo,
      heartMat,
      raysGeo,
      raysMat,
      shockGeo,
      shockMatA,
      shockMatB,
      singularityGeo,
      singularityMat,
      hitGeo,
      hitMat,
    };
  }, []);

  // Trigger Stage 3 Shooting Star Coalescence on frame 0
  useEffect(() => {
    if (!active) {
      morphStartedRef.current = false;
      morphTimeRef.current = 0;
      resources.heartMat.uniforms.uActive.value = 0;
      resources.heartMat.uniforms.uMorphTime.value = 0;
      return;
    }

    resources.heartMat.uniforms.uActive.value = 1;
    if (!morphStartedRef.current) {
      morphStartedRef.current = true;
      morphStartMsRef.current = performance.now();
      morphTimeRef.current = reducedMotion ? MORPH_DURATION + 0.2 : 0;
      resources.heartMat.uniforms.uMorphTime.value = morphTimeRef.current;

      if (!reducedMotion) {
        sfxEngine.playHeartCoalescenceSequence();
      }
    }
  }, [active, reducedMotion, resources]);

  const cancelImplosion = useCallback(() => {
    if (snPhaseRef.current === 'imploding') {
      snPhaseRef.current = 'idle';
      galaxySignals.isHoldingHeart = false;
      sfxEngine.cutSupernovaImplosion();
    }
  }, []);

  // Cancel Beat 1 implosion if user drags camera (> 14px) or releases before 2.85s
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (snPhaseRef.current !== 'imploding') return;
      const dx = e.clientX - holdStartPosRef.current.x;
      const dy = e.clientY - holdStartPosRef.current.y;
      if (dx * dx + dy * dy > DRAG_CANCEL_PX_SQ) {
        cancelImplosion();
      }
    };

    const onPointerUp = () => {
      if (snPhaseRef.current === 'imploding') {
        cancelImplosion();
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
  }, [cancelImplosion]);

  // Trigger clean particle reformation right when the user closes the Secret Modal,
  // and cleanly cancel/reset any in-flight Supernova when switching to Constellation View.
  useEffect(() => {
    const unsub = useAppStore.subscribe((state, prev) => {
      if (state.viewMode === 'constellation' && prev.viewMode !== 'constellation') {
        if (modalTimerRef.current !== null) {
          window.clearTimeout(modalTimerRef.current);
          modalTimerRef.current = null;
        }
        if (snPhaseRef.current === 'imploding' || snPhaseRef.current === 'freezing') {
          snPhaseRef.current = 'idle';
          galaxySignals.isHoldingHeart = false;
          galaxySignals.supernovaCharge = 0;
          galaxySignals.supernovaFreeze = 0;
          sfxEngine.cutSupernovaImplosion();
        } else if (snPhaseRef.current === 'detonated') {
          snPhaseRef.current = 'reforming';
          reformStartMsRef.current = performance.now();
        }
        return;
      }

      if (
        prev.activeModal === 'secret' &&
        !state.activeModal &&
        snPhaseRef.current === 'detonated'
      ) {
        snPhaseRef.current = 'reforming';
        reformStartMsRef.current = performance.now();
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    const clamped = THREE.MathUtils.clamp(quality, 0.6, 1);
    resources.heartGeo.setDrawRange(0, Math.floor(HEART_PARTICLES * clamped));
  }, [quality, resources]);

  useEffect(() => {
    return () => {
      cancelImplosion();
      sfxEngine.stopHeartCoalescence();
      sfxEngine.cutSupernovaImplosion();
      resources.heartGeo.dispose();
      resources.heartMat.dispose();
      resources.raysGeo.dispose();
      resources.raysMat.dispose();
      resources.shockGeo.dispose();
      resources.shockMatA.dispose();
      resources.shockMatB.dispose();
      resources.singularityGeo.dispose();
      resources.singularityMat.dispose();
      resources.hitGeo.dispose();
      resources.hitMat.dispose();
      if (flashTimerRef.current !== null) window.clearTimeout(flashTimerRef.current);
      if (modalTimerRef.current !== null) window.clearTimeout(modalTimerRef.current);
      galaxySignals.supernovaCharge = 0;
      galaxySignals.supernovaFreeze = 0;
      galaxySignals.supernovaDetonateTime = -1;
      galaxySignals.supernovaShake = 0;
      galaxySignals.supernovaFovKick = 0;
      galaxySignals.isHoldingHeart = false;
    };
  }, [cancelImplosion, resources]);

  const handleHeartPointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!interactive || !active) return;
      if (morphTimeRef.current < 2.65) return;
      if (snPhaseRef.current !== 'idle') return;
      if (useAppStore.getState().activeModal) return;
      if (useAppStore.getState().viewMode !== 'galaxy') return;

      sfxEngine.unlock();
      snPhaseRef.current = 'imploding';
      galaxySignals.isHoldingHeart = true;
      holdStartPosRef.current.x = event.nativeEvent.clientX;
      holdStartPosRef.current.y = event.nativeEvent.clientY;
      holdStartMsRef.current = performance.now();
      heartbeatAccumRef.current = 0;
      modalOpenedForBurstRef.current = false;

      sfxEngine.startSupernovaImplosion();
      sfxEngine.playHeartbeatPulse(0.15);
    },
    [interactive, active]
  );

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const elapsed = state.clock.elapsedTime;
    const nowMs = performance.now();
    const dpr = state.gl.getPixelRatio();
    const rm = reducedMotion ? 1 : 0;

    if (!active) {
      resources.heartMat.uniforms.uActive.value = 0;
      return;
    }

    if (reducedMotion) {
      morphTimeRef.current = MORPH_DURATION + 0.2;
    } else if (morphTimeRef.current < MORPH_DURATION + 0.25) {
      morphTimeRef.current = Math.min(
        MORPH_DURATION + 0.25,
        (nowMs - morphStartMsRef.current) / 1000
      );
    }
    resources.heartMat.uniforms.uActive.value = 1;
    resources.heartMat.uniforms.uMorphTime.value = morphTimeRef.current;

    // ─── 3-BEAT SECRET SUPERNOVA STATE MACHINE ───
    const phase = snPhaseRef.current;
    let reformFactor = 0;
    let singularityIntensity = 0;
    let singularitySharpness = 0;
    let shockProgA = 0;
    let shockOpA = 0;
    let shockProgB = 0;
    let shockOpB = 0;

    if (phase === 'imploding') {
      const holdSec = (nowMs - holdStartMsRef.current) / 1000;
      const charge = THREE.MathUtils.clamp(holdSec / IMPLOSION_END_SEC, 0, 1);
      galaxySignals.supernovaCharge = charge;
      galaxySignals.supernovaFreeze = 0;
      galaxySignals.supernovaDetonateTime = -1;

      sfxEngine.updateSupernovaImplosion(charge);
      singularityIntensity = Math.pow(charge, 1.4) * 1.15;
      singularitySharpness = charge * 0.7;

      const beatInterval = THREE.MathUtils.lerp(0.64, 0.2, charge);
      heartbeatAccumRef.current += dt;
      if (heartbeatAccumRef.current >= beatInterval && charge < 0.96) {
        heartbeatAccumRef.current = 0;
        sfxEngine.playHeartbeatPulse(charge);
      }

      if (holdSec >= IMPLOSION_END_SEC) {
        // Enter Beat 1b: 150ms razor-sharp breath-hold vacuum freeze
        snPhaseRef.current = 'freezing';
        freezeStartMsRef.current = nowMs;
        sfxEngine.cutSupernovaImplosion();
      }
    } else if (phase === 'freezing') {
      const freezeDur = FREEZE_END_SEC - IMPLOSION_END_SEC; // 0.15s
      const freezeSec = (nowMs - freezeStartMsRef.current) / 1000;
      const f = THREE.MathUtils.clamp(freezeSec / freezeDur, 0, 1);

      galaxySignals.supernovaCharge = 1;
      galaxySignals.supernovaFreeze = f;
      singularityIntensity = 1.45;
      singularitySharpness = 1.0;

      if (freezeSec >= freezeDur) {
        // Enter Beat 2: High-Impact Supernova Detonation!
        snPhaseRef.current = 'detonated';
        detonateStartMsRef.current = nowMs;
        galaxySignals.isHoldingHeart = false;
        galaxySignals.supernovaCharge = 0;
        galaxySignals.supernovaFreeze = 0;
        galaxySignals.supernovaDetonateTime = 0;
        galaxySignals.supernovaShake = 1;
        galaxySignals.supernovaFovKick = 1;

        sfxEngine.playSupernovaBurst();

        // Crisp brief bloom flash (dissipates rapidly in 180ms so shockwaves stay vivid!)
        useAppStore.getState().setTransitionFlashing(true);
        if (flashTimerRef.current !== null) window.clearTimeout(flashTimerRef.current);
        flashTimerRef.current = window.setTimeout(() => {
          useAppStore.getState().setTransitionFlashing(false);
        }, 185);

        // Beat 3: Delayed Modal Reveal (~1.32s after detonation — ZERO premature cut-off!)
        if (modalTimerRef.current !== null) window.clearTimeout(modalTimerRef.current);
        modalTimerRef.current = window.setTimeout(() => {
          if (!modalOpenedForBurstRef.current) {
            modalOpenedForBurstRef.current = true;
            useAppStore.getState().setActiveModal('secret');
          }
        }, MODAL_DELAY_MS);
      }
    } else if (phase === 'detonated') {
      const detT = (nowMs - detonateStartMsRef.current) / 1000;
      galaxySignals.supernovaDetonateTime = detT;

      // Damped ~0.45s camera shake + punchy FOV kick ease-back
      galaxySignals.supernovaShake = detT < 0.55 ? Math.exp(-detT * 8.5) : 0;
      galaxySignals.supernovaFovKick = Math.exp(-detT * 5.2);

      // Core flash dissipates quickly (0 -> 0.38s) without washing out the galaxy
      singularityIntensity = Math.exp(-detT * 6.5) * 1.65;
      singularitySharpness = 0.25;

      // 2 Expanding 3D Shockwave Rings
      if (detT < 1.35) {
        shockProgA = 1.0 - Math.exp(-detT * 3.1);
        shockOpA = Math.pow(Math.max(0, 1.0 - detT / 1.25), 1.65);
      }
      if (detT > 0.08 && detT < 1.45) {
        const dtB = detT - 0.08;
        shockProgB = 1.0 - Math.exp(-dtB * 2.75);
        shockOpB = Math.pow(Math.max(0, 1.0 - dtB / 1.3), 1.75) * 0.78;
      }
    } else if (phase === 'reforming') {
      const detT = (nowMs - detonateStartMsRef.current) / 1000;
      const refT = (nowMs - reformStartMsRef.current) / 1000;
      galaxySignals.supernovaDetonateTime = detT;
      galaxySignals.supernovaShake = 0;
      galaxySignals.supernovaFovKick = 0;

      reformFactor = THREE.MathUtils.clamp(refT / 2.1, 0, 1);
      if (reformFactor >= 1) {
        snPhaseRef.current = 'idle';
        galaxySignals.supernovaDetonateTime = -1;
        reformFactor = 0;
      }
    } else {
      // Idle: ease residual charge back to 0 cleanly if released early
      if (galaxySignals.supernovaCharge > 0.001) {
        galaxySignals.supernovaCharge = THREE.MathUtils.lerp(
          galaxySignals.supernovaCharge,
          0,
          Math.min(1, dt * 7)
        );
        singularityIntensity = galaxySignals.supernovaCharge * 0.6;
      } else {
        galaxySignals.supernovaCharge = 0;
      }
      galaxySignals.supernovaFreeze = 0;
      galaxySignals.supernovaDetonateTime = -1;
      galaxySignals.supernovaShake = 0;
      galaxySignals.supernovaFovKick = 0;
    }

    // Idle double-beat pulse + audio bass
    const beatSpeed = 0.9 + galaxySignals.supernovaCharge * 2.4;
    const beatCycle = (elapsed * beatSpeed) % 1;
    const pulse = reducedMotion
      ? 0
      : Math.exp(-Math.pow((beatCycle - 0.16) * 11, 2)) +
        0.55 * Math.exp(-Math.pow((beatCycle - 0.34) * 12, 2));

    // Transform world pointer into heart's local coordinates (zero allocations)
    if (heartGroupRef.current && galaxySignals.pointerStrength > 0.005) {
      invMatrixRef.current.copy(heartGroupRef.current.matrixWorld).invert();
      localPointerRef.current.copy(galaxySignals.pointerWorld).applyMatrix4(invMatrixRef.current);
      resources.heartMat.uniforms.uPointerLocal.value.copy(localPointerRef.current);
    }

    // Update GPU shader uniforms
    const hm = resources.heartMat.uniforms;
    hm.uTime.value = elapsed;
    hm.uPulse.value = pulse;
    hm.uBass.value = galaxySignals.bassEnergy;
    hm.uDim.value = galaxySignals.galaxyDim;
    hm.uPixelRatio.value = dpr;
    hm.uReducedMotion.value = rm;
    hm.uPointerStrength.value =
      quality < 0.65 || reducedMotion ? 0 : galaxySignals.pointerStrength;
    hm.uSupernovaCharge.value = galaxySignals.supernovaCharge;
    hm.uSupernovaFreeze.value = galaxySignals.supernovaFreeze;
    hm.uDetonateTime.value = galaxySignals.supernovaDetonateTime;
    hm.uReformFactor.value = reformFactor;

    const rmUniforms = resources.raysMat.uniforms;
    rmUniforms.uTime.value = elapsed;
    rmUniforms.uCharge.value = galaxySignals.supernovaCharge;
    rmUniforms.uFreeze.value = galaxySignals.supernovaFreeze;
    rmUniforms.uDetonateTime.value = galaxySignals.supernovaDetonateTime;

    resources.shockMatA.uniforms.uProgress.value = shockProgA;
    resources.shockMatA.uniforms.uOpacity.value = shockOpA;
    resources.shockMatB.uniforms.uProgress.value = shockProgB;
    resources.shockMatB.uniforms.uOpacity.value = shockOpB;

    resources.singularityMat.uniforms.uIntensity.value = singularityIntensity;
    resources.singularityMat.uniforms.uSharpness.value = singularitySharpness;

    if (shockRingARef.current) {
      shockRingARef.current.visible = shockOpA > 0.004;
    }
    if (shockRingBRef.current) {
      shockRingBRef.current.visible = shockOpB > 0.004;
    }

    // Idle gentle rotation & float (pauses during Beat 1b freeze so pinpoint stays rock-steady)
    if (heartGroupRef.current && !reducedMotion) {
      const idleWeight = THREE.MathUtils.smoothstep(morphTimeRef.current, 2.25, 2.8);
      const freezeStop = phase === 'freezing' ? 0 : 1;
      const spinSpeed = (0.32 + galaxySignals.supernovaCharge * 1.2) * idleWeight * freezeStop;
      heartGroupRef.current.rotation.y += dt * spinSpeed;
      heartGroupRef.current.position.y = HEART_BASE_Y + Math.sin(elapsed * 1.15) * 0.18 * idleWeight;
    }
  });

  return (
    <group ref={heartGroupRef} position={[0, HEART_BASE_Y, 0]} scale={1} name="particle-heart">
      <points
        geometry={resources.heartGeo}
        material={resources.heartMat}
        frustumCulled={false}
      />

      {/* Dual-mode 44 energy rays (converging inward during Beat 1 -> 360° streaks on Beat 2) */}
      <lineSegments
        geometry={resources.raysGeo}
        material={resources.raysMat}
        frustumCulled={false}
      />

      {/* Two orthogonal 3D expanding additive shockwave rings */}
      <mesh
        ref={shockRingARef}
        visible={false}
        position={[0, 0.28, 0]}
        rotation={[-Math.PI * 0.42, 0.12, 0]}
        geometry={resources.shockGeo}
        material={resources.shockMatA}
      />
      <mesh
        ref={shockRingBRef}
        visible={false}
        position={[0, 0.28, 0]}
        rotation={[Math.PI * 0.28, 0.55, 0.3]}
        geometry={resources.shockGeo}
        material={resources.shockMatB}
      />

      {/* Blinding singularity pinpoint & crisp detonation core flash */}
      <Billboard position={[0, 0.28, 0]} follow>
        <mesh geometry={resources.singularityGeo} material={resources.singularityMat} />
      </Billboard>

      {/* Invisible raycast hit-sphere over heart center */}
      <mesh
        geometry={resources.hitGeo}
        material={resources.hitMat}
        onPointerDown={handleHeartPointerDown}
        name="heart-supernova-trigger"
      />
    </group>
  );
}
