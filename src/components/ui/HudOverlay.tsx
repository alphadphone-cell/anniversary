import { useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Orbit, Sparkles } from 'lucide-react';
import {
  useAppStore,
  useIsTransitionFlashing,
  useStage,
  useViewMode,
  type ViewMode,
} from '../../store/useAppStore';
import { ANNIVERSARY_DATA } from '../../data/anniversaryData';
import { installAlwaysOnAmbientAudio } from '../../audio/audioEngine';
import { sfxEngine } from '../../utils/sfxEngine';
import { IntroStage } from './IntroStage';
import { ModalShell } from './ModalShell';
import { ConstellationCard } from './ConstellationCard';

/** Isolated flash overlay so flashing never re-renders the main HUD or WebGL canvas. */
function WarpFlashOverlay() {
  const isFlashing = useIsTransitionFlashing();

  return (
    <AnimatePresence>
      {isFlashing && (
        <motion.div
          key="warp-flash"
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.94 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.56, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none fixed inset-0 z-30"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, rgba(255, 245, 253, 0.98) 0%, rgba(255, 62, 165, 0.72) 40%, rgba(139, 92, 246, 0.44) 72%, rgba(5, 2, 10, 0.92) 100%)',
          }}
        />
      )}
    </AnimatePresence>
  );
}

/** Compact top-right glassmorphism view switcher for Galaxy View / Constellation View. */
function ViewModeToggle() {
  const viewMode = useViewMode();
  const setViewMode = useAppStore((s) => s.setViewMode);

  const handleSelect = useCallback(
    (next: ViewMode) => {
      if (next === viewMode) return;
      sfxEngine.playCelestialChime(next === 'constellation' ? 'up' : 'down');
      setViewMode(next);
    },
    [viewMode, setViewMode]
  );

  return (
    <motion.nav
      key="view-mode-toggle"
      aria-label="Sky view mode"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.65, delay: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-auto glass-surface inline-flex items-center gap-1 rounded-full p-1"
    >
      <button
        type="button"
        onClick={() => handleSelect('galaxy')}
        onMouseEnter={() => sfxEngine.playHoverTick()}
        aria-pressed={viewMode === 'galaxy'}
        aria-label="Galaxy View"
        className={`glass-interactive flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 text-xs font-medium sm:px-3.5 ${
          viewMode === 'galaxy'
            ? 'glass-active text-starlight'
            : 'border border-transparent text-lavender hover:text-starlight'
        }`}
      >
        <Orbit
          className={`h-4 w-4 shrink-0 ${viewMode === 'galaxy' ? 'text-neon-pink' : ''}`}
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <span className="hidden sm:inline">Galaxy</span>
      </button>

      <button
        type="button"
        onClick={() => handleSelect('constellation')}
        onMouseEnter={() => sfxEngine.playHoverTick()}
        aria-pressed={viewMode === 'constellation'}
        aria-label="Constellation View"
        className={`glass-interactive flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 text-xs font-medium sm:px-3.5 ${
          viewMode === 'constellation'
            ? 'glass-active text-starlight'
            : 'border border-transparent text-lavender hover:text-starlight'
        }`}
      >
        <Sparkles
          className={`h-4 w-4 shrink-0 ${viewMode === 'constellation' ? 'text-neon-pink' : ''}`}
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <span className="hidden sm:inline">Constellation</span>
      </button>
    </motion.nav>
  );
}

export function HudOverlay() {
  const stage = useStage();

  useEffect(() => {
    const cleanupAmbient = installAlwaysOnAmbientAudio();
    const unlockSfx = () => sfxEngine.unlock();
    window.addEventListener('pointerdown', unlockSfx, { passive: true, once: true });
    window.addEventListener('keydown', unlockSfx, { passive: true, once: true });

    return () => {
      cleanupAmbient();
      window.removeEventListener('pointerdown', unlockSfx);
      window.removeEventListener('keydown', unlockSfx);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-4 sm:p-6">
      {/* Top Bar — staggered reveal ~0.8s after Galaxy blooms */}
      <header className="flex items-start justify-between gap-3">
        <AnimatePresence>
          {stage === 'galaxy' && (
            <motion.div
              key="galaxy-brand"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.65, delay: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto glass-surface rounded-2xl px-4 py-2.5 sm:px-5 sm:py-3"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-full bg-neon-pink shadow-[0_0_10px_#ff3ea5]"
                  aria-hidden="true"
                />
                <h1 className="font-display text-xl leading-none font-semibold tracking-tight text-starlight sm:text-2xl">
                  {ANNIVERSARY_DATA.experienceTitle}
                </h1>
              </div>
              <p className="mt-1 text-xs text-lavender">
                {ANNIVERSARY_DATA.coupleNames[0]} &amp; {ANNIVERSARY_DATA.coupleNames[1]} ·{' '}
                <span className="font-mono tabular-nums">{ANNIVERSARY_DATA.anniversaryOrdinal}</span>
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>{stage === 'galaxy' && <ViewModeToggle />}</AnimatePresence>
      </header>

      {/* Center Stage Overlay (Stage 1 Intro Card) */}
      <div className="pointer-events-none flex flex-1 items-center justify-center">
        <AnimatePresence mode="wait">
          {stage === 'intro' && <IntroStage key="intro" />}
        </AnimatePresence>
      </div>

      <ConstellationCard />
      <ModalShell />
      <WarpFlashOverlay />
    </div>
  );
}
