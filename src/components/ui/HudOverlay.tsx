import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useIsTransitionFlashing, useStage } from '../../store/useAppStore';
import { ANNIVERSARY_DATA } from '../../data/anniversaryData';
import { installAlwaysOnAmbientAudio } from '../../audio/audioEngine';
import { sfxEngine } from '../../utils/sfxEngine';
import { IntroStage } from './IntroStage';
import { ModalShell } from './ModalShell';

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
      {/* Top Brand Badge — staggered reveal ~0.8s after Galaxy blooms */}
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
      </header>

      {/* Center Stage Overlay (Stage 1 Intro Card) */}
      <div className="pointer-events-none flex flex-1 items-center justify-center">
        <AnimatePresence mode="wait">
          {stage === 'intro' && <IntroStage key="intro" />}
        </AnimatePresence>
      </div>

      <ModalShell />
      <WarpFlashOverlay />
    </div>
  );
}
