import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
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

export function OrbitingTextPhrases({ reducedMotion = false }: OrbitingTextPhrasesProps) {
  const orbitRef = useRef<THREE.Group>(null);
  const lastOpacityRef = useRef(1);

  const placements = useMemo<PhrasePlacement[]>(() => {
    const phrases = ANNIVERSARY_DATA.galaxyPhrases;
    if (!phrases.length) return [];

    return phrases.map((text, index) => {
      const ratio = index / phrases.length;
      const angle = ratio * Math.PI * 2 + 0.25;
      // Stagger inner and outer rings so labels stay readable and balanced across the disc
      const isOuter = index % 2 === 0;
      const radius = isOuter ? 8.6 + (index % 3) * 0.6 : 5.4 + (index % 3) * 0.55;
      // Elevated Y-offset keeps lowest orbiting phrases cleanly clear of the bottom viewport band
      const y = isOuter ? 0.95 + (index % 3) * 0.22 : 1.18 + (index % 2) * 0.28;
      const fontSize = index < 2 ? 0.4 : 0.31;

      return { text, radius, angle, y, fontSize };
    });
  }, []);

  useFrame((_, delta) => {
    if (!orbitRef.current) return;
    if (!reducedMotion) {
      orbitRef.current.rotation.y -= Math.min(delta, 0.05) * 0.065;
    }

    // Theatrical focus: smoothly dim surrounding 3D text during Supernova build-up & freeze
    const dim = Math.max(galaxySignals.supernovaAmbientDim, galaxySignals.galaxyDim * 0.65);
    const targetOpacity = THREE.MathUtils.clamp(1.0 - dim * 0.92, 0.06, 1.0);
    if (Math.abs(targetOpacity - lastOpacityRef.current) > 0.008) {
      lastOpacityRef.current = targetOpacity;
      orbitRef.current.traverse((obj) => {
        const mesh = obj as THREE.Mesh & { fillOpacity?: number; outlineOpacity?: number };
        if (typeof mesh.fillOpacity === 'number') {
          mesh.fillOpacity = targetOpacity;
          mesh.outlineOpacity = targetOpacity * 0.75;
        }
      });
    }
  });

  if (!placements.length) return null;

  return (
    <group ref={orbitRef} name="orbiting-text-phrases">
      {placements.map((item) => {
        const x = Math.cos(item.angle) * item.radius;
        const z = Math.sin(item.angle) * item.radius;

        return (
          <Billboard key={item.text} position={[x, item.y, z]} follow lockX={false} lockY={false} lockZ={false}>
            <Text
              font="/fonts/BeVietnamPro-SemiBold.ttf"
              fontSize={item.fontSize}
              letterSpacing={0.06}
              color="#fff3fd"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.016}
              outlineColor="#c026d3"
              outlineOpacity={0.75}
              material-toneMapped={false}
            >
              {item.text}
            </Text>
          </Billboard>
        );
      })}
    </group>
  );
}
