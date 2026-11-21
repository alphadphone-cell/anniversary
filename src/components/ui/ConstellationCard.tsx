import { useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-react';
import { ANNIVERSARY_DATA } from '../../data/anniversaryData';
import {
  useAppStore,
  useMaxUnlockedMilestoneIndex,
  useSelectedMilestoneId,
  useViewMode,
} from '../../store/useAppStore';
import { sfxEngine } from '../../utils/sfxEngine';

const FINALE_SHOWCASE_MS = 1200;

export function ConstellationCard() {
  const viewMode = useViewMode();
  const selectedId = useSelectedMilestoneId();
  const maxUnlockedIndex = useMaxUnlockedMilestoneIndex();
  const setSelectedMilestoneId = useAppStore((s) => s.setSelectedMilestoneId);
  const startConstellationFinale = useAppStore((s) => s.startConstellationFinale);
  const endConstellationFinale = useAppStore((s) => s.endConstellationFinale);

  const finaleTimerRef = useRef<number | null>(null);

  const milestones = ANNIVERSARY_DATA.constellationMilestones;
  const currentIndex = milestones.findIndex((m) => m.id === selectedId);
  const current = viewMode === 'constellation' && currentIndex >= 0 ? milestones[currentIndex] : null;
  const isFirst = currentIndex <= 0;
  const isLast = currentIndex === milestones.length - 1;

  // Cancel any pending finale return timer if user manually switches back to Galaxy View or unmounts
  useEffect(() => {
    if (viewMode !== 'constellation' && finaleTimerRef.current !== null) {
      window.clearTimeout(finaleTimerRef.current);
      finaleTimerRef.current = null;
    }
  }, [viewMode]);

  useEffect(() => {
    return () => {
      if (finaleTimerRef.current !== null) {
        window.clearTimeout(finaleTimerRef.current);
        finaleTimerRef.current = null;
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

    // Step 1: Close Milestone Card & hold ~1.2s full-constellation showcase with warm harmonic chord
    sfxEngine.playConstellationFinaleChord();
    startConstellationFinale();

    // Step 2: Automatically glide smoothly back down to the 3D Love Galaxy
    finaleTimerRef.current = window.setTimeout(() => {
      finaleTimerRef.current = null;
      const latest = useAppStore.getState();
      if (latest.viewMode === 'constellation' && latest.constellationFinaleActive) {
        sfxEngine.playCelestialChime('down');
        endConstellationFinale();
      }
    }, FINALE_SHOWCASE_MS);
  }, [endConstellationFinale, startConstellationFinale]);

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
