import { useEffect, useRef } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { ANNIVERSARY_DATA, type GalaxyNodeId } from '../data/anniversaryData';
import { useAppStore, type AppStage, type CameraPhase, type ViewMode } from '../store/useAppStore';
import { sfxEngine } from '../utils/sfxEngine';
import {
  GALAXY_OVERVIEW_FOV,
  GALAXY_OVERVIEW_POS,
  GALAXY_OVERVIEW_TARGET,
  galaxySignals,
  HEART_CENTER_Y,
} from './galaxySignals';

interface CameraRigProps {
  stage: AppStage;
  reducedMotion?: boolean;
}

const GALAXY_START_POS = new THREE.Vector3(0, 2.3, 5.6);

const CONSTELLATION_DEFAULT_POS = new THREE.Vector3(0, 14.2, 16.2);
const CONSTELLATION_FINALE_POS = new THREE.Vector3(0, 14.4, 21.4);
const CONSTELLATION_FINALE_RECEDE_POS = new THREE.Vector3(0, 13.0, 27.2);
const CONSTELLATION_DEFAULT_TARGET = new THREE.Vector3(0, 16.2, -7.6);
const CONSTELLATION_FINALE_RECEDE_TARGET = new THREE.Vector3(0, 15.6, -7.6);

const HEART_FOCUS_POINT = new THREE.Vector3(0, HEART_CENTER_Y, 0);
const FOCUS_ORB_FOV = 41;
const DEFAULT_MIN_DISTANCE = 6;
const FOCUS_MIN_DISTANCE = 3.2;

const ENTRANCE_DURATION = 1.8;
const VIEW_GLIDE_DURATION = 1.5;
const ORB_FLY_DURATION = 1.15;
const ORB_FLARE_START = 0.92;
const ORB_FLARE_END = 1.38;
const ORB_MODAL_OPEN_AT = 1.15;
const ORB_RETURN_DURATION = 0.95;
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
  const { camera, gl, invalidate } = useThree();
  const enabled = stage !== 'warp' && stage !== 'setup';

  // Single-source-of-truth Camera Finite State Machine + monotonic transition token guard
  const cameraPhaseRef = useRef<CameraPhase>('idle');
  const transitionIdRef = useRef(0);
  const activeFlightTokenRef = useRef(0);

  // Reusable zero-allocation tween & shake state (wall-clock synced so slow GPUs never stall glides)
  const tweenActiveRef = useRef(false);
  const tweenStartMsRef = useRef(0);
  const tweenDurationRef = useRef(ENTRANCE_DURATION);
  const tweenTargetPhaseRef = useRef<CameraPhase>('idle');
  const tweenFromFovRef = useRef(GALAXY_OVERVIEW_FOV);
  const tweenToFovRef = useRef(GALAXY_OVERVIEW_FOV);
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

  // Cinematic Orb Fly-To & Canonical Overview Return state (zero per-frame allocations)
  const activeFocusNodeRef = useRef<GalaxyNodeId | null>(null);
  const focusFromFovRef = useRef(GALAXY_OVERVIEW_FOV);
  const focusToFovRef = useRef(GALAXY_OVERVIEW_FOV);
  const orbDirScratchRef = useRef(new THREE.Vector3());
  const orbCamScratchRef = useRef(new THREE.Vector3());
  const orbDestPosRef = useRef(new THREE.Vector3());
  const orbDestTargetRef = useRef(new THREE.Vector3());
  const arcCtrlPosRef = useRef(new THREE.Vector3());
  const arcTangentRef = useRef(new THREE.Vector3());
  const portalChimePlayedRef = useRef(false);
  const modalOpenedForFocusRef = useRef(false);
  const flareDecayStartMsRef = useRef(0);
  const finaleRecedeTriggeredRef = useRef(false);

  const commitCameraPhase = (next: CameraPhase) => {
    cameraPhaseRef.current = next;
    galaxySignals.cameraPhase = next;
    galaxySignals.isOrbReturning = next === 'returning_to_galaxy';
    useAppStore.getState().setCameraPhase(next);
  };

  const applyCameraFov = (fov: number) => {
    if (camera instanceof THREE.PerspectiveCamera && Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  };

  const setControlsInteractive = (interactive: boolean, autoRotate: boolean, minDistance?: number) => {
    const controls = controlsRef.current;
    if (!controls) return;
    if (minDistance !== undefined) {
      controls.minDistance = minDistance;
    }
    controls.enabled = interactive;
    controls.autoRotate = interactive && autoRotate;
    controls.update();
  };

  const startCameraGlide = (
    destPos: THREE.Vector3,
    destTarget: THREE.Vector3,
    duration: number,
    instant = false,
    targetPhase: CameraPhase = useAppStore.getState().viewMode === 'constellation' ? 'constellation' : 'idle',
    destFov = GALAXY_OVERVIEW_FOV
  ) => {
    const token = ++transitionIdRef.current;
    activeFlightTokenRef.current = token;
    invalidate();

    if (instant || reducedMotion) {
      tweenActiveRef.current = false;
      camera.position.copy(destPos);
      applyCameraFov(destFov);
      if (controlsRef.current) {
        controlsRef.current.target.copy(destTarget);
        controlsRef.current.minDistance = DEFAULT_MIN_DISTANCE;
        controlsRef.current.enabled = true;
        const st = useAppStore.getState();
        controlsRef.current.autoRotate =
          !reducedMotion &&
          st.activeModal === null &&
          st.focusingNodeId === null &&
          st.viewMode === 'galaxy' &&
          targetPhase === 'idle';
        controlsRef.current.update();
      } else {
        camera.lookAt(destTarget);
      }
      commitCameraPhase(targetPhase);
      return;
    }

    fromPosRef.current.copy(camera.position);
    toPosRef.current.copy(destPos);

    if (controlsRef.current) {
      fromTargetRef.current.copy(controlsRef.current.target);
      controlsRef.current.enabled = false;
      controlsRef.current.autoRotate = false;
    } else {
      fromTargetRef.current.copy(GALAXY_OVERVIEW_TARGET);
    }
    toTargetRef.current.copy(destTarget);
    tweenFromFovRef.current =
      camera instanceof THREE.PerspectiveCamera ? camera.fov : GALAXY_OVERVIEW_FOV;
    tweenToFovRef.current = destFov;
    tweenTargetPhaseRef.current = targetPhase;

    tweenDurationRef.current = duration;
    tweenStartMsRef.current = performance.now();
    tweenActiveRef.current = true;
    commitCameraPhase(targetPhase === 'idle' ? 'returning_to_galaxy' : targetPhase);
  };

  /** Unconditionally starts a smooth return flight back to canonical GALAXY_OVERVIEW_POS / TARGET / FOV. */
  const startCanonicalGalaxyReturn = () => {
    const token = ++transitionIdRef.current;
    activeFlightTokenRef.current = token;
    activeFocusNodeRef.current = null;
    modalOpenedForFocusRef.current = false;
    portalChimePlayedRef.current = false;
    flareDecayStartMsRef.current = 0;
    tweenActiveRef.current = false;

    galaxySignals.focusingNodeId = null;
    galaxySignals.nodeFocusStartMs = 0;
    galaxySignals.nodeFlareProgress = 0;
    galaxySignals.orbFlareBloomSpike = 0;
    galaxySignals.isOrbReturning = true;
    invalidate();

    if (reducedMotion) {
      camera.position.copy(GALAXY_OVERVIEW_POS);
      applyCameraFov(GALAXY_OVERVIEW_FOV);
      if (controlsRef.current) {
        controlsRef.current.target.copy(GALAXY_OVERVIEW_TARGET);
        controlsRef.current.minDistance = DEFAULT_MIN_DISTANCE;
        controlsRef.current.enabled = true;
        controlsRef.current.autoRotate = false;
        controlsRef.current.update();
      } else {
        camera.lookAt(GALAXY_OVERVIEW_TARGET);
      }
      commitCameraPhase('idle');
      return;
    }

    fromPosRef.current.copy(camera.position);
    toPosRef.current.copy(GALAXY_OVERVIEW_POS);
    fromTargetRef.current.copy(controlsRef.current?.target ?? orbDestTargetRef.current);
    toTargetRef.current.copy(GALAXY_OVERVIEW_TARGET);
    focusFromFovRef.current =
      camera instanceof THREE.PerspectiveCamera ? camera.fov : FOCUS_ORB_FOV;
    focusToFovRef.current = GALAXY_OVERVIEW_FOV;

    // Gentle inverse orbital arc returning strictly to canonical GALAXY_OVERVIEW_POS
    arcTangentRef.current.subVectors(toPosRef.current, fromPosRef.current);
    const backChord = arcTangentRef.current.length();
    const backLatX = -arcTangentRef.current.z;
    const backLatZ = arcTangentRef.current.x;
    const backLatLen = Math.hypot(backLatX, backLatZ) || 1;
    const backBend = Math.min(1.6, backChord * 0.12);
    arcCtrlPosRef.current.copy(fromPosRef.current).lerp(toPosRef.current, 0.5);
    arcCtrlPosRef.current.x += (backLatX / backLatLen) * backBend;
    arcCtrlPosRef.current.z += (backLatZ / backLatLen) * backBend;
    arcCtrlPosRef.current.y += Math.min(0.75, backChord * 0.05 + 0.18);

    tweenStartMsRef.current = performance.now();
    tweenDurationRef.current = ORB_RETURN_DURATION;
    commitCameraPhase('returning_to_galaxy');

    // Lock OrbitControls throughout automated return so damping or residual clicks can NEVER abort pull-back
    if (controlsRef.current) {
      controlsRef.current.enabled = false;
      controlsRef.current.autoRotate = false;
    }
  };

  // Expose zero-overhead read-only camera telemetry getter on the WebGL canvas for deterministic QA verification
  useEffect(() => {
    const canvasEl = gl.domElement as HTMLCanvasElement & {
      __anniCameraState?: () => {
        phase: CameraPhase;
        transitionId: number;
        controlsEnabled: boolean;
        fov: number;
        position: [number, number, number];
        target: [number, number, number];
      };
    };
    canvasEl.__anniCameraState = () => {
      const t = controlsRef.current?.target ?? GALAXY_OVERVIEW_TARGET;
      return {
        phase: cameraPhaseRef.current,
        transitionId: transitionIdRef.current,
        controlsEnabled: Boolean(controlsRef.current?.enabled),
        fov: camera instanceof THREE.PerspectiveCamera ? Number(camera.fov.toFixed(2)) : GALAXY_OVERVIEW_FOV,
        position: [
          Number(camera.position.x.toFixed(3)),
          Number(camera.position.y.toFixed(3)),
          Number(camera.position.z.toFixed(3)),
        ],
        target: [Number(t.x.toFixed(3)), Number(t.y.toFixed(3)), Number(t.z.toFixed(3))],
      };
    };
    return () => {
      delete canvasEl.__anniCameraState;
    };
  }, [camera, gl]);

  // Initial Stage arrival pose (Warp -> Galaxy pull-out from core)
  useEffect(() => {
    if (stage === 'galaxy') {
      if (reducedMotion) {
        startCameraGlide(GALAXY_OVERVIEW_POS, GALAXY_OVERVIEW_TARGET, 0, true, 'idle', GALAXY_OVERVIEW_FOV);
      } else {
        camera.position.copy(GALAXY_START_POS);
        applyCameraFov(GALAXY_OVERVIEW_FOV);
        if (controlsRef.current) {
          controlsRef.current.target.copy(GALAXY_OVERVIEW_TARGET);
          controlsRef.current.update();
        }
        startCameraGlide(
          GALAXY_OVERVIEW_POS,
          GALAXY_OVERVIEW_TARGET,
          ENTRANCE_DURATION,
          false,
          'idle',
          GALAXY_OVERVIEW_FOV
        );
      }
    } else if (stage === 'intro' || stage === 'setup') {
      transitionIdRef.current += 1;
      tweenActiveRef.current = false;
      activeFocusNodeRef.current = null;
      cameraPhaseRef.current = 'idle';
      galaxySignals.cameraPhase = 'idle';
      galaxySignals.isOrbReturning = false;
      camera.position.set(0, 0.8, 13);
      applyCameraFov(GALAXY_OVERVIEW_FOV);
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      }
    }
  }, [stage, camera, reducedMotion]);

  // Imperatively sync viewMode, selectedMilestoneId, focusingNodeId, modal close, and OrbitControls without re-rendering Canvas
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
          cameraPhaseRef.current === 'idle' &&
          !tweenActiveRef.current &&
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
        state.focusingNodeId !== prev.focusingNodeId ||
        state.cameraPhase !== prev.cameraPhase
      ) {
        syncAutoRotate(state.activeModal, state.viewMode, state.focusingNodeId);
      }

      if (stage !== 'galaxy') return;

      // Glide smoothly between Galaxy View and Constellation View
      if (state.viewMode !== prev.viewMode) {
        transitionIdRef.current += 1;
        activeFocusNodeRef.current = null;
        modalOpenedForFocusRef.current = false;
        portalChimePlayedRef.current = false;
        flareDecayStartMsRef.current = 0;
        galaxySignals.focusingNodeId = null;
        galaxySignals.isOrbReturning = false;
        galaxySignals.nodeFocusStartMs = 0;
        galaxySignals.nodeFlareProgress = 0;
        galaxySignals.orbFlareBloomSpike = 0;
        hasUserDraggedInModeRef.current = false;
        viewSwitchCooldownUntilMsRef.current = performance.now() + VIEW_SWITCH_COOLDOWN_MS;

        if (state.viewMode === 'constellation') {
          cameraPhaseRef.current = 'constellation';
          galaxySignals.cameraPhase = 'constellation';
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
            startCameraGlide(
              focusPos.clone(),
              focusTarget.clone(),
              0.88,
              false,
              'constellation',
              GALAXY_OVERVIEW_FOV
            );
          } else {
            startCameraGlide(
              CONSTELLATION_DEFAULT_POS,
              CONSTELLATION_DEFAULT_TARGET,
              VIEW_GLIDE_DURATION,
              false,
              'constellation',
              GALAXY_OVERVIEW_FOV
            );
          }
        } else {
          startCameraGlide(
            GALAXY_OVERVIEW_POS,
            GALAXY_OVERVIEW_TARGET,
            VIEW_GLIDE_DURATION,
            false,
            'idle',
            GALAXY_OVERVIEW_FOV
          );
        }
        return;
      }

      // Beat 1 Trigger: Cinematic 3D Camera Fly-To a Memory Orb (supports safe mid-return interrupts!)
      if (
        state.viewMode === 'galaxy' &&
        state.focusingNodeId !== null &&
        (state.focusingNodeId !== prev.focusingNodeId ||
          state.cameraTransitionId !== prev.cameraTransitionId)
      ) {
        const token = ++transitionIdRef.current;
        activeFlightTokenRef.current = token;
        const nodeId = state.focusingNodeId;
        const orbPos = galaxySignals.nodeWorldPositions[nodeId];

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
          const align = orbCamScratchRef.current.dot(orbDirScratchRef.current);
          const radialWeight = align >= 0 ? 0.32 : 0.14;
          orbDirScratchRef.current
            .multiplyScalar(radialWeight)
            .addScaledVector(orbCamScratchRef.current, 1 - radialWeight)
            .normalize();
        } else {
          orbDirScratchRef.current.copy(orbCamScratchRef.current);
        }
        orbDirScratchRef.current.y = THREE.MathUtils.clamp(orbDirScratchRef.current.y, 0.08, 0.42);
        orbDirScratchRef.current.normalize();

        orbDestTargetRef.current.copy(orbPos);
        orbDestPosRef.current
          .copy(orbPos)
          .addScaledVector(orbDirScratchRef.current, ORB_STANDOFF_DISTANCE);
        orbDestPosRef.current.y += 0.24;

        fromPosRef.current.copy(camera.position);
        fromTargetRef.current.copy(controlsRef.current?.target ?? GALAXY_OVERVIEW_TARGET);
        focusFromFovRef.current =
          camera instanceof THREE.PerspectiveCamera ? camera.fov : GALAXY_OVERVIEW_FOV;
        focusToFovRef.current = FOCUS_ORB_FOV;

        // Compute lateral curved orbital arc control point
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
        flareDecayStartMsRef.current = 0;
        tweenActiveRef.current = false;
        galaxySignals.isOrbReturning = false;
        cameraPhaseRef.current = 'flying_to_node';
        galaxySignals.cameraPhase = 'flying_to_node';
        invalidate();

        if (controlsRef.current) {
          controlsRef.current.minDistance = FOCUS_MIN_DISTANCE;
          controlsRef.current.enabled = false;
          controlsRef.current.autoRotate = false;
        }

        sfxEngine.playOrbFlyWhoosh();
        return;
      }

      // Unified Return Trigger: Modal Closed (or focus cancelled) -> ALWAYS glide back to canonical GALAXY_OVERVIEW_POS
      const closedModalInGalaxy =
        state.viewMode === 'galaxy' &&
        prev.activeModal !== null &&
        state.activeModal === null;
      const requestedReturnInGalaxy =
        state.viewMode === 'galaxy' &&
        state.activeModal === null &&
        state.focusingNodeId === null &&
        state.cameraPhase === 'returning_to_galaxy' &&
        state.cameraTransitionId !== prev.cameraTransitionId;

      if (closedModalInGalaxy || requestedReturnInGalaxy) {
        startCanonicalGalaxyReturn();
        return;
      }

      // Direct modal open (e.g. reducedMotion or Secret Supernova modal)
      if (
        state.viewMode === 'galaxy' &&
        state.activeModal !== null &&
        state.activeModal !== prev.activeModal &&
        cameraPhaseRef.current !== 'modal_open'
      ) {
        const nextPhase: CameraPhase = state.activeModal === 'secret' ? 'supernova' : 'modal_open';
        cameraPhaseRef.current = nextPhase;
        galaxySignals.cameraPhase = nextPhase;
        if (controlsRef.current) {
          controlsRef.current.enabled = false;
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
        startCameraGlide(
          CONSTELLATION_FINALE_POS,
          CONSTELLATION_DEFAULT_TARGET,
          0.72,
          false,
          'constellation',
          GALAXY_OVERVIEW_FOV
        );
        return;
      }

      // Focus camera gracefully toward active milestone star (leads slightly ahead of the 1.2s travelling light-beam)
      if (
        state.viewMode === 'constellation' &&
        !state.constellationFinaleActive &&
        state.selectedMilestoneId !== prev.selectedMilestoneId
      ) {
        if (!state.selectedMilestoneId) {
          startCameraGlide(
            CONSTELLATION_DEFAULT_POS,
            CONSTELLATION_DEFAULT_TARGET,
            0.9,
            false,
            'constellation',
            GALAXY_OVERVIEW_FOV
          );
          return;
        }
        const star = ANNIVERSARY_DATA.constellationMilestones.find(
          (m) => m.id === state.selectedMilestoneId
        );
        if (star) {
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
          startCameraGlide(
            focusPos.clone(),
            focusTarget.clone(),
            0.95,
            false,
            'constellation',
            GALAXY_OVERVIEW_FOV
          );
        }
      }
    });

    return unsubscribe;
  }, [reducedMotion, stage, camera, invalidate]);

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
      (cameraPhaseRef.current === 'flying_to_node' ||
        cameraPhaseRef.current === 'modal_open' ||
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
          Math.max(0.85, galaxySignals.beamTracer.durationMs / 1000 + 0.08),
          false,
          'constellation',
          GALAXY_OVERVIEW_FOV
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
          FINALE_RECEDE_DURATION_SEC,
          false,
          'constellation',
          GALAXY_OVERVIEW_FOV
        );
      }
    }

    // FSM STATE: 'flying_to_node' — Curved Orbital Arc (0.0s -> 1.15s) + Portal Flare -> 'modal_open'
    if (cameraPhaseRef.current === 'flying_to_node' && stage === 'galaxy') {
      const token = activeFlightTokenRef.current;
      const nodeId = activeFocusNodeRef.current;
      if (!nodeId || token !== transitionIdRef.current) {
        startCanonicalGalaxyReturn();
        return;
      }

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
        controlsRef.current.enabled = false;
        controlsRef.current.target.lerpVectors(
          fromTargetRef.current,
          orbDestTargetRef.current,
          eased
        );
        controlsRef.current.update();
      } else {
        camera.lookAt(orbDestTargetRef.current);
      }

      applyCameraFov(THREE.MathUtils.lerp(focusFromFovRef.current, focusToFovRef.current, eased));

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

      // Beat 3: Transition cleanly into 'modal_open' right as Portal Flare peaks (1.15s)
      if (elapsedSec >= ORB_MODAL_OPEN_AT && !modalOpenedForFocusRef.current) {
        if (token !== transitionIdRef.current) return;
        modalOpenedForFocusRef.current = true;
        flareDecayStartMsRef.current = galaxySignals.nodeFocusStartMs;
        cameraPhaseRef.current = 'modal_open';
        galaxySignals.cameraPhase = 'modal_open';
        useAppStore.getState().completeNodeFocus();
      }
      return;
    }

    // FSM STATE: 'modal_open' / 'supernova' — Low-cost locked hold while modal is open
    if (
      (cameraPhaseRef.current === 'modal_open' || cameraPhaseRef.current === 'supernova') &&
      stage === 'galaxy'
    ) {
      // Finish trailing portal flare smoothly (1.15s -> 1.38s) without risking stale transitions
      if (flareDecayStartMsRef.current > 0) {
        const elapsedSec = (performance.now() - flareDecayStartMsRef.current) / 1000;
        if (elapsedSec >= ORB_FLARE_END) {
          galaxySignals.nodeFlareProgress = 0;
          galaxySignals.orbFlareBloomSpike = 0;
          flareDecayStartMsRef.current = 0;
        } else {
          const flareT = THREE.MathUtils.clamp(
            (elapsedSec - ORB_FLARE_START) / (ORB_FLARE_END - ORB_FLARE_START),
            0,
            1
          );
          galaxySignals.nodeFlareProgress = flareT;
          galaxySignals.orbFlareBloomSpike = Math.sin(flareT * Math.PI);
        }
      }

      // Self-healing safety net: if modal was closed without firing subscription, unconditionally return to canonical Galaxy overview
      if (storeNow.activeModal === null && storeNow.focusingNodeId === null) {
        startCanonicalGalaxyReturn();
        return;
      }

      if (controlsRef.current && controlsRef.current.enabled) {
        controlsRef.current.enabled = false;
      }
      return;
    }

    // FSM STATE: 'returning_to_galaxy' — Smooth 0.95s easeInOutCubic flight strictly to canonical GALAXY_OVERVIEW_POS/TARGET/FOV
    if (
      cameraPhaseRef.current === 'returning_to_galaxy' &&
      !tweenActiveRef.current &&
      stage === 'galaxy'
    ) {
      const token = activeFlightTokenRef.current;
      if (token !== transitionIdRef.current) return;

      const elapsedSec = (performance.now() - tweenStartMsRef.current) / 1000;
      const t = THREE.MathUtils.clamp(elapsedSec / ORB_RETURN_DURATION, 0, 1);
      const eased = easeInOutCubic(t);

      evalQuadraticBezier(
        camera.position,
        fromPosRef.current,
        arcCtrlPosRef.current,
        GALAXY_OVERVIEW_POS,
        eased
      );
      if (controlsRef.current) {
        controlsRef.current.enabled = false;
        controlsRef.current.target.lerpVectors(fromTargetRef.current, GALAXY_OVERVIEW_TARGET, eased);
        controlsRef.current.update();
      } else {
        camera.lookAt(GALAXY_OVERVIEW_TARGET);
      }

      applyCameraFov(THREE.MathUtils.lerp(focusFromFovRef.current, GALAXY_OVERVIEW_FOV, eased));

      if (t >= 1) {
        camera.position.copy(GALAXY_OVERVIEW_POS);
        applyCameraFov(GALAXY_OVERVIEW_FOV);
        if (controlsRef.current) {
          controlsRef.current.target.copy(GALAXY_OVERVIEW_TARGET);
        }
        hasUserDraggedInModeRef.current = false;
        commitCameraPhase('idle');
        setControlsInteractive(
          true,
          !reducedMotion &&
            storeNow.activeModal === null &&
            storeNow.focusingNodeId === null &&
            storeNow.viewMode === 'galaxy',
          DEFAULT_MIN_DISTANCE
        );
      }
      return;
    }

    // General scripted glides (Warp arrival, Galaxy <-> Constellation view switches, Star-to-Star pan)
    if (tweenActiveRef.current && stage === 'galaxy') {
      const elapsedSec = (performance.now() - tweenStartMsRef.current) / 1000;
      const t = THREE.MathUtils.clamp(
        elapsedSec / Math.max(0.01, tweenDurationRef.current),
        0,
        1
      );
      const isConstellation = storeNow.viewMode === 'constellation';
      const eased = isConstellation
        ? galaxySignals.beamTracer.active
          ? easeInOutSine(t)
          : easeInOutCubic(t)
        : easeInOutCubic(t);

      camera.position.lerpVectors(fromPosRef.current, toPosRef.current, eased);
      applyCameraFov(THREE.MathUtils.lerp(tweenFromFovRef.current, tweenToFovRef.current, eased));
      if (controlsRef.current) {
        controlsRef.current.enabled = false;
        controlsRef.current.target.lerpVectors(fromTargetRef.current, toTargetRef.current, eased);
        controlsRef.current.update();
      } else {
        camera.lookAt(toTargetRef.current);
      }

      if (t >= 1) {
        tweenActiveRef.current = false;
        camera.position.copy(toPosRef.current);
        applyCameraFov(tweenToFovRef.current);
        const destPhase = tweenTargetPhaseRef.current;
        if (controlsRef.current) {
          controlsRef.current.target.copy(toTargetRef.current);
        }
        commitCameraPhase(destPhase);
        setControlsInteractive(
          true,
          !reducedMotion &&
            storeNow.activeModal === null &&
            storeNow.focusingNodeId === null &&
            storeNow.viewMode === 'galaxy' &&
            destPhase === 'idle',
          DEFAULT_MIN_DISTANCE
        );
      }
      return;
    }

    // Idle / Constellation interactive controls management
    if (controlsRef.current) {
      const shouldEnableOrbit = !galaxySignals.isHoldingHeart;
      if (controlsRef.current.enabled !== shouldEnableOrbit) {
        controlsRef.current.enabled = shouldEnableOrbit;
      }

      if (
        cameraPhaseRef.current === 'idle' &&
        controlsRef.current.minDistance < DEFAULT_MIN_DISTANCE
      ) {
        controlsRef.current.minDistance = DEFAULT_MIN_DISTANCE;
      }

      // Manual camera tilt-up / tilt-down between Galaxy & Constellation sky dome (hysteresis + drag-gated)
      const nowMs = performance.now();
      if (
        stage === 'galaxy' &&
        hasUserDraggedInModeRef.current &&
        nowMs >= viewSwitchCooldownUntilMsRef.current &&
        !galaxySignals.isHoldingHeart &&
        storeNow.activeModal === null &&
        !storeNow.constellationFinaleActive
      ) {
        const polarAngle = controlsRef.current.getPolarAngle();
        if (storeNow.viewMode === 'galaxy' && polarAngle >= TILT_UP_TO_CONSTELLATION_POLAR) {
          hasUserDraggedInModeRef.current = false;
          viewSwitchCooldownUntilMsRef.current = nowMs + VIEW_SWITCH_COOLDOWN_MS;
          sfxEngine.playCelestialChime('up');
          storeNow.setViewMode('constellation');
          return;
        }
        if (storeNow.viewMode === 'constellation' && polarAngle <= TILT_DOWN_TO_GALAXY_POLAR) {
          hasUserDraggedInModeRef.current = false;
          viewSwitchCooldownUntilMsRef.current = nowMs + VIEW_SWITCH_COOLDOWN_MS;
          sfxEngine.playCelestialChime('down');
          storeNow.setViewMode('galaxy');
          return;
        }
      }
    }

    if (stage === 'galaxy' && !reducedMotion && storeNow.viewMode === 'galaxy') {
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

      // Beat 2: Aggressive +18° FOV kick on detonation + smooth ease back to GALAXY_OVERVIEW_FOV
      if (camera instanceof THREE.PerspectiveCamera) {
        const freezeTighten = galaxySignals.supernovaFreeze * -4.2;
        const kickOffset = galaxySignals.supernovaFovKick * 18.0;
        const desiredFov = GALAXY_OVERVIEW_FOV + freezeTighten + kickOffset;
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
      minDistance={DEFAULT_MIN_DISTANCE}
      maxDistance={32}
      minPolarAngle={0.18}
      maxPolarAngle={SKY_MAX_POLAR_ANGLE}
      rotateSpeed={0.55}
      zoomSpeed={0.68}
      autoRotate={!reducedMotion && stateNow.activeModal === null && stateNow.viewMode === 'galaxy'}
      autoRotateSpeed={0.34}
      onStart={() => {
        // Never allow OrbitControls onStart to abort automated orb fly-to or canonical galaxy return
        if (
          cameraPhaseRef.current === 'flying_to_node' ||
          cameraPhaseRef.current === 'returning_to_galaxy' ||
          cameraPhaseRef.current === 'modal_open'
        ) {
          return;
        }
        tweenActiveRef.current = false;
        if (!galaxySignals.isHoldingHeart) {
          hasUserDraggedInModeRef.current = true;
        }
      }}
    />
  );
}
