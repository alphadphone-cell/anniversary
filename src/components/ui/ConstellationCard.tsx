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
import { sfxEngine } from '../../utils/sfxEngine';

const ENTRY_AUTO_OPEN_MS = 850;
// Unobstructed 3-Beat Star-to-Star Transition Choreography (~1.45s before Beat 3 card reveal):
const BEAT1_CLEAR_SKY_MS = 280; // Beat 1: fade & scale out current card completely so sky is 100% clear
const BEAT3_REVEAL_CARD_MS = 1450; // Beat 2 ends (~0.6s line + star flare + ~0.45s admiration hold) -> Beat 3 card reveal!

// Balanced ~5.2s Constellation Emblem Finale Timeline:
const EMBLEM_REVEAL_MS = 1800; // Phase 3: Logo materializes right as 0.85s->1.80s circuit surge finishes
const EMBLEM_DISSOLVE_MS = 3950; // Phase 4: ~2.15s admiration hold -> dissolves into 7-star burst & Starfall
const RETURN_TO_GALAXY_MS = 4200; // Camera glides down following falling starlight back into Love Galaxy
const HEART_ABSORPTION_CHIME_MS = 5020; // Warm shimmer chime as falling starlight pours into the 3D Heart

type EmblemPhase = 'hidden' | 'visible' | 'dissolving';

/**
 * GPU-accelerated Celestial Constellation Emblem / Logo Reveal overlay (`1.80s -> 3.95s`).
 * Draws the customizable `constellationEmblem.svgPath` with rose-gold/white neon glow, rotating
 * celestial astrolabe rings, twinkling vertex stars, and Playfair Display / Be Vietnam Pro typography.
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
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.14 }}
            transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
            style={{ willChange: 'transform, opacity' }}
            className="flex flex-col items-center"
          >
            {/* Glowing SVG Emblem + Counter-Rotating Celestial Rings */}
            <div className="relative flex h-44 w-44 items-center justify-center sm:h-52 sm:w-52">
              <motion.svg
                viewBox="0 0 200 200"
                aria-hidden="true"
                initial={{ opacity: 0, rotate: -18, scale: 0.9 }}
                animate={{ opacity: 0.72, rotate: 28, scale: 1 }}
                transition={{ duration: 2.6, ease: 'easeOut' }}
                style={{ willChange: 'transform, opacity' }}
                className="absolute inset-0 h-full w-full"
              >
                <circle
                  cx="100"
                  cy="100"
                  r="92"
                  fill="none"
                  stroke="rgba(253, 224, 71, 0.34)"
                  strokeWidth="0.9"
                  strokeDasharray="4 6"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="80"
                  fill="none"
                  stroke="rgba(255, 118, 198, 0.32)"
                  strokeWidth="0.75"
                />
              </motion.svg>

              <motion.svg
                viewBox="0 0 200 200"
                aria-hidden="true"
                initial={{ opacity: 0, rotate: 22 }}
                animate={{ opacity: 0.56, rotate: -22 }}
                transition={{ duration: 2.6, ease: 'easeOut' }}
                style={{ willChange: 'transform, opacity' }}
                className="absolute inset-0 h-full w-full"
              >
                <circle
                  cx="100"
                  cy="100"
                  r="66"
                  fill="none"
                  stroke="rgba(255, 240, 250, 0.24)"
                  strokeWidth="0.75"
                  strokeDasharray="2 9"
                />
              </motion.svg>

              <div
                aria-hidden="true"
                className="absolute inset-6 rounded-full opacity-75"
                style={{
                  background:
                    'radial-gradient(circle, rgba(255,118,198,0.28) 0%, rgba(253,224,71,0.16) 45%, rgba(10,4,20,0) 74%)',
                }}
              />

              <svg
                viewBox="0 0 160 160"
                aria-hidden="true"
                className="relative h-36 w-36 sm:h-40 sm:w-40"
                style={{
                  filter:
                    'drop-shadow(0 0 10px rgba(255, 244, 252, 0.95)) drop-shadow(0 0 22px rgba(255, 92, 184, 0.85)) drop-shadow(0 0 36px rgba(253, 224, 71, 0.55))',
                }}
              >
                <defs>
                  <linearGradient id="constellation-emblem-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fff9fe" />
                    <stop offset="50%" stopColor="#fde68a" />
                    <stop offset="100%" stopColor="#ff7ac8" />
                  </linearGradient>
                </defs>

                <motion.path
                  d={emblem.svgPath}
                  fill="none"
                  stroke="url(#constellation-emblem-grad)"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0, opacity: 0.25 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.78, ease: [0.22, 1, 0.36, 1] }}
                />

                {emblem.starDots?.map(([cx, cy], idx) => (
                  <motion.circle
                    key={`${cx}-${cy}`}
                    cx={cx}
                    cy={cy}
                    r="3.2"
                    fill="#fffaf0"
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: [0, 1, 0.85], scale: [0, 1.35, 1] }}
                    transition={{ duration: 0.42, delay: 0.24 + idx * 0.08, ease: 'easeOut' }}
                  />
                ))}
              </svg>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.58, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="mt-2 rounded-2xl border border-pink-300/25 bg-void/45 px-5 py-2.5 backdrop-blur-md"
            >
              <h2
                className="font-display text-2xl leading-snug font-semibold tracking-wide text-starlight sm:text-3xl"
                style={{
                  textShadow:
                    '0 0 18px rgba(255, 118, 198, 0.65), 0 0 32px rgba(253, 224, 71, 0.35)',
                }}
              >
                {emblem.name}
              </h2>
              <p className="mt-1 font-sans text-xs tracking-[0.14em] text-pink-100/90 uppercase sm:text-sm">
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
   * Unhurried 3-Beat Star-to-Star Choreography (~1.45s before Beat 3 card reveal):
   * - Beat 1 (0.0s -> 0.28s): Clear the sky completely (card & vignette fade out)
   * - Beat 2 (0.28s -> 1.45s): Glide camera smoothly + draw 0.6s line + flare next star + ~0.45s admiration hold
   * - Beat 3 (1.45s -> 1.85s): Gracefully reveal centered Milestone Card (400ms ease-out)
   */
  const runStarStepTransition = useCallback(
    (targetIdx: number) => {
      if (isSteppingRef.current) return;
      const target = milestones[targetIdx];
      if (!target) return;

      isSteppingRef.current = true;
      setIsStepping(true);

      // Beat 1: Fade out current card & vignette completely so the 3D night sky is 100% clear
      setDisplayedId(null);

      // Beat 2 (at 280ms): Glide camera, draw connecting line (~0.6s), ignite star + celestial chime
      beat2TimerRef.current = window.setTimeout(() => {
        beat2TimerRef.current = null;
        const latest = useAppStore.getState();
        if (latest.viewMode !== 'constellation' || latest.constellationFinaleActive) {
          clearStepTimers();
          return;
        }
        if (targetIdx > latest.maxUnlockedMilestoneIndex) {
          sfxEngine.playStarIgnite(targetIdx);
        } else {
          sfxEngine.playStarSelect();
        }
        latest.setSelectedMilestoneId(target.id);
      }, BEAT1_CLEAR_SKY_MS);

      // Beat 3 (at 1450ms): Gracefully reveal next centered Milestone Card
      beat3TimerRef.current = window.setTimeout(() => {
        beat3TimerRef.current = null;
        const latest = useAppStore.getState();
        isSteppingRef.current = false;
        setIsStepping(false);
        if (latest.viewMode === 'constellation' && !latest.constellationFinaleActive) {
          setDisplayedId(target.id);
        }
      }, BEAT3_REVEAL_CARD_MS);
    },
    [clearStepTimers, milestones]
  );

  const goPrev = useCallback(() => {
    if (isSteppingRef.current || !milestones.length) return;
    const liveIdx = milestones.findIndex((m) => m.id === useAppStore.getState().selectedMilestoneId);
    if (liveIdx <= 0) return;
    runStarStepTransition(liveIdx - 1);
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
    runStarStepTransition(liveIdx + 1);
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
              exit={{ opacity: 0, y: 8, scale: 0.96, pointerEvents: 'none' }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
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
                    aria-label="Đóng thẻ kỷ niệm"
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
              <div className="mt-6 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={isFirst || isStepping}
                  aria-label="Kỷ niệm trước"
                  className="glass-interactive inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-4.5 text-xs leading-normal font-medium text-lavender hover:text-starlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-pink/75 disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm"
                >
                  <ChevronLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  <span>Trước</span>
                </button>

                {isLast ? (
                  <button
                    type="button"
                    onClick={handleCompleteConstellation}
                    disabled={isStepping}
                    aria-label="Hoàn thành hành trình chòm sao và về Ngân Hà"
                    className="glass-interactive inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-pink-300/60 bg-gradient-to-r from-neon-pink/30 via-neon-magenta/26 to-neon-violet/30 px-5 text-xs leading-normal font-semibold text-starlight shadow-[0_0_22px_rgba(255,62,165,0.32)] hover:border-pink-200/85 hover:shadow-[0_0_28px_rgba(255,62,165,0.46)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-pink/80 disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm"
                  >
                    <span>Về Ngân Hà</span>
                    <Sparkles className="h-4 w-4 text-pink-200" strokeWidth={1.75} aria-hidden="true" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={isStepping}
                    aria-label="Kỷ niệm tiếp theo"
                    className="glass-interactive inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-pink-300/45 bg-pink-500/16 px-5 text-xs leading-normal font-medium text-starlight hover:border-pink-200/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-pink/75 disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm"
                  >
                    <span>Tiếp theo</span>
                    <ChevronRight className="h-4 w-4 text-pink-300" strokeWidth={1.75} aria-hidden="true" />
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
