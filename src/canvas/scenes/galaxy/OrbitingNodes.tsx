import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import { ANNIVERSARY_DATA, type GalaxyNodeConfig } from '../../../data/anniversaryData';
import { getNextJourneyStep, useAppStore } from '../../../store/useAppStore';
import { sfxEngine } from '../../../utils/sfxEngine';

const NODE_BEACON_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * Cohesive rose-pink (#f472b6) & pearlescent-white (#fdf2f8) soft additive bloom aura
 * for the current guided target node — zero solid rings, zero harsh yellow borders.
 */
const NODE_BEACON_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uStrength; // 0 = off, 1 = soft breathing rose-pink/pearlescent bloom aura
  varying vec2 vUv;

  void main() {
    if (uStrength <= 0.005) discard;
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0) discard;

    float breathe = 0.78 + 0.22 * sin(uTime * 2.8);
    float edgeFade = smoothstep(1.0, 0.28, r);
    float coreBloom = exp(-r * r * 4.6) * 0.62;
    float outerVeil = exp(-r * r * 1.9) * 0.28;

    float alpha = clamp((coreBloom + outerVeil) * edgeFade * breathe * uStrength, 0.0, 0.72);
    if (alpha <= 0.004) discard;

    vec3 cRosePink = vec3(1.52, 0.54, 1.08);
    vec3 cPearlWhite = vec3(1.62, 1.46, 1.58);
    vec3 col = mix(cRosePink, cPearlWhite, exp(-r * r * 6.0) * 0.65);
    gl_FragColor = vec4(col, alpha);
  }
`;

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
  const beaconMeshRef = useRef<THREE.Mesh>(null);
  const angleRef = useRef(node.orbitAngle);
  const colorScratchRef = useRef(new THREE.Color());
  const [hovered, setHovered] = useState(false);

  const { texture, geometry, material, beaconGeo, beaconMat } = useMemo(() => {
    const tex = createNodeTexture(node);
    const geo = new THREE.PlaneGeometry(1.65, 1.65);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      color: new THREE.Color(1.22, 1.15, 1.25),
    });
    const bGeo = new THREE.PlaneGeometry(2.85, 2.85);
    const bMat = new THREE.ShaderMaterial({
      vertexShader: NODE_BEACON_VERTEX,
      fragmentShader: NODE_BEACON_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uStrength: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { texture: tex, geometry: geo, material: mat, beaconGeo: bGeo, beaconMat: bMat };
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
      beaconGeo.dispose();
      beaconMat.dispose();
      document.body.style.cursor = 'auto';
    };
  }, [texture, geometry, material, beaconGeo, beaconMat]);

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

    // Imperative zero-re-render target aura lookup (soft rose-pink/pearlescent bloom, zero harsh rings)
    const { completedSteps, viewMode } = useAppStore.getState();
    const nextStep = getNextJourneyStep(completedSteps);
    const isNextSpotlight = interactive && viewMode === 'galaxy' && nextStep === node.id;

    beaconMat.uniforms.uTime.value = elapsed;
    const nextStrength = THREE.MathUtils.lerp(
      beaconMat.uniforms.uStrength.value,
      isNextSpotlight ? 1 : 0,
      Math.min(1, dt * 6)
    );
    beaconMat.uniforms.uStrength.value = nextStrength;
    if (beaconMeshRef.current) {
      beaconMeshRef.current.visible = nextStrength > 0.01;
    }

    // Gentle breathing scale 1.0 -> 1.12 + cohesive rose-pink/pearlescent luminance on the target node
    const spotlightBreathe = isNextSpotlight && !reducedMotion ? (0.5 + 0.5 * Math.sin(elapsed * 2.8)) * 0.12 : 0;
    if (isNextSpotlight) {
      colorScratchRef.current.setRGB(1.42, 1.26, 1.40);
    } else {
      colorScratchRef.current.setRGB(1.22, 1.15, 1.25);
    }
    material.color.lerp(colorScratchRef.current, Math.min(1, dt * 6));

    if (scaleWrapperRef.current) {
      const baseScale = hovered ? 1.26 : isNextSpotlight ? 1.0 + spotlightBreathe : 1.0;
      const current = scaleWrapperRef.current.scale.x;
      const next = THREE.MathUtils.lerp(current, baseScale, 0.14);
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
            ref={beaconMeshRef}
            position={[0, 0, -0.04]}
            geometry={beaconGeo}
            material={beaconMat}
            visible={false}
          />
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
