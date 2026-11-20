import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sampleAudioBass } from '../../audio/audioEngine';
import { useAppStore } from '../../store/useAppStore';
import { galaxySignals } from '../galaxySignals';
import { SpiralGalaxy } from './galaxy/SpiralGalaxy';
import { ParticleHeart } from './galaxy/ParticleHeart';
import { OrbitingTextPhrases } from './galaxy/OrbitingTextPhrases';
import { OrbitingNodes } from './galaxy/OrbitingNodes';
import { StardustTrail } from './galaxy/StardustTrail';
import { ConstellationSky } from './galaxy/ConstellationSky';

interface LoveGalaxySceneProps {
  active: boolean;
  quality?: number;
  reducedMotion?: boolean;
}

const BURST_DURATION = 1.55; // seconds for smooth radial bloom from core

export function LoveGalaxyScene({
  active,
  quality = 1,
  reducedMotion = false,
}: LoveGalaxySceneProps) {
  const rootRef = useRef<THREE.Group>(null);
  const heartAnchorRef = useRef<THREE.Group>(null);
  const revealTimeRef = useRef(0);

  useEffect(() => {
    if (!active) {
      revealTimeRef.current = 0;
      if (rootRef.current) {
        rootRef.current.scale.setScalar(0.0001);
      }
      return;
    }

    if (reducedMotion && rootRef.current) {
      revealTimeRef.current = BURST_DURATION;
      rootRef.current.scale.setScalar(1);
    }
  }, [active, reducedMotion]);

  useFrame((state, delta) => {
    if (!rootRef.current) return;

    const dt = Math.min(delta, 0.05);
    const elapsed = state.clock.elapsedTime;

    // 1. Sample Web Audio bass energy into smoothed mutable ref (procedural sine fallback if muted/paused)
    const liveBass = active ? sampleAudioBass() : null;
    const proceduralBreath = reducedMotion ? 0.12 : 0.18 + 0.2 * (0.5 + 0.5 * Math.sin(elapsed * 1.9));
    const targetBass = liveBass !== null ? liveBass : proceduralBreath;
    galaxySignals.bassEnergy = THREE.MathUtils.lerp(
      galaxySignals.bassEnergy,
      targetBass,
      Math.min(1, dt * 10)
    );

    // 2. Smoothly dim lower galaxy when gazing up at Constellation Timeline
    const targetDim = active && useAppStore.getState().viewMode === 'constellation' ? 1 : 0;
    galaxySignals.galaxyDim = THREE.MathUtils.lerp(
      galaxySignals.galaxyDim,
      targetDim,
      Math.min(1, dt * 4.2)
    );

    // 3. Keep pre-mounted LoveGalaxy hidden at micro-scale during Intro/Warp, then bloom radially
    if (!active) {
      rootRef.current.scale.setScalar(0.0001);
      return;
    }

    if (reducedMotion) {
      rootRef.current.scale.setScalar(1);
      return;
    }

    if (revealTimeRef.current < BURST_DURATION) {
      revealTimeRef.current = Math.min(BURST_DURATION, revealTimeRef.current + dt);
      const t = revealTimeRef.current / BURST_DURATION;
      const eased = 1 - Math.pow(1 - t, 3);
      const scale = THREE.MathUtils.lerp(0.06, 1.0, eased);
      rootRef.current.scale.setScalar(scale);

      if (heartAnchorRef.current) {
        heartAnchorRef.current.position.y = THREE.MathUtils.lerp(-1.8, 0, eased);
      }
    } else {
      rootRef.current.scale.setScalar(1);
      if (heartAnchorRef.current) {
        heartAnchorRef.current.position.y = 0;
      }
    }
  });

  return (
    <>
      <group ref={rootRef} scale={0.0001} name="stage-galaxy">
        <SpiralGalaxy quality={quality} reducedMotion={reducedMotion} />
        <group ref={heartAnchorRef}>
          <ParticleHeart interactive={active} quality={quality} reducedMotion={reducedMotion} />
        </group>
        <OrbitingTextPhrases reducedMotion={reducedMotion} />
        <OrbitingNodes interactive={active} reducedMotion={reducedMotion} />
      </group>

      {/* Upper Sky Dome Constellation Timeline */}
      <ConstellationSky active={active} reducedMotion={reducedMotion} />

      {/* World-space pooled Stardust Cursor Trail & pointer tracker */}
      <StardustTrail active={active} quality={quality} reducedMotion={reducedMotion} />
    </>
  );
}
