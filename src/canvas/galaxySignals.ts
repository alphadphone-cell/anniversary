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
  /** Secret Supernova hold charge [0..1] over 3.0s direct hold on the 3D particle heart. */
  supernovaCharge: 0,
  /** Secret Supernova radial explosion & reformation wave [0..1] (spikes 1 -> decays to 0). */
  supernovaBurst: 0,
  /** True while holding directly on the 3D particle heart (triggers gentle camera zoom-in). */
  isHoldingHeart: false,
  /** Smoothed [0..1] lower-galaxy dim factor when viewing the upper Constellation Timeline dome. */
  galaxyDim: 0,
};
