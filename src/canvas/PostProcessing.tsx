import { EffectComposer, Bloom } from '@react-three/postprocessing';

interface PostProcessingProps {
  /** Disables or softens bloom if PerformanceMonitor drops to low tier */
  quality?: number;
}

export function PostProcessing({ quality = 1 }: PostProcessingProps) {
  if (quality < 0.6) return null;

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        mipmapBlur
        luminanceThreshold={0.85}
        luminanceSmoothing={0.22}
        intensity={0.95 * quality}
        radius={0.62}
      />
    </EffectComposer>
  );
}
