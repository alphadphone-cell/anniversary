import { AnimatePresence, motion } from 'framer-motion';
import { Mail, Clock, Layers, Sparkles, Image as ImageIcon, Compass } from 'lucide-react';
import {
  useActiveModal,
  useAppStore,
  useIsTransitionFlashing,
  useStage,
  type AppStage,
  type ModalId,
} from '../../store/useAppStore';
import { ANNIVERSARY_DATA } from '../../data/anniversaryData';
import { AudioController } from './AudioController';
import { IntroStage } from './IntroStage';
import { ModalShell } from './ModalShell';

const STAGES: { id: AppStage; label: string }[] = [
  { id: 'intro', label: 'Intro' },
  { id: 'warp', label: 'Warp' },
  { id: 'galaxy', label: 'Galaxy' },
];

const DOCK_ITEMS: { id: Exclude<ModalId, null>; label: string; Icon: typeof Mail }[] = [
  { id: 'letter', label: 'Letter', Icon: Mail },
  { id: 'counter', label: 'Counter', Icon: Clock },
  { id: 'cards', label: 'Cards', Icon: Layers },
  { id: 'puzzle', label: 'Puzzle', Icon: Sparkles },
  { id: 'gallery', label: 'Gallery', Icon: ImageIcon },
];

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
          animate={{ opacity: 0.92 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none fixed inset-0 z-30"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, rgba(255, 240, 252, 0.96) 0%, rgba(255, 62, 165, 0.72) 38%, rgba(139, 92, 246, 0.45) 70%, rgba(5, 2, 10, 0.92) 100%)',
          }}
        />
      )}
    </AnimatePresence>
  );
}

export function HudOverlay() {
  const stage = useStage();
  const activeModal = useActiveModal();
  const setStage = useAppStore((s) => s.setStage);
  const toggleModal = useAppStore((s) => s.toggleModal);

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-4 sm:p-6">
      {/* Top Bar */}
      <header className="flex items-start justify-between gap-3">
        <AnimatePresence>
          {stage === 'galaxy' && (
            <motion.div
              key="galaxy-brand"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
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

        <div className="pointer-events-auto ml-auto flex items-center gap-2">
          <AnimatePresence>
            {stage === 'galaxy' && (
              <motion.nav
                key="stage-switcher"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                aria-label="Experience stage"
                className="glass-surface hidden items-center gap-1 rounded-full p-1 md:flex"
              >
                {STAGES.map((item) => {
                  const isCurrent = stage === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setStage(item.id)}
                      aria-current={isCurrent ? 'step' : undefined}
                      className={`glass-interactive min-h-9 cursor-pointer rounded-full px-3.5 text-xs font-medium ${
                        isCurrent
                          ? 'bg-neon-pink/22 text-starlight shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
                          : 'text-lavender hover:text-starlight'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </motion.nav>
            )}
          </AnimatePresence>

          {stage !== 'warp' && <AudioController />}
        </div>
      </header>

      {/* Center Stage Overlay (Stage 1 Intro Card) */}
      <div className="pointer-events-none flex flex-1 items-center justify-center">
        <AnimatePresence mode="wait">
          {stage === 'intro' && <IntroStage key="intro" />}
        </AnimatePresence>
      </div>

      {/* Bottom Interactive Dock (Stage 3 Galaxy) */}
      <AnimatePresence>
        {stage === 'galaxy' && (
          <motion.footer
            key="galaxy-dock"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 14 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center gap-2.5 pb-[env(safe-area-inset-bottom)]"
          >
            <div className="flex items-center gap-1.5 text-xs text-lavender-muted">
              <Compass className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
              <span>Drag to orbit · Scroll to zoom</span>
            </div>

            <nav
              aria-label="Anniversary chapters"
              className="pointer-events-auto glass-surface flex max-w-full items-center gap-1 overflow-x-auto rounded-full p-1.5 sm:gap-1.5 sm:p-2"
            >
              {DOCK_ITEMS.map(({ id, label, Icon }) => {
                const isOpen = activeModal === id;
                return (
                  <motion.button
                    key={id}
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => toggleModal(id)}
                    aria-expanded={isOpen}
                    aria-label={label}
                    className={`glass-interactive flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full border border-transparent px-3 text-xs font-medium sm:px-4 sm:text-sm ${
                      isOpen
                        ? 'glass-active text-starlight'
                        : 'text-lavender hover:text-starlight'
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 ${isOpen ? 'text-neon-pink' : ''}`}
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <span className="hidden sm:inline">{label}</span>
                  </motion.button>
                );
              })}
            </nav>
          </motion.footer>
        )}
      </AnimatePresence>

      <ModalShell />
      <WarpFlashOverlay />
    </div>
  );
}
