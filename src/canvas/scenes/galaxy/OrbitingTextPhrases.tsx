import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import { ANNIVERSARY_DATA } from '../../../data/anniversaryData';
import { galaxySignals } from '../../galaxySignals';

interface OrbitingTextPhrasesProps {
  reducedMotion?: boolean;
}

interface PhrasePlacement {
  text: string;
  radius: number;
  angle: number;
  y: number;
  fontSize: number;
}

interface TroikaTextMesh {
  fillOpacity?: number;
}

// Strict Concentric Orbital Layering:
// - Inner Core: 3D Particle Heart (radius ~2.4)
// - Middle Shell: Clickable 3D Orbiting Nodes (max orbitRadius = 7.4)
// - Dedicated Outer Text Halo: strictly outside nodes (+3.0 units clearance -> radius 10.4)
const OUTER_HALO_RADIUS = 10.4;
const UNIFORM_ORBIT_SPEED = 0.048;

export function OrbitingTextPhrases({ reducedMotion = false }: OrbitingTextPhrasesProps) {
  const { camera } = useThree();
  const orbitRef = useRef<THREE.Group>(null);
  const masterTextAngleRef = useRef(0);
  const anchorRefs = useRef<Array<THREE.Group | null>>([]);
  const textRefs = useRef<Array<TroikaTextMesh | null>>([]);

  // Reusable zero-allocation scratch vectors for per-frame depth & clearance math
  const worldPosRef = useRef(new THREE.Vector3());
  const ndcPosRef = useRef(new THREE.Vector3());

  const placements = useMemo<PhrasePlacement[]>(() => {
    const phrases = ANNIVERSARY_DATA.galaxyPhrases;
    if (!phrases.length) return [];

    return phrases.map((text, index) => {
      // Exact equal angular intervals so two phrases can mathematically never catch up or overlap
      const angle = (index / phrases.length) * Math.PI * 2 + 0.32;
      // Gentle vertical wave elevated cleanly above both the clickable nodes and the bottom Journey Guide Bar
      const y = 4.05 + Math.sin(index * 1.45) * 0.55;
      // Airy, lightweight serif proportions (~22–28% smaller than the old chunky sans-serif)
      const fontSize = text.length > 18 ? 0.25 : 0.285;

      return { text, radius: OUTER_HALO_RADIUS, angle, y, fontSize };
    });
  }, []);

  useFrame((_, delta) => {
    const orbit = orbitRef.current;
    if (!orbit) return;

    if (!reducedMotion) {
      const dt = Math.min(delta, 0.05);
      // Wrap single shared angular accumulator cleanly mod 2π so long idle sessions never lose precision
      masterTextAngleRef.current =
        (masterTextAngleRef.current - dt * UNIFORM_ORBIT_SPEED) % (Math.PI * 2);
      orbit.rotation.y = masterTextAngleRef.current;
    }

    // Theatrical dim during Supernova build-up, Constellation View, or Orb Camera Fly-To focus
    const theatricalDim = Math.max(
      galaxySignals.supernovaAmbientDim,
      galaxySignals.galaxyDim * 0.72,
      galaxySignals.nodeFocusDim * 0.86
    );
    const globalVisibility = THREE.MathUtils.clamp(1.0 - theatricalDim * 0.94, 0.04, 1.0);

    const worldPos = worldPosRef.current;
    const ndcPos = ndcPosRef.current;

    for (let i = 0; i < placements.length; i++) {
      const anchor = anchorRefs.current[i];
      const textMesh = textRefs.current[i];
      if (!anchor || !textMesh) continue;

      anchor.getWorldPosition(worldPos);

      // 1. Front/Back Depth Fade: behind heart/galaxy -> ~0.16, sides/foreground -> ~0.84 (never harsh 1.0)
      const camDist = worldPos.distanceTo(camera.position);
      const frontness = THREE.MathUtils.smoothstep(25.8 - camDist, 0, 16.8);
      const depthOpacity = THREE.MathUtils.lerp(0.16, 0.84, frontness);

      // 2. Center-Heart & Bottom-HUD Screen-Space Clearance
      ndcPos.copy(worldPos).project(camera);

      // Gently dip opacity by ~55% when passing across the central 3D Heart core (near x ≈ 0)
      const centerProximity = 1.0 - THREE.MathUtils.smoothstep(Math.abs(ndcPos.x), 0.1, 0.42);
      const centerClearance = 1.0 - centerProximity * 0.55;

      // Softly fade out if a phrase ever dips near the bottom Journey Guide Bar band
      const bottomClearance = THREE.MathUtils.smoothstep(ndcPos.y, -0.7, -0.38);

      const finalOpacity = depthOpacity * centerClearance * bottomClearance * globalVisibility;
      textMesh.fillOpacity = finalOpacity;
    }
  });

  if (!placements.length) return null;

  return (
    <group ref={orbitRef} name="orbiting-text-phrases">
      {placements.map((item, idx) => {
        const x = Math.cos(item.angle) * item.radius;
        const z = Math.sin(item.angle) * item.radius;

        return (
          <group
            key={item.text}
            ref={(el) => {
              anchorRefs.current[idx] = el;
            }}
            position={[x, item.y, z]}
          >
            <Billboard follow lockX={false} lockY={false} lockZ={false}>
              <Text
                ref={(el) => {
                  textRefs.current[idx] = el as unknown as TroikaTextMesh | null;
                }}
                font="/fonts/PlayfairDisplay-Italic.ttf"
                fontSize={item.fontSize}
                letterSpacing={0.06}
                color="#fce7f3"
                anchorX="center"
                anchorY="middle"
                fillOpacity={0.75}
                outlineWidth={0}
                material-toneMapped={false}
                material-depthTest={true}
                material-depthWrite={false}
              >
                {item.text}
              </Text>
            </Billboard>
          </group>
        );
      })}
    </group>
  );
}
