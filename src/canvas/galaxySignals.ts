import * as THREE from 'three';

/**
 * Shared zero-allocation mutable signal bus for 60 FPS WebGL <-> Audio <-> Pointer coordination.
 * Mutated inside `useFrame` without ever triggering React re-renders.
 */
export const galaxySignals = {
  /** Smoothed low-frequency bass energy [0..1] (falls back to procedural breathing sine). */
  bassEnergy: 0.25,
  /** World-space 3D pointer coordinate projected onto the galaxy interaction plane. */
  pointerWorld: new THREE.Vector3(0, 100, 0),
  /** Smoothed [0..1] pointer proximity weight for GPU gravity pull & stardust trail. */
  pointerStrength: 0,
  /** Beat 1 implosion charge [0..1] over 0.0s -> 2.85s hold on the 3D particle heart. */
  supernovaCharge: 0,
  /** Beat 1b breath-hold vacuum freeze [0..1] over 2.85s -> 3.0s right before detonation. */
  supernovaFreeze: 0,
  /** Seconds elapsed since Beat 2 detonation (-1 when idle). Drives shockwaves, rays, and aftermath. */
  supernovaDetonateTime: -1,
  /** Damped physical camera shake envelope [0..1] (~0.45s on detonation). */
  supernovaShake: 0,
  /** Punchy FOV kick envelope [0..1] on detonation (quick outward recoil then smooth ease back). */
  supernovaFovKick: 0,
  /** True while holding on the 3D particle heart or during the 150ms breath-hold anticipation. */
  isHoldingHeart: false,
  /** Smoothed [0..1] lower-galaxy dim factor when viewing the upper Constellation Timeline dome. */
  galaxyDim: 0,
  /** Theatrical focus dim [0..1] during Supernova build-up (0->1) & deep contrast dip on pinpoint freeze. */
  supernovaAmbientDim: 0,
  /** Brief [0..1] post-processing bloom spike right at Supernova detonation (~160ms). */
  supernovaBloomSpike: 0,
};
