import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-react';
import { ANNIVERSARY_DATA } from '../../data/anniversaryData';
import { galaxySignals } from '../../canvas/galaxySignals';
import {
  useAppStore,
  useSelectedMilestoneId,
  useStage,
  useViewMode,
} from '../../store/useAppStore';
import { musicEngine } from '../../utils/musicEngine';
import { sfxEngine } from '../../utils/sfxEngine';

const ENTRY_AUTO_OPEN_MS = 850;
// Strict Impact-Triggered Ignition Star-to-Star Choreography:
const BEAT1_CLEAR_SKY_MS = 320; // Beat 1: clear current card & vignette completely
const BEAM_DRAW_DURATION_MS = 1100; // Beat 2: ~1.1s slow white-gold comet + strict trailing line (destination star stays dormant!)
const POST_IGNITION_HOLD_MS = 550; // Beat 4: +0.55s admiration hold AFTER exact WebGL impact frame before revealing next card

// Layered Separation Capricorn Emblem Finale Timeline:
const EMBLEM_REVEAL_MS = 2050; // Phase 3: appears after 0.0->1.4s Circuit Surge & 1.4->2.05s Recede/Soft Dim (~22%)
const EMBLEM_DISSOLVE_MS = 4650; // Phase 5: ~2.6s Emblem hold (incl. 1.0s SVG draw) -> dissolves into Starfall
const RETURN_TO_GALAXY_MS = 4900; // Slow 1.5s camera return gliding down with golden-pink stardust into Love Galaxy
const HEART_ABSORPTION_CHIME_MS = 5700; // Warm shimmer chime as falling starlight pours into the 3D Heart

type EmblemPhase = 'hidden' | 'visible' | 'dissolving';

const ASTROLABE_TICKS = Array.from({ length: 24 }, (_, idx) => {
  const angle = (idx / 24) * Math.PI * 2;
  const isMajor = idx % 6 === 0;
  const rInner = isMajor ? 92 : 95.5;
  const rOuter = 100;
  return {
    key: idx,
    x1: 110 + Math.cos(angle) * rInner,
    y1: 110 + Math.sin(angle) * rInner,
    x2: 110 + Math.cos(angle) * rOuter,
    y2: 110 + Math.sin(angle) * rOuter,
    isMajor,
  };
});

/**
 * Clean, Unobstructed Capricorn (♑) Celestial Centerpiece Overlay (Phase 3: `2.05s -> 4.65s`).
 * - Positioned slightly above viewport center over a soft seamless dark radial vignette (zero harsh box).
 * - Thin celestial astrolabe ring with slowly rotating degree ticks + 1.0s champagne-gold/rose-white pathLength draw.
 * - Uncluttered borderless Playfair Display & Be Vietnam Pro typography cleanly below the outer ring (`mt-6`).
 */
function ConstellationEmblemOverlay({ phase }: { phase: EmblemPhase }) {
  const emblem = ANNIVERSARY_DATA.constellationEmblem;
  const isShowing = phase === 'visible';

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col items-center justify-center px-6 text-center">
      <AnimatePresence>
        {isShowing && (
          <motion.div
            key="constellation-emblem-reveal"
            role="status"
            aria-live="polite"
            aria-label={`Biểu tượng ${emblem.name}`}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            style={{ willChange: 'transform, opacity' }}
            className="relative flex -translate-y-4 flex-col items-center sm:-translate-y-5"
          >
            {/* Seamless Soft Dark Radial Vignette Halo (prevents background stars from bleeding into symbol or text) */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-1/2 h-[440px] w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-full sm:h-[520px] sm:w-[520px]"
              style={{
                background:
                  'radial-gradient(circle, rgba(5,2,10,0.86) 0%, rgba(5,2,10,0.68) 38%, rgba(5,2,10,0.22) 66%, rgba(5,2,10,0) 86%)',
              }}
            />

            {/* Crisp Celestial Astrolabe Ring + Champagne-Gold Capricorn (♑) Emblem */}
            <div className="relative flex h-48 w-48 items-center justify-center sm:h-56 sm:w-56">
              {/* Outer Astrolabe Ring with Slowly Rotating Degree Ticks */}
              <motion.svg
                viewBox="0 0 220 220"
                aria-hidden="true"
                initial={{ opacity: 0, rotate: -14, scale: 0.94 }}
                animate={{ opacity: 0.85, rotate: 22, scale: 1 }}
                transition={{ duration: 3.4, ease: 'easeOut' }}
                style={{ willChange: 'transform, opacity' }}
                className="absolute inset-0 h-full w-full"
              >
                <circle
                  cx="110"
                  cy="110"
                  r="100"
                  fill="none"
                  stroke="rgba(246, 211, 139, 0.36)"
                  strokeWidth="0.9"
                />
                <circle
                  cx="110"
                  cy="110"
                  r="90"
                  fill="none"
                  stroke="rgba(253, 164, 207, 0.24)"
                  strokeWidth="0.7"
                  strokeDasharray="3 7"
                />
                {ASTROLABE_TICKS.map((tick) => (
                  <line
                    key={tick.key}
                    x1={tick.x1}
                    y1={tick.y1}
                    x2={tick.x2}
                    y2={tick.y2}
                    stroke={
                      tick.isMajor ? 'rgba(255, 245, 214, 0.78)' : 'rgba(246, 211, 139, 0.38)'
                    }
                    strokeWidth={tick.isMajor ? '1.35' : '0.8'}
                    strokeLinecap="round"
                  />
                ))}
              </motion.svg>

              {/* Subtle Warm Celestial Inner Backlight */}
              <div
                aria-hidden="true"
                className="absolute inset-7 rounded-full opacity-70"
                style={{
                  background:
                    'radial-gradient(circle, rgba(246,211,139,0.22) 0%, rgba(244,114,182,0.14) 48%, rgba(5,2,10,0) 76%)',
                }}
              />

              {/* Higher-Contrast Champagne-Gold to Rose-White Capricorn (♑) SVG */}
              <svg
                viewBox="0 0 160 160"
                aria-hidden="true"
                className="relative h-36 w-36 sm:h-40 sm:w-40"
                style={{
                  filter:
                    'drop-shadow(0 0 8px rgba(255, 251, 240, 0.95)) drop-shadow(0 0 20px rgba(246, 211, 139, 0.65)) drop-shadow(0 0 34px rgba(244, 114, 182, 0.45))',
                }}
              >
                <defs>
                  <linearGradient id="constellation-emblem-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fffdf7" />
                    <stop offset="48%" stopColor="#f6d38b" />
                    <stop offset="100%" stopColor="#fda4cf" />
                  </linearGradient>
                </defs>

                <motion.path
                  d={emblem.svgPath}
                  fill="none"
                  stroke="url(#constellation-emblem-grad)"
                  strokeWidth="3.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0, opacity: 0.25 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
                />

                {emblem.starDots?.map(([cx, cy], idx) => (
                  <motion.circle
                    key={`${cx}-${cy}`}
                    cx={cx}
                    cy={cy}
                    r="3.4"
                    fill="#fffdf7"
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: [0, 1, 0.92], scale: [0, 1.35, 1] }}
                    transition={{ duration: 0.45, delay: 0.32 + idx * 0.1, ease: 'easeOut' }}
                  />
                ))}
              </svg>
            </div>

            {/* Clean, Borderless Typography Positioned Below the Entire Astrolabe Ring (Zero Box!) */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.38, ease: [0.22, 1, 0.36, 1] }}
              className="relative mt-6 flex flex-col items-center"
            >
              <h2
                className="font-display text-2xl leading-snug font-semibold tracking-wide text-[#fdf6ff] sm:text-3xl"
                style={{
                  textShadow:
                    '0 2px 14px rgba(5, 2, 10, 0.9), 0 0 22px rgba(246, 211, 139, 0.48), 0 0 36px rgba(244, 114, 182, 0.36)',
                }}
              >
                {emblem.name}
              </h2>
              <p
                className="mt-2 font-sans text-[11px] font-medium tracking-[0.22em] text-pink-100/85 uppercase sm:text-xs"
                style={{ textShadow: '0 2px 10px rgba(5, 2, 10, 0.92)' }}
              >
                {emblem.subtitle}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ConstellationCard() {
  const stage = useStage();
  const viewMode = useViewMode();
  const selectedId = useSelectedMilestoneId();
  const setSelectedMilestoneId = useAppStore((s) => s.setSelectedMilestoneId);
  const startConstellationFinale = useAppStore((s) => s.startConstellationFinale);
  const endConstellationFinale = useAppStore((s) => s.endConstellationFinale);

  const [displayedId, setDisplayedId] = useState<string | null>(null);
  const [isStepping, setIsStepping] = useState(false);
  const [emblemPhase, setEmblemPhase] = useState<EmblemPhase>('hidden');

  const isSteppingRef = useRef(false);
  const entryTimerRef = useRef<number | null>(null);
  const beat2TimerRef = useRef<number | null>(null);
  const beat3TimerRef = useRef<number | null>(null);
  const beat4TimerRef = useRef<number | null>(null);
  const emblemRevealTimerRef = useRef<number | null>(null);
  const emblemDissolveTimerRef = useRef<number | null>(null);
  const finaleTimerRef = useRef<number | null>(null);
  const absorptionTimerRef = useRef<number | null>(null);

  const milestones = ANNIVERSARY_DATA.constellationMilestones;
  const activeDisplayedId = viewMode === 'constellation' ? displayedId : null;
  const currentIndex = milestones.findIndex((m) => m.id === activeDisplayedId);
  const current = viewMode === 'constellation' && currentIndex >= 0 ? milestones[currentIndex] : null;
  const isFirst = currentIndex <= 0;
  const isLast = currentIndex === milestones.length - 1;

  const clearStepTimers = useCallback(() => {
    if (beat2TimerRef.current !== null) {
      window.clearTimeout(beat2TimerRef.current);
      beat2TimerRef.current = null;
    }
    if (beat3TimerRef.current !== null) {
      window.clearTimeout(beat3TimerRef.current);
      beat3TimerRef.current = null;
    }
    if (beat4TimerRef.current !== null) {
      window.clearTimeout(beat4TimerRef.current);
      beat4TimerRef.current = null;
    }
    galaxySignals.beamTracer.active = false;
    galaxySignals.beamTracer.onImpact = null;
    galaxySignals.beamTracer.cameraGlideRequested = false;
    isSteppingRef.current = false;
    setIsStepping(false);
  }, []);

  const clearFinaleTimers = useCallback(() => {
    if (emblemRevealTimerRef.current !== null) {
      window.clearTimeout(emblemRevealTimerRef.current);
      emblemRevealTimerRef.current = null;
    }
    if (emblemDissolveTimerRef.current !== null) {
      window.clearTimeout(emblemDissolveTimerRef.current);
      emblemDissolveTimerRef.current = null;
    }
    if (finaleTimerRef.current !== null) {
      window.clearTimeout(finaleTimerRef.current);
      finaleTimerRef.current = null;
    }
    if (absorptionTimerRef.current !== null) {
      window.clearTimeout(absorptionTimerRef.current);
      absorptionTimerRef.current = null;
    }
  }, []);

  // Sync direct 3D star clicks / initial auto-open into displayedId (when not mid 3-beat step transition)
  useEffect(() => {
    if (isSteppingRef.current) return;
    if (viewMode !== 'constellation' || !selectedId) {
      setDisplayedId(null);
      return;
    }
    setDisplayedId(selectedId);
  }, [selectedId, viewMode]);

  // Auto-focus & auto-open Star #1 (~0.85s) upon entering Constellation View, and clean up timers on exit
  useEffect(() => {
    if (entryTimerRef.current !== null) {
      window.clearTimeout(entryTimerRef.current);
      entryTimerRef.current = null;
    }

    if (stage === 'galaxy' && viewMode === 'constellation') {
      clearStepTimers();
      clearFinaleTimers();
      setEmblemPhase('hidden');
      galaxySignals.constellationFinaleStartMs = 0;
      galaxySignals.constellationBloomSpike = 0;
      galaxySignals.heartAbsorptionGlow = 0;

      const firstMilestone = milestones[0];
      if (firstMilestone) {
        entryTimerRef.current = window.setTimeout(() => {
          entryTimerRef.current = null;
          const latest = useAppStore.getState();
          if (
            latest.stage === 'galaxy' &&
            latest.viewMode === 'constellation' &&
            !latest.constellationFinaleActive &&
            latest.selectedMilestoneId === null
          ) {
            galaxySignals.constellationStar0IgniteMs = performance.now();
            sfxEngine.playStarIgnite(0);
            latest.setSelectedMilestoneId(firstMilestone.id);
          }
        }, ENTRY_AUTO_OPEN_MS);
      }
    } else {
      clearStepTimers();
      if (finaleTimerRef.current !== null || emblemRevealTimerRef.current !== null) {
        clearFinaleTimers();
        setEmblemPhase('hidden');
        galaxySignals.constellationFinaleStartMs = 0;
        galaxySignals.constellationBloomSpike = 0;
      }
    }
  }, [stage, viewMode, milestones, clearStepTimers, clearFinaleTimers]);

  // Cancel entry auto-open if user selects a star manually before 0.85s
  useEffect(() => {
    if (selectedId && entryTimerRef.current !== null) {
      window.clearTimeout(entryTimerRef.current);
      entryTimerRef.current = null;
    }
  }, [selectedId]);

  useEffect(() => {
    return () => {
      if (entryTimerRef.current !== null) window.clearTimeout(entryTimerRef.current);
      clearStepTimers();
      clearFinaleTimers();
    };
  }, [clearStepTimers, clearFinaleTimers]);

  /**
   * Strict "Impact-Triggered Ignition" Star-to-Star Choreography:
   * 1. Immediately clear Milestone Card without incrementing maxUnlockedMilestoneIndex or lighting Star i+1.
   * 2. Launch 1.1s white-gold light-beam tracer (destination star stays strictly dormant opacity ~0.16; line draws strictly behind comet).
   * 3. On the EXACT WebGL frame beamProgress >= 1.0: ConstellationSky commits setSelectedMilestoneId / maxUnlockedIndex,
   *    extinguishes comet into Star i+1, bursts starlight flare + halo ring + bell chime, and invokes onImpact.
   * 4. Hold cleanly for +550ms post-ignition so cause-and-effect shines clearly, then reveal Milestone Card i+1.
   */
  const runStarStepTransition = useCallback(
    (fromIdx: number, targetIdx: number) => {
      if (isSteppingRef.current) return;
      const fromStar = milestones[fromIdx];
      const target = milestones[targetIdx];
      if (!fromStar || !target) return;

      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReducedMotion) {
        useAppStore.getState().setSelectedMilestoneId(target.id);
        setDisplayedId(target.id);
        return;
      }

      isSteppingRef.current = true;
      setIsStepping(true);

      // Step 1: Close current card immediately WITHOUT pre-updating selectedMilestoneId or maxUnlockedMilestoneIndex
      setDisplayedId(null);

      // Step 2 (at 320ms): Launch slow 1.1s travelling light beam (destination star stays dormant until impact!)
      beat2TimerRef.current = window.setTimeout(() => {
        beat2TimerRef.current = null;
        const latest = useAppStore.getState();
        if (latest.viewMode !== 'constellation' || latest.constellationFinaleActive) {
          clearStepTimers();
          return;
        }
        const isAdvancing = targetIdx > latest.maxUnlockedMilestoneIndex;
        const tracer = galaxySignals.beamTracer;
        tracer.fromIdx = fromIdx;
        tracer.toIdx = targetIdx;
        tracer.isAdvancing = isAdvancing;
        tracer.targetMilestoneId = target.id;
        tracer.fromPos.set(fromStar.position[0], fromStar.position[1], fromStar.position[2]);
        tracer.toPos.set(target.position[0], target.position[1], target.position[2]);
        tracer.currentHeadPos.copy(tracer.fromPos);
        tracer.durationMs = BEAM_DRAW_DURATION_MS;
        tracer.startMs = performance.now();
        tracer.cameraGlideRequested = true;
        tracer.onImpact = () => {
          // Ease BGM back to constellation browse level once the beam tracer & star ignition land
          const currentNow = useAppStore.getState();
          if (currentNow.viewMode === 'constellation' && !currentNow.constellationFinaleActive) {
            musicEngine.duckBGM(musicEngine.getCanonicalDuckMultiplier(), 0.6);
          }
          // Step 4: Exactly +550ms AFTER WebGL collision & star ignition, smoothly reveal next Milestone Card
          beat4TimerRef.current = window.setTimeout(() => {
            beat4TimerRef.current = null;
            const after = useAppStore.getState();
            isSteppingRef.current = false;
            setIsStepping(false);
            if (after.viewMode === 'constellation' && !after.constellationFinaleActive) {
              setDisplayedId(target.id);
            }
          }, POST_IGNITION_HOLD_MS);
        };
        tracer.active = true;

        musicEngine.duckBGM(0.65, 0.35);
        sfxEngine.playBeamGlideTone(targetIdx);
      }, BEAT1_CLEAR_SKY_MS);
    },
    [clearStepTimers, milestones]
  );

  const goPrev = useCallback(() => {
    if (isSteppingRef.current || !milestones.length) return;
    const liveIdx = milestones.findIndex((m) => m.id === useAppStore.getState().selectedMilestoneId);
    if (liveIdx <= 0) return;
    runStarStepTransition(liveIdx, liveIdx - 1);
  }, [milestones, runStarStepTransition]);

  const handleCompleteConstellation = useCallback(() => {
    if (
      isSteppingRef.current ||
      finaleTimerRef.current !== null ||
      useAppStore.getState().constellationFinaleActive
    ) {
      return;
    }

    // 0.00s -> 0.85s: Close Card & frame 7 Capricornus stars dead-center; 0.85s -> 1.80s: Smoother Circuit Surge
    clearStepTimers();
    setDisplayedId(null);
    setEmblemPhase('hidden');
    galaxySignals.constellationFinaleStartMs = performance.now();
    sfxEngine.playConstellationAwakeningSequence(milestones.length);
    startConstellationFinale();

    // 1.80s -> 3.95s: Materialize glowing Constellation Emblem aligned over the 7 illuminated stars (~2.15s hold)
    emblemRevealTimerRef.current = window.setTimeout(() => {
      emblemRevealTimerRef.current = null;
      const latest = useAppStore.getState();
      if (latest.viewMode === 'constellation' && latest.constellationFinaleActive) {
        setEmblemPhase('visible');
      }
    }, EMBLEM_REVEAL_MS);

    // 3.95s: Dissolve Emblem into the 7-star burst & 420-particle Starfall Cascade
    emblemDissolveTimerRef.current = window.setTimeout(() => {
      emblemDissolveTimerRef.current = null;
      setEmblemPhase('dissolving');
    }, EMBLEM_DISSOLVE_MS);

    // 4.20s: Switch viewMode back to 'galaxy' & glide camera downward following the falling starlight
    finaleTimerRef.current = window.setTimeout(() => {
      finaleTimerRef.current = null;
      setEmblemPhase('hidden');
      const latest = useAppStore.getState();
      if (latest.viewMode === 'constellation' && latest.constellationFinaleActive) {
        sfxEngine.playCelestialChime('down');
        endConstellationFinale();
      }
    }, RETURN_TO_GALAXY_MS);

    // 5.02s: Warm crystalline shimmer chime right as falling starlight pours into the 3D Particle Heart
    absorptionTimerRef.current = window.setTimeout(() => {
      absorptionTimerRef.current = null;
      if (galaxySignals.constellationFinaleStartMs > 0) {
        sfxEngine.playHeartAbsorptionShimmer();
      }
    }, HEART_ABSORPTION_CHIME_MS);
  }, [clearStepTimers, endConstellationFinale, milestones.length, startConstellationFinale]);

  const goNext = useCallback(() => {
    if (isSteppingRef.current || !milestones.length) return;
    const liveIdx = milestones.findIndex((m) => m.id === useAppStore.getState().selectedMilestoneId);
    if (liveIdx < 0) return;

    if (liveIdx >= milestones.length - 1) {
      handleCompleteConstellation();
      return;
    }
    runStarStepTransition(liveIdx, liveIdx + 1);
  }, [handleCompleteConstellation, milestones, runStarStepTransition]);

  const handleClose = useCallback(() => {
    if (isSteppingRef.current) return;
    sfxEngine.playModalClose();
    setSelectedMilestoneId(null);
  }, [setSelectedMilestoneId]);

  useEffect(() => {
    if (!current || isStepping) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [current, isStepping, goNext, goPrev, handleClose]);

  return (
    <>
      {/* Clean, ultra-light radial vignette (bg-black/25, ZERO full-screen backdrop-blur so surrounding stars stay razor-sharp) */}
      <AnimatePresence>
        {current && (
          <motion.div
            key="constellation-vignette"
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.26 }}
            className="pointer-events-none fixed inset-0 z-10"
            style={{
              background:
                'radial-gradient(ellipse at 50% 50%, rgba(0, 0, 0, 0.28) 0%, rgba(0, 0, 0, 0.14) 55%, rgba(0, 0, 0, 0.02) 100%)',
            }}
          />
        )}
      </AnimatePresence>

      {/* Spacious Centered Milestone Card (w-[92vw] max-w-[540px] dead-center, 400ms graceful reveal) */}
      <div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center px-3 py-5 sm:px-6">
        <AnimatePresence mode="wait">
          {current && (
            <motion.aside
              key={current.id}
              role="dialog"
              aria-modal="false"
              aria-label={`Kỷ niệm: ${current.title}`}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{
                opacity: 0,
                y: 8,
                scale: 0.96,
                pointerEvents: 'none',
                transition: { duration: 0.28, ease: [0.4, 0, 1, 1] },
              }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              style={{ willChange: 'transform, opacity' }}
              className="pointer-events-auto glass-modal w-[92vw] max-w-[540px] rounded-[28px] p-5 sm:p-7"
            >
              {/* Header Row: Date Badge + Step Counter + Close */}
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-pink-300/35 bg-pink-500/14 px-3.5 py-1.5 text-xs text-starlight">
                  <Calendar className="h-3.5 w-3.5 text-pink-300" strokeWidth={1.75} aria-hidden="true" />
                  <span className="font-mono tabular-nums">{current.date}</span>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs text-lavender-muted tabular-nums">
                    {String(currentIndex + 1).padStart(2, '0')} / {String(milestones.length).padStart(2, '0')}
                  </span>
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isStepping}
                    title="Quay lại ngân hà"
                    aria-label="Quay lại ngân hà"
                    className="glass-interactive flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-lavender hover:text-starlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-pink/75 disabled:opacity-40"
                  >
                    <X className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* Generous 16:10 Photo Showcase with subtle rose-violet luminous inner border */}
              <div className="mt-4 aspect-[16/10] w-full overflow-hidden rounded-2xl border border-pink-300/25 bg-void/75 shadow-[inset_0_0_24px_rgba(255,95,180,0.14),0_10px_30px_rgba(5,2,12,0.5)]">
                <img
                  src={current.image}
                  alt={current.title}
                  className="h-full w-full object-cover"
                />
              </div>

              {/* Balanced Typography */}
              <h2 className="mt-5 font-display text-2xl leading-snug font-semibold text-starlight sm:text-[28px]">
                {current.title}
              </h2>
              <p className="mt-2.5 font-sans text-sm leading-relaxed text-lavender sm:text-[15px]">
                {current.caption}
              </p>

              {/* Symmetrical Prev / Next or Finale Return Controls (locked cleanly during 3-beat transition) */}
              <div className="mt-6 flex items-center justify-between gap-2.5 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={isFirst || isStepping}
                  aria-label="Xem kỷ niệm trước"
                  className="glass-interactive inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-full border border-white/15 bg-white/[0.04] px-3.5 text-xs leading-normal font-medium whitespace-nowrap text-lavender hover:text-starlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-pink/75 disabled:cursor-not-allowed disabled:opacity-40 sm:gap-1.5 sm:px-4.5 sm:text-sm"
                >
                  <ChevronLeft className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                  <span>Kỷ niệm trước</span>
                </button>

                {isLast ? (
                  <button
                    type="button"
                    onClick={handleCompleteConstellation}
                    disabled={isStepping}
                    aria-label="Thắp sáng trọn vẹn chòm sao và về ngân hà"
                    className="glass-interactive inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-pink-300/60 bg-gradient-to-r from-neon-pink/30 via-neon-magenta/26 to-neon-violet/30 px-4 text-xs leading-normal font-semibold whitespace-nowrap text-starlight shadow-[0_0_22px_rgba(255,62,165,0.32)] hover:border-pink-200/85 hover:shadow-[0_0_28px_rgba(255,62,165,0.46)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-pink/80 disabled:cursor-not-allowed disabled:opacity-40 sm:gap-2 sm:px-5 sm:text-sm"
                  >
                    <span>Thắp sáng trọn vẹn</span>
                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-pink-200 sm:h-4 sm:w-4" strokeWidth={1.75} aria-hidden="true" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={isStepping}
                    aria-label="Thắp sáng ngôi sao tiếp theo"
                    className="glass-interactive inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-full border border-pink-300/45 bg-pink-500/16 px-4 text-xs leading-normal font-medium whitespace-nowrap text-starlight hover:border-pink-200/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-pink/75 disabled:cursor-not-allowed disabled:opacity-40 sm:gap-1.5 sm:px-5 sm:text-sm"
                  >
                    <span>Sao tiếp theo</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-pink-300" strokeWidth={1.75} aria-hidden="true" />
                  </button>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* Phase 3 Glowing Constellation Emblem / Logo Materialization Overlay */}
      <ConstellationEmblemOverlay phase={emblemPhase} />
    </>
  );
}
