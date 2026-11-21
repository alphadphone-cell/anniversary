import { useCallback, useEffect, useRef } from 'react';
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
const STARFALL_DESCENT_MS = 1600; // Phase 1 (0->0.9s surge) + Phase 2 (0.9->1.6s simultaneous burst) -> descend!
const HEART_ABSORPTION_CHIME_MS = 2280; // Chime right as falling starlight pours into the 3D Particle Heart

export function ConstellationCard() {
  const stage = useStage();
  const viewMode = useViewMode();
  const selectedId = useSelectedMilestoneId();
  const maxUnlockedIndex = useMaxUnlockedMilestoneIndex();
  const setSelectedMilestoneId = useAppStore((s) => s.setSelectedMilestoneId);
  const startConstellationFinale = useAppStore((s) => s.startConstellationFinale);
  const endConstellationFinale = useAppStore((s) => s.endConstellationFinale);

  const entryTimerRef = useRef<number | null>(null);
  const finaleTimerRef = useRef<number | null>(null);
  const absorptionTimerRef = useRef<number | null>(null);

  const milestones = ANNIVERSARY_DATA.constellationMilestones;
  const currentIndex = milestones.findIndex((m) => m.id === selectedId);
  const current = viewMode === 'constellation' && currentIndex >= 0 ? milestones[currentIndex] : null;
  const isFirst = currentIndex <= 0;
  const isLast = currentIndex === milestones.length - 1;

  // Auto-focus & auto-open Star #1 (~0.8s) upon entering Constellation View, and clean up timers on exit
  useEffect(() => {
    if (entryTimerRef.current !== null) {
      window.clearTimeout(entryTimerRef.current);
      entryTimerRef.current = null;
    }

    if (stage === 'galaxy' && viewMode === 'constellation') {
      // Fresh entry into Constellation View: clear any previous finale/cascade state
      galaxySignals.constellationFinaleStartMs = 0;
      galaxySignals.constellationBloomSpike = 0;
      galaxySignals.heartAbsorptionGlow = 0;
      if (absorptionTimerRef.current !== null) {
        window.clearTimeout(absorptionTimerRef.current);
        absorptionTimerRef.current = null;
      }

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
    } else if (finaleTimerRef.current !== null) {
      // User manually toggled back to Galaxy before 1.6s descent — cancel pending finale switch cleanly
      window.clearTimeout(finaleTimerRef.current);
      finaleTimerRef.current = null;
      galaxySignals.constellationFinaleStartMs = 0;
      galaxySignals.constellationBloomSpike = 0;
      if (absorptionTimerRef.current !== null) {
        window.clearTimeout(absorptionTimerRef.current);
        absorptionTimerRef.current = null;
      }
    }
  }, [stage, viewMode, milestones]);

  // Cancel entry auto-open if user selects a star manually before 0.8s
  useEffect(() => {
    if (selectedId && entryTimerRef.current !== null) {
      window.clearTimeout(entryTimerRef.current);
      entryTimerRef.current = null;
    }
  }, [selectedId]);

  useEffect(() => {
    return () => {
      if (entryTimerRef.current !== null) {
        window.clearTimeout(entryTimerRef.current);
        entryTimerRef.current = null;
      }
      if (finaleTimerRef.current !== null) {
        window.clearTimeout(finaleTimerRef.current);
        finaleTimerRef.current = null;
      }
      if (absorptionTimerRef.current !== null) {
        window.clearTimeout(absorptionTimerRef.current);
        absorptionTimerRef.current = null;
      }
    };
  }, []);

  const goPrev = useCallback(() => {
    if (!milestones.length || currentIndex <= 0) return;
    sfxEngine.playStarSelect();
    setSelectedMilestoneId(milestones[currentIndex - 1].id);
  }, [currentIndex, milestones, setSelectedMilestoneId]);

  const handleCompleteConstellation = useCallback(() => {
    if (finaleTimerRef.current !== null || useAppStore.getState().constellationFinaleActive) return;

    // 0.0s -> 1.6s: Close Milestone Card, pull camera back, fire blazing line surge + simultaneous burst & starfall
    galaxySignals.constellationFinaleStartMs = performance.now();
    sfxEngine.playConstellationAwakeningSequence(milestones.length);
    startConstellationFinale();

    // 1.6s: Switch back to Galaxy View & glide camera smoothly downward following the falling starlight
    finaleTimerRef.current = window.setTimeout(() => {
      finaleTimerRef.current = null;
      const latest = useAppStore.getState();
      if (latest.viewMode === 'constellation' && latest.constellationFinaleActive) {
        sfxEngine.playCelestialChime('down');
        endConstellationFinale();
      }
    }, STARFALL_DESCENT_MS);

    // ~2.28s: Warm crystalline chime as the falling starlight streams merge into the 3D Particle Heart
    if (absorptionTimerRef.current !== null) {
      window.clearTimeout(absorptionTimerRef.current);
    }
    absorptionTimerRef.current = window.setTimeout(() => {
      absorptionTimerRef.current = null;
      if (galaxySignals.constellationFinaleStartMs > 0) {
        sfxEngine.playHeartAbsorptionShimmer();
      }
    }, HEART_ABSORPTION_CHIME_MS);
  }, [endConstellationFinale, milestones.length, startConstellationFinale]);

  const goNext = useCallback(() => {
    if (!milestones.length || currentIndex < 0) return;
    if (currentIndex >= milestones.length - 1) {
      handleCompleteConstellation();
      return;
    }

    const nextIdx = currentIndex + 1;
    if (nextIdx > maxUnlockedIndex) {
      sfxEngine.playStarIgnite(nextIdx);
    } else {
      sfxEngine.playStarSelect();
    }
    setSelectedMilestoneId(milestones[nextIdx].id);
  }, [currentIndex, handleCompleteConstellation, maxUnlockedIndex, milestones, setSelectedMilestoneId]);

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
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-20 flex justify-center sm:inset-x-auto sm:right-6 sm:bottom-6 sm:justify-end">
      <AnimatePresence mode="wait">
        {current && (
          <motion.aside
            key={current.id}
            role="dialog"
            aria-modal="false"
            aria-label={`Kỷ niệm: ${current.title}`}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96, pointerEvents: 'none' }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto glass-modal w-full max-w-[356px] rounded-[24px] p-4 sm:p-5"
          >
            {/* Header Row: Date Badge + Step Counter + Close */}
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-neon-pink/30 bg-neon-pink/12 px-2.5 py-1 text-xs text-starlight">
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
            <div className="mt-3 aspect-[16/9] w-full overflow-hidden rounded-xl border border-white/12 bg-void/80">
              <img
                src={current.image}
                alt={current.title}
                className="h-full w-full object-cover"
              />
            </div>

            {/* Milestone Copy */}
            <h2 className="mt-3.5 font-display text-2xl leading-snug font-semibold text-starlight">
              {current.title}
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-lavender sm:text-sm">
              {current.caption}
            </p>

            {/* Chronological Prev / Next or Finale Return Controls */}
            <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/10 pt-3">
              <button
                type="button"
                onClick={goPrev}
                disabled={isFirst}
                aria-label="Kỷ niệm trước"
                className="glass-interactive inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3.5 text-xs leading-normal font-medium text-lavender hover:text-starlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-pink/70 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                <span>Trước</span>
              </button>

              {isLast ? (
                <button
                  type="button"
                  onClick={handleCompleteConstellation}
                  aria-label="Hoàn thành hành trình chòm sao và về Ngân Hà"
                  className="glass-interactive inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-neon-pink/60 bg-gradient-to-r from-neon-pink/28 via-neon-magenta/24 to-neon-violet/28 px-4 text-xs leading-normal font-semibold text-starlight shadow-[0_0_20px_rgba(255,62,165,0.28)] hover:border-neon-pink/85 hover:shadow-[0_0_26px_rgba(255,62,165,0.42)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-pink/80"
                >
                  <span>Về Ngân Hà</span>
                  <Sparkles className="h-4 w-4 text-neon-pink" strokeWidth={1.75} aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={goNext}
                  aria-label="Kỷ niệm tiếp theo"
                  className="glass-interactive inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-neon-pink/35 bg-neon-pink/12 px-3.5 text-xs leading-normal font-medium text-starlight hover:border-neon-pink/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-pink/70"
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
  );
}
