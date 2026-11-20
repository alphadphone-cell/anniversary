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

const BURST_DURATION = 1.55; // seconds for smooth radial bloom of the Spiral Galaxy disc

export function LoveGalaxyScene({
  active,
  quality = 1,
  reducedMotion = false,
}: LoveGalaxySceneProps) {
  const galaxyDiscRef = useRef<THREE.Group>(null);
  const revealTimeRef = useRef(0);

  useEffect(() => {
    if (!active) {
      revealTimeRef.current = 0;
      if (galaxyDiscRef.current) {
        galaxyDiscRef.current.scale.setScalar(0.0001);
      }
      return;
    }

    if (reducedMotion && galaxyDiscRef.current) {
      revealTimeRef.current = BURST_DURATION;
      galaxyDiscRef.current.scale.setScalar(1);
    }
  }, [active, reducedMotion]);

  useFrame((state, delta) => {
    if (!galaxyDiscRef.current) return;

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

    // 3. Keep pre-mounted Spiral Galaxy disc hidden at micro-scale during Intro/Warp, then bloom radially
    if (!active) {
      galaxyDiscRef.current.scale.setScalar(0.0001);
      return;
    }

    if (reducedMotion) {
      galaxyDiscRef.current.scale.setScalar(1);
      return;
    }

    if (revealTimeRef.current < BURST_DURATION) {
      revealTimeRef.current = Math.min(BURST_DURATION, revealTimeRef.current + dt);
      const t = revealTimeRef.current / BURST_DURATION;
      const eased = 1 - Math.pow(1 - t, 3);
      galaxyDiscRef.current.scale.setScalar(THREE.MathUtils.lerp(0.06, 1.0, eased));
    } else {
      galaxyDiscRef.current.scale.setScalar(1);
    }
  });

  return (
    <>
      <group ref={galaxyDiscRef} scale={0.0001} name="stage-galaxy-disc">
        <SpiralGalaxy quality={quality} reducedMotion={reducedMotion} />
        <OrbitingTextPhrases reducedMotion={reducedMotion} />
        <OrbitingNodes interactive={active} reducedMotion={reducedMotion} />
      </group>

      {/* ParticleHeart stays permanently at scale 1.0 so individual GPU shooting-star particles drive the 3-phase reveal */}
      <ParticleHeart
        active={active}
        interactive={active}
        quality={quality}
        reducedMotion={reducedMotion}
      />

      {/* Upper Sky Dome Constellation Timeline */}
      <ConstellationSky active={active} reducedMotion={reducedMotion} />

      {/* World-space pooled Stardust Cursor Trail & pointer tracker */}
      <StardustTrail active={active} quality={quality} reducedMotion={reducedMotion} />
    </>
  );
}
