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
  useSelectedMilestoneId,
  useViewMode,
} from '../../../store/useAppStore';
import { sfxEngine } from '../../../utils/sfxEngine';

interface ConstellationSkyProps {
  active: boolean;
  reducedMotion?: boolean;
}

const LINE_VERTEX_SHADER = /* glsl */ `
  attribute float aProgress;
  uniform float uDrawProgress;
  uniform float uTime;

  varying float vProgress;
  varying float vVisible;
  varying float vPulse;

  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vProgress = aProgress;
    // Smooth glowing leading tip as constellation draws across the sky
    vVisible = 1.0 - smoothstep(uDrawProgress - 0.04, uDrawProgress + 0.01, aProgress);
    vPulse = 0.72 + 0.28 * sin(aProgress * 18.0 - uTime * 2.4);
  }
`;

const LINE_FRAGMENT_SHADER = /* glsl */ `
  uniform float uOpacity;
  varying float vProgress;
  varying float vVisible;
  varying float vPulse;

  void main() {
    float alpha = vVisible * uOpacity * (0.55 + 0.45 * vPulse);
    if (alpha <= 0.005) discard;

    vec3 cLavender = vec3(0.92, 0.84, 1.48);
    vec3 cPink = vec3(1.38, 0.45, 0.96);
    vec3 col = mix(cLavender, cPink, 0.45 + 0.35 * sin(vProgress * 6.2831));
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
  isConstellationView: boolean;
  reducedMotion: boolean;
}

function ConstellationStarNode({
  milestone,
  index,
  texture,
  planeGeo,
  interactive,
  isSelected,
  isConstellationView,
  reducedMotion,
}: StarNodeProps) {
  const scaleGroupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        color: new THREE.Color(1.32, 1.18, 1.45),
        opacity: 0.35,
      }),
    [texture]
  );

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
      sfxEngine.playStarSelect();
      useAppStore.getState().setSelectedMilestoneId(milestone.id);
    },
    [interactive, milestone.id]
  );

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const elapsed = state.clock.elapsedTime;
    const pulse = reducedMotion ? 1 : 1 + Math.sin(elapsed * 2.4 + index * 1.15) * 0.09;

    const targetOpacity = isConstellationView ? 1.0 : 0.24;
    material.opacity = THREE.MathUtils.lerp(material.opacity, targetOpacity, Math.min(1, dt * 5));

    if (scaleGroupRef.current) {
      const baseScale = isConstellationView ? 1.18 : 0.55;
      const focusBoost = isSelected ? 1.42 : hovered ? 1.3 : 1.0;
      const targetScale = baseScale * focusBoost * pulse;
      const next = THREE.MathUtils.lerp(scaleGroupRef.current.scale.x, targetScale, Math.min(1, dt * 10));
      scaleGroupRef.current.scale.setScalar(next);
    }
  });

  const showLabel = isConstellationView && (hovered || isSelected);

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
          {showLabel && (
            <group position={[0, 1.02, 0.02]}>
              <Text
                position={[0, 0.22, 0]}
                fontSize={0.22}
                letterSpacing={0.12}
                color="#ff8ed0"
                anchorX="center"
                anchorY="middle"
                material-toneMapped={false}
              >
                {milestone.date}
              </Text>
              <Text
                position={[0, -0.08, 0]}
                fontSize={0.27}
                letterSpacing={0.04}
                color="#fff6fe"
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.018}
                outlineColor="#9333ea"
                material-toneMapped={false}
              >
                {milestone.title}
              </Text>
            </group>
          )}
        </group>
      </Billboard>
    </group>
  );
}

export function ConstellationSky({ active, reducedMotion = false }: ConstellationSkyProps) {
  const viewMode = useViewMode();
  const selectedMilestoneId = useSelectedMilestoneId();
  const isConstellation = active && viewMode === 'constellation';
  const drawProgressRef = useRef(0);

  const milestones = ANNIVERSARY_DATA.constellationMilestones;

  const { starTexture, starPlaneGeo, lineObject, lineGeo, lineMat } = useMemo(() => {
    const tex = createStarSpriteTexture();
    const plane = new THREE.PlaneGeometry(1.45, 1.45);

    // Subdivide sequential milestone segments smoothly so the GLSL draw-in animation flows seamlessly
    const samplesPerSegment = 24;
    const totalSegments = Math.max(0, milestones.length - 1);
    const totalPoints = totalSegments > 0 ? totalSegments * samplesPerSegment + 1 : 0;

    const positions = new Float32Array(totalPoints * 3);
    const progress = new Float32Array(totalPoints);

    if (totalSegments > 0) {
      let ptr = 0;
      for (let s = 0; s < totalSegments; s++) {
        const a = milestones[s].position;
        const b = milestones[s + 1].position;
        const steps = s === totalSegments - 1 ? samplesPerSegment + 1 : samplesPerSegment;

        for (let k = 0; k < steps; k++) {
          const frac = k / samplesPerSegment;
          const p3 = ptr * 3;
          positions[p3] = a[0] + (b[0] - a[0]) * frac;
          positions[p3 + 1] = a[1] + (b[1] - a[1]) * frac;
          positions[p3 + 2] = a[2] + (b[2] - a[2]) * frac;
          progress[ptr] = (s + frac) / totalSegments;
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

    const targetDraw = isConstellation ? 1.05 : 0;
    const speed = isConstellation ? (reducedMotion ? 8 : 0.78) : 2.2;

    if (drawProgressRef.current < targetDraw) {
      drawProgressRef.current = Math.min(targetDraw, drawProgressRef.current + dt * speed);
    } else if (drawProgressRef.current > targetDraw) {
      drawProgressRef.current = Math.max(targetDraw, drawProgressRef.current - dt * speed);
    }

    lineMat.uniforms.uDrawProgress.value = drawProgressRef.current;
    const targetOpacity = isConstellation ? 0.92 : 0;
    lineMat.uniforms.uOpacity.value = THREE.MathUtils.lerp(
      lineMat.uniforms.uOpacity.value,
      targetOpacity,
      Math.min(1, dt * 5)
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
          interactive={isConstellation}
          isSelected={selectedMilestoneId === milestone.id}
          isConstellationView={isConstellation}
          reducedMotion={reducedMotion}
        />
      ))}
    </group>
  );
}
