import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import type { BloomEffect } from 'postprocessing';
import { galaxySignals } from './galaxySignals';

interface PostProcessingProps {
  /** Disables or softens bloom if PerformanceMonitor drops to low tier */
  quality?: number;
}

export function PostProcessing({ quality = 1 }: PostProcessingProps) {
  const bloomRef = useRef<BloomEffect | null>(null);

  useFrame(() => {
    const effect = bloomRef.current;
    if (!effect) return;
    // Brief radial lens bloom spike at Supernova detonation or Constellation Burst, zero React re-renders
    const boost = Math.max(
      galaxySignals.supernovaBloomSpike * 1.45,
      galaxySignals.constellationBloomSpike * 0.95
    );
    effect.intensity = (0.95 + boost) * quality;
  });

  if (quality < 0.6) return null;

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        ref={bloomRef}
        mipmapBlur
        luminanceThreshold={0.85}
        luminanceSmoothing={0.22}
        intensity={0.95 * quality}
        radius={0.62}
      />
    </EffectComposer>
  );
}
