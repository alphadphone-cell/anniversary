import { Component, memo, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { useStage } from '../store/useAppStore';
import { AmbientStarfield } from './AmbientStarfield';
import { CameraRig } from './CameraRig';
import { PostProcessing } from './PostProcessing';
import { IntroScene } from './scenes/IntroScene';
import { WarpSpeedScene } from './scenes/WarpSpeedScene';
import { LoveGalaxyScene } from './scenes/LoveGalaxyScene';

interface ErrorBoundaryState {
  hasError: boolean;
}

class WebGLErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="fixed inset-0 z-0 flex items-center justify-center bg-void px-6 text-center"
          role="status"
        >
          <div className="glass-surface max-w-md rounded-2xl p-6">
            <p className="font-display text-2xl leading-snug font-medium text-starlight">
              Ơ, trình duyệt chưa mở được bầu trời 3D rồi
            </p>
            <p className="mt-2 text-sm leading-relaxed text-lavender">
              Em thử bật tăng tốc phần cứng (WebGL) hoặc mở lại bằng Chrome/Safari để ngắm dải ngân
              hà của tụi mình nha.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

interface StageSceneContentProps {
  quality: number;
  reducedMotion: boolean;
}

/** Subscribes ONLY to `stage` so UI modal/audio/flash updates never re-render the WebGL tree. */
const StageSceneContent = memo(function StageSceneContent({
  quality,
  reducedMotion,
}: StageSceneContentProps) {
  const stage = useStage();
  const isWarp = stage === 'warp';

  return (
    <>
      {!isWarp && <AmbientStarfield quality={quality} reducedMotion={reducedMotion} />}
      {(stage === 'setup' || stage === 'intro') && <IntroScene />}
      {isWarp && <WarpSpeedScene quality={quality} reducedMotion={reducedMotion} />}
      {/* Pre-mounted LoveGalaxy so shaders/buffers compile upfront with zero black frame at Warp peak */}
      <LoveGalaxyScene
        active={stage === 'galaxy'}
        quality={quality}
        reducedMotion={reducedMotion}
      />
      <CameraRig stage={stage} reducedMotion={reducedMotion} />
    </>
  );
});

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

export const ExperienceCanvas = memo(function ExperienceCanvas() {
  const [dpr, setDpr] = useState<[number, number]>([1, 2]);
  const [quality, setQuality] = useState<number>(1);
  const [contextLost, setContextLost] = useState<boolean>(false);
  const canvasCleanupRef = useRef<(() => void) | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    return () => {
      canvasCleanupRef.current?.();
      canvasCleanupRef.current = null;
    };
  }, []);

  const handleDecline = useCallback(() => {
    setDpr([1, 1.25]);
    setQuality(0.68);
  }, []);

  const handleIncline = useCallback(() => {
    setDpr([1, 2]);
    setQuality(1);
  }, []);

  const handleFallback = useCallback(() => {
    setDpr([1, 1]);
    setQuality(0.55);
  }, []);

  const handleCreated = useCallback(
    ({ gl }: { gl: { domElement: HTMLCanvasElement } }) => {
      canvasCleanupRef.current?.();
      const canvas = gl.domElement;
      const onLost = (event: Event) => {
        event.preventDefault();
        setContextLost(true);
      };
      const onRestored = () => {
        setContextLost(false);
      };

      canvas.addEventListener('webglcontextlost', onLost, false);
      canvas.addEventListener('webglcontextrestored', onRestored, false);
      canvasCleanupRef.current = () => {
        canvas.removeEventListener('webglcontextlost', onLost, false);
        canvas.removeEventListener('webglcontextrestored', onRestored, false);
      };
    },
    []
  );

  return (
    <WebGLErrorBoundary>
      <div
        className="fixed inset-0 z-0 bg-void"
        aria-label="Bầu trời ngân hà của tụi mình"
      >
        <Canvas
          dpr={dpr}
          gl={{
            antialias: false,
            powerPreference: 'high-performance',
            alpha: false,
            stencil: false,
            depth: true,
          }}
          camera={{ position: [0, 0.8, 13], fov: 46, near: 0.1, far: 160 }}
          onCreated={handleCreated}
        >
          <color attach="background" args={['#05020a']} />
          <fog attach="fog" args={['#05020a', 18, 125]} />

          <PerformanceMonitor
            ms={250}
            iterations={8}
            threshold={0.75}
            onDecline={handleDecline}
            onIncline={handleIncline}
            onFallback={handleFallback}
          />

          <Suspense fallback={null}>
            <StageSceneContent quality={quality} reducedMotion={reducedMotion} />
            <PostProcessing quality={quality} />
          </Suspense>
        </Canvas>

        {contextLost && (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center bg-void/80"
            role="status"
          >
            <p className="glass-surface rounded-full px-5 py-2.5 text-sm text-starlight">
              Đợi anh một xíu, bầu trời sao đang sáng lại liền nè…
            </p>
          </div>
        )}
      </div>
    </WebGLErrorBoundary>
  );
});
