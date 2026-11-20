import { useEffect, useRef } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useAppStore, type AppStage } from '../store/useAppStore';

interface CameraRigProps {
  stage: AppStage;
  reducedMotion?: boolean;
}

export function CameraRig({ stage, reducedMotion = false }: CameraRigProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const enabled = stage !== 'warp';

  // Position camera at elevated 3/4 cosmic vantage when entering Galaxy
  useEffect(() => {
    if (stage === 'galaxy') {
      camera.position.set(0, 6.4, 16.2);
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 1.75, 0);
        controlsRef.current.update();
      } else {
        camera.lookAt(0, 1.75, 0);
      }
    } else if (stage === 'intro') {
      camera.position.set(0, 0.8, 13);
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      }
    }
  }, [stage, camera]);

  // Imperatively pause autoRotate whenever a modal opens without triggering any React re-render
  useEffect(() => {
    const syncAutoRotate = (activeModal: ReturnType<typeof useAppStore.getState>['activeModal']) => {
      if (controlsRef.current) {
        controlsRef.current.autoRotate = !reducedMotion && activeModal === null;
      }
    };

    syncAutoRotate(useAppStore.getState().activeModal);

    const unsubscribe = useAppStore.subscribe((state, prevState) => {
      if (state.activeModal !== prevState.activeModal) {
        syncAutoRotate(state.activeModal);
      }
    });

    return unsubscribe;
  }, [reducedMotion, enabled]);

  if (!enabled) return null;

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.055}
      enablePan={false}
      minDistance={6}
      maxDistance={28}
      minPolarAngle={0.22}
      maxPolarAngle={Math.PI * 0.49}
      rotateSpeed={0.55}
      zoomSpeed={0.68}
      autoRotate={!reducedMotion && useAppStore.getState().activeModal === null}
      autoRotateSpeed={0.34}
    />
  );
}
