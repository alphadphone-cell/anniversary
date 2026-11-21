import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-react';
import { ANNIVERSARY_DATA } from '../../data/anniversaryData';
import { galaxySignals } from '../../canvas/galaxySignals';
import {
  useAppStore,
  useMaxUnlockedMilestoneIndex,
  useSelectedMilestoneId,
  useStage,
  useViewMode,
} from '../../store/useAppStore';
import { sfxEngine } from '../../utils/sfxEngine';

const ENTRY_AUTO_OPEN_MS = 800;
const CARD_IGNITION_BEAT_MS = 350; // Brief star-ignition beat before centered card content swaps
const EMBLEM_REVEAL_MS = 1500; // Phase 3: Logo materializes right as 0.8s->1.5s circuit surge finishes
const EMBLEM_DISSOLVE_MS = 3300; // Phase 4: Logo dissolves into 7-star burst & 420-particle Starfall
const RETURN_TO_GALAXY_MS = 3550; // Camera glides down following falling starlight back into Love Galaxy
const HEART_ABSORPTION_CHIME_MS = 4380; // Warm shimmer chime as falling starlight pours into the 3D Heart

type EmblemPhase = 'hidden' | 'visible' | 'dissolving';

/**
 * GPU-accelerated Celestial Constellation Emblem / Logo Reveal overlay (`1.5s -> 3.3s`).
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
            initial={{ opacity: 0, scale: 0.86 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.16, filter: 'blur(6px)' }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            style={{ willChange: 'transform, opacity' }}
            className="flex flex-col items-center"
          >
            {/* Glowing SVG Emblem + Counter-Rotating Celestial Rings */}
            <div className="relative flex h-44 w-44 items-center justify-center sm:h-52 sm:w-52">
              {/* Outer slow-rotating celestial astrolabe ring */}
              <motion.svg
                viewBox="0 0 200 200"
                aria-hidden="true"
                initial={{ opacity: 0, rotate: -18, scale: 0.9 }}
                animate={{ opacity: 0.72, rotate: 24, scale: 1 }}
                transition={{ duration: 2.2, ease: 'easeOut' }}
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

              {/* Inner counter-rotating compass halo */}
              <motion.svg
                viewBox="0 0 200 200"
                aria-hidden="true"
                initial={{ opacity: 0, rotate: 22 }}
                animate={{ opacity: 0.56, rotate: -18 }}
                transition={{ duration: 2.2, ease: 'easeOut' }}
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

              {/* Soft ambient radial rose-gold aura behind emblem */}
              <div
                aria-hidden="true"
                className="absolute inset-6 rounded-full opacity-75"
                style={{
                  background:
                    'radial-gradient(circle, rgba(255,118,198,0.28) 0%, rgba(253,224,71,0.16) 45%, rgba(10,4,20,0) 74%)',
                }}
              />

              {/* Main Customizable Constellation Line-Art SVG (stroke pathLength 0 -> 1) */}
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
                  transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
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
                    transition={{ duration: 0.4, delay: 0.22 + idx * 0.08, ease: 'easeOut' }}
                  />
                ))}
              </svg>
            </div>

            {/* Constellation Name (Playfair Display) + Poetic Subtitle (Be Vietnam Pro) */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="mt-2 rounded-2xl border border-amber-200/25 bg-void/45 px-5 py-2.5 backdrop-blur-md"
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
              <p className="mt-1 font-sans text-xs tracking-[0.14em] text-amber-100/90 uppercase sm:text-sm">
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
  const maxUnlockedIndex = useMaxUnlockedMilestoneIndex();
  const setSelectedMilestoneId = useAppStore((s) => s.setSelectedMilestoneId);
  const startConstellationFinale = useAppStore((s) => s.startConstellationFinale);
  const endConstellationFinale = useAppStore((s) => s.endConstellationFinale);

  const [displayedId, setDisplayedId] = useState<string | null>(null);
  const [emblemPhase, setEmblemPhase] = useState<EmblemPhase>('hidden');

  const entryTimerRef = useRef<number | null>(null);
  const cardSwapTimerRef = useRef<number | null>(null);
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

  // Synchronize displayedId with selectedId using a crisp ~0.35s star-ignition beat when stepping between stars
  useEffect(() => {
    if (cardSwapTimerRef.current !== null) {
      window.clearTimeout(cardSwapTimerRef.current);
      cardSwapTimerRef.current = null;
    }

    if (viewMode !== 'constellation' || !selectedId) {
      setDisplayedId(null);
      return;
    }

    if (displayedId === null) {
      // Initial open (entry auto-open or first star tap): appear immediately
      setDisplayedId(selectedId);
      return;
    }

    if (displayedId !== selectedId) {
      // Hold ~0.35s so user clearly sees the newly ignited star flare in the upper third before card swaps
      cardSwapTimerRef.current = window.setTimeout(() => {
        cardSwapTimerRef.current = null;
        setDisplayedId(selectedId);
      }, CARD_IGNITION_BEAT_MS);
    }
  }, [selectedId, displayedId, viewMode]);

  // Auto-focus & auto-open Star #1 (~0.8s) upon entering Constellation View, and clean up timers on exit
  useEffect(() => {
    if (entryTimerRef.current !== null) {
      window.clearTimeout(entryTimerRef.current);
      entryTimerRef.current = null;
    }

    if (stage === 'galaxy' && viewMode === 'constellation') {
      // Fresh entry into Constellation View: clear any previous finale/cascade state
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
    } else if (finaleTimerRef.current !== null || emblemRevealTimerRef.current !== null) {
      // User manually toggled back to Galaxy before automatic return — cancel pending finale cleanly
      clearFinaleTimers();
      setEmblemPhase('hidden');
      galaxySignals.constellationFinaleStartMs = 0;
      galaxySignals.constellationBloomSpike = 0;
    }
  }, [stage, viewMode, milestones, clearFinaleTimers]);

  // Cancel entry auto-open if user selects a star manually before 0.8s
  useEffect(() => {
    if (selectedId && entryTimerRef.current !== null) {
      window.clearTimeout(entryTimerRef.current);
      entryTimerRef.current = null;
    }
  }, [selectedId]);

  useEffect(() => {
    return () => {
      if (entryTimerRef.current !== null) window.clearTimeout(entryTimerRef.current);
      if (cardSwapTimerRef.current !== null) window.clearTimeout(cardSwapTimerRef.current);
      clearFinaleTimers();
    };
  }, [clearFinaleTimers]);

  const goPrev = useCallback(() => {
    if (!milestones.length) return;
    const liveIdx = milestones.findIndex((m) => m.id === useAppStore.getState().selectedMilestoneId);
    if (liveIdx <= 0) return;
    sfxEngine.playStarSelect();
    setSelectedMilestoneId(milestones[liveIdx - 1].id);
  }, [milestones, setSelectedMilestoneId]);

  const handleCompleteConstellation = useCallback(() => {
    if (finaleTimerRef.current !== null || useAppStore.getState().constellationFinaleActive) return;

    // 0.0s -> 0.8s: Close Milestone Card & pull camera back dead-center; 0.8s -> 1.5s: Circuit Surge
    setDisplayedId(null);
    setEmblemPhase('hidden');
    galaxySignals.constellationFinaleStartMs = performance.now();
    sfxEngine.playConstellationAwakeningSequence(milestones.length);
    startConstellationFinale();

    // 1.5s -> 3.3s: Materialize glowing Constellation Emblem aligned over the 7 illuminated stars
    emblemRevealTimerRef.current = window.setTimeout(() => {
      emblemRevealTimerRef.current = null;
      const latest = useAppStore.getState();
      if (latest.viewMode === 'constellation' && latest.constellationFinaleActive) {
        setEmblemPhase('visible');
      }
    }, EMBLEM_REVEAL_MS);

    // 3.3s: Dissolve Emblem into the 7-star burst & 420-particle Starfall Cascade
    emblemDissolveTimerRef.current = window.setTimeout(() => {
      emblemDissolveTimerRef.current = null;
      setEmblemPhase('dissolving');
    }, EMBLEM_DISSOLVE_MS);

    // 3.55s: Switch viewMode back to 'galaxy' & glide camera downward following the falling starlight
    finaleTimerRef.current = window.setTimeout(() => {
      finaleTimerRef.current = null;
      setEmblemPhase('hidden');
      const latest = useAppStore.getState();
      if (latest.viewMode === 'constellation' && latest.constellationFinaleActive) {
        sfxEngine.playCelestialChime('down');
        endConstellationFinale();
      }
    }, RETURN_TO_GALAXY_MS);

    // 4.38s: Warm crystalline shimmer chime right as falling starlight pours into the 3D Particle Heart
    absorptionTimerRef.current = window.setTimeout(() => {
      absorptionTimerRef.current = null;
      if (galaxySignals.constellationFinaleStartMs > 0) {
        sfxEngine.playHeartAbsorptionShimmer();
      }
    }, HEART_ABSORPTION_CHIME_MS);
  }, [endConstellationFinale, milestones.length, startConstellationFinale]);

  const goNext = useCallback(() => {
    if (!milestones.length) return;
    const liveIdx = milestones.findIndex((m) => m.id === useAppStore.getState().selectedMilestoneId);
    if (liveIdx < 0) return;

    if (liveIdx >= milestones.length - 1) {
      handleCompleteConstellation();
      return;
    }

    const nextIdx = liveIdx + 1;
    if (nextIdx > maxUnlockedIndex) {
      sfxEngine.playStarIgnite(nextIdx);
    } else {
      sfxEngine.playStarSelect();
    }
    setSelectedMilestoneId(milestones[nextIdx].id);
  }, [handleCompleteConstellation, maxUnlockedIndex, milestones, setSelectedMilestoneId]);

  const handleClose = useCallback(() => {
    sfxEngine.playModalClose();
    setSelectedMilestoneId(null);
  }, [setSelectedMilestoneId]);

  useEffect(() => {
    if (!current) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [current, goNext, goPrev, handleClose]);

  return (
    <>
      {/* Subtle translucent radial vignette behind the centered card (keeps active star in upper third visible) */}
      <AnimatePresence>
        {current && (
          <motion.div
            key="constellation-vignette"
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-none fixed inset-0 z-10"
            style={{
              background:
                'radial-gradient(ellipse at 50% 58%, rgba(7, 3, 16, 0.54) 0%, rgba(5, 2, 12, 0.22) 55%, rgba(5, 2, 12, 0.04) 100%)',
            }}
          />
        )}
      </AnimatePresence>

      {/* Centered Milestone Card (positioned symmetrically with breathing room above for the active ignited star) */}
      <div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center px-4 py-6 sm:px-6">
        <AnimatePresence mode="wait">
          {current && (
            <motion.aside
              key={current.id}
              role="dialog"
              aria-modal="false"
              aria-label={`Kỷ niệm: ${current.title}`}
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.96, pointerEvents: 'none' }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto glass-modal mt-16 w-full max-w-md rounded-[26px] p-5 sm:mt-20 sm:p-6"
            >
              {/* Header Row: Date Badge + Step Counter + Close */}
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-neon-pink/30 bg-neon-pink/12 px-3 py-1 text-xs text-starlight">
                  <Calendar className="h-3.5 w-3.5 text-neon-pink" strokeWidth={1.75} aria-hidden="true" />
                  <span className="font-mono tabular-nums">{current.date}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-lavender-muted tabular-nums">
                    {String(currentIndex + 1).padStart(2, '0')} / {String(milestones.length).padStart(2, '0')}
                  </span>
                  <button
                    type="button"
                    onClick={handleClose}
                    aria-label="Đóng thẻ kỷ niệm"
                    className="glass-interactive flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-lavender hover:text-starlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-pink/70"
                  >
                    <X className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* Framed Milestone Thumbnail */}
              <div className="mt-3.5 aspect-[16/9] w-full overflow-hidden rounded-2xl border border-white/12 bg-void/80">
                <img
                  src={current.image}
                  alt={current.title}
                  className="h-full w-full object-cover"
                />
              </div>

              {/* Milestone Copy */}
              <h2 className="mt-4 font-display text-2xl leading-snug font-semibold text-starlight">
                {current.title}
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-lavender sm:text-sm">
                {current.caption}
              </p>

              {/* Symmetrical Prev / Next or Finale Return Controls */}
              <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-3.5">
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={isFirst}
                  aria-label="Kỷ niệm trước"
                  className="glass-interactive inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-4 text-xs leading-normal font-medium text-lavender hover:text-starlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-pink/70 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  <span>Trước</span>
                </button>

                {isLast ? (
                  <button
                    type="button"
                    onClick={handleCompleteConstellation}
                    aria-label="Hoàn thành hành trình chòm sao và về Ngân Hà"
                    className="glass-interactive inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-neon-pink/60 bg-gradient-to-r from-neon-pink/28 via-neon-magenta/24 to-neon-violet/28 px-4.5 text-xs leading-normal font-semibold text-starlight shadow-[0_0_20px_rgba(255,62,165,0.28)] hover:border-neon-pink/85 hover:shadow-[0_0_26px_rgba(255,62,165,0.42)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-pink/80"
                  >
                    <span>Về Ngân Hà</span>
                    <Sparkles className="h-4 w-4 text-neon-pink" strokeWidth={1.75} aria-hidden="true" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={goNext}
                    aria-label="Kỷ niệm tiếp theo"
                    className="glass-interactive inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-neon-pink/35 bg-neon-pink/12 px-4 text-xs leading-normal font-medium text-starlight hover:border-neon-pink/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-pink/70"
                  >
                    <span>Tiếp theo</span>
                    <ChevronRight className="h-4 w-4 text-neon-pink" strokeWidth={1.75} aria-hidden="true" />
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
