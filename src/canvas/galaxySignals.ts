import * as THREE from 'three';
import { ANNIVERSARY_DATA, type GalaxyNodeId } from '../data/anniversaryData';

const initialNodePositions: Record<GalaxyNodeId, THREE.Vector3> = {
  letter: new THREE.Vector3(),
  counter: new THREE.Vector3(),
  cards: new THREE.Vector3(),
  puzzle: new THREE.Vector3(),
  gallery: new THREE.Vector3(),
};

for (const node of ANNIVERSARY_DATA.galaxyNodes) {
  initialNodePositions[node.id].set(
    Math.cos(node.orbitAngle) * node.orbitRadius,
    node.heightOffset,
    Math.sin(node.orbitAngle) * node.orbitRadius
  );
}

/**
 * Shared zero-allocation mutable signal bus for 60 FPS WebGL <-> Audio <-> Pointer coordination.
 * Mutated inside `useFrame` without ever triggering React re-renders.
 */
export const galaxySignals = {
  /** Stage 1 Intro charge progress [0..1] driving inward starlight pull in IntroScene (zero Canvas re-renders). */
  introCharge: 0,
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
  /** Wall-clock timestamp (ms) when Star #1 auto-ignites upon entering Constellation View (0 when idle). */
  constellationStar0IgniteMs: 0,
  /** Wall-clock timestamp (ms) when the ~2.6s Celestial Awakening & Starfall Cascade starts (0 when idle). */
  constellationFinaleStartMs: 0,
  /** Brief [0..1] post-processing bloom spike at Constellation simultaneous burst (t = 0.9s). */
  constellationBloomSpike: 0,
  /** Warm [0..1] absorption shimmer & pulse on the 3D Particle Heart when falling starlight arrives. */
  heartAbsorptionGlow: 0,
  /** Live world positions of the 5 orbiting feature nodes, updated zero-alloc inside useFrame. */
  nodeWorldPositions: initialNodePositions,
  /** Active node ID currently undergoing 3D camera fly-to & orb portal ignition (null when idle). */
  focusingNodeId: null as GalaxyNodeId | null,
  /** True while camera is smoothly pulling back after closing an orb modal (hides hover labels cleanly). */
  isOrbReturning: false,
  /** Wall-clock timestamp (ms) when the current fly-to sequence began (0 when idle). */
  nodeFocusStartMs: 0,
  /** Normalized [0..1] portal ignition & sparkle burst progress on the focused orb (Beat 2). */
  nodeFlareProgress: 0,
  /** Smoothed [0..1] dim factor for peripheral 3D text during orb fly-to & modal display. */
  nodeFocusDim: 0,
  /** Brief [0..1] post-processing bloom pulse during orb portal ignition. */
  orbFlareBloomSpike: 0,
  /** Travelling Light-Beam Tracer state for Star i -> Star i+1 in Constellation View (zero React re-renders). */
  beamTracer: {
    active: false,
    startMs: 0,
    durationMs: 1200,
    fromIdx: 0,
    toIdx: 0,
    fromPos: new THREE.Vector3(),
    toPos: new THREE.Vector3(),
    currentHeadPos: new THREE.Vector3(),
  },
  /** Target star impact ring/flare triggered the exact instant the travelling beam hits Star i+1. */
  starImpactIdx: -1,
  starImpactStartMs: 0,
};
