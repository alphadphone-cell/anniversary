import { useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, Heart, Sparkles, Star, X } from 'lucide-react';
import {
  JOURNEY_STEPS,
  getNextJourneyStep,
  isAllCoreJourneyCompleted,
  useActiveModal,
  useAppStore,
  useCompletedSteps,
  useGuidePillDismissed,
  useStage,
  useSupernovaCompleted,
  useViewMode,
  type JourneyStepId,
} from '../../store/useAppStore';
import { sfxEngine } from '../../utils/sfxEngine';

interface StepHintCopy {
  prefix: string;
  emphasis: string;
  suffix: string;
  ariaAction: string;
}

const STEP_HINTS: Record<JourneyStepId, StepHintCopy> = {
  letter: {
    prefix: 'Chạm vào ',
    emphasis: 'Thư Tình',
    suffix: ' để mở đầu hành trình nhé...',
    ariaAction: 'Mở Thư Tình',
  },
  counter: {
    prefix: 'Cùng xem ',
    emphasis: 'Đếm Ngày',
    suffix: ' tụi mình đã bên nhau bao lâu rồi nè',
    ariaAction: 'Mở Đếm Ngày Yêu',
  },
  cards: {
    prefix: 'Thử vận may với ',
    emphasis: 'Lật Thẻ',
    suffix: ' nhận quà bí mật nha',
    ariaAction: 'Mở Lật Thẻ Nhân Phẩm',
  },
  puzzle: {
    prefix: 'Ghép lại bức ảnh kỷ niệm trong ',
    emphasis: 'Ghép Hình',
    suffix: ' nhé',
    ariaAction: 'Mở Ghép Hình 3x3',
  },
  gallery: {
    prefix: 'Bước vào ',
    emphasis: 'Bảo Tàng',
    suffix: ' để dạo quanh kỷ niệm của tụi mình nào',
    ariaAction: 'Mở Bảo Tàng Của Chúng Mình',
  },
  constellation: {
    prefix: 'Chạm nút ',
    emphasis: 'Chòm Sao',
    suffix: ' ở góc trên để thắp sáng bầu trời nhé',
    ariaAction: 'Chuyển sang góc nhìn Chòm Sao Kỷ Niệm',
  },
};

/**
 * Romantic Soft-Guided Journey ("Hành Trình Của Tụi Mình") Poetic Guide Pill.
 * - Compact bottom-center glassmorphism pill with 6/6 star progress, clickable shortcut, and dismiss toggle.
 * - Auto-hides whenever not in Galaxy View, when any Modal is open, or during Supernova build-up/climax.
 */
export function JourneyGuidePill() {
  const stage = useStage();
  const viewMode = useViewMode();
  const activeModal = useActiveModal();
  const completedSteps = useCompletedSteps();
  const supernovaCompleted = useSupernovaCompleted();
  const dismissed = useGuidePillDismissed();

  const openModal = useAppStore((s) => s.openModal);
  const setViewMode = useAppStore((s) => s.setViewMode);
  const setGuidePillDismissed = useAppStore((s) => s.setGuidePillDismissed);

  const nextStep = getNextJourneyStep(completedSteps);
  const allCoreCompleted = isAllCoreJourneyCompleted(completedSteps);
  const completedCount = completedSteps.length;

  const isVisible =
    stage === 'galaxy' && viewMode === 'galaxy' && activeModal === null && !dismissed;

  // Play magical unlock sparkle chime once the moment 6/6 completes and she is back in Galaxy View
  const unlockChimePlayedRef = useRef(false);
  useEffect(() => {
    if (
      stage === 'galaxy' &&
      viewMode === 'galaxy' &&
      activeModal === null &&
      allCoreCompleted &&
      !supernovaCompleted &&
      !unlockChimePlayedRef.current
    ) {
      unlockChimePlayedRef.current = true;
      sfxEngine.playFinaleUnlockChime();
    }
  }, [stage, viewMode, activeModal, allCoreCompleted, supernovaCompleted]);

  const handleShortcutClick = useCallback(() => {
    if (!nextStep) return;
    if (nextStep === 'constellation') {
      sfxEngine.playCelestialChime('up');
      setViewMode('constellation');
    } else {
      sfxEngine.playStarSelect();
      openModal(nextStep);
    }
  }, [nextStep, openModal, setViewMode]);

  const handleDismiss = useCallback(() => {
    sfxEngine.playModalClose();
    setGuidePillDismissed(true);
  }, [setGuidePillDismissed]);

  const isFinaleBanner = allCoreCompleted && !supernovaCompleted;
  const isClosingNote = allCoreCompleted && supernovaCompleted;
  const activeHint = nextStep ? STEP_HINTS[nextStep] : null;

  return (
    <div
      className="pointer-events-none fixed inset-x-3 bottom-4 z-10 flex justify-center transition-opacity duration-150 sm:inset-x-6 sm:bottom-6"
      style={{ opacity: 'calc(1 - var(--supernova-hud-dim, 0) * 0.96)' }}
    >
      <AnimatePresence mode="wait">
        {isVisible && (
          <motion.div
            key={isClosingNote ? 'journey-closing' : isFinaleBanner ? 'journey-finale' : `journey-${nextStep ?? 'done'}`}
            role="region"
            aria-label="Hành Trình Của Tụi Mình"
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97, pointerEvents: 'none' }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className={`pointer-events-auto glass-surface flex max-w-[min(92vw,600px)] items-center gap-1.5 rounded-3xl p-1.5 pl-3 sm:gap-2 sm:rounded-full sm:pl-4 ${
              isFinaleBanner
                ? '!border-amber-200/55 bg-gradient-to-r from-[#240d34]/85 via-[#32103c]/85 to-[#281136]/85 shadow-[0_0_32px_rgba(255,62,165,0.34),0_0_18px_rgba(253,224,71,0.22)]'
                : isClosingNote
                  ? '!border-neon-pink/35 shadow-[0_0_24px_rgba(255,62,165,0.2)]'
                  : ''
            }`}
          >
            {/* Guided Step State (0/6 -> 5/6): Progress Counter + Clickable Shortcut */}
            {!allCoreCompleted && activeHint && (
              <button
                type="button"
                onClick={handleShortcutClick}
                onMouseEnter={() => sfxEngine.playHoverTick()}
                aria-label={activeHint.ariaAction}
                className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-2xl py-1 pr-1 text-left transition-colors hover:text-starlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-pink/75 sm:rounded-full"
              >
                {/* Glowing 1/6..5/6 Progress Counter + 6 Tiny Star Pips */}
                <span className="flex shrink-0 flex-col items-center gap-0.5 rounded-full border border-neon-pink/30 bg-neon-pink/12 px-2.5 py-1">
                  <span className="font-mono text-[11px] leading-none font-semibold text-starlight tabular-nums">
                    {completedCount}/{JOURNEY_STEPS.length}
                  </span>
                  <span className="flex items-center gap-0.5" aria-hidden="true">
                    {JOURNEY_STEPS.map((step) => {
                      const done = completedSteps.includes(step);
                      const isNext = step === nextStep;
                      return (
                        <Star
                          key={step}
                          className={`h-2 w-2 ${
                            done
                              ? 'fill-amber-300 text-amber-300'
                              : isNext
                                ? 'fill-neon-pink text-neon-pink'
                                : 'text-lavender-muted/45'
                          }`}
                          strokeWidth={2}
                        />
                      );
                    })}
                  </span>
                </span>

                {/* Poetic Vietnamese Hint */}
                <span className="flex min-w-0 flex-1 items-center gap-1.5 text-xs leading-relaxed text-lavender sm:text-[13px]">
                  <Sparkles
                    className="hidden h-3.5 w-3.5 shrink-0 text-neon-pink sm:inline-block"
                    strokeWidth={1.85}
                    aria-hidden="true"
                  />
                  <span className="line-clamp-2 sm:line-clamp-1">
                    {activeHint.prefix}
                    <strong className="font-semibold text-starlight">{activeHint.emphasis}</strong>
                    {activeHint.suffix}
                  </span>
                </span>

                <ChevronRight
                  className="h-4 w-4 shrink-0 text-neon-pink/85"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </button>
            )}

            {/* Grand Finale Unlock Banner (6/6 Completed -> Hold Heart 3s for Secret Supernova) */}
            {isFinaleBanner && (
              <div className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 py-1 pr-1">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-200/50 bg-neon-pink/20 shadow-[0_0_16px_rgba(255,62,165,0.45)]">
                  <Heart
                    className="h-4 w-4 animate-pulse fill-neon-pink text-neon-pink"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                </span>
                <p className="min-w-0 flex-1 text-xs leading-relaxed text-starlight sm:text-[13px]">
                  Em đã mở khóa trọn vẹn{' '}
                  <strong className="font-mono font-semibold text-amber-200 tabular-nums">6/6</strong>{' '}
                  kỷ niệm! Bây giờ hãy{' '}
                  <strong className="font-semibold text-amber-200">
                    chạm và giữ vào Trái Tim ở giữa trong 3 giây
                  </strong>{' '}
                  để mở món quà cuối cùng nhé...
                </p>
              </div>
            )}

            {/* Post-Supernova Sweet Closing Note */}
            {isClosingNote && (
              <div className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 py-1 pr-1">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neon-pink/35 bg-neon-pink/15">
                  <Sparkles
                    className="h-4 w-4 text-amber-200"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                </span>
                <p className="min-w-0 flex-1 text-xs leading-relaxed text-starlight/95 sm:text-[13px]">
                  Cảm ơn em đã đi hết hành trình này cùng anh — Em có thể tự do ngắm lại mọi kỷ niệm bất cứ lúc nào nhé
                </p>
              </div>
            )}

            {/* Subtle Hide / Dismiss Toggle (44x44px touch target) */}
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Ẩn gợi ý hành trình"
              title="Ẩn gợi ý"
              className="glass-interactive flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-transparent text-lavender-muted hover:text-starlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-pink/70"
            >
              <X className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
