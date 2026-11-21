import { useEffect, useRef } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { ANNIVERSARY_DATA, type GalaxyNodeId } from '../data/anniversaryData';
import { useAppStore, type AppStage, type ViewMode } from '../store/useAppStore';
import { sfxEngine } from '../utils/sfxEngine';
import { galaxySignals, HEART_CENTER_Y } from './galaxySignals';

interface CameraRigProps {
  stage: AppStage;
  reducedMotion?: boolean;
}

const GALAXY_START_POS = new THREE.Vector3(0, 2.3, 5.6);
const GALAXY_DEFAULT_POS = new THREE.Vector3(0, 6.2, 16.4);
const GALAXY_DEFAULT_TARGET = new THREE.Vector3(0, 1.95, 0);

const CONSTELLATION_DEFAULT_POS = new THREE.Vector3(0, 14.2, 16.2);
const CONSTELLATION_FINALE_POS = new THREE.Vector3(0, 14.4, 21.4);
const CONSTELLATION_FINALE_RECEDE_POS = new THREE.Vector3(0, 13.0, 27.2);
const CONSTELLATION_DEFAULT_TARGET = new THREE.Vector3(0, 16.2, -7.6);
const CONSTELLATION_FINALE_RECEDE_TARGET = new THREE.Vector3(0, 15.6, -7.6);

const HEART_FOCUS_POINT = new THREE.Vector3(0, HEART_CENTER_Y, 0);
const BASE_GALAXY_FOV = 46;
const FOCUS_ORB_FOV = 41;
const DEFAULT_MIN_DISTANCE = 6;
const FOCUS_MIN_DISTANCE = 3.2;

const ENTRANCE_DURATION = 1.8;
const VIEW_GLIDE_DURATION = 1.5;
const ORB_FLY_DURATION = 1.15;
const ORB_FLARE_START = 0.92;
const ORB_FLARE_END = 1.38;
const ORB_MODAL_OPEN_AT = 1.15;
const ORB_PULL_BACK_DURATION = 1.0;
const ORB_STANDOFF_DISTANCE = 5.4;
const FINALE_RECEDE_START_SEC = 1.4;
const FINALE_RECEDE_DURATION_SEC = 0.8;

const SKY_MAX_POLAR_ANGLE = Math.PI * 0.78;
const TILT_UP_TO_CONSTELLATION_POLAR = Math.PI * 0.56;
const TILT_DOWN_TO_GALAXY_POLAR = Math.PI * 0.42;
const VIEW_SWITCH_COOLDOWN_MS = 1600;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeInOutQuart(t: number): number {
  return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
}

function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function evalQuadraticBezier(
  out: THREE.Vector3,
  p0: THREE.Vector3,
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  t: number
): THREE.Vector3 {
  const inv = 1 - t;
  const w0 = inv * inv;
  const w1 = 2 * inv * t;
  const w2 = t * t;
  return out.set(
    w0 * p0.x + w1 * p1.x + w2 * p2.x,
    w0 * p0.y + w1 * p1.y + w2 * p2.y,
    w0 * p0.z + w1 * p1.z + w2 * p2.z
  );
}

export function CameraRig({ stage, reducedMotion = false }: CameraRigProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const enabled = stage !== 'warp';

  // Reusable zero-allocation tween & shake state (wall-clock synced so slow GPUs never stall glides)
  const tweenActiveRef = useRef(false);
  const tweenStartMsRef = useRef(0);
  const tweenDurationRef = useRef(ENTRANCE_DURATION);
  const fromPosRef = useRef(new THREE.Vector3());
  const toPosRef = useRef(new THREE.Vector3());
  const fromTargetRef = useRef(new THREE.Vector3());
  const toTargetRef = useRef(new THREE.Vector3());
  const starPosScratchRef = useRef(new THREE.Vector3());
  const zoomDirRef = useRef(new THREE.Vector3());
  const lastShakeOffsetRef = useRef(new THREE.Vector3());
  const currentShakeOffsetRef = useRef(new THREE.Vector3());
  const hasUserDraggedInModeRef = useRef(false);
  const viewSwitchCooldownUntilMsRef = useRef(0);

  // Cinematic Orb Camera Fly-To & Pull-Back state (zero per-frame allocations)
  const focusPhaseRef = useRef<'idle' | 'flyIn' | 'holding' | 'pullBack'>('idle');
  const activeFocusNodeRef = useRef<GalaxyNodeId | null>(null);
  const preFocusPosRef = useRef(new THREE.Vector3().copy(GALAXY_DEFAULT_POS));
  const preFocusTargetRef = useRef(new THREE.Vector3().copy(GALAXY_DEFAULT_TARGET));
  const hasSavedFocusPoseRef = useRef(false);
  const focusFromFovRef = useRef(BASE_GALAXY_FOV);
  const focusToFovRef = useRef(BASE_GALAXY_FOV);
  const orbDirScratchRef = useRef(new THREE.Vector3());
  const orbCamScratchRef = useRef(new THREE.Vector3());
  const orbDestPosRef = useRef(new THREE.Vector3());
  const orbDestTargetRef = useRef(new THREE.Vector3());
  const arcCtrlPosRef = useRef(new THREE.Vector3());
  const arcTangentRef = useRef(new THREE.Vector3());
  const portalChimePlayedRef = useRef(false);
  const modalOpenedForFocusRef = useRef(false);
  const finaleRecedeTriggeredRef = useRef(false);

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
    tweenStartMsRef.current = performance.now();
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

  // Imperatively sync viewMode, selectedMilestoneId, focusingNodeId, and autoRotate without re-rendering Canvas
  useEffect(() => {
    const syncAutoRotate = (
      activeModal: ReturnType<typeof useAppStore.getState>['activeModal'],
      viewMode: ViewMode,
      focusingNodeId: GalaxyNodeId | null
    ) => {
      if (controlsRef.current) {
        controlsRef.current.autoRotate =
          !reducedMotion &&
          activeModal === null &&
          focusingNodeId === null &&
          focusPhaseRef.current === 'idle' &&
          viewMode === 'galaxy';
        // Allow free upward tilt in both modes so user can pan directly up into the Constellation sky dome
        controlsRef.current.maxPolarAngle = SKY_MAX_POLAR_ANGLE;
      }
    };

    const initial = useAppStore.getState();
    syncAutoRotate(initial.activeModal, initial.viewMode, initial.focusingNodeId);

    const unsubscribe = useAppStore.subscribe((state, prev) => {
      if (
        state.activeModal !== prev.activeModal ||
        state.viewMode !== prev.viewMode ||
        state.focusingNodeId !== prev.focusingNodeId
      ) {
        syncAutoRotate(state.activeModal, state.viewMode, state.focusingNodeId);
      }

      if (stage !== 'galaxy') return;

      // Glide smoothly between Galaxy View and Constellation View
      if (state.viewMode !== prev.viewMode) {
        focusPhaseRef.current = 'idle';
        activeFocusNodeRef.current = null;
        hasSavedFocusPoseRef.current = false;
        if (controlsRef.current) {
          controlsRef.current.minDistance = DEFAULT_MIN_DISTANCE;
          controlsRef.current.enabled = true;
        }
        hasUserDraggedInModeRef.current = false;
        viewSwitchCooldownUntilMsRef.current = performance.now() + VIEW_SWITCH_COOLDOWN_MS;
        if (state.viewMode === 'constellation') {
          // Auto-focus directly onto Star #1 in the upper third of the viewport so the centered card never covers it
          const star0 = ANNIVERSARY_DATA.constellationMilestones[0];
          if (star0) {
            starPosScratchRef.current.set(star0.position[0], star0.position[1], star0.position[2]);
            const focusTarget = toTargetRef.current
              .copy(CONSTELLATION_DEFAULT_TARGET)
              .lerp(starPosScratchRef.current, 0.62);
            focusTarget.y -= 1.65; // Frame active star in the upper third above the centered card
            const focusPos = toPosRef.current.set(
              star0.position[0] * 0.48,
              12.8 + (star0.position[1] - 16) * 0.25,
              11.8
            );
            startCameraGlide(focusPos.clone(), focusTarget.clone(), 0.88);
          } else {
            startCameraGlide(
              CONSTELLATION_DEFAULT_POS,
              CONSTELLATION_DEFAULT_TARGET,
              VIEW_GLIDE_DURATION
            );
          }
        } else {
          startCameraGlide(GALAXY_DEFAULT_POS, GALAXY_DEFAULT_TARGET, VIEW_GLIDE_DURATION);
        }
        return;
      }

      // Beat 1 Trigger: Cinematic 3D Camera Fly-To a Memory Orb
      if (
        state.viewMode === 'galaxy' &&
        state.focusingNodeId !== null &&
        state.focusingNodeId !== prev.focusingNodeId
      ) {
        const nodeId = state.focusingNodeId;
        const orbPos = galaxySignals.nodeWorldPositions[nodeId];

        // Save the user's resting Galaxy orbit offset only when starting from idle (never overwrite mid-pull-back)
        if (focusPhaseRef.current === 'idle') {
          const curTarget = controlsRef.current?.target ?? GALAXY_DEFAULT_TARGET;
          const distFromTarget = camera.position.distanceTo(curTarget);
          if (distFromTarget >= DEFAULT_MIN_DISTANCE - 0.25) {
            preFocusPosRef.current.copy(camera.position);
            preFocusTargetRef.current.copy(curTarget);
          } else {
            preFocusPosRef.current.copy(GALAXY_DEFAULT_POS);
            preFocusTargetRef.current.copy(GALAXY_DEFAULT_TARGET);
          }
          hasSavedFocusPoseRef.current = true;
        }

        // Approach front-on from the current camera hemisphere, nudged gently outward from the central 3D Heart
        orbCamScratchRef.current.subVectors(camera.position, orbPos);
        if (orbCamScratchRef.current.lengthSq() < 0.001) {
          orbCamScratchRef.current.set(0, 0.2, 1);
        } else {
          orbCamScratchRef.current.normalize();
        }
        orbDirScratchRef.current.set(orbPos.x, 0, orbPos.z);
        if (orbDirScratchRef.current.lengthSq() > 0.001) {
          orbDirScratchRef.current.normalize();
          // Keep dot > 0 so camera never swings behind the orb; blend gently outward to frame the Heart behind it
          const align = orbCamScratchRef.current.dot(orbDirScratchRef.current);
          const radialWeight = align >= 0 ? 0.32 : 0.14;
          orbDirScratchRef.current
            .multiplyScalar(radialWeight)
            .addScaledVector(orbCamScratchRef.current, 1 - radialWeight)
            .normalize();
        } else {
          orbDirScratchRef.current.copy(orbCamScratchRef.current);
        }
        // Keep a flattering slight elevation so the orb stays centered and never ducks under the Galaxy disc
        orbDirScratchRef.current.y = THREE.MathUtils.clamp(orbDirScratchRef.current.y, 0.08, 0.42);
        orbDirScratchRef.current.normalize();

        orbDestTargetRef.current.copy(orbPos);
        orbDestPosRef.current
          .copy(orbPos)
          .addScaledVector(orbDirScratchRef.current, ORB_STANDOFF_DISTANCE);
        orbDestPosRef.current.y += 0.24;

        fromPosRef.current.copy(camera.position);
        fromTargetRef.current.copy(controlsRef.current?.target ?? GALAXY_DEFAULT_TARGET);
        focusFromFovRef.current =
          camera instanceof THREE.PerspectiveCamera ? camera.fov : BASE_GALAXY_FOV;
        focusToFovRef.current = FOCUS_ORB_FOV;

        // Compute lateral curved orbital arc control point (so the camera sweeps gracefully around instead of diving straight)
        arcTangentRef.current.subVectors(orbDestPosRef.current, fromPosRef.current);
        const chordLen = arcTangentRef.current.length();
        const lateralX = -arcTangentRef.current.z;
        const lateralZ = arcTangentRef.current.x;
        const lateralLen = Math.hypot(lateralX, lateralZ) || 1;
        const arcSide = orbPos.x >= 0 ? 1 : -1;
        const arcBend = Math.min(2.6, chordLen * 0.22) * arcSide;
        arcCtrlPosRef.current
          .copy(fromPosRef.current)
          .lerp(orbDestPosRef.current, 0.5);
        arcCtrlPosRef.current.x += (lateralX / lateralLen) * arcBend;
        arcCtrlPosRef.current.z += (lateralZ / lateralLen) * arcBend;
        arcCtrlPosRef.current.y += Math.min(1.1, chordLen * 0.08 + 0.35);

        activeFocusNodeRef.current = nodeId;
        portalChimePlayedRef.current = false;
        modalOpenedForFocusRef.current = false;
        tweenActiveRef.current = false;
        galaxySignals.isOrbReturning = false;
        focusPhaseRef.current = 'flyIn';

        if (controlsRef.current) {
          controlsRef.current.minDistance = FOCUS_MIN_DISTANCE;
          controlsRef.current.enabled = false;
          controlsRef.current.autoRotate = false;
        }

        sfxEngine.playOrbFlyWhoosh();
        return;
      }

      // Smooth 1.0s Camera Pull-Back on Modal Close (ĐÓNG ×)
      if (
        state.viewMode === 'galaxy' &&
        prev.activeModal !== null &&
        state.activeModal === null &&
        hasSavedFocusPoseRef.current
      ) {
        hasSavedFocusPoseRef.current = false;
        activeFocusNodeRef.current = null;
        galaxySignals.focusingNodeId = null;
        galaxySignals.isOrbReturning = true;
        galaxySignals.nodeFocusStartMs = 0;
        galaxySignals.nodeFlareProgress = 0;
        galaxySignals.orbFlareBloomSpike = 0;

        fromPosRef.current.copy(camera.position);
        toPosRef.current.copy(preFocusPosRef.current);
        fromTargetRef.current.copy(controlsRef.current?.target ?? orbDestTargetRef.current);
        toTargetRef.current.copy(preFocusTargetRef.current);
        focusFromFovRef.current =
          camera instanceof THREE.PerspectiveCamera ? camera.fov : FOCUS_ORB_FOV;
        focusToFovRef.current = BASE_GALAXY_FOV;

        // Gentle inverse orbital arc on pull-back
        arcTangentRef.current.subVectors(toPosRef.current, fromPosRef.current);
        const backChord = arcTangentRef.current.length();
        const backLatX = -arcTangentRef.current.z;
        const backLatZ = arcTangentRef.current.x;
        const backLatLen = Math.hypot(backLatX, backLatZ) || 1;
        const backBend = Math.min(1.8, backChord * 0.14);
        arcCtrlPosRef.current.copy(fromPosRef.current).lerp(toPosRef.current, 0.5);
        arcCtrlPosRef.current.x += (backLatX / backLatLen) * backBend;
        arcCtrlPosRef.current.z += (backLatZ / backLatLen) * backBend;
        arcCtrlPosRef.current.y += Math.min(0.85, backChord * 0.06 + 0.2);

        tweenStartMsRef.current = performance.now();
        tweenDurationRef.current = ORB_PULL_BACK_DURATION;
        tweenActiveRef.current = false;
        focusPhaseRef.current = 'pullBack';

        if (controlsRef.current) {
          controlsRef.current.enabled = true;
          controlsRef.current.autoRotate = false;
        }
        return;
      }

      // Finale Phase 1 (0.0s -> 1.4s): frame all 7 Capricornus stars cleanly for the Golden Circuit Surge
      if (
        state.viewMode === 'constellation' &&
        state.constellationFinaleActive &&
        !prev.constellationFinaleActive
      ) {
        finaleRecedeTriggeredRef.current = false;
        startCameraGlide(CONSTELLATION_FINALE_POS, CONSTELLATION_DEFAULT_TARGET, 0.72);
        return;
      }

      // Focus camera gracefully toward active milestone star (leads slightly ahead of the 1.2s travelling light-beam)
      if (
        state.viewMode === 'constellation' &&
        !state.constellationFinaleActive &&
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
          // If the beam-follow camera glide just delivered us to this star on impact, don't restart a redundant 0.95s pan
          const justArrivedViaBeam =
            galaxySignals.starImpactIdx >= 0 &&
            ANNIVERSARY_DATA.constellationMilestones[galaxySignals.starImpactIdx]?.id === star.id &&
            performance.now() - galaxySignals.starImpactStartMs < 120;
          if (justArrivedViaBeam) return;

          starPosScratchRef.current.set(star.position[0], star.position[1], star.position[2]);
          const focusTarget = toTargetRef.current
            .copy(CONSTELLATION_DEFAULT_TARGET)
            .lerp(starPosScratchRef.current, 0.62);
          focusTarget.y -= 0.75;
          const focusPos = toPosRef.current.set(
            star.position[0] * 0.48,
            13.2 + (star.position[1] - 16) * 0.25,
            12.2
          );
          startCameraGlide(focusPos.clone(), focusTarget.clone(), 0.95);
        }
      }
    });

    return unsubscribe;
  }, [reducedMotion, stage]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const elapsed = state.clock.elapsedTime;

    // Remove previous frame's physical shake delta cleanly so camera never drifts
    if (lastShakeOffsetRef.current.lengthSq() > 0) {
      camera.position.sub(lastShakeOffsetRef.current);
      lastShakeOffsetRef.current.set(0, 0, 0);
    }

    // Smoothly dim peripheral 3D floating text while focusing on an orb or viewing a modal
    const storeNow = useAppStore.getState();
    const shouldDimForOrb =
      stage === 'galaxy' &&
      (focusPhaseRef.current === 'flyIn' ||
        focusPhaseRef.current === 'holding' ||
        storeNow.activeModal !== null);
    galaxySignals.nodeFocusDim = THREE.MathUtils.lerp(
      galaxySignals.nodeFocusDim,
      shouldDimForOrb ? 1 : 0,
      Math.min(1, dt * (shouldDimForOrb ? 7.5 : 4.5))
    );

    // Follow Constellation Travelling Light-Beam smoothly toward pending target star BEFORE destination star ignites
    if (
      stage === 'galaxy' &&
      storeNow.viewMode === 'constellation' &&
      !storeNow.constellationFinaleActive &&
      galaxySignals.beamTracer.active &&
      galaxySignals.beamTracer.cameraGlideRequested
    ) {
      galaxySignals.beamTracer.cameraGlideRequested = false;
      const targetStar = ANNIVERSARY_DATA.constellationMilestones[galaxySignals.beamTracer.toIdx];
      if (targetStar) {
        starPosScratchRef.current.set(
          targetStar.position[0],
          targetStar.position[1],
          targetStar.position[2]
        );
        const focusTarget = toTargetRef.current
          .copy(CONSTELLATION_DEFAULT_TARGET)
          .lerp(starPosScratchRef.current, 0.62);
        focusTarget.y -= 0.75;
        const focusPos = toPosRef.current.set(
          targetStar.position[0] * 0.48,
          13.2 + (targetStar.position[1] - 16) * 0.25,
          12.2
        );
        startCameraGlide(
          focusPos.clone(),
          focusTarget.clone(),
          Math.max(0.85, galaxySignals.beamTracer.durationMs / 1000 + 0.08)
        );
      }
    }

    // Finale Phase 2 (1.40s -> 2.20s): gracefully glide camera further back/down so dimmed 7 stars become a delicate backdrop
    if (
      stage === 'galaxy' &&
      storeNow.viewMode === 'constellation' &&
      storeNow.constellationFinaleActive &&
      galaxySignals.constellationFinaleStartMs > 0 &&
      !finaleRecedeTriggeredRef.current &&
      !reducedMotion
    ) {
      const fSec = (performance.now() - galaxySignals.constellationFinaleStartMs) / 1000;
      if (fSec >= FINALE_RECEDE_START_SEC) {
        finaleRecedeTriggeredRef.current = true;
        startCameraGlide(
          CONSTELLATION_FINALE_RECEDE_POS,
          CONSTELLATION_FINALE_RECEDE_TARGET,
          FINALE_RECEDE_DURATION_SEC
        );
      }
    }

    // Beat 1 (0.0s -> 1.15s Curved Orbital Arc) + Beat 2 (0.92s -> 1.38s Flair) + Beat 3 (1.15s Unfold)
    if (focusPhaseRef.current === 'flyIn' && stage === 'galaxy') {
      const nodeId = activeFocusNodeRef.current;
      if (!nodeId) {
        focusPhaseRef.current = 'idle';
      } else {
        const elapsedSec = (performance.now() - galaxySignals.nodeFocusStartMs) / 1000;
        const flyT = THREE.MathUtils.clamp(elapsedSec / ORB_FLY_DURATION, 0, 1);
        const eased = easeInOutQuart(flyT);

        // Track live world position of the target orb (zero allocation)
        const liveOrbPos = galaxySignals.nodeWorldPositions[nodeId];
        orbDestTargetRef.current.copy(liveOrbPos);
        orbDestPosRef.current
          .copy(liveOrbPos)
          .addScaledVector(orbDirScratchRef.current, ORB_STANDOFF_DISTANCE);
        orbDestPosRef.current.y += 0.24;

        evalQuadraticBezier(
          camera.position,
          fromPosRef.current,
          arcCtrlPosRef.current,
          orbDestPosRef.current,
          eased
        );
        if (controlsRef.current) {
          controlsRef.current.target.lerpVectors(
            fromTargetRef.current,
            orbDestTargetRef.current,
            eased
          );
          controlsRef.current.update();
        } else {
          camera.lookAt(orbDestTargetRef.current);
        }

        if (camera instanceof THREE.PerspectiveCamera) {
          const nextFov = THREE.MathUtils.lerp(focusFromFovRef.current, focusToFovRef.current, eased);
          if (Math.abs(camera.fov - nextFov) > 0.01) {
            camera.fov = nextFov;
            camera.updateProjectionMatrix();
          }
        }

        // Beat 2: Distinct Orb Ignition & Portal Flare (0.92s -> 1.38s)
        if (elapsedSec >= ORB_FLARE_START) {
          if (!portalChimePlayedRef.current) {
            portalChimePlayedRef.current = true;
            sfxEngine.playOrbPortalChime();
          }
          const flareT = THREE.MathUtils.clamp(
            (elapsedSec - ORB_FLARE_START) / (ORB_FLARE_END - ORB_FLARE_START),
            0,
            1
          );
          galaxySignals.nodeFlareProgress = flareT;
          galaxySignals.orbFlareBloomSpike = Math.sin(flareT * Math.PI);
        }

        // Beat 3: Lush Modal Bloom Unfold right as Portal Flare peaks (1.15s)
        if (elapsedSec >= ORB_MODAL_OPEN_AT && !modalOpenedForFocusRef.current) {
          modalOpenedForFocusRef.current = true;
          useAppStore.getState().completeNodeFocus();
        }

        // Settle into low-cost holding state once flare finishes
        if (elapsedSec >= ORB_FLARE_END) {
          galaxySignals.nodeFlareProgress = 0;
          galaxySignals.orbFlareBloomSpike = 0;
          focusPhaseRef.current = 'holding';
        }
        return;
      }
    }

    // GPU-saving hold while orb modal is open: zero camera/matrix work per frame
    if (focusPhaseRef.current === 'holding' && stage === 'galaxy') {
      if (storeNow.activeModal === null && storeNow.focusingNodeId === null) {
        focusPhaseRef.current = 'idle';
        galaxySignals.isOrbReturning = false;
        if (controlsRef.current) {
          controlsRef.current.minDistance = DEFAULT_MIN_DISTANCE;
          controlsRef.current.enabled = true;
        }
      } else {
        return;
      }
    }

    // Graceful 1.0s Curved Orbital Pull-Back on Modal Close back to resting Galaxy orbit pose
    if (focusPhaseRef.current === 'pullBack' && stage === 'galaxy') {
      const elapsedSec = (performance.now() - tweenStartMsRef.current) / 1000;
      const t = THREE.MathUtils.clamp(elapsedSec / ORB_PULL_BACK_DURATION, 0, 1);
      const eased = easeInOutQuart(t);

      evalQuadraticBezier(
        camera.position,
        fromPosRef.current,
        arcCtrlPosRef.current,
        toPosRef.current,
        eased
      );
      if (controlsRef.current) {
        controlsRef.current.target.lerpVectors(fromTargetRef.current, toTargetRef.current, eased);
        controlsRef.current.update();
      } else {
        camera.lookAt(toTargetRef.current);
      }

      if (camera instanceof THREE.PerspectiveCamera) {
        const nextFov = THREE.MathUtils.lerp(focusFromFovRef.current, focusToFovRef.current, eased);
        if (Math.abs(camera.fov - nextFov) > 0.01) {
          camera.fov = nextFov;
          camera.updateProjectionMatrix();
        }
      }

      if (t >= 1) {
        focusPhaseRef.current = 'idle';
        galaxySignals.isOrbReturning = false;
        hasUserDraggedInModeRef.current = false;
        if (controlsRef.current) {
          controlsRef.current.minDistance = DEFAULT_MIN_DISTANCE;
          controlsRef.current.autoRotate =
            !reducedMotion &&
            storeNow.activeModal === null &&
            storeNow.focusingNodeId === null &&
            storeNow.viewMode === 'galaxy';
        }
      }
      return;
    }

    if (tweenActiveRef.current && stage === 'galaxy') {
      const elapsedSec = (performance.now() - tweenStartMsRef.current) / 1000;
      const t = THREE.MathUtils.clamp(
        elapsedSec / Math.max(0.01, tweenDurationRef.current),
        0,
        1
      );
      // Silky easeInOutSine while following Constellation light-beam; easeInOutCubic for general Constellation pan
      const isConstellation = useAppStore.getState().viewMode === 'constellation';
      const eased = isConstellation
        ? galaxySignals.beamTracer.active
          ? easeInOutSine(t)
          : easeInOutCubic(t)
        : 1 - Math.pow(1 - t, 3);

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

    // Yield OrbitControls while holding the 3D heart so mouse/finger movement never spins the camera or interrupts charging
    if (controlsRef.current) {
      const shouldEnableOrbit = !galaxySignals.isHoldingHeart;
      if (controlsRef.current.enabled !== shouldEnableOrbit) {
        controlsRef.current.enabled = shouldEnableOrbit;
      }

      // Gently restore default minDistance once the camera is back outside DEFAULT_MIN_DISTANCE (prevents snap if user dragged mid-pull-back)
      if (
        focusPhaseRef.current === 'idle' &&
        controlsRef.current.minDistance < DEFAULT_MIN_DISTANCE
      ) {
        const dist = camera.position.distanceTo(controlsRef.current.target);
        if (dist >= DEFAULT_MIN_DISTANCE) {
          controlsRef.current.minDistance = DEFAULT_MIN_DISTANCE;
        }
      }

      // Manual camera tilt-up / tilt-down between Galaxy & Constellation sky dome (hysteresis + drag-gated)
      const nowMs = performance.now();
      const store = useAppStore.getState();
      if (
        stage === 'galaxy' &&
        hasUserDraggedInModeRef.current &&
        nowMs >= viewSwitchCooldownUntilMsRef.current &&
        !galaxySignals.isHoldingHeart &&
        store.activeModal === null &&
        !store.constellationFinaleActive
      ) {
        const polarAngle = controlsRef.current.getPolarAngle();
        if (store.viewMode === 'galaxy' && polarAngle >= TILT_UP_TO_CONSTELLATION_POLAR) {
          hasUserDraggedInModeRef.current = false;
          viewSwitchCooldownUntilMsRef.current = nowMs + VIEW_SWITCH_COOLDOWN_MS;
          sfxEngine.playCelestialChime('up');
          store.setViewMode('constellation');
          return;
        }
        if (store.viewMode === 'constellation' && polarAngle <= TILT_DOWN_TO_GALAXY_POLAR) {
          hasUserDraggedInModeRef.current = false;
          viewSwitchCooldownUntilMsRef.current = nowMs + VIEW_SWITCH_COOLDOWN_MS;
          sfxEngine.playCelestialChime('down');
          store.setViewMode('galaxy');
          return;
        }
      }
    }

    if (stage === 'galaxy' && !reducedMotion && useAppStore.getState().viewMode === 'galaxy') {
      // Beat 1 + Breath-Hold: tighten gently closer to heart core
      if (galaxySignals.isHoldingHeart) {
        zoomDirRef.current.subVectors(HEART_FOCUS_POINT, camera.position);
        const dist = zoomDirRef.current.length();
        const pullSpeed = galaxySignals.supernovaFreeze > 0.1 ? 3.2 : 1.75;
        if (dist > 7.8) {
          zoomDirRef.current.normalize();
          camera.position.addScaledVector(zoomDirRef.current, dt * pullSpeed);
        }
        if (controlsRef.current) {
          controlsRef.current.target.lerp(HEART_FOCUS_POINT, Math.min(1, dt * 1.8));
          controlsRef.current.update();
        }
      }

      // Beat 2: Aggressive +18° FOV kick on detonation + smooth ease back to BASE_GALAXY_FOV
      if (camera instanceof THREE.PerspectiveCamera) {
        const freezeTighten = galaxySignals.supernovaFreeze * -4.2;
        const kickOffset = galaxySignals.supernovaFovKick * 18.0;
        const desiredFov = BASE_GALAXY_FOV + freezeTighten + kickOffset;
        if (Math.abs(camera.fov - desiredFov) > 0.02) {
          const lerpRate = galaxySignals.supernovaFovKick > 0.45 ? 28 : 6.2;
          camera.fov = THREE.MathUtils.lerp(camera.fov, desiredFov, Math.min(1, dt * lerpRate));
          camera.updateProjectionMatrix();
        }
      }

      // Beat 2: Punchy ~0.50s high-frequency damped Camera Shake on detonation
      if (galaxySignals.supernovaShake > 0.002) {
        const amp = galaxySignals.supernovaShake * 0.54;
        currentShakeOffsetRef.current.set(
          Math.sin(elapsed * 82.0) * amp,
          Math.cos(elapsed * 97.0) * amp * 0.88,
          Math.sin(elapsed * 68.0 + 1.3) * amp * 0.65
        );
        camera.position.add(currentShakeOffsetRef.current);
        lastShakeOffsetRef.current.copy(currentShakeOffsetRef.current);
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
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: undefined,
      }}
      minDistance={6}
      maxDistance={32}
      minPolarAngle={0.18}
      maxPolarAngle={SKY_MAX_POLAR_ANGLE}
      rotateSpeed={0.55}
      zoomSpeed={0.68}
      autoRotate={!reducedMotion && stateNow.activeModal === null && stateNow.viewMode === 'galaxy'}
      autoRotateSpeed={0.34}
      onStart={() => {
        // Immediately yield scripted glide or pull-back when user drags or zooms manually
        tweenActiveRef.current = false;
        if (focusPhaseRef.current === 'pullBack') {
          focusPhaseRef.current = 'idle';
          galaxySignals.isOrbReturning = false;
          if (controlsRef.current) {
            const store = useAppStore.getState();
            controlsRef.current.autoRotate =
              !reducedMotion && store.activeModal === null && store.viewMode === 'galaxy';
          }
        }
        if (!galaxySignals.isHoldingHeart) {
          hasUserDraggedInModeRef.current = true;
        }
      }}
    />
  );
}
