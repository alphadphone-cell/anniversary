import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import { galaxySignals } from '../../galaxySignals';
import { isAllCoreJourneyCompleted, useAppStore } from '../../../store/useAppStore';
import { sfxEngine } from '../../../utils/sfxEngine';
import { musicEngine } from '../../../utils/musicEngine';

interface ParticleHeartProps {
  active: boolean;
  interactive?: boolean;
  quality?: number;
  reducedMotion?: boolean;
}

const HEART_PARTICLES = 5000;
const ENERGY_RAY_COUNT = 36;
const FINALE_RAIN_COUNT = 520;
const HEART_BASE_Y = 5.05;
const HEART_WORLD_SCALE = 2.68;
const MORPH_DURATION = 2.8;

// 3-Beat Grand Finale Supernova Timing
const IMPLOSION_END_SEC = 2.88; // Beat 1: isotropic implosion + converging beams
const FREEZE_END_SEC = 3.0; // Beat 1b: 120ms razor-sharp pinpoint freeze + ambient contrast dip
const MODAL_DELAY_MS = 1600; // Beat 3: wait ~1.6s after whiteout peak so full shockwave + stardust rain shine

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
  uniform float uAbsorptionGlow;

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

    // Base idle target position (audio-reactive breathing + joyous Starfall absorption swell)
    float handOff = smoothstep(2.42, 2.8, uMorphTime);
    float beatScale = 1.0 + (uPulse * 0.04 + uBass * 0.085 + uAbsorptionGlow * 0.095) * handOff;
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

    // BEAT 2 & 3: Explosive 360° Detonation -> Rapid Exponential Air-Drag -> Slow-Motion Weightless Drift -> Reformation
    float detGlow = 0.0;
    float finaleWarm = 0.0;
    if (uDetonateTime >= 0.0) {
      // Violent initial velocity transitioning into dramatic slow-motion suspension
      float dragExpand = 1.0 - exp(-uDetonateTime * 4.8);
      float slowFloat = log(1.0 + uDetonateTime * 0.75) * 0.85;
      float burstRadius = (7.8 + aRandom * 7.6) * dragExpand + slowFloat;

      // Weightless slow-motion ember drift across viewport
      vec3 drift = vec3(
        sin(uTime * 0.65 + aPhase) * 0.58,
        -0.16 * min(uDetonateTime, 6.0) + cos(uTime * 0.52 + aPhase * 1.4) * 0.36,
        cos(uTime * 0.6 + aPhase) * 0.52
      ) * dragExpand;

      vec3 explodedPos = heartCenter + aBurstDir * burstRadius + drift;

      // Smoothly reform back into the heart when uReformFactor sweeps 0 -> 1
      float rf = uReformFactor * uReformFactor * (3.0 - 2.0 * uReformFactor);
      pos = mix(explodedPos, targetPos, rf);

      float initFlash = exp(-uDetonateTime * 2.6);
      float slowTwinkle = 0.62 + 0.38 * sin(uTime * (2.2 + aRandom * 3.4) + aPhase * 2.0);
      detGlow = initFlash * 1.85 + (1.0 - rf) * (0.48 * slowTwinkle);
      finaleWarm = (1.0 - rf) * smoothstep(0.15, 0.9, uDetonateTime) * (0.35 + aRandom * 0.45);
      sparkBoost = max(sparkBoost, initFlash * 1.45 + (1.0 - rf) * 0.42 * slowTwinkle);
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

    float sparkle = 0.85 + 0.15 * sin(uTime * (2.6 + uSupernovaCharge * 6.0) * motion + aPhase);
    float dimMul = 1.0 - uDim * 0.72;
    float energyGlow =
      (1.06 + uPulse * 0.18 + uBass * 0.38 + lockPulse * 0.78 + singularityGlow + detGlow + uAbsorptionGlow * 0.72) * dimMul;

    vec3 starHighlight = vec3(2.05, 1.72, 1.98);
    vec3 champagneGold = vec3(1.88, 1.56, 1.02);
    float hotMix = clamp(sparkBoost * 0.62 + singularityGlow * 0.45 + detGlow * 0.4 + uAbsorptionGlow * 0.32, 0.0, 0.85);
    vec3 baseCol = mix(aColor * energyGlow, starHighlight * (1.0 + hotMix * 0.4), hotMix);
    float warmMix = clamp(finaleWarm * 0.52 + uAbsorptionGlow * (0.42 + 0.25 * sin(uTime * 5.0 + aPhase)), 0.0, 0.78);
    vColor = mix(baseCol, champagneGold * (1.0 + (detGlow + uAbsorptionGlow) * 0.38), warmMix);
    vAlpha = clamp(sparkle + sparkBoost * 0.2 + lockPulse * 0.2 + singularityGlow * 0.3 + uAbsorptionGlow * 0.25, 0.0, 1.0) * (1.0 - uDim * 0.45);
    vSparkBoost = max(sparkBoost, uAbsorptionGlow * 0.9);

    float sizeBoost = 1.0 + uBass * 0.18 + sparkBoost * 0.48 + lockPulse * 0.26 + detGlow * 0.24 + uAbsorptionGlow * 0.32;
    float atten = 34.0 / max(-mvPosition.z, 2.0);
    gl_PointSize = clamp(aScale * sizeBoost * uPixelRatio * atten, 2.0, 22.0);
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

    // Bright high-intensity radial starlight crystal sprite for lush neon bloom
    float core = exp(-dist * dist * 16.5);
    float halo = pow(1.0 - smoothstep(0.02, 0.49, dist), 1.65) * 0.68;
    float starCross = max(
      exp(-abs(uv.x) * 26.0) * exp(-abs(uv.y) * 6.5),
      exp(-abs(uv.y) * 26.0) * exp(-abs(uv.x) * 6.5)
    ) * (0.18 + vSparkBoost * 0.68);

    float alpha = clamp((core + halo + starCross) * vAlpha, 0.0, 1.0);
    gl_FragColor = vec4(vColor * (core * 1.48 + halo * 0.92 + starCross), alpha);
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
    // Beat 2: 36 Elongated Radial Supernova Light Rays blasting 360° outward
    else if (uDetonateTime >= 0.0 && uDetonateTime < 1.65) {
      float t = uDetonateTime;
      float headR = 0.3 + (17.5 + aLen * 6.0) * (1.0 - exp(-t * 4.4));
      float tailLag = (4.6 + aLen * 3.4) * exp(-t * 1.75);
      float r = max(0.05, headR - aEnd * tailLag);

      pos = center + aDir * r;
      float env = exp(-t * 1.95) * smoothstep(0.0, 0.025, t);
      alpha = env * mix(1.0, 0.05, aEnd);
      col = mix(vec3(2.2, 2.02, 1.65), vec3(1.75, 0.32, 1.12), aEnd);
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
  uniform float uVariant;
  varying vec2 vUv;

  void main() {
    if (uOpacity <= 0.004) discard;
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);
    if (r > 1.0) discard;

    float ringPos = mix(0.08, 0.94, uProgress);
    // Variant 0 = thick luminous primary wave (white-hot core + gold/magenta rims)
    // Variant 1 = delayed secondary ripple (broader, softer rose-gold dispersion)
    float width = uVariant < 0.5
      ? mix(0.115, 0.052, uProgress)
      : mix(0.145, 0.075, uProgress);
    float ring = exp(-pow((r - ringPos) / width, 2.0));
    float hotCore = exp(-pow((r - ringPos) / (width * 0.36), 2.0));
    float innerTrail = smoothstep(ringPos - 0.34, ringPos, r) * step(r, ringPos) * (uVariant < 0.5 ? 0.36 : 0.28);

    vec3 whiteHot = vec3(2.35, 2.22, 2.15);
    vec3 goldRim = vec3(1.95, 1.48, 0.82);
    vec3 magentaEdge = uVariant < 0.5 ? vec3(1.65, 0.26, 1.05) : vec3(1.32, 0.45, 1.42);

    vec3 col = mix(magentaEdge, goldRim, smoothstep(0.15, 0.85, ring));
    col = mix(col, whiteHot, hotCore * (1.0 - uProgress * 0.35));

    float alpha = (ring + hotCore * 0.55 + innerTrail) * uOpacity;
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
  }
`;

const NEBULA_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  varying vec2 vUv;

  void main() {
    if (uIntensity <= 0.004) discard;
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);
    if (r > 1.0) discard;

    // Breathing multi-lobe rose-gold & magenta nebula afterglow
    float ang = atan(p.y, p.x);
    float wisp = 0.86 + 0.14 * sin(ang * 3.0 + uTime * 0.45) * cos(ang * 2.0 - uTime * 0.32);
    float breath = 0.9 + 0.1 * sin(uTime * 1.25);

    float coreGlow = exp(-r * r * 5.2) * 0.65;
    float roseCloud = pow(max(0.0, 1.0 - r / wisp), 2.35) * 0.58;
    float goldRing = exp(-pow((r - 0.32) / 0.24, 2.0)) * 0.32;

    vec3 rose = vec3(1.28, 0.36, 0.88);
    vec3 gold = vec3(1.52, 1.12, 0.68);
    vec3 whiteCore = vec3(1.75, 1.48, 1.62);

    vec3 col = rose * roseCloud + gold * goldRing + whiteCore * coreGlow;
    float alpha = clamp((coreGlow + roseCloud + goldRing) * uIntensity * breath, 0.0, 0.92);
    gl_FragColor = vec4(col, alpha);
  }
`;

const FINALE_RAIN_VERTEX_SHADER = /* glsl */ `
  attribute float aScale;
  attribute float aPhase;
  attribute float aSpeed;
  attribute vec3 aColor;

  uniform float uTime;
  uniform float uVisibility;
  uniform float uPixelRatio;
  uniform float uReducedMotion;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    if (uVisibility <= 0.004) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      vAlpha = 0.0;
      vColor = aColor;
      return;
    }

    float motion = 1.0 - uReducedMotion;
    vec3 pos = position;

    // Weightless slow-motion downward drift wrapping across the full viewport volume
    float fall = mod(pos.y - uTime * aSpeed * 0.42 * motion + 7.5, 17.0) - 7.5;
    pos.y = fall;
    pos.x += sin(uTime * 0.45 * motion + aPhase) * 0.68;
    pos.z += cos(uTime * 0.38 * motion + aPhase * 1.3) * 0.48;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float twinkle = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * (2.4 + aSpeed * 2.2) * motion + aPhase * 4.0), 1.6);
    float edgeFade = smoothstep(-7.5, -5.2, pos.y) * (1.0 - smoothstep(7.2, 9.5, pos.y));
    vColor = aColor * (0.95 + twinkle * 0.55);
    vAlpha = uVisibility * twinkle * edgeFade;

    float atten = 28.0 / max(-mvPosition.z, 2.5);
    gl_PointSize = clamp(aScale * (0.85 + twinkle * 0.45) * uPixelRatio * atten, 1.5, 14.0);
  }
`;

const FINALE_RAIN_FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    if (vAlpha <= 0.004) discard;
    vec2 uv = gl_PointCoord - vec2(0.5);
    float dist = length(uv);
    if (dist > 0.5) discard;

    float core = exp(-dist * dist * 22.0);
    float crossSpark = max(
      exp(-abs(uv.x) * 26.0) * exp(-abs(uv.y) * 5.5),
      exp(-abs(uv.y) * 26.0) * exp(-abs(uv.x) * 5.5)
    ) * 0.55;
    float halo = smoothstep(0.5, 0.08, dist) * 0.38;

    float alpha = clamp((core + crossSpark + halo) * vAlpha, 0.0, 1.0);
    gl_FragColor = vec4(vColor * (core * 1.3 + crossSpark + halo * 0.75), alpha);
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

const HEART_TARGET_RING_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const HEART_TARGET_RING_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    if (uOpacity <= 0.005) discard;
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0) discard;

    // Pure invisible-edge rose-pink (#f472b6) & pearlescent-white (#fdf2f8) soft breathing aura (zero disk boundary)
    float p1 = fract(uTime * 0.34);
    float edgeFade = smoothstep(0.88, 0.22, r);
    edgeFade *= edgeFade;
    float softAura = exp(-r * r * 7.5) * (0.32 + 0.1 * sin(uTime * 2.4));
    float gossamerRipple = exp(-pow((r - mix(0.28, 0.74, p1)) / 0.015, 2.0)) * (1.0 - p1) * 0.42;

    float alpha = clamp((softAura + gossamerRipple) * edgeFade * uOpacity, 0.0, 0.42);
    if (alpha <= 0.004) discard;

    vec3 cRose = vec3(1.52, 0.52, 1.08);
    vec3 cPearl = vec3(1.64, 1.48, 1.60);
    vec3 col = mix(cRose, cPearl, clamp(gossamerRipple * 1.6 + exp(-r * r * 8.0) * 0.45, 0.0, 1.0));
    gl_FragColor = vec4(col, alpha);
  }
`;

interface TroikaHintTextHandle {
  fillOpacity: number;
  outlineOpacity: number;
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
  const nebulaRef = useRef<THREE.Mesh>(null);
  const targetRingRef = useRef<THREE.Mesh>(null);
  const heartHintGroupRef = useRef<THREE.Group>(null);
  const heartHintTextRef = useRef<TroikaHintTextHandle | null>(null);
  const finaleCueAlphaRef = useRef(0);

  // Pre-allocated math objects (ZERO per-frame allocations)
  const invMatrixRef = useRef(new THREE.Matrix4());
  const localPointerRef = useRef(new THREE.Vector3());
  const lastHudDimRef = useRef(0);

  // Initial 3-phase morph timeline refs (wall-clock synced to Web Audio)
  const morphTimeRef = useRef(0);
  const morphStartMsRef = useRef(0);
  const morphStartedRef = useRef(false);

  // 3-Beat Supernova state machine refs
  // 'idle' | 'imploding' | 'freezing' | 'detonated' | 'reforming'
  const snPhaseRef = useRef<'idle' | 'imploding' | 'freezing' | 'detonated' | 'reforming'>('idle');
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

    const cHotNeon = new THREE.Color('#ff2e93');
    const cVividMagenta = new THREE.Color('#ff66c4');
    const cPearlPink = new THREE.Color('#ffe6f4');
    const cPureWhite = new THREE.Color('#ffffff');
    const tmp = new THREE.Color();
    const dirVec = new THREE.Vector3();

    // Classic full-bodied parametric heart curve normalized (/16) + 1.12x width boost + centered at (0, 0, 0)
    const evalParametricHeart2D = (t: number): [number, number] => {
      const sinT = Math.sin(t);
      const hx = 16 * sinT * sinT * sinT;
      const hy =
        13 * Math.cos(t) -
        5 * Math.cos(2 * t) -
        2 * Math.cos(3 * t) -
        Math.cos(4 * t);
      return [(hx / 16) * 1.12, (hy + 2.55) / 16];
    };

    // Precompute 512-step cumulative arc-length LUT along t ∈ [0, 2π] for 100% uniform sampling (zero clumping!)
    const ARC_STEPS = 512;
    const arcLut = new Float32Array(ARC_STEPS + 1);
    let [prevX, prevY] = evalParametricHeart2D(0);
    arcLut[0] = 0;
    for (let s = 1; s <= ARC_STEPS; s++) {
      const t = (s / ARC_STEPS) * Math.PI * 2;
      const [cx, cy] = evalParametricHeart2D(t);
      arcLut[s] = arcLut[s - 1] + Math.hypot(cx - prevX, cy - prevY);
      prevX = cx;
      prevY = cy;
    }
    const totalArcLen = arcLut[ARC_STEPS];

    const sampleUniformArcT = (): number => {
      const targetLen = rand() * totalArcLen;
      let lo = 0;
      let hi = ARC_STEPS;
      while (lo < hi - 1) {
        const mid = (lo + hi) >> 1;
        if (arcLut[mid] <= targetLen) lo = mid;
        else hi = mid;
      }
      const segLen = Math.max(1e-6, arcLut[hi] - arcLut[lo]);
      const frac = (targetLen - arcLut[lo]) / segLen;
      return ((lo + frac) / ARC_STEPS) * Math.PI * 2;
    };

    for (let i = 0; i < HEART_PARTICLES; i++) {
      const i3 = i * 3;
      // Stratified random layer assignment so setDrawRange(0, N * quality) preserves the exact 40/48/12 mix on low-end GPUs
      const layerRoll = rand();
      const layer: 'rim' | 'shell' | 'core' =
        layerRoll < 0.4 ? 'rim' : layerRoll < 0.88 ? 'shell' : 'core';

      const t = sampleUniformArcT();
      const [nx, ny] = evalParametricHeart2D(t);

      let r = 1;
      let zNorm = 0;
      if (layer === 'rim') {
        // 40% Blazing Crisp Silhouette Rim: iconic wide outline, cleft, and sharp bottom V-tip
        r = 0.92 + rand() * 0.08;
        zNorm = (rand() - 0.5) * 0.22 * (1.0 - r * 0.5);
      } else if (layer === 'shell') {
        // 48% Plump 3D Front & Back Pillowed Shells
        r = Math.pow(rand(), 0.52);
        const side = rand() < 0.5 ? 1 : -1;
        zNorm = side * 0.44 * Math.pow(Math.max(0, 1 - r * r), 0.65);
      } else {
        // 12% Radiant Inner Core: full-bodied glowing volume
        r = Math.pow(rand(), 0.6) * 0.82;
        const maxZ = 0.44 * Math.pow(Math.max(0, 1 - r * r), 0.65);
        zNorm = (rand() * 2 - 1) * maxZ * 0.84;
      }

      const x = nx * r * HEART_WORLD_SCALE;
      const y = ny * r * HEART_WORLD_SCALE;
      const z = zNorm * HEART_WORLD_SCALE;

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

      // High-impact neon vibrancy: hot neon pink (#ff2e93) -> vivid rose magenta (#ff66c4) -> pearlescent white highlights
      const hNorm = THREE.MathUtils.clamp((ny * r + 0.91) / 1.82, 0, 1);
      const isUpperSpec = layer === 'rim' && hNorm > 0.62 && rand() < 0.48;
      const isRimSpark = layer === 'rim' && rand() < 0.22;

      if (isUpperSpec) {
        tmp.copy(cPearlPink).lerp(cPureWhite, 0.35 + rand() * 0.65);
      } else if (isRimSpark) {
        tmp.copy(cVividMagenta).lerp(cPearlPink, 0.55 + rand() * 0.45);
      } else if (layer === 'rim') {
        tmp.copy(cHotNeon).lerp(cVividMagenta, 0.35 + hNorm * 0.55);
      } else if (layer === 'shell') {
        tmp.copy(cHotNeon).lerp(cVividMagenta, 0.2 + hNorm * 0.6);
        if (hNorm > 0.72 && rand() < 0.25) {
          tmp.lerp(cPearlPink, 0.5);
        }
      } else {
        tmp.copy(cHotNeon).lerp(cVividMagenta, rand() * 0.35);
      }

      // HDR brightness > 1.0 so Bloom catches a lush, dreamy rose-pink glow
      const hdrBoost =
        isUpperSpec
          ? 1.92
          : layer === 'rim'
            ? 1.66
            : layer === 'shell'
              ? 1.38
              : 1.24;
      colors[i3] = tmp.r * hdrBoost;
      colors[i3 + 1] = tmp.g * hdrBoost;
      colors[i3 + 2] = tmp.b * hdrBoost;

      // Boosted particle presence (~40% larger than prior dusty dots) for rich, crystalline glow
      scales[i] =
        layer === 'rim'
          ? 1.05 + Math.pow(rand(), 1.55) * 1.15
          : layer === 'shell'
            ? 0.88 + Math.pow(rand(), 1.65) * 0.95
            : 0.78 + rand() * 0.72;
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
        uAbsorptionGlow: { value: 0 },
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

    // Two multi-layered expanding 3D additive shockwave rings (Primary + Delayed Secondary Ripple)
    const shockGeo = new THREE.PlaneGeometry(34, 34);
    const shockMatA = new THREE.ShaderMaterial({
      vertexShader: SHOCKWAVE_VERTEX_SHADER,
      fragmentShader: SHOCKWAVE_FRAGMENT_SHADER,
      uniforms: { uProgress: { value: 0 }, uOpacity: { value: 0 }, uVariant: { value: 0 } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const shockMatB = new THREE.ShaderMaterial({
      vertexShader: SHOCKWAVE_VERTEX_SHADER,
      fragmentShader: SHOCKWAVE_FRAGMENT_SHADER,
      uniforms: { uProgress: { value: 0 }, uOpacity: { value: 0 }, uVariant: { value: 1 } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });

    // Blinding pinpoint singularity core & detonation flash sprite
    const singularityGeo = new THREE.PlaneGeometry(5.6, 5.6);
    const singularityMat = new THREE.ShaderMaterial({
      vertexShader: SHOCKWAVE_VERTEX_SHADER,
      fragmentShader: SINGULARITY_FRAGMENT_SHADER,
      uniforms: { uIntensity: { value: 0 }, uSharpness: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    // Lingering Rose-Gold Nebula Afterglow halo in the detonated center
    const nebulaGeo = new THREE.PlaneGeometry(13.5, 13.5);
    const nebulaMat = new THREE.ShaderMaterial({
      vertexShader: SHOCKWAVE_VERTEX_SHADER,
      fragmentShader: NEBULA_FRAGMENT_SHADER,
      uniforms: { uTime: { value: 0 }, uIntensity: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    // Object-pooled Grand Finale Particle Rain (warm champagne gold, rose pink, twinkling white starlight)
    const rainPos = new Float32Array(FINALE_RAIN_COUNT * 3);
    const rainScale = new Float32Array(FINALE_RAIN_COUNT);
    const rainPhase = new Float32Array(FINALE_RAIN_COUNT);
    const rainSpeed = new Float32Array(FINALE_RAIN_COUNT);
    const rainCol = new Float32Array(FINALE_RAIN_COUNT * 3);

    const cChampagne = new THREE.Color('#fde68a');
    const cRoseRain = new THREE.Color('#ff74c6');
    const cStarWhite = new THREE.Color('#fff9fe');

    for (let i = 0; i < FINALE_RAIN_COUNT; i++) {
      const i3 = i * 3;
      rainPos[i3] = (rand() - 0.5) * 28.0;
      rainPos[i3 + 1] = -7.5 + rand() * 17.0;
      rainPos[i3 + 2] = -9.0 + rand() * 17.0;
      rainScale[i] = 0.65 + rand() * 1.45;
      rainPhase[i] = rand() * Math.PI * 2;
      rainSpeed[i] = 0.55 + rand() * 1.15;

      const pick = rand();
      if (pick < 0.42) {
        tmp.copy(cChampagne);
      } else if (pick < 0.78) {
        tmp.copy(cRoseRain);
      } else {
        tmp.copy(cStarWhite);
      }
      rainCol[i3] = tmp.r;
      rainCol[i3 + 1] = tmp.g;
      rainCol[i3 + 2] = tmp.b;
    }

    const finaleRainGeo = new THREE.BufferGeometry();
    finaleRainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    finaleRainGeo.setAttribute('aScale', new THREE.BufferAttribute(rainScale, 1));
    finaleRainGeo.setAttribute('aPhase', new THREE.BufferAttribute(rainPhase, 1));
    finaleRainGeo.setAttribute('aSpeed', new THREE.BufferAttribute(rainSpeed, 1));
    finaleRainGeo.setAttribute('aColor', new THREE.BufferAttribute(rainCol, 3));

    const finaleRainMat = new THREE.ShaderMaterial({
      vertexShader: FINALE_RAIN_VERTEX_SHADER,
      fragmentShader: FINALE_RAIN_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uVisibility: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
        uReducedMotion: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    // Subtle pulsing concentric rose-gold target ring once 6/6 core memories unlock the Supernova finale
    const targetRingGeo = new THREE.PlaneGeometry(7.2, 7.2);
    const targetRingMat = new THREE.ShaderMaterial({
      vertexShader: HEART_TARGET_RING_VERTEX,
      fragmentShader: HEART_TARGET_RING_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const hitGeo = new THREE.SphereGeometry(2.85, 16, 16);
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
      nebulaGeo,
      nebulaMat,
      finaleRainGeo,
      finaleRainMat,
      targetRingGeo,
      targetRingMat,
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
      musicEngine.cancelSupernovaHold();
    }
  }, []);

  // Only releasing the pointer (or window blur) cancels Beat 1 implosion — moving the mouse/finger never interrupts the hold
  useEffect(() => {
    const onPointerUp = () => {
      if (snPhaseRef.current === 'imploding') {
        cancelImplosion();
      }
    };

    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });
    window.addEventListener('blur', onPointerUp);

    return () => {
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('blur', onPointerUp);
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
        galaxySignals.supernovaAmbientDim = 0;
        galaxySignals.supernovaBloomSpike = 0;
        lastHudDimRef.current = 0;
        document.documentElement.style.setProperty('--supernova-hud-dim', '0');
        if (snPhaseRef.current === 'imploding' || snPhaseRef.current === 'freezing') {
          snPhaseRef.current = 'idle';
          galaxySignals.isHoldingHeart = false;
          galaxySignals.supernovaCharge = 0;
          galaxySignals.supernovaFreeze = 0;
          sfxEngine.cutSupernovaImplosion();
          musicEngine.cancelSupernovaHold();
        } else if (snPhaseRef.current === 'detonated') {
          snPhaseRef.current = 'reforming';
          reformStartMsRef.current = performance.now();
          musicEngine.crossfadeBackFromSupernova(2.0);
        }
        return;
      }

      if (prev.activeModal === 'secret' && !state.activeModal) {
        musicEngine.crossfadeBackFromSupernova(2.0);
        if (snPhaseRef.current === 'detonated') {
          snPhaseRef.current = 'reforming';
          reformStartMsRef.current = performance.now();
        }
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    const clamped = THREE.MathUtils.clamp(quality, 0.6, 1);
    resources.heartGeo.setDrawRange(0, Math.floor(HEART_PARTICLES * clamped));
    resources.finaleRainGeo.setDrawRange(0, Math.floor(FINALE_RAIN_COUNT * clamped));
  }, [quality, resources]);

  useEffect(() => {
    return () => {
      cancelImplosion();
      sfxEngine.stopHeartCoalescence();
      sfxEngine.cutSupernovaImplosion();
      musicEngine.swellFromSupernova(0, 0.25);
      resources.heartGeo.dispose();
      resources.heartMat.dispose();
      resources.raysGeo.dispose();
      resources.raysMat.dispose();
      resources.shockGeo.dispose();
      resources.shockMatA.dispose();
      resources.shockMatB.dispose();
      resources.singularityGeo.dispose();
      resources.singularityMat.dispose();
      resources.nebulaGeo.dispose();
      resources.nebulaMat.dispose();
      resources.finaleRainGeo.dispose();
      resources.finaleRainMat.dispose();
      resources.targetRingGeo.dispose();
      resources.targetRingMat.dispose();
      resources.hitGeo.dispose();
      resources.hitMat.dispose();
      if (flashTimerRef.current !== null) window.clearTimeout(flashTimerRef.current);
      if (modalTimerRef.current !== null) window.clearTimeout(modalTimerRef.current);
      galaxySignals.supernovaCharge = 0;
      galaxySignals.supernovaFreeze = 0;
      galaxySignals.supernovaDetonateTime = -1;
      galaxySignals.supernovaShake = 0;
      galaxySignals.supernovaFovKick = 0;
      galaxySignals.supernovaAmbientDim = 0;
      galaxySignals.supernovaBloomSpike = 0;
      galaxySignals.isHoldingHeart = false;
      document.documentElement.style.setProperty('--supernova-hud-dim', '0');
    };
  }, [cancelImplosion, resources]);

  const handleHeartPointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!interactive || !active) return;
      if (morphTimeRef.current < 2.65) return;
      if (snPhaseRef.current !== 'idle') return;
      const store = useAppStore.getState();
      if (store.activeModal || store.focusingNodeId !== null || galaxySignals.isOrbReturning) return;
      if (store.viewMode !== 'galaxy') return;
      // Lock Supernova completely until all 6/6 journey milestones are completed so accidental taps never spoil it early
      if (!isAllCoreJourneyCompleted(store.completedSteps)) return;

      event.stopPropagation();
      sfxEngine.unlock();
      // Dual-Deck Mobile Zero-Latency Pre-Cue: fade Deck A -> 0 over hold duration & prime Deck B at chorusStartTime
      musicEngine.beginSupernovaHold(IMPLOSION_END_SEC);

      snPhaseRef.current = 'imploding';
      galaxySignals.isHoldingHeart = true;
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

    // ─── 3-BEAT GRAND FINALE SUPERNOVA STATE MACHINE ───
    const phase = snPhaseRef.current;
    let reformFactor = 0;
    let singularityIntensity = 0;
    let singularitySharpness = 0;
    let shockProgA = 0;
    let shockOpA = 0;
    let shockProgB = 0;
    let shockOpB = 0;
    let nebulaIntensity = 0;
    let finaleRainVis = 0;
    let targetAmbientDim = 0;
    let targetHudDim = 0;

    if (phase === 'imploding') {
      const holdSec = (nowMs - holdStartMsRef.current) / 1000;
      const charge = THREE.MathUtils.clamp(holdSec / IMPLOSION_END_SEC, 0, 1);
      galaxySignals.supernovaCharge = charge;
      galaxySignals.supernovaFreeze = 0;
      galaxySignals.supernovaDetonateTime = -1;
      galaxySignals.supernovaBloomSpike = 0;

      // Theatrical Focus: smoothly dim HUD & surrounding 3D text as charge builds 0% -> 100%
      targetAmbientDim = Math.pow(charge, 1.15) * 0.68;
      targetHudDim = Math.pow(charge, 0.9) * 0.94;

      sfxEngine.updateSupernovaImplosion(charge);
      singularityIntensity = Math.pow(charge, 1.35) * 1.25;
      singularitySharpness = charge * 0.75;

      const beatInterval = THREE.MathUtils.lerp(0.64, 0.2, charge);
      heartbeatAccumRef.current += dt;
      if (heartbeatAccumRef.current >= beatInterval && charge < 0.96) {
        heartbeatAccumRef.current = 0;
        sfxEngine.playHeartbeatPulse(charge);
      }

      if (holdSec >= IMPLOSION_END_SEC) {
        // Enter Beat 1b: 120ms razor-sharp pinpoint freeze in near-silence before chorus drop
        snPhaseRef.current = 'freezing';
        freezeStartMsRef.current = nowMs;
        sfxEngine.cutSupernovaImplosion();
        musicEngine.duckForSupernova();
      }
    } else if (phase === 'freezing') {
      const freezeDur = FREEZE_END_SEC - IMPLOSION_END_SEC; // 0.12s
      const freezeSec = (nowMs - freezeStartMsRef.current) / 1000;
      const f = THREE.MathUtils.clamp(freezeSec / freezeDur, 0, 1);

      galaxySignals.supernovaCharge = 1;
      galaxySignals.supernovaFreeze = f;
      galaxySignals.supernovaBloomSpike = 0;
      // Maximum dark-to-bright contrast dip right before detonation
      targetAmbientDim = 0.96;
      targetHudDim = 1.0;

      singularityIntensity = 1.55;
      singularitySharpness = 1.0;

      if (freezeSec >= freezeDur) {
        // Enter Beat 2: True High-Impact Grand Finale Detonation!
        snPhaseRef.current = 'detonated';
        detonateStartMsRef.current = nowMs;
        galaxySignals.isHoldingHeart = false;
        galaxySignals.supernovaCharge = 0;
        galaxySignals.supernovaFreeze = 0;
        galaxySignals.supernovaDetonateTime = 0;
        galaxySignals.supernovaShake = 1;
        galaxySignals.supernovaFovKick = 1;
        galaxySignals.supernovaBloomSpike = 1;

        sfxEngine.playSupernovaBurst();
        // Dual-Deck Chorus Drop: pause Deck A (saved timestamp) & unleash Deck B at chorusStartTime (120ms attack)
        musicEngine.unleashSupernovaChorus();

        // Full-screen pure-white -> rose-pink whiteout splash + chromatic lens kick (`z-30`)
        if (!reducedMotion) {
          useAppStore.getState().triggerSupernovaFlash();
        }

        // Beat 3: Wait ~1.6s after whiteout peak so shockwaves & slow-motion stardust rain shine
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

      // Punchy ~0.50s camera shake + +18° FOV recoil + brief ~150ms bloom spike
      galaxySignals.supernovaShake = detT < 0.56 ? Math.exp(-detT * 6.8) : 0;
      galaxySignals.supernovaFovKick = Math.exp(-detT * 4.4);
      galaxySignals.supernovaBloomSpike = detT < 0.3 ? Math.exp(-detT * 13.5) : 0;

      // Keep HUD softly tucked & ambient dimmed so stardust aftermath + modal take center stage
      targetAmbientDim = 0.42;
      targetHudDim = 0.88;

      // Blinding core flare dissolves into warm lingering Rose-Gold Nebula Afterglow
      singularityIntensity = Math.exp(-detT * 5.2) * 1.85;
      singularitySharpness = 0.2;
      nebulaIntensity = THREE.MathUtils.smoothstep(detT, 0.08, 0.65) * 0.92;
      finaleRainVis = THREE.MathUtils.smoothstep(detT, 0.14, 0.95);

      // Multi-layered Shockwaves:
      // 1. Thick luminous Primary Shockwave Ring expanding fast across viewport
      if (detT < 1.55) {
        shockProgA = 1.0 - Math.exp(-detT * 2.95);
        shockOpA = Math.pow(Math.max(0, 1.0 - detT / 1.48), 1.45);
      }
      // 2. Secondary Delayed Ripple Ring (+180ms), expanding slightly slower with softer dispersion
      if (detT > 0.18 && detT < 1.95) {
        const dtB = detT - 0.18;
        shockProgB = 1.0 - Math.exp(-dtB * 2.15);
        shockOpB = Math.pow(Math.max(0, 1.0 - dtB / 1.7), 1.55) * 0.82;
      }
    } else if (phase === 'reforming') {
      const detT = (nowMs - detonateStartMsRef.current) / 1000;
      const refT = (nowMs - reformStartMsRef.current) / 1000;
      galaxySignals.supernovaDetonateTime = detT;
      galaxySignals.supernovaShake = 0;
      galaxySignals.supernovaFovKick = 0;
      galaxySignals.supernovaBloomSpike = 0;

      reformFactor = THREE.MathUtils.clamp(refT / 2.1, 0, 1);
      nebulaIntensity = (1 - reformFactor) * 0.85;
      finaleRainVis = Math.max(0, 1 - reformFactor * 1.35);
      targetAmbientDim = (1 - reformFactor) * 0.42;
      targetHudDim = (1 - reformFactor) * 0.88;

      if (reformFactor >= 1) {
        snPhaseRef.current = 'idle';
        galaxySignals.supernovaDetonateTime = -1;
        reformFactor = 0;
        nebulaIntensity = 0;
        finaleRainVis = 0;
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
        targetAmbientDim = galaxySignals.supernovaCharge * 0.5;
        targetHudDim = galaxySignals.supernovaCharge * 0.8;
      } else {
        galaxySignals.supernovaCharge = 0;
      }
      galaxySignals.supernovaFreeze = 0;
      galaxySignals.supernovaDetonateTime = -1;
      galaxySignals.supernovaShake = 0;
      galaxySignals.supernovaFovKick = 0;
      galaxySignals.supernovaBloomSpike = 0;
    }

    // Smooth ambient focus dim + zero-re-render HUD opacity CSS variable
    const dimLerp = phase === 'freezing' ? 28 : 8.5;
    galaxySignals.supernovaAmbientDim = THREE.MathUtils.lerp(
      galaxySignals.supernovaAmbientDim,
      targetAmbientDim,
      Math.min(1, dt * dimLerp)
    );
    const nextHudDim = THREE.MathUtils.lerp(
      lastHudDimRef.current,
      targetHudDim,
      Math.min(1, dt * dimLerp)
    );
    if (Math.abs(nextHudDim - lastHudDimRef.current) > 0.004 || (targetHudDim === 0 && lastHudDimRef.current !== 0 && nextHudDim < 0.005)) {
      const snapped = targetHudDim === 0 && nextHudDim < 0.005 ? 0 : nextHudDim;
      lastHudDimRef.current = snapped;
      document.documentElement.style.setProperty('--supernova-hud-dim', snapped.toFixed(3));
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
    hm.uAbsorptionGlow.value = galaxySignals.heartAbsorptionGlow;

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

    resources.nebulaMat.uniforms.uTime.value = elapsed;
    resources.nebulaMat.uniforms.uIntensity.value = nebulaIntensity;

    resources.finaleRainMat.uniforms.uTime.value = elapsed;
    resources.finaleRainMat.uniforms.uVisibility.value = finaleRainVis;
    resources.finaleRainMat.uniforms.uPixelRatio.value = dpr;
    resources.finaleRainMat.uniforms.uReducedMotion.value = rm;

    if (shockRingARef.current) {
      shockRingARef.current.visible = shockOpA > 0.004;
    }
    if (shockRingBRef.current) {
      shockRingBRef.current.visible = shockOpB > 0.004;
    }
    if (nebulaRef.current) {
      nebulaRef.current.visible = nebulaIntensity > 0.004;
    }

    // Grand Finale Unlock Cue (6/6 completed & !supernovaCompleted): pulsing target ring + floating hint below heart
    const appState = useAppStore.getState();
    const showFinaleCue =
      active &&
      interactive &&
      morphTimeRef.current >= 2.65 &&
      phase === 'idle' &&
      appState.viewMode === 'galaxy' &&
      appState.activeModal === null &&
      isAllCoreJourneyCompleted(appState.completedSteps) &&
      !appState.supernovaCompleted;

    finaleCueAlphaRef.current = THREE.MathUtils.lerp(
      finaleCueAlphaRef.current,
      showFinaleCue ? 1 : 0,
      Math.min(1, dt * 6)
    );
    const cueAlpha = finaleCueAlphaRef.current;

    resources.targetRingMat.uniforms.uTime.value = elapsed;
    resources.targetRingMat.uniforms.uOpacity.value = cueAlpha * 0.52;
    if (targetRingRef.current) {
      targetRingRef.current.visible = cueAlpha > 0.01;
    }
    if (heartHintGroupRef.current) {
      heartHintGroupRef.current.visible = cueAlpha > 0.015;
    }
    if (heartHintTextRef.current) {
      const breatheAlpha = reducedMotion ? 1 : 0.78 + 0.22 * Math.sin(elapsed * 2.6);
      heartHintTextRef.current.fillOpacity = cueAlpha * breatheAlpha;
      heartHintTextRef.current.outlineOpacity = cueAlpha * 0.85;
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
    <>
      <group ref={heartGroupRef} position={[0, HEART_BASE_Y, 0]} scale={1} name="particle-heart">
        <points
          geometry={resources.heartGeo}
          material={resources.heartMat}
          frustumCulled={false}
        />

        {/* Dual-mode 36 energy rays (converging inward during Beat 1 -> 360° star-streaks on Beat 2) */}
        <lineSegments
          geometry={resources.raysGeo}
          material={resources.raysMat}
          frustumCulled={false}
        />

        {/* Multi-layered 3D expanding additive shockwave rings (Primary + Delayed Secondary Ripple) */}
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
          rotation={[Math.PI * 0.26, 0.52, 0.28]}
          geometry={resources.shockGeo}
          material={resources.shockMatB}
        />

        {/* Lingering Rose-Gold Nebula Afterglow halo */}
        <Billboard position={[0, 0.28, -0.3]} follow>
          <mesh
            ref={nebulaRef}
            visible={false}
            geometry={resources.nebulaGeo}
            material={resources.nebulaMat}
          />
        </Billboard>

        {/* Subtle pulsing concentric target ring + floating hold hint once 6/6 memories unlock */}
        <Billboard position={[0, 0.28, -0.15]} follow>
          <mesh
            ref={targetRingRef}
            visible={false}
            geometry={resources.targetRingGeo}
            material={resources.targetRingMat}
          />
          <group ref={heartHintGroupRef} position={[0, -3.35, 0.1]} visible={false}>
            <Text
              ref={heartHintTextRef}
              font="/fonts/BeVietnamPro-SemiBold.ttf"
              fontSize={0.27}
              letterSpacing={0.08}
              color="#fdf2f8"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.018}
              outlineColor="#db2777"
              fillOpacity={0}
              outlineOpacity={0}
              material-toneMapped={false}
            >
              CHẠM &amp; GIỮ TRÁI TIM 3 GIÂY
            </Text>
          </group>
        </Billboard>

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

      {/* Non-rotating world-aligned slow-motion Grand Finale Stardust & Ember Rain */}
      <group position={[0, HEART_BASE_Y, 0]} name="finale-stardust-rain">
        <points
          geometry={resources.finaleRainGeo}
          material={resources.finaleRainMat}
          frustumCulled={false}
        />
      </group>
    </>
  );
}
