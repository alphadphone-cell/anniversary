import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import { ANNIVERSARY_DATA, type GalaxyNodeConfig } from '../../../data/anniversaryData';
import { useAppStore } from '../../../store/useAppStore';
import { sfxEngine } from '../../../utils/sfxEngine';

interface OrbitingNodesProps {
  interactive?: boolean;
  reducedMotion?: boolean;
}

/** Draws a crisp, luminous glowing heart/sticker medallion onto a 256x256 CanvasTexture. */
function createNodeTexture(node: GalaxyNodeConfig): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const cx = size / 2;
    const cy = size / 2;

    // Soft outer cosmic bloom aura
    const aura = ctx.createRadialGradient(cx, cy, 18, cx, cy, 118);
    aura.addColorStop(0, `${node.primaryColor}cc`);
    aura.addColorStop(0.48, `${node.primaryColor}48`);
    aura.addColorStop(1, 'rgba(5, 2, 10, 0)');
    ctx.fillStyle = aura;
    ctx.fillRect(0, 0, size, size);

    const drawHeart = (x: number, y: number, r: number, fill: string | CanvasGradient) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.beginPath();
      ctx.moveTo(0, r * 0.78);
      ctx.bezierCurveTo(-r * 1.15, r * 0.15, -r * 1.05, -r * 0.85, -r * 0.48, -r * 0.85);
      ctx.bezierCurveTo(-r * 0.16, -r * 0.85, 0, -r * 0.56, 0, -r * 0.42);
      ctx.bezierCurveTo(0, -r * 0.56, r * 0.16, -r * 0.85, r * 0.48, -r * 0.85);
      ctx.bezierCurveTo(r * 1.05, -r * 0.85, r * 1.15, r * 0.15, 0, r * 0.78);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.restore();
    };

    const heartGrad = ctx.createRadialGradient(cx - 18, cy - 22, 8, cx, cy + 12, 84);
    heartGrad.addColorStop(0, node.secondaryColor);
    heartGrad.addColorStop(0.45, node.primaryColor);
    heartGrad.addColorStop(1, '#701a75');

    ctx.shadowColor = node.primaryColor;
    ctx.shadowBlur = 24;

    if (node.emblem === 'twin-hearts') {
      drawHeart(cx - 24, cy + 10, 44, heartGrad);
      drawHeart(cx + 22, cy - 8, 56, heartGrad);
    } else {
      drawHeart(cx, cy + 4, 66, heartGrad);
    }

    // Crisp minimalist white sticker emblem inside the heart
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ffffff';
    ctx.strokeStyle = '#fff7fd';
    ctx.fillStyle = '#fff7fd';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (node.emblem === 'heart-mail') {
      // Envelope icon
      ctx.strokeRect(cx - 22, cy - 12, 44, 28);
      ctx.beginPath();
      ctx.moveTo(cx - 22, cy - 12);
      ctx.lineTo(cx, cy + 5);
      ctx.lineTo(cx + 22, cy - 12);
      ctx.stroke();
    } else if (node.emblem === 'heart-clock') {
      // Clock emblem
      ctx.beginPath();
      ctx.arc(cx, cy + 2, 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy + 2);
      ctx.lineTo(cx, cy - 9);
      ctx.moveTo(cx, cy + 2);
      ctx.lineTo(cx + 9, cy + 6);
      ctx.stroke();
    } else if (node.emblem === 'star-heart') {
      // Four-point cosmic star sparkle
      ctx.beginPath();
      ctx.moveTo(cx, cy - 22);
      ctx.quadraticCurveTo(cx + 4, cy - 4, cx + 22, cy);
      ctx.quadraticCurveTo(cx + 4, cy + 4, cx, cy + 22);
      ctx.quadraticCurveTo(cx - 4, cy + 4, cx - 22, cy);
      ctx.quadraticCurveTo(cx - 4, cy - 4, cx, cy - 22);
      ctx.closePath();
      ctx.fill();
    } else if (node.emblem === 'keepsake-heart') {
      // Polaroid frame emblem
      ctx.strokeRect(cx - 19, cy - 18, 38, 38);
      ctx.beginPath();
      ctx.moveTo(cx - 19, cy + 10);
      ctx.lineTo(cx + 19, cy + 10);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx - 6, cy - 6, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

interface GalaxyNodeItemProps {
  node: GalaxyNodeConfig;
  interactive: boolean;
  reducedMotion: boolean;
}

function GalaxyNodeItem({ node, interactive, reducedMotion }: GalaxyNodeItemProps) {
  const groupRef = useRef<THREE.Group>(null);
  const scaleWrapperRef = useRef<THREE.Group>(null);
  const angleRef = useRef(node.orbitAngle);
  const [hovered, setHovered] = useState(false);

  const { texture, geometry, material } = useMemo(() => {
    const tex = createNodeTexture(node);
    const geo = new THREE.PlaneGeometry(1.65, 1.65);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      color: new THREE.Color(1.22, 1.15, 1.25),
    });
    return { texture: tex, geometry: geo, material: mat };
  }, [node]);

  useEffect(() => {
    if (!interactive && hovered) {
      setHovered(false);
      document.body.style.cursor = 'auto';
    }
  }, [interactive, hovered]);

  useEffect(() => {
    return () => {
      texture.dispose();
      geometry.dispose();
      material.dispose();
      document.body.style.cursor = 'auto';
    };
  }, [texture, geometry, material]);

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
      sfxEngine.playModalOpen();
      useAppStore.getState().setActiveModal(node.id);
    },
    [interactive, node.id]
  );

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const elapsed = state.clock.elapsedTime;

    // Pause orbital drift slightly while hovered for effortless click targeting
    if (!reducedMotion) {
      const speedMul = hovered ? 0.15 : 1;
      angleRef.current += dt * node.orbitSpeed * speedMul;
    }

    if (groupRef.current) {
      const x = Math.cos(angleRef.current) * node.orbitRadius;
      const z = Math.sin(angleRef.current) * node.orbitRadius;
      const bob = reducedMotion ? 0 : Math.sin(elapsed * 1.8 + node.orbitAngle * 2) * 0.18;
      groupRef.current.position.set(x, node.heightOffset + bob, z);
    }

    if (scaleWrapperRef.current) {
      const targetScale = hovered ? 1.28 : 1.0;
      const current = scaleWrapperRef.current.scale.x;
      const next = THREE.MathUtils.lerp(current, targetScale, 0.16);
      scaleWrapperRef.current.scale.setScalar(next);
    }
  });

  const initialX = Math.cos(node.orbitAngle) * node.orbitRadius;
  const initialZ = Math.sin(node.orbitAngle) * node.orbitRadius;

  return (
    <group
      ref={groupRef}
      position={[initialX, node.heightOffset, initialZ]}
      name={`galaxy-node-${node.id}`}
    >
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        <group ref={scaleWrapperRef}>
          <mesh
            geometry={geometry}
            material={material}
            onPointerOver={handlePointerOver}
            onPointerOut={handlePointerOut}
            onClick={handleClick}
          />
          {hovered && (
            <Text
              font="/fonts/BeVietnamPro-SemiBold.ttf"
              position={[0, 1.08, 0.02]}
              fontSize={0.28}
              letterSpacing={0.05}
              color="#fff5fe"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.02}
              outlineColor="#db2777"
              material-toneMapped={false}
            >
              {node.label.toUpperCase()}
            </Text>
          )}
        </group>
      </Billboard>
    </group>
  );
}

export function OrbitingNodes({ interactive = true, reducedMotion = false }: OrbitingNodesProps) {
  return (
    <group name="orbiting-modal-nodes">
      {ANNIVERSARY_DATA.galaxyNodes.map((node) => (
        <GalaxyNodeItem
          key={node.id}
          node={node}
          interactive={interactive}
          reducedMotion={reducedMotion}
        />
      ))}
    </group>
  );
}
