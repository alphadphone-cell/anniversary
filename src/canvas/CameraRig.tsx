import { useEffect, useRef } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useAppStore, type AppStage } from '../store/useAppStore';
import { galaxySignals } from './galaxySignals';

interface CameraRigProps {
  stage: AppStage;
  reducedMotion?: boolean;
}

const GALAXY_START_POS = new THREE.Vector3(0, 2.3, 5.6);
const GALAXY_TARGET_POS = new THREE.Vector3(0, 6.4, 16.2);
const GALAXY_LOOK_TARGET = new THREE.Vector3(0, 1.75, 0);
const HEART_FOCUS_POINT = new THREE.Vector3(0, 4.25, 0);
const ENTRANCE_DURATION = 1.8; // seconds smooth pull-out from galaxy core

export function CameraRig({ stage, reducedMotion = false }: CameraRigProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const entranceActiveRef = useRef(false);
  const entranceElapsedRef = useRef(0);
  const zoomDirRef = useRef(new THREE.Vector3());
  const { camera } = useThree();
  const enabled = stage !== 'warp';

  // Position camera close to the galaxy core and ease out smoothly over ~1.8s
  useEffect(() => {
    if (stage === 'galaxy') {
      if (reducedMotion) {
        entranceActiveRef.current = false;
        camera.position.copy(GALAXY_TARGET_POS);
      } else {
        entranceActiveRef.current = true;
        entranceElapsedRef.current = 0;
        camera.position.copy(GALAXY_START_POS);
      }

      if (controlsRef.current) {
        controlsRef.current.target.copy(GALAXY_LOOK_TARGET);
        controlsRef.current.update();
      } else {
        camera.lookAt(GALAXY_LOOK_TARGET);
      }
    } else if (stage === 'intro') {
      entranceActiveRef.current = false;
      camera.position.set(0, 0.8, 13);
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      }
    }
  }, [stage, camera, reducedMotion]);

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

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);

    if (entranceActiveRef.current && stage === 'galaxy') {
      entranceElapsedRef.current += dt;
      const t = THREE.MathUtils.clamp(entranceElapsedRef.current / ENTRANCE_DURATION, 0, 1);
      // Smooth cubic ease-out pull-back from core to default orbit vantage
      const eased = 1 - Math.pow(1 - t, 3);

      camera.position.lerpVectors(GALAXY_START_POS, GALAXY_TARGET_POS, eased);
      if (controlsRef.current) {
        controlsRef.current.target.copy(GALAXY_LOOK_TARGET);
        controlsRef.current.update();
      } else {
        camera.lookAt(GALAXY_LOOK_TARGET);
      }

      if (t >= 1) {
        entranceActiveRef.current = false;
      }
      return;
    }

    // Gentle camera zoom-in toward the 3D Particle Heart during the 3.0s Secret Supernova hold
    if (stage === 'galaxy' && !reducedMotion && galaxySignals.isHoldingHeart) {
      zoomDirRef.current.subVectors(HEART_FOCUS_POINT, camera.position);
      const dist = zoomDirRef.current.length();
      if (dist > 8.2) {
        zoomDirRef.current.normalize();
        camera.position.addScaledVector(zoomDirRef.current, dt * 1.85);
      }
      if (controlsRef.current) {
        controlsRef.current.target.lerp(HEART_FOCUS_POINT, Math.min(1, dt * 1.4));
        controlsRef.current.update();
      }
    }
  });

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
      onStart={() => {
        // Immediately yield entrance animation when user grabs/zooms manually
        entranceActiveRef.current = false;
      }}
    />
  );
}
