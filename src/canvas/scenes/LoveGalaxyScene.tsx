import { SpiralGalaxy } from './galaxy/SpiralGalaxy';
import { ParticleHeart } from './galaxy/ParticleHeart';
import { OrbitingTextPhrases } from './galaxy/OrbitingTextPhrases';
import { OrbitingNodes } from './galaxy/OrbitingNodes';

interface LoveGalaxySceneProps {
  quality?: number;
  reducedMotion?: boolean;
}

export function LoveGalaxyScene({ quality = 1, reducedMotion = false }: LoveGalaxySceneProps) {
  return (
    <group name="stage-galaxy">
      <SpiralGalaxy quality={quality} reducedMotion={reducedMotion} />
      <ParticleHeart quality={quality} reducedMotion={reducedMotion} />
      <OrbitingTextPhrases reducedMotion={reducedMotion} />
      <OrbitingNodes reducedMotion={reducedMotion} />
    </group>
  );
}
