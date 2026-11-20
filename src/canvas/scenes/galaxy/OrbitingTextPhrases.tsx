import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import { ANNIVERSARY_DATA } from '../../../data/anniversaryData';

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

  const placements = useMemo<PhrasePlacement[]>(() => {
    const phrases = ANNIVERSARY_DATA.galaxyPhrases;
    if (!phrases.length) return [];

    return phrases.map((text, index) => {
      const ratio = index / phrases.length;
      const angle = ratio * Math.PI * 2 + 0.25;
      // Stagger inner and outer rings so labels stay readable and balanced across the disc
      const isOuter = index % 2 === 0;
      const radius = isOuter ? 8.8 + (index % 3) * 0.65 : 5.4 + (index % 3) * 0.55;
      const y = isOuter ? 0.35 + (index % 3) * 0.18 : 0.65 + (index % 2) * 0.24;
      const fontSize = index < 2 ? 0.42 : 0.32;

      return { text, radius, angle, y, fontSize };
    });
  }, []);

  useFrame((_, delta) => {
    if (orbitRef.current && !reducedMotion) {
      orbitRef.current.rotation.y -= Math.min(delta, 0.05) * 0.065;
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
              fontSize={item.fontSize}
              letterSpacing={0.12}
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
