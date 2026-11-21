import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import {
  ANNIVERSARY_DATA,
  type ConstellationMilestone,
} from '../../../data/anniversaryData';
import { galaxySignals } from '../../galaxySignals';
import {
  useAppStore,
  useConstellationFinaleActive,
  useMaxUnlockedMilestoneIndex,
  useSelectedMilestoneId,
  useViewMode,
} from '../../../store/useAppStore';
import { sfxEngine } from '../../../utils/sfxEngine';

interface ConstellationSkyProps {
  active: boolean;
  reducedMotion?: boolean;
}

const LINE_IGNITE_DURATION_MS = 600; // Unhurried ~0.6s crisp luminous connecting line draw
const STAR_IGNITE_BURST_MS = 780; // Crisp starlight flare + sparkle halo during Beat 2 (~0.45s admiration hold)
// Synchronized Balanced 5.2s Finale Timeline:
// 0.00s -> 0.85s: Close card & frame entire Capricornus constellation dead-center
// 0.85s -> 1.80s: Smoother golden-white circuit surge Star #1 -> Star #7 -> closing arch
// 1.80s -> 3.95s: Glowing Constellation Emblem materialization & ~2.0s admiration hold
// 3.95s -> 6.30s: Emblem dissolve -> Simultaneous 7-Star Burst -> Starfall Descent -> Heart Absorption
const SURGE_START_SEC = 0.85;
const SURGE_END_SEC = 1.8;
const BURST_START_SEC = 3.95;
const HEART_ABSORB_START_SEC = 5.0;
const HEART_ABSORB_END_SEC = 6.1;
const CASCADE_TOTAL_SEC = 6.35;
const PARTICLES_PER_STAR = 60; // 7 * 60 = 420 object-pooled GPU starfall particles
const HEART_ABSORB_WORLD = new THREE.Vector3(0, 4.45, 0);

const COLOR_DORMANT = new THREE.Color(0.46, 0.50, 0.78);
const COLOR_GALAXY_BG = new THREE.Color(0.95, 0.88, 1.18);
const COLOR_VISITED = new THREE.Color(1.22, 1.06, 1.38);
const COLOR_ACTIVE = new THREE.Color(1.66, 1.34, 1.78);
const COLOR_IGNITE_PEAK = new THREE.Color(2.35, 1.98, 2.45);
const COLOR_SURGE_GOLD = new THREE.Color(2.65, 2.24, 1.62);

const LINE_VERTEX_SHADER = /* glsl */ `
  attribute float aProgress;
  uniform float uDrawProgress;
  uniform float uTime;
  uniform float uSurgeProgress;

  varying float vProgress;
  varying float vLit;
  varying float vLeading;
  varying float vSurgeBolt;
  varying float vSurgeTrail;
  varying float vPulse;

  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vProgress = aProgress;
    // Soft glowing edge as each segment ignites from star i to star i + 1
    vLit = 1.0 - smoothstep(uDrawProgress - 0.025, uDrawProgress + 0.008, aProgress);
    float distToTip = abs(aProgress - uDrawProgress);
    vLeading = exp(-distToTip * distToTip * 950.0);

    // Phase 1 Finale: blazing golden-white energy bolt racing Star #1 -> Star #7
    float distToSurge = aProgress - uSurgeProgress;
    vSurgeBolt = exp(-distToSurge * distToSurge * 220.0);
    vSurgeTrail = smoothstep(-0.28, 0.0, distToSurge) * step(distToSurge, 0.02);

    vPulse = 0.74 + 0.26 * sin(aProgress * 18.0 - uTime * 2.4);
  }
`;

const LINE_FRAGMENT_SHADER = /* glsl */ `
  uniform float uOpacity;
  uniform float uIgniteWave;
  uniform float uFinaleBoost;
  uniform float uSurgeIntensity;
  varying float vProgress;
  varying float vLit;
  varying float vLeading;
  varying float vSurgeBolt;
  varying float vSurgeTrail;
  varying float vPulse;

  void main() {
    if (uOpacity <= 0.004) discard;

    // Ultra-faint dormant sky guide (~0.08) for upcoming unvisited segments
    float dormantAlpha = 0.08 * (1.0 - vLit);
    float litAlpha = vLit * (0.58 + 0.42 * vPulse) * (1.0 + uFinaleBoost * 0.25);
    float waveSpark = vLeading * uIgniteWave * 0.95;
    float surgeGlow = (vSurgeBolt * 1.35 + vSurgeTrail * 0.48) * uSurgeIntensity;

    float alpha = clamp((dormantAlpha + litAlpha + waveSpark + surgeGlow) * uOpacity, 0.0, 1.0);
    if (alpha <= 0.005) discard;

    vec3 cDormant = vec3(0.46, 0.50, 0.78);
    vec3 cLavender = vec3(0.95, 0.86, 1.52);
    vec3 cPink = vec3(1.42, 0.48, 0.98);
    vec3 cSpark = vec3(2.2, 1.85, 2.35);
    vec3 cGoldBolt = vec3(2.85, 2.42, 1.65);

    vec3 litCol = mix(cLavender, cPink, 0.45 + 0.35 * sin(vProgress * 6.2831));
    litCol *= (1.0 + uFinaleBoost * 0.38);

    vec3 col = mix(cDormant, litCol, vLit);
    col = mix(col, cSpark, clamp(waveSpark, 0.0, 1.0));
    col = mix(col, cGoldBolt, clamp(surgeGlow, 0.0, 1.0));
    gl_FragColor = vec4(col, alpha);
  }
`;

/** Expanding 3D celestial rose-gold/white shockwave halo across the sky dome on Simultaneous Burst (t = 0.9s). */
const CELESTIAL_SHOCKWAVE_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CELESTIAL_SHOCKWAVE_FRAGMENT = /* glsl */ `
  uniform float uProgress;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    if (uOpacity <= 0.004) discard;
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0) discard;

    float radius = mix(0.05, 0.95, uProgress);
    float ring = exp(-pow((r - radius) / 0.052, 2.0));
    float innerHalo = exp(-pow((r - radius * 0.84) / 0.11, 2.0)) * 0.38;
    float edgeFade = smoothstep(1.0, 0.78, r);
    float alpha = clamp((ring + innerHalo) * edgeFade * uOpacity, 0.0, 1.0);
    if (alpha <= 0.004) discard;

    vec3 cWhiteGold = vec3(2.4, 2.15, 1.65);
    vec3 cRosePink = vec3(1.85, 0.72, 1.38);
    vec3 col = mix(cRosePink, cWhiteGold, clamp(ring * 1.1, 0.0, 1.0));
    gl_FragColor = vec4(col, alpha);
  }
`;

/**
 * Object-pooled GPU Starfall Cascade (420 golden-pink shooting-star particles):
 * - uCascadeTime 0.0 -> 0.65s: explosive 360° burst outward from all 7 constellation stars
 * - uCascadeTime 0.65 -> 2.45s: gravity pulls sparkling streams smoothly down into the 3D Particle Heart
 */
const STARFALL_VERTEX_SHADER = /* glsl */ `
  attribute vec3 aBurstVel;
  attribute float aScale;
  attribute float aDelay;
  attribute float aColorMix;
  attribute float aSeed;

  uniform float uCascadeTime;
  uniform float uPixelRatio;
  uniform vec3 uHeartTarget;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vStreak;

  void main() {
    float t = uCascadeTime - aDelay;
    if (uCascadeTime < 0.0 || t <= 0.0 || t > 2.45) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      vAlpha = 0.0;
      vColor = vec3(1.0);
      vStreak = 0.0;
      return;
    }

    // Phase A (0.0 -> 0.65s): crisp 360° starlight burst with air-drag deceleration
    float drag = 1.0 - exp(-t * 4.2);
    vec3 burstPos = position + aBurstVel * drag * 3.1;

    // Phase B (0.55 -> 2.15s): gravity starfall ribbons curving gracefully down into the 3D Particle Heart
    float fallU = clamp((t - 0.52) / 1.58, 0.0, 1.0);
    float fallEase = fallU * fallU * (2.6 - 1.6 * fallU);

    // Curved quadratic Bezier path with dreamy sky-to-heart swirl
    vec3 midCtrl = mix(burstPos, uHeartTarget, 0.45) + vec3(
      sin(aSeed * 6.2831 + t * 1.8) * 3.2,
      -2.2 - aSeed * 1.8,
      2.6 + cos(aSeed * 6.2831) * 2.2
    );
    vec3 q0 = mix(burstPos, midCtrl, fallEase);
    vec3 q1 = mix(midCtrl, uHeartTarget, fallEase);
    vec3 finalPos = mix(q0, q1, fallEase);

    // Subtle sparkle drift during initial burst before descent kicks in
    finalPos.y -= pow(min(t, 0.7), 2.0) * 0.9 * (1.0 - fallEase);

    vec4 mvPos = modelViewMatrix * vec4(finalPos, 1.0);
    gl_Position = projectionMatrix * mvPos;

    float fadeIn = smoothstep(0.0, 0.08, t);
    float fadeOut = 1.0 - smoothstep(1.85, 2.38, t);
    float twinkle = 0.68 + 0.32 * sin(t * (14.0 + aSeed * 10.0) + aSeed * 20.0);

    vAlpha = fadeIn * fadeOut * twinkle;
    vStreak = smoothstep(0.45, 1.0, fallU) * (1.0 - smoothstep(0.92, 1.0, fallU));

    vec3 cGold = vec3(2.35, 1.92, 1.08);
    vec3 cRose = vec3(2.15, 0.72, 1.48);
    vec3 cWhite = vec3(2.45, 2.32, 2.48);
    vec3 baseCol = mix(cGold, cRose, aColorMix);
    float flash = exp(-t * 4.0);
    vColor = mix(baseCol, cWhite, clamp(flash * 0.65 + vStreak * 0.3, 0.0, 0.85));

    float atten = 42.0 / max(-mvPos.z, 2.0);
    gl_PointSize = clamp(aScale * (1.0 + flash * 0.75 + vStreak * 0.4) * uPixelRatio * atten, 2.0, 22.0);
  }
`;

const STARFALL_FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vStreak;

  void main() {
    if (vAlpha <= 0.005) discard;
    vec2 uv = gl_PointCoord - vec2(0.5);
    float d = length(uv);
    if (d > 0.5) discard;

    float core = exp(-d * d * 20.0);
    float halo = smoothstep(0.5, 0.08, d) * 0.55;
    float crossSpark = max(
      exp(-abs(uv.x) * 26.0) * exp(-abs(uv.y) * 5.2),
      exp(-abs(uv.y) * 26.0) * exp(-abs(uv.x) * 5.2)
    ) * (0.45 + vStreak * 0.65);

    float alpha = clamp((core + halo + crossSpark) * vAlpha, 0.0, 1.0);
    gl_FragColor = vec4(vColor * (core * 1.25 + halo * 0.75 + crossSpark), alpha);
  }
`;

/** Generates a single crisp 4-point starlight burst + soft cosmic halo texture shared by all stars. */
function createStarSpriteTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const cx = size / 2;
    const cy = size / 2;

    // Outer dreamy rose-violet halo
    const halo = ctx.createRadialGradient(cx, cy, 4, cx, cy, 118);
    halo.addColorStop(0, 'rgba(255, 250, 255, 1.0)');
    halo.addColorStop(0.18, 'rgba(255, 198, 240, 0.92)');
    halo.addColorStop(0.42, 'rgba(217, 70, 239, 0.42)');
    halo.addColorStop(0.72, 'rgba(139, 92, 246, 0.14)');
    halo.addColorStop(1, 'rgba(5, 2, 10, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, size, size);

    // Crisp 4-point star diffraction spikes
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = '#fff9fe';
    ctx.shadowColor = '#ff74c6';
    ctx.shadowBlur = 16;

    const drawSpike = (rx: number, ry: number) => {
      ctx.beginPath();
      ctx.moveTo(0, -ry);
      ctx.quadraticCurveTo(rx * 0.25, -ry * 0.16, rx, 0);
      ctx.quadraticCurveTo(rx * 0.25, ry * 0.16, 0, ry);
      ctx.quadraticCurveTo(-rx * 0.25, ry * 0.16, -rx, 0);
      ctx.quadraticCurveTo(-rx * 0.25, -ry * 0.16, 0, -ry);
      ctx.closePath();
      ctx.fill();
    };

    drawSpike(88, 12);
    drawSpike(12, 88);
    ctx.rotate(Math.PI / 4);
    ctx.globalAlpha = 0.52;
    drawSpike(46, 7);
    drawSpike(7, 46);
    ctx.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

interface StarNodeProps {
  milestone: ConstellationMilestone;
  index: number;
  totalCount: number;
  texture: THREE.CanvasTexture;
  planeGeo: THREE.PlaneGeometry;
  interactive: boolean;
  isSelected: boolean;
  isUnlocked: boolean;
  hasAnyOpenCard: boolean;
  isFinale: boolean;
  isConstellationView: boolean;
  reducedMotion: boolean;
}

interface TroikaTextHandle {
  fillOpacity: number;
  outlineOpacity: number;
}

function ConstellationStarNode({
  milestone,
  index,
  totalCount,
  texture,
  planeGeo,
  interactive,
  isSelected,
  isUnlocked,
  hasAnyOpenCard,
  isFinale,
  isConstellationView,
  reducedMotion,
}: StarNodeProps) {
  const scaleGroupRef = useRef<THREE.Group>(null);
  const labelGroupRef = useRef<THREE.Group>(null);
  const dateTextRef = useRef<TroikaTextHandle | null>(null);
  const titleTextRef = useRef<TroikaTextHandle | null>(null);
  const labelOpacityRef = useRef(0);
  const targetColorRef = useRef(new THREE.Color());
  const wasUnlockedRef = useRef(isUnlocked);
  const igniteStartMsRef = useRef<number | null>(null);
  const [hovered, setHovered] = useState(false);

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        color: COLOR_GALAXY_BG.clone(),
        opacity: 0.22,
      }),
    [texture]
  );

  // Trigger crisp star ignition pulse whenever a dormant star unlocks in Constellation View
  useEffect(() => {
    if (!isConstellationView) {
      wasUnlockedRef.current = index === 0;
      igniteStartMsRef.current = null;
      return;
    }

    if (isUnlocked && !wasUnlockedRef.current) {
      igniteStartMsRef.current = performance.now();
    }
    wasUnlockedRef.current = isUnlocked;
  }, [isConstellationView, isUnlocked, index]);

  useEffect(() => {
    if (!interactive && hovered) {
      setHovered(false);
      document.body.style.cursor = 'auto';
    }
  }, [interactive, hovered]);

  useEffect(() => {
    return () => {
      material.dispose();
      document.body.style.cursor = 'auto';
    };
  }, [material]);

  const handlePointerOver = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!interactive) return;
      event.stopPropagation();
      setHovered(true);
      document.body.style.cursor = 'pointer';
      sfxEngine.playHoverTick();
    },
    [interactive]
  );

  const handlePointerOut = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!interactive) return;
      event.stopPropagation();
      setHovered(false);
      document.body.style.cursor = 'auto';
    },
    [interactive]
  );

  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      if (!interactive) return;
      event.stopPropagation();
      const { maxUnlockedMilestoneIndex, setSelectedMilestoneId } = useAppStore.getState();
      if (index > maxUnlockedMilestoneIndex) {
        sfxEngine.playStarIgnite(index);
      } else {
        sfxEngine.playStarSelect();
      }
      setSelectedMilestoneId(milestone.id);
    },
    [interactive, index, milestone.id]
  );

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const elapsed = state.clock.elapsedTime;
    const nowMs = performance.now();

    // Compute wall-clock ignition burst (on unlocking next star OR Star #1 auto-arrival pulse)
    let igniteBurst = 0;
    if (!reducedMotion) {
      if (index === 0 && galaxySignals.constellationStar0IgniteMs > 0) {
        const entryElapsedMs = nowMs - galaxySignals.constellationStar0IgniteMs;
        if (entryElapsedMs >= 0 && entryElapsedMs < STAR_IGNITE_BURST_MS) {
          igniteBurst = Math.max(igniteBurst, Math.sin(Math.PI * (entryElapsedMs / STAR_IGNITE_BURST_MS)));
        }
      }
      if (igniteStartMsRef.current !== null) {
        const elapsedMs = nowMs - igniteStartMsRef.current;
        const delayMs = 260;
        if (elapsedMs >= delayMs) {
          const t = (elapsedMs - delayMs) / STAR_IGNITE_BURST_MS;
          if (t >= 1) {
            igniteStartMsRef.current = null;
          } else {
            igniteBurst = Math.max(igniteBurst, Math.sin(Math.PI * t));
          }
        }
      }
    }

    // Compute Phase 2 Circuit Surge (0.8s -> 1.5s), Phase 3 Emblem Glow (1.5s -> 3.3s), & Phase 4 Burst (3.3s+)
    let surgeFlare = 0;
    let simultaneousBurst = 0;
    if (isFinale && galaxySignals.constellationFinaleStartMs > 0 && !reducedMotion) {
      const fSec = (nowMs - galaxySignals.constellationFinaleStartMs) / 1000;
      const starNorm = totalCount > 1 ? index / (totalCount - 1) : 0;

      if (fSec >= SURGE_START_SEC && fSec < SURGE_END_SEC + 0.25) {
        const surgeT = THREE.MathUtils.clamp(
          (fSec - SURGE_START_SEC) / (SURGE_END_SEC - SURGE_START_SEC),
          0,
          1
        );
        const easedSurge = surgeT * surgeT * (3 - 2 * surgeT);
        const hitDist = easedSurge - starNorm;
        surgeFlare =
          Math.exp(-hitDist * hitDist * 75) *
          (1.0 - THREE.MathUtils.smoothstep(fSec, SURGE_END_SEC - 0.05, SURGE_END_SEC + 0.2));
      }

      if (fSec >= BURST_START_SEC) {
        const burstT = fSec - BURST_START_SEC;
        simultaneousBurst = Math.exp(-burstT * 3.1) * THREE.MathUtils.smoothstep(burstT, 0, 0.06);
      }
    }

    let targetOpacity = 0.22;
    let targetScale = 0.52;
    const targetColor = targetColorRef.current;

    if (!isConstellationView) {
      targetOpacity = 0.2;
      targetScale = 0.52;
      targetColor.copy(COLOR_GALAXY_BG);
    } else if (!isUnlocked) {
      // Dormant / Upcoming star: dimmed, smaller, pale-indigo, zero bloom/halo
      targetOpacity = hovered ? 0.36 : 0.21;
      targetScale = hovered ? 0.7 : 0.58;
      targetColor.copy(COLOR_DORMANT);
    } else if (isSelected || isFinale) {
      // Active star or Grand Finale showcase: brightest glow + gentle breathing halo
      const breathe = reducedMotion ? 1 : 1 + Math.sin(elapsed * 2.8 + index * 0.9) * 0.11;
      targetOpacity = 1.0;
      targetScale = (isFinale ? 1.42 : 1.48) * breathe;
      targetColor.copy(COLOR_ACTIVE);
    } else {
      // Previously unlocked / visited star (or inviting Star 0 before first click)
      const isStartBeacon = index === 0 && !hasAnyOpenCard;
      const pulseAmp = isStartBeacon ? 0.09 : 0.045;
      const pulse = reducedMotion ? 1 : 1 + Math.sin(elapsed * 2.3 + index * 1.15) * pulseAmp;
      targetOpacity = hovered ? 0.98 : isStartBeacon ? 0.96 : 0.84;
      targetScale = (hovered ? 1.28 : isStartBeacon ? 1.24 : 1.06) * pulse;
      targetColor.copy(isStartBeacon ? COLOR_ACTIVE : COLOR_VISITED);
    }

    if (igniteBurst > 0.001) {
      targetScale += igniteBurst * 0.58;
      targetOpacity = Math.min(1, targetOpacity + igniteBurst * 0.45);
      targetColor.lerp(COLOR_IGNITE_PEAK, igniteBurst * 0.85);
    }

    const finaleEnergy = Math.max(surgeFlare, simultaneousBurst);
    if (finaleEnergy > 0.001) {
      targetScale += surgeFlare * 0.55 + simultaneousBurst * 0.82;
      targetOpacity = 1.0;
      targetColor.lerp(COLOR_SURGE_GOLD, Math.min(1, surgeFlare * 0.85 + simultaneousBurst * 0.95));
    }

    const fastLerp = igniteBurst > 0 || finaleEnergy > 0.05;
    const lerpRate = Math.min(1, dt * (fastLerp ? 18 : 7.5));
    material.opacity = THREE.MathUtils.lerp(material.opacity, targetOpacity, lerpRate);
    material.color.lerp(targetColor, lerpRate);

    if (scaleGroupRef.current) {
      const nextScale = THREE.MathUtils.lerp(
        scaleGroupRef.current.scale.x,
        targetScale,
        Math.min(1, dt * (fastLerp ? 18 : 9.5))
      );
      scaleGroupRef.current.scale.setScalar(nextScale);
    }

    // Mobile & modal clarity: smoothly fade out 3D floating date/title label while any Milestone Card is open
    const desiredLabelOpacity =
      isConstellationView && !hasAnyOpenCard && !isFinale && (hovered || index === 0) ? 1 : 0;
    labelOpacityRef.current = THREE.MathUtils.lerp(
      labelOpacityRef.current,
      desiredLabelOpacity,
      Math.min(1, dt * 12)
    );
    const labelAlpha = labelOpacityRef.current;

    if (labelGroupRef.current) {
      labelGroupRef.current.visible = labelAlpha > 0.015;
    }
    if (dateTextRef.current) {
      dateTextRef.current.fillOpacity = labelAlpha;
    }
    if (titleTextRef.current) {
      titleTextRef.current.fillOpacity = labelAlpha;
      titleTextRef.current.outlineOpacity = labelAlpha;
    }
  });

  return (
    <group position={milestone.position} name={`constellation-star-${milestone.id}`}>
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        <group ref={scaleGroupRef} scale={0.55}>
          <mesh
            geometry={planeGeo}
            material={material}
            onPointerOver={handlePointerOver}
            onPointerOut={handlePointerOut}
            onClick={handleClick}
          />
          <group ref={labelGroupRef} position={[0, 1.06, 0.02]} visible={false}>
            <Text
              ref={dateTextRef}
              font="/fonts/BeVietnamPro-SemiBold.ttf"
              position={[0, 0.24, 0]}
              fontSize={0.21}
              letterSpacing={0.08}
              color="#ff8ed0"
              anchorX="center"
              anchorY="middle"
              fillOpacity={0}
              material-toneMapped={false}
            >
              {milestone.date}
            </Text>
            <Text
              ref={titleTextRef}
              font="/fonts/BeVietnamPro-SemiBold.ttf"
              position={[0, -0.08, 0]}
              fontSize={0.26}
              letterSpacing={0.02}
              color="#fff6fe"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.018}
              outlineColor="#9333ea"
              fillOpacity={0}
              outlineOpacity={0}
              material-toneMapped={false}
            >
              {milestone.title}
            </Text>
          </group>
        </group>
      </Billboard>
    </group>
  );
}

export function ConstellationSky({ active, reducedMotion = false }: ConstellationSkyProps) {
  const viewMode = useViewMode();
  const selectedMilestoneId = useSelectedMilestoneId();
  const maxUnlockedIndex = useMaxUnlockedMilestoneIndex();
  const isFinale = useConstellationFinaleActive();
  const isConstellation = active && viewMode === 'constellation';
  const hasAnyOpenCard = isConstellation && selectedMilestoneId !== null;

  // Wall-clock synced progressive line ignition (~0.45s per segment advance)
  const drawProgressRef = useRef(0);
  const lineAnimStartMsRef = useRef(0);
  const lineAnimFromRef = useRef(0);
  const lineAnimToRef = useRef(0);
  const lineAnimActiveRef = useRef(false);
  const igniteWaveRef = useRef(0);
  const finaleBoostRef = useRef(0);

  const shockRef = useRef<THREE.Mesh>(null);
  const starfallRef = useRef<THREE.Points>(null);

  const milestones = ANNIVERSARY_DATA.constellationMilestones;
  const totalSegments = Math.max(1, milestones.length - 1);

  // Trigger smooth 0.45s line draw animation whenever maxUnlockedIndex advances, and reset cleanly on exit/re-entry
  useEffect(() => {
    if (!isConstellation) {
      lineAnimActiveRef.current = false;
      lineAnimFromRef.current = 0;
      lineAnimToRef.current = 0;
      drawProgressRef.current = 0;
      igniteWaveRef.current = 0;
      return;
    }

    const targetNorm = THREE.MathUtils.clamp(maxUnlockedIndex / totalSegments, 0, 1);
    if (reducedMotion) {
      drawProgressRef.current = targetNorm;
      lineAnimActiveRef.current = false;
      igniteWaveRef.current = 0;
      return;
    }

    if (Math.abs(targetNorm - drawProgressRef.current) > 0.001) {
      lineAnimFromRef.current = drawProgressRef.current;
      lineAnimToRef.current = targetNorm;
      lineAnimStartMsRef.current = performance.now();
      lineAnimActiveRef.current = true;
    }
  }, [isConstellation, maxUnlockedIndex, totalSegments, reducedMotion]);

  const {
    starTexture,
    starPlaneGeo,
    lineObject,
    lineGeo,
    lineMat,
    shockGeo,
    shockMat,
    starfallGeo,
    starfallMat,
    constellationCenter,
  } = useMemo(() => {
    const tex = createStarSpriteTexture();
    const plane = new THREE.PlaneGeometry(1.45, 1.45);

    // Subdivide sequential milestone segments + Capricornus closing ridge (Star #7 Theta -> Star #2 Dabih)
    const samplesPerSegment = 24;
    const baseSegCount = Math.max(0, milestones.length - 1);
    const hasCapricornClosingArch = milestones.length >= 7;
    const renderSegCount = baseSegCount + (hasCapricornClosingArch ? 1 : 0);
    const totalPoints = renderSegCount > 0 ? renderSegCount * samplesPerSegment + 1 : 0;

    const positions = new Float32Array(totalPoints * 3);
    const progress = new Float32Array(totalPoints);

    if (renderSegCount > 0) {
      let ptr = 0;
      for (let s = 0; s < renderSegCount; s++) {
        const isClosingArch = hasCapricornClosingArch && s === renderSegCount - 1;
        const a = isClosingArch ? milestones[milestones.length - 1].position : milestones[s].position;
        const b = isClosingArch ? milestones[1].position : milestones[s + 1].position;
        const steps = s === renderSegCount - 1 ? samplesPerSegment + 1 : samplesPerSegment;

        // Map aProgress so unlocking the final star (07/07) smoothly draws both Star #6->#7 and closes #7->#2
        let segStartProg = s / baseSegCount;
        let segEndProg = (s + 1) / baseSegCount;
        if (hasCapricornClosingArch && s === baseSegCount - 1) {
          segStartProg = (baseSegCount - 1) / baseSegCount;
          segEndProg = (baseSegCount - 0.5) / baseSegCount;
        } else if (isClosingArch) {
          segStartProg = (baseSegCount - 0.5) / baseSegCount;
          segEndProg = 1.0;
        }

        for (let k = 0; k < steps; k++) {
          const frac = k / samplesPerSegment;
          const p3 = ptr * 3;
          positions[p3] = a[0] + (b[0] - a[0]) * frac;
          positions[p3 + 1] = a[1] + (b[1] - a[1]) * frac;
          positions[p3 + 2] = a[2] + (b[2] - a[2]) * frac;
          progress[ptr] = segStartProg + (segEndProg - segStartProg) * frac;
          ptr++;
        }
      }
    }

    const lGeo = new THREE.BufferGeometry();
    lGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    lGeo.setAttribute('aProgress', new THREE.BufferAttribute(progress, 1));

    const lMat = new THREE.ShaderMaterial({
      vertexShader: LINE_VERTEX_SHADER,
      fragmentShader: LINE_FRAGMENT_SHADER,
      uniforms: {
        uDrawProgress: { value: 0 },
        uTime: { value: 0 },
        uOpacity: { value: 0 },
        uIgniteWave: { value: 0 },
        uFinaleBoost: { value: 0 },
        uSurgeProgress: { value: -0.5 },
        uSurgeIntensity: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const line = new THREE.Line(lGeo, lMat);
    line.frustumCulled = false;

    // Constellation center for the expanding 3D celestial shockwave halo
    const center: [number, number, number] = [0, 16.2, -7.8];
    if (milestones.length > 0) {
      let cx = 0;
      let cy = 0;
      let cz = 0;
      for (const m of milestones) {
        cx += m.position[0];
        cy += m.position[1];
        cz += m.position[2];
      }
      center[0] = cx / milestones.length;
      center[1] = cy / milestones.length;
      center[2] = cz / milestones.length;
    }

    const sGeo = new THREE.PlaneGeometry(34, 34);
    const sMat = new THREE.ShaderMaterial({
      vertexShader: CELESTIAL_SHOCKWAVE_VERTEX,
      fragmentShader: CELESTIAL_SHOCKWAVE_FRAGMENT,
      uniforms: {
        uProgress: { value: 0 },
        uOpacity: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    // Object-pooled 420 golden-pink Starfall Cascade particles (60 seeded at each constellation star)
    const count = milestones.length * PARTICLES_PER_STAR;
    const sfPos = new Float32Array(count * 3);
    const sfVel = new Float32Array(count * 3);
    const sfScale = new Float32Array(count);
    const sfDelay = new Float32Array(count);
    const sfColorMix = new Float32Array(count);
    const sfSeed = new Float32Array(count);

    // Deterministic LCG for zero-variance crisp starburst distribution
    let seed = 20261120;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    let idx = 0;
    for (let m = 0; m < milestones.length; m++) {
      const origin = milestones[m].position;
      for (let k = 0; k < PARTICLES_PER_STAR; k++) {
        const i3 = idx * 3;
        sfPos[i3] = origin[0];
        sfPos[i3 + 1] = origin[1];
        sfPos[i3 + 2] = origin[2];

        const theta = rand() * Math.PI * 2;
        const phi = Math.acos(2 * rand() - 1);
        const speed = 0.55 + rand() * 1.35;
        sfVel[i3] = Math.sin(phi) * Math.cos(theta) * speed;
        sfVel[i3 + 1] = Math.cos(phi) * speed * 0.92 + 0.25;
        sfVel[i3 + 2] = Math.sin(phi) * Math.sin(theta) * speed * 0.85;

        sfScale[idx] = 0.85 + rand() * 1.45;
        sfDelay[idx] = rand() * 0.26;
        sfColorMix[idx] = rand();
        sfSeed[idx] = rand();
        idx++;
      }
    }

    const sfGeo = new THREE.BufferGeometry();
    sfGeo.setAttribute('position', new THREE.BufferAttribute(sfPos, 3));
    sfGeo.setAttribute('aBurstVel', new THREE.BufferAttribute(sfVel, 3));
    sfGeo.setAttribute('aScale', new THREE.BufferAttribute(sfScale, 1));
    sfGeo.setAttribute('aDelay', new THREE.BufferAttribute(sfDelay, 1));
    sfGeo.setAttribute('aColorMix', new THREE.BufferAttribute(sfColorMix, 1));
    sfGeo.setAttribute('aSeed', new THREE.BufferAttribute(sfSeed, 1));

    const sfMat = new THREE.ShaderMaterial({
      vertexShader: STARFALL_VERTEX_SHADER,
      fragmentShader: STARFALL_FRAGMENT_SHADER,
      uniforms: {
        uCascadeTime: { value: -1 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
        uHeartTarget: { value: HEART_ABSORB_WORLD.clone() },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return {
      starTexture: tex,
      starPlaneGeo: plane,
      lineObject: line,
      lineGeo: lGeo,
      lineMat: lMat,
      shockGeo: sGeo,
      shockMat: sMat,
      starfallGeo: sfGeo,
      starfallMat: sfMat,
      constellationCenter: center,
    };
  }, [milestones]);

  useEffect(() => {
    return () => {
      starTexture.dispose();
      starPlaneGeo.dispose();
      lineGeo.dispose();
      lineMat.dispose();
      shockGeo.dispose();
      shockMat.dispose();
      starfallGeo.dispose();
      starfallMat.dispose();
      galaxySignals.constellationBloomSpike = 0;
      galaxySignals.heartAbsorptionGlow = 0;
    };
  }, [starTexture, starPlaneGeo, lineGeo, lineMat, shockGeo, shockMat, starfallGeo, starfallMat]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const nowMs = performance.now();
    lineMat.uniforms.uTime.value = state.clock.elapsedTime;
    starfallMat.uniforms.uPixelRatio.value = state.gl.getPixelRatio();

    if (isConstellation && lineAnimActiveRef.current) {
      const t = THREE.MathUtils.clamp(
        (nowMs - lineAnimStartMsRef.current) / LINE_IGNITE_DURATION_MS,
        0,
        1
      );
      const eased = 1 - Math.pow(1 - t, 3);
      drawProgressRef.current = THREE.MathUtils.lerp(
        lineAnimFromRef.current,
        lineAnimToRef.current,
        eased
      );
      igniteWaveRef.current = Math.sin(Math.PI * t);

      if (t >= 1) {
        drawProgressRef.current = lineAnimToRef.current;
        lineAnimActiveRef.current = false;
        igniteWaveRef.current = 0;
      }
    } else {
      igniteWaveRef.current = THREE.MathUtils.lerp(igniteWaveRef.current, 0, Math.min(1, dt * 10));
    }

    // ─── 4.5s CONSTELLATION EMBLEM REVEAL & STARFALL CASCADE STATE MACHINE ───
    let surgeProgress = -0.5;
    let surgeIntensity = 0;
    let shockProg = 0;
    let shockOp = 0;
    let cascadeTime = -1;
    let bloomSpike = 0;
    let heartAbsorb = 0;

    if (galaxySignals.constellationFinaleStartMs > 0 && !reducedMotion) {
      const fSec = (nowMs - galaxySignals.constellationFinaleStartMs) / 1000;

      if (fSec < CASCADE_TOTAL_SEC) {
        // Phase 2 (0.8s -> 1.5s): Golden-white circuit surge pulse racing Star #1 -> Star #7 -> closing arch
        if (fSec >= SURGE_START_SEC && fSec < SURGE_END_SEC + 0.2) {
          const sT = THREE.MathUtils.clamp(
            (fSec - SURGE_START_SEC) / (SURGE_END_SEC - SURGE_START_SEC),
            0,
            1
          );
          surgeProgress = sT * sT * (3 - 2 * sT);
          surgeIntensity =
            THREE.MathUtils.smoothstep(fSec, SURGE_START_SEC, SURGE_START_SEC + 0.08) *
            (1.0 - THREE.MathUtils.smoothstep(fSec, SURGE_END_SEC, SURGE_END_SEC + 0.2));
        }

        // Phase 3 (1.5s -> 3.3s): Subtle luminous bloom halo supporting the materialized Emblem
        if (fSec >= SURGE_END_SEC && fSec < BURST_START_SEC) {
          const embT = fSec - SURGE_END_SEC;
          bloomSpike = 0.24 * THREE.MathUtils.smoothstep(embT, 0, 0.35);
        }

        // Phase 4 (3.3s -> 5.7s): Emblem Dissolve -> Simultaneous Burst, Shockwave Halo, Starfall -> Heart Absorption
        if (fSec >= BURST_START_SEC) {
          cascadeTime = fSec - BURST_START_SEC;

          // Expanding 3D celestial shockwave halo (3.3s -> 4.25s)
          if (cascadeTime < 0.95) {
            shockProg = 1.0 - Math.exp(-cascadeTime * 3.2);
            shockOp = Math.pow(Math.max(0, 1.0 - cascadeTime / 0.92), 1.35) * 0.92;
          }

          // Luminous bloom spike right at burst impact (3.3s -> 3.85s)
          if (cascadeTime < 0.55) {
            bloomSpike = Math.exp(-cascadeTime * 6.5) * 0.85;
          }

          // Warm joyous absorption shimmer on the 3D Particle Heart as starfall arrives (4.35s -> 5.45s)
          if (fSec >= HEART_ABSORB_START_SEC && fSec <= HEART_ABSORB_END_SEC) {
            const absU =
              (fSec - HEART_ABSORB_START_SEC) / (HEART_ABSORB_END_SEC - HEART_ABSORB_START_SEC);
            heartAbsorb = Math.sin(Math.PI * absU);
          }
        }
      } else {
        galaxySignals.constellationFinaleStartMs = 0;
      }
    }

    galaxySignals.constellationBloomSpike = bloomSpike;
    galaxySignals.heartAbsorptionGlow = heartAbsorb;

    finaleBoostRef.current = THREE.MathUtils.lerp(
      finaleBoostRef.current,
      isConstellation && isFinale ? 1 : 0,
      Math.min(1, dt * 5)
    );

    lineMat.uniforms.uDrawProgress.value = drawProgressRef.current;
    lineMat.uniforms.uIgniteWave.value = igniteWaveRef.current;
    lineMat.uniforms.uFinaleBoost.value = finaleBoostRef.current;
    lineMat.uniforms.uSurgeProgress.value = surgeProgress;
    lineMat.uniforms.uSurgeIntensity.value = surgeIntensity;

    const targetOpacity = isConstellation ? 0.94 : 0;
    lineMat.uniforms.uOpacity.value = THREE.MathUtils.lerp(
      lineMat.uniforms.uOpacity.value,
      targetOpacity,
      Math.min(1, dt * 5.5)
    );

    shockMat.uniforms.uProgress.value = shockProg;
    shockMat.uniforms.uOpacity.value = shockOp;
    if (shockRef.current) {
      shockRef.current.visible = shockOp > 0.005;
    }

    starfallMat.uniforms.uCascadeTime.value = cascadeTime;
    if (starfallRef.current) {
      starfallRef.current.visible = cascadeTime >= 0 && cascadeTime < 2.6;
    }
  });

  if (!milestones.length) return null;

  return (
    <group name="constellation-timeline-sky">
      <primitive object={lineObject} />

      {/* Expanding 3D Celestial Shockwave Halo on Simultaneous Burst */}
      <Billboard position={constellationCenter} follow>
        <mesh ref={shockRef} geometry={shockGeo} material={shockMat} visible={false} />
      </Billboard>

      {/* Object-Pooled 420-Particle Starfall Cascade descending from Constellation -> Particle Heart */}
      <points
        ref={starfallRef}
        geometry={starfallGeo}
        material={starfallMat}
        visible={false}
        frustumCulled={false}
      />

      {milestones.map((milestone, index) => (
        <ConstellationStarNode
          key={milestone.id}
          milestone={milestone}
          index={index}
          totalCount={milestones.length}
          texture={starTexture}
          planeGeo={starPlaneGeo}
          interactive={isConstellation && !isFinale}
          isSelected={selectedMilestoneId === milestone.id}
          isUnlocked={index <= maxUnlockedIndex}
          hasAnyOpenCard={hasAnyOpenCard}
          isFinale={isFinale}
          isConstellationView={isConstellation}
          reducedMotion={reducedMotion}
        />
      ))}
    </group>
  );
}
