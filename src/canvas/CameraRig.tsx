import { useEffect, useRef } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { ANNIVERSARY_DATA } from '../data/anniversaryData';
import { useAppStore, type AppStage, type ViewMode } from '../store/useAppStore';
import { galaxySignals } from './galaxySignals';

interface CameraRigProps {
  stage: AppStage;
  reducedMotion?: boolean;
}

const GALAXY_START_POS = new THREE.Vector3(0, 2.3, 5.6);
const GALAXY_DEFAULT_POS = new THREE.Vector3(0, 6.4, 16.2);
const GALAXY_DEFAULT_TARGET = new THREE.Vector3(0, 1.75, 0);

const CONSTELLATION_DEFAULT_POS = new THREE.Vector3(0, 14.2, 16.2);
const CONSTELLATION_DEFAULT_TARGET = new THREE.Vector3(0, 16.3, -7.6);

const HEART_FOCUS_POINT = new THREE.Vector3(0, 4.25, 0);

const ENTRANCE_DURATION = 1.8;
const VIEW_GLIDE_DURATION = 1.4;

export function CameraRig({ stage, reducedMotion = false }: CameraRigProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const enabled = stage !== 'warp';

  // Reusable zero-allocation tween state
  const tweenActiveRef = useRef(false);
  const tweenElapsedRef = useRef(0);
  const tweenDurationRef = useRef(ENTRANCE_DURATION);
  const fromPosRef = useRef(new THREE.Vector3());
  const toPosRef = useRef(new THREE.Vector3());
  const fromTargetRef = useRef(new THREE.Vector3());
  const toTargetRef = useRef(new THREE.Vector3());
  const starPosScratchRef = useRef(new THREE.Vector3());
  const zoomDirRef = useRef(new THREE.Vector3());

  const startCameraGlide = (
    destPos: THREE.Vector3,
    destTarget: THREE.Vector3,
    duration: number,
    instant = false
  ) => {
    if (instant || reducedMotion) {
      tweenActiveRef.current = false;
      camera.position.copy(destPos);
      if (controlsRef.current) {
        controlsRef.current.target.copy(destTarget);
        controlsRef.current.update();
      } else {
        camera.lookAt(destTarget);
      }
      return;
    }

    fromPosRef.current.copy(camera.position);
    toPosRef.current.copy(destPos);

    if (controlsRef.current) {
      fromTargetRef.current.copy(controlsRef.current.target);
    } else {
      fromTargetRef.current.copy(GALAXY_DEFAULT_TARGET);
    }
    toTargetRef.current.copy(destTarget);

    tweenDurationRef.current = duration;
    tweenElapsedRef.current = 0;
    tweenActiveRef.current = true;
  };

  // Initial Stage arrival pose (Warp -> Galaxy pull-out from core)
  useEffect(() => {
    if (stage === 'galaxy') {
      if (reducedMotion) {
        startCameraGlide(GALAXY_DEFAULT_POS, GALAXY_DEFAULT_TARGET, 0, true);
      } else {
        camera.position.copy(GALAXY_START_POS);
        if (controlsRef.current) {
          controlsRef.current.target.copy(GALAXY_DEFAULT_TARGET);
          controlsRef.current.update();
        }
        startCameraGlide(GALAXY_DEFAULT_POS, GALAXY_DEFAULT_TARGET, ENTRANCE_DURATION, false);
      }
    } else if (stage === 'intro') {
      tweenActiveRef.current = false;
      camera.position.set(0, 0.8, 13);
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      }
    }
  }, [stage, camera, reducedMotion]);

  // Imperatively sync viewMode, selectedMilestoneId, and autoRotate without re-rendering Canvas
  useEffect(() => {
    const syncAutoRotate = (
      activeModal: ReturnType<typeof useAppStore.getState>['activeModal'],
      viewMode: ViewMode
    ) => {
      if (controlsRef.current) {
        controlsRef.current.autoRotate =
          !reducedMotion && activeModal === null && viewMode === 'galaxy';
        // Relax polar clamp in Constellation View so user can gaze upward smoothly
        controlsRef.current.maxPolarAngle =
          viewMode === 'constellation' ? Math.PI * 0.72 : Math.PI * 0.49;
      }
    };

    const initial = useAppStore.getState();
    syncAutoRotate(initial.activeModal, initial.viewMode);

    const unsubscribe = useAppStore.subscribe((state, prev) => {
      if (state.activeModal !== prev.activeModal || state.viewMode !== prev.viewMode) {
        syncAutoRotate(state.activeModal, state.viewMode);
      }

      if (stage !== 'galaxy') return;

      // Glide smoothly between Galaxy View and Constellation View (~1.4s)
      if (state.viewMode !== prev.viewMode) {
        if (state.viewMode === 'constellation') {
          startCameraGlide(
            CONSTELLATION_DEFAULT_POS,
            CONSTELLATION_DEFAULT_TARGET,
            VIEW_GLIDE_DURATION
          );
        } else {
          startCameraGlide(GALAXY_DEFAULT_POS, GALAXY_DEFAULT_TARGET, VIEW_GLIDE_DURATION);
        }
        return;
      }

      // Focus camera subtly toward clicked milestone star in Constellation View
      if (
        state.viewMode === 'constellation' &&
        state.selectedMilestoneId !== prev.selectedMilestoneId
      ) {
        if (!state.selectedMilestoneId) {
          startCameraGlide(CONSTELLATION_DEFAULT_POS, CONSTELLATION_DEFAULT_TARGET, 0.9);
          return;
        }
        const star = ANNIVERSARY_DATA.constellationMilestones.find(
          (m) => m.id === state.selectedMilestoneId
        );
        if (star) {
          starPosScratchRef.current.set(star.position[0], star.position[1], star.position[2]);
          const focusTarget = toTargetRef.current
            .copy(CONSTELLATION_DEFAULT_TARGET)
            .lerp(starPosScratchRef.current, 0.55);
          const focusPos = toPosRef.current.set(
            star.position[0] * 0.42,
            13.2 + (star.position[1] - 16) * 0.25,
            11.4
          );
          startCameraGlide(focusPos.clone(), focusTarget.clone(), 0.95);
        }
      }
    });

    return unsubscribe;
  }, [reducedMotion, stage]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);

    if (tweenActiveRef.current && stage === 'galaxy') {
      tweenElapsedRef.current += dt;
      const t = THREE.MathUtils.clamp(
        tweenElapsedRef.current / Math.max(0.01, tweenDurationRef.current),
        0,
        1
      );
      // Silky cubic ease-out glide
      const eased = 1 - Math.pow(1 - t, 3);

      camera.position.lerpVectors(fromPosRef.current, toPosRef.current, eased);
      if (controlsRef.current) {
        controlsRef.current.target.lerpVectors(fromTargetRef.current, toTargetRef.current, eased);
        controlsRef.current.update();
      } else {
        camera.lookAt(toTargetRef.current);
      }

      if (t >= 1) {
        tweenActiveRef.current = false;
      }
      return;
    }

    // Gentle camera zoom-in toward the 3D Particle Heart during the 3.0s Secret Supernova hold
    if (
      stage === 'galaxy' &&
      !reducedMotion &&
      galaxySignals.isHoldingHeart &&
      useAppStore.getState().viewMode === 'galaxy'
    ) {
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

  const stateNow = useAppStore.getState();

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.055}
      enablePan={false}
      minDistance={6}
      maxDistance={32}
      minPolarAngle={0.18}
      maxPolarAngle={stateNow.viewMode === 'constellation' ? Math.PI * 0.72 : Math.PI * 0.49}
      rotateSpeed={0.55}
      zoomSpeed={0.68}
      autoRotate={!reducedMotion && stateNow.activeModal === null && stateNow.viewMode === 'galaxy'}
      autoRotateSpeed={0.34}
      onStart={() => {
        // Immediately yield scripted glide when user drags or zooms manually
        tweenActiveRef.current = false;
      }}
    />
  );
}
