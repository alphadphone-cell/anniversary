import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import {
  ANNIVERSARY_DATA,
  type ConstellationMilestone,
} from '../../../data/anniversaryData';
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

const LINE_IGNITE_DURATION_MS = 450;
const STAR_IGNITE_BURST_MS = 620;

const COLOR_DORMANT = new THREE.Color(0.46, 0.50, 0.78);
const COLOR_GALAXY_BG = new THREE.Color(0.95, 0.88, 1.18);
const COLOR_VISITED = new THREE.Color(1.22, 1.06, 1.38);
const COLOR_ACTIVE = new THREE.Color(1.66, 1.34, 1.78);
const COLOR_IGNITE_PEAK = new THREE.Color(2.35, 1.98, 2.45);

const LINE_VERTEX_SHADER = /* glsl */ `
  attribute float aProgress;
  uniform float uDrawProgress;
  uniform float uTime;

  varying float vProgress;
  varying float vLit;
  varying float vLeading;
  varying float vPulse;

  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vProgress = aProgress;
    // Soft glowing edge as each segment ignites from star i to star i + 1
    vLit = 1.0 - smoothstep(uDrawProgress - 0.025, uDrawProgress + 0.008, aProgress);
    float distToTip = abs(aProgress - uDrawProgress);
    vLeading = exp(-distToTip * distToTip * 950.0);
    vPulse = 0.74 + 0.26 * sin(aProgress * 18.0 - uTime * 2.4);
  }
`;

const LINE_FRAGMENT_SHADER = /* glsl */ `
  uniform float uOpacity;
  uniform float uIgniteWave;
  uniform float uFinaleBoost;
  varying float vProgress;
  varying float vLit;
  varying float vLeading;
  varying float vPulse;

  void main() {
    if (uOpacity <= 0.004) discard;

    // Ultra-faint dormant sky guide (~0.08) for upcoming unvisited segments
    float dormantAlpha = 0.08 * (1.0 - vLit);
    float litAlpha = vLit * (0.58 + 0.42 * vPulse) * (1.0 + uFinaleBoost * 0.22);
    float waveSpark = vLeading * uIgniteWave * 0.95;

    float alpha = clamp((dormantAlpha + litAlpha + waveSpark) * uOpacity, 0.0, 1.0);
    if (alpha <= 0.005) discard;

    vec3 cDormant = vec3(0.46, 0.50, 0.78);
    vec3 cLavender = vec3(0.95, 0.86, 1.52);
    vec3 cPink = vec3(1.42, 0.48, 0.98);
    vec3 cSpark = vec3(2.2, 1.85, 2.35);

    vec3 litCol = mix(cLavender, cPink, 0.45 + 0.35 * sin(vProgress * 6.2831));
    litCol *= (1.0 + uFinaleBoost * 0.28);

    vec3 col = mix(cDormant, litCol, vLit);
    col = mix(col, cSpark, clamp(waveSpark, 0.0, 1.0));
    gl_FragColor = vec4(col, alpha);
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

    // Compute wall-clock ignition burst (peaks as the 0.45s connecting line reaches this star)
    let igniteBurst = 0;
    if (igniteStartMsRef.current !== null && !reducedMotion) {
      const elapsedMs = performance.now() - igniteStartMsRef.current;
      const delayMs = 140;
      if (elapsedMs >= delayMs) {
        const t = (elapsedMs - delayMs) / STAR_IGNITE_BURST_MS;
        if (t >= 1) {
          igniteStartMsRef.current = null;
        } else {
          igniteBurst = Math.sin(Math.PI * t);
        }
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
      targetScale = (isFinale ? 1.38 : 1.48) * breathe;
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

    const lerpRate = Math.min(1, dt * (igniteBurst > 0 ? 15 : 7.5));
    material.opacity = THREE.MathUtils.lerp(material.opacity, targetOpacity, lerpRate);
    material.color.lerp(targetColor, lerpRate);

    if (scaleGroupRef.current) {
      const nextScale = THREE.MathUtils.lerp(
        scaleGroupRef.current.scale.x,
        targetScale,
        Math.min(1, dt * (igniteBurst > 0 ? 16 : 9.5))
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

  const { starTexture, starPlaneGeo, lineObject, lineGeo, lineMat } = useMemo(() => {
    const tex = createStarSpriteTexture();
    const plane = new THREE.PlaneGeometry(1.45, 1.45);

    // Subdivide sequential milestone segments smoothly so progressive GLSL ignition flows seamlessly
    const samplesPerSegment = 24;
    const segCount = Math.max(0, milestones.length - 1);
    const totalPoints = segCount > 0 ? segCount * samplesPerSegment + 1 : 0;

    const positions = new Float32Array(totalPoints * 3);
    const progress = new Float32Array(totalPoints);

    if (segCount > 0) {
      let ptr = 0;
      for (let s = 0; s < segCount; s++) {
        const a = milestones[s].position;
        const b = milestones[s + 1].position;
        const steps = s === segCount - 1 ? samplesPerSegment + 1 : samplesPerSegment;

        for (let k = 0; k < steps; k++) {
          const frac = k / samplesPerSegment;
          const p3 = ptr * 3;
          positions[p3] = a[0] + (b[0] - a[0]) * frac;
          positions[p3 + 1] = a[1] + (b[1] - a[1]) * frac;
          positions[p3 + 2] = a[2] + (b[2] - a[2]) * frac;
          progress[ptr] = (s + frac) / segCount;
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
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const line = new THREE.Line(lGeo, lMat);
    line.frustumCulled = false;

    return {
      starTexture: tex,
      starPlaneGeo: plane,
      lineObject: line,
      lineGeo: lGeo,
      lineMat: lMat,
    };
  }, [milestones]);

  useEffect(() => {
    return () => {
      starTexture.dispose();
      starPlaneGeo.dispose();
      lineGeo.dispose();
      lineMat.dispose();
    };
  }, [starTexture, starPlaneGeo, lineGeo, lineMat]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    lineMat.uniforms.uTime.value = state.clock.elapsedTime;

    if (isConstellation && lineAnimActiveRef.current) {
      const t = THREE.MathUtils.clamp(
        (performance.now() - lineAnimStartMsRef.current) / LINE_IGNITE_DURATION_MS,
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

    finaleBoostRef.current = THREE.MathUtils.lerp(
      finaleBoostRef.current,
      isConstellation && isFinale ? 1 : 0,
      Math.min(1, dt * 5)
    );

    lineMat.uniforms.uDrawProgress.value = drawProgressRef.current;
    lineMat.uniforms.uIgniteWave.value = igniteWaveRef.current;
    lineMat.uniforms.uFinaleBoost.value = finaleBoostRef.current;

    const targetOpacity = isConstellation ? 0.94 : 0;
    lineMat.uniforms.uOpacity.value = THREE.MathUtils.lerp(
      lineMat.uniforms.uOpacity.value,
      targetOpacity,
      Math.min(1, dt * 5.5)
    );
  });

  if (!milestones.length) return null;

  return (
    <group name="constellation-timeline-sky">
      <primitive object={lineObject} />
      {milestones.map((milestone, index) => (
        <ConstellationStarNode
          key={milestone.id}
          milestone={milestone}
          index={index}
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
