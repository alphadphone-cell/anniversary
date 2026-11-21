import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Compass,
  Heart,
  Lock,
  Sparkles,
} from 'lucide-react';
import {
  JOURNEY_STEPS,
  getNextJourneyStep,
  isAllCoreJourneyCompleted,
  useActiveModal,
  useAppStore,
  useCompletedSteps,
  useFocusingNodeId,
  useStage,
  useSupernovaCompleted,
  useViewMode,
  type JourneyStepId,
} from '../../store/useAppStore';
import { sfxEngine } from '../../utils/sfxEngine';

interface StepGuideMeta {
  title: string;
  ctaLabel: string;
  ctaIsCelestial?: boolean;
  /** Detailed, warm 2-part Vietnamese instruction split around the bold keyword */
  beforeBold: string;
  boldText: string;
  afterBold: string;
  ariaAction: string;
}

const STEP_GUIDE_META: Record<JourneyStepId, StepGuideMeta> = {
  letter: {
    title: 'Thư Tình',
    ctaLabel: 'Mở',
    beforeBold: 'Mở lá thư anh viết riêng cho em — chạm ',
    boldText: 'Phong Thư',
    afterBold: ' trên quỹ đạo hoặc bấm Mở nhé.',
    ariaAction: 'Mở Thư Tình',
  },
  counter: {
    title: 'Đếm Ngày Yêu',
    ctaLabel: 'Mở',
    beforeBold: 'Nhìn lại từng ngày tụi mình bên nhau — chạm ',
    boldText: 'Đồng Hồ',
    afterBold: ' trên quỹ đạo hoặc bấm Mở nhé.',
    ariaAction: 'Mở Đếm Ngày Yêu',
  },
  cards: {
    title: 'Lật Thẻ Nhân Phẩm',
    ctaLabel: 'Mở',
    beforeBold: 'Rút thử voucher hẹn hò và lời chúc bí mật trong ',
    boldText: 'Lật Thẻ',
    afterBold: ' nha.',
    ariaAction: 'Mở Lật Thẻ Nhân Phẩm',
  },
  puzzle: {
    title: 'Ghép Hình 3x3',
    ctaLabel: 'Mở',
    beforeBold: 'Ghép lại bức ảnh kỷ niệm trong ',
    boldText: 'Ghép Hình 3x3',
    afterBold: ' — chạm 2 mảnh để đổi chỗ cho nhau.',
    ariaAction: 'Mở Ghép Hình 3x3',
  },
  gallery: {
    title: 'Bảo Tàng Của Chúng Mình',
    ctaLabel: 'Mở',
    beforeBold: 'Ghé ',
    boldText: 'Bảo Tàng Của Chúng Mình',
    afterBold: ' để đi dọc hành lang ảnh, vẽ tranh và quay xèng nhận quà.',
    ariaAction: 'Mở Bảo Tàng Của Chúng Mình',
  },
  constellation: {
    title: 'Chòm Sao Kỷ Niệm',
    ctaLabel: 'Lên Chòm Sao',
    ctaIsCelestial: true,
    beforeBold: 'Kéo ngước góc nhìn ',
    boldText: 'lên bầu trời sao',
    afterBold: ' phía trên Ngân Hà để thắp sáng chòm sao Ma Kết nhé.',
    ariaAction: 'Chuyển lên góc nhìn Chòm Sao Kỷ Niệm',
  },
};

/**
 * Refined, detailed Vietnamese Guided Journey Bar ("Hành Trình Của Tụi Mình").
 * - Unified obsidian / rose-pink (#f472b6) / violet / pearlescent-white palette (zero harsh yellow accents).
 * - Includes Step Badge, smooth pink-violet progress bar, explicit 2-part Vietnamese instructions,
 *   Direct CTA button, expandable "Lộ trình (x/6)" checklist popover, dismissible first-arrival controls tip,
 *   and a "Thu gọn" minimize/expand toggle.
 * - Auto-hides cleanly whenever any modal is open, in Constellation View, or during Supernova build-up/climax.
 */
export function JourneyGuidePill() {
  const stage = useStage();
  const viewMode = useViewMode();
  const activeModal = useActiveModal();
  const focusingNodeId = useFocusingNodeId();
  const completedSteps = useCompletedSteps();
  const supernovaCompleted = useSupernovaCompleted();

  const openFeatureWithCameraFly = useAppStore((s) => s.openFeatureWithCameraFly);

  const [isMinimized, setIsMinimized] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);

  const nextStep = getNextJourneyStep(completedSteps);
  const allCoreCompleted = isAllCoreJourneyCompleted(completedSteps);
  const completedCount = completedSteps.length;
  const progressPct = Math.round((completedCount / JOURNEY_STEPS.length) * 100);

  const isVisible =
    stage === 'galaxy' &&
    viewMode === 'galaxy' &&
    activeModal === null &&
    focusingNodeId === null;

  // Close checklist popover automatically whenever the bar hides or minimizes
  useEffect(() => {
    if (!isVisible || isMinimized) {
      setChecklistOpen(false);
    }
  }, [isVisible, isMinimized]);

  // Auto-expand & play magical unlock sparkle chime once when 6/6 core memories unlock the Supernova finale
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
      setIsMinimized(false);
      sfxEngine.playFinaleUnlockChime();
    }
  }, [stage, viewMode, activeModal, allCoreCompleted, supernovaCompleted]);

  // Auto-expand to show sweet closing note right after Supernova secret letter closes
  const prevSupernovaDoneRef = useRef(supernovaCompleted);
  useEffect(() => {
    if (supernovaCompleted && !prevSupernovaDoneRef.current) {
      setIsMinimized(false);
    }
    prevSupernovaDoneRef.current = supernovaCompleted;
  }, [supernovaCompleted]);

  const navigateToStep = useCallback(
    (step: JourneyStepId) => {
      setChecklistOpen(false);
      const started = openFeatureWithCameraFly(step);
      if (started && step === 'constellation') {
        sfxEngine.playCelestialChime('up');
      }
    },
    [openFeatureWithCameraFly]
  );

  const handleToggleChecklist = useCallback(() => {
    sfxEngine.playHoverTick();
    setChecklistOpen((prev) => !prev);
  }, []);

  const handleToggleMinimize = useCallback(() => {
    sfxEngine.playHoverTick();
    setChecklistOpen(false);
    setIsMinimized((prev) => !prev);
  }, []);

  const isFinaleBanner = allCoreCompleted && !supernovaCompleted;
  const isClosingNote = allCoreCompleted && supernovaCompleted;
  const activeMeta = nextStep ? STEP_GUIDE_META[nextStep] : null;
  const activeStepNumber = nextStep ? JOURNEY_STEPS.indexOf(nextStep) + 1 : JOURNEY_STEPS.length;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-3.5 z-20 flex flex-col items-center px-3 transition-opacity duration-150 sm:bottom-5"
      style={{ opacity: 'calc(1 - var(--supernova-hud-dim, 0) * 0.96)' }}
    >
      <AnimatePresence>
        {isVisible && (
          <motion.div
            key="journey-hud-shell"
            layout
            role="region"
            aria-label="Hành Trình Của Tụi Mình"
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97, pointerEvents: 'none' }}
            transition={{
              duration: 0.26,
              ease: [0.22, 1, 0.36, 1],
              layout: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
            }}
            className={`pointer-events-auto relative ${
              isMinimized ? 'w-auto' : 'w-[92vw] max-w-[500px]'
            }`}
          >
            {/* Expandable "Lộ Trình" Checklist Popover (opens upward cleanly above the HUD) */}
            <AnimatePresence>
              {checklistOpen && !isMinimized && (
                <motion.div
                  key="journey-checklist-popover"
                  role="dialog"
                  aria-label="Danh sách lộ trình kỷ niệm"
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98, pointerEvents: 'none' }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="cosmic-scroll absolute inset-x-0 bottom-full z-30 mb-2 max-h-[54vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0e061b]/92 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_44px_rgba(3,1,10,0.82)] backdrop-blur-xl sm:p-3.5"
                >
                  <div className="mb-2 flex items-center justify-between border-b border-white/10 pb-2">
                    <div className="flex items-center gap-2">
                      <Compass className="h-3.5 w-3.5 text-pink-400" strokeWidth={1.8} aria-hidden="true" />
                      <span className="font-sans text-xs font-semibold tracking-wide text-starlight">
                        Lộ Trình Của Tụi Mình
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-pink-300/90 tabular-nums">
                      {completedCount}/{JOURNEY_STEPS.length} chặng
                    </span>
                  </div>

                  <ul className="space-y-1.5">
                    {JOURNEY_STEPS.map((stepId, idx) => {
                      const meta = STEP_GUIDE_META[stepId];
                      const done = completedSteps.includes(stepId);
                      const isCurrent = stepId === nextStep;

                      return (
                        <li key={stepId}>
                          <button
                            type="button"
                            onClick={() => navigateToStep(stepId)}
                            className={`flex min-h-11 w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl border px-3 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-pink/75 ${
                              isCurrent
                                ? 'border-pink-400/50 bg-pink-500/15 text-starlight'
                                : done
                                  ? 'border-white/8 bg-white/[0.03] text-starlight/90 hover:border-pink-300/35 hover:bg-white/[0.06]'
                                  : 'border-white/6 bg-white/[0.02] text-lavender hover:border-white/15 hover:text-starlight'
                            }`}
                          >
                            <span className="flex min-w-0 items-center gap-2.5">
                              <span
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-mono tabular-nums ${
                                  done
                                    ? 'border-pink-300/50 bg-pink-400/20 text-pink-200'
                                    : isCurrent
                                      ? 'border-neon-pink/70 bg-neon-pink/25 text-starlight'
                                      : 'border-white/15 bg-white/[0.04] text-lavender-muted'
                                }`}
                              >
                                {done ? (
                                  <Check className="h-3 w-3 text-pink-200" strokeWidth={2.4} aria-hidden="true" />
                                ) : (
                                  idx + 1
                                )}
                              </span>
                              <span className="truncate text-xs font-medium">
                                {meta.title}
                              </span>
                            </span>

                            <span className="shrink-0 text-[11px] font-medium">
                              {isCurrent ? (
                                <span className="text-pink-300">Tiếp theo</span>
                              ) : done ? (
                                <span className="text-pink-300/75">Xem lại</span>
                              ) : (
                                <span className="text-white/55">Mở</span>
                              )}
                            </span>
                          </button>
                        </li>
                      );
                    })}

                    {/* 7th Special Item: Secret Supernova Grand Finale */}
                    <li
                      className={`mt-1.5 flex min-h-11 items-center justify-between gap-2.5 rounded-xl border px-3 py-1.5 ${
                        allCoreCompleted
                          ? 'border-pink-300/45 bg-gradient-to-r from-pink-500/20 via-fuchsia-500/15 to-violet-500/20 text-starlight'
                          : 'border-white/8 bg-white/[0.015] text-lavender-muted'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                            supernovaCompleted
                              ? 'border-pink-300/55 bg-pink-400/25 text-pink-200'
                              : allCoreCompleted
                                ? 'border-pink-300/60 bg-neon-pink/25 text-pink-200'
                                : 'border-white/15 bg-white/[0.03] text-lavender-muted'
                          }`}
                        >
                          {supernovaCompleted ? (
                            <Check className="h-3 w-3" strokeWidth={2.4} aria-hidden="true" />
                          ) : allCoreCompleted ? (
                            <Sparkles className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                          ) : (
                            <Lock className="h-2.5 w-2.5" strokeWidth={2} aria-hidden="true" />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-semibold">
                            Món Quà Cuối Cùng
                          </span>
                          <span className="block text-[11px] leading-snug text-white/55">
                            {supernovaCompleted
                              ? 'Đã khám phá Siêu Tân Tinh Bí Mật'
                              : allCoreCompleted
                                ? 'Chạm & giữ giữa Trái Tim 3D trong 3 giây'
                                : 'Mở khóa sau khi hoàn thành đủ 6/6 chặng'}
                          </span>
                        </span>
                      </span>
                    </li>
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Morphing Surface: Ultra-Minimal Collapsed Chip <-> Sleek Jewel-Like Floating HUD Pill */}
            {isMinimized ? (
              <motion.button
                key="journey-chip-collapsed"
                layout="position"
                type="button"
                onClick={handleToggleMinimize}
                aria-label="Mở rộng thanh hướng dẫn hành trình"
                className="group relative inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-[#0c0516]/55 px-3.5 py-1.5 font-sans text-[11px] font-medium tracking-wide text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_28px_rgba(3,1,10,0.5)] backdrop-blur-md transition-colors hover:border-pink-300/35 hover:bg-[#130824]/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-pink/75 before:absolute before:-inset-y-2 before:-inset-x-1"
              >
                <span
                  className="h-[5px] w-[5px] shrink-0 rounded-full bg-pink-400 shadow-[0_0_8px_#f472b6]"
                  aria-hidden="true"
                />
                <span className="tabular-nums">
                  {isFinaleBanner
                    ? '6/6 · Món Quà Cuối'
                    : isClosingNote
                      ? 'Hành Trình · 6/6'
                      : `Chặng ${activeStepNumber}/${JOURNEY_STEPS.length}`}
                </span>
                <ChevronUp
                  className="h-3.5 w-3.5 text-pink-300/85 transition-transform duration-200 group-hover:-translate-y-0.5"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </motion.button>
            ) : (
              <motion.div
                key="journey-hud-expanded"
                layout="position"
                className={`relative overflow-hidden rounded-2xl border bg-[#0c0516]/50 px-4 pt-2.5 pb-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_14px_40px_rgba(3,1,10,0.52)] backdrop-blur-md ${
                  isFinaleBanner
                    ? 'border-pink-300/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_0_32px_rgba(255,62,165,0.3)]'
                    : 'border-white/10'
                }`}
              >
                {/* Row 1: Borderless Header Metadata + Ghost Controls */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2 font-sans text-[11px] font-medium tracking-wide text-pink-300/90">
                    <span
                      className="h-[5px] w-[5px] shrink-0 rounded-full bg-pink-400 shadow-[0_0_8px_#f472b6]"
                      aria-hidden="true"
                    />
                    <span className="truncate">
                      {isFinaleBanner ? (
                        'Hoàn thành 6/6 · Món Quà Cuối Cùng'
                      ) : isClosingNote ? (
                        'Hoàn Trọn Hành Trình · 6/6'
                      ) : (
                        <>
                          Chặng <span className="font-mono tabular-nums">{activeStepNumber}/{JOURNEY_STEPS.length}</span> · {activeMeta?.title}
                        </>
                      )}
                    </span>
                  </div>

                  <div className="flex shrink-0 items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleToggleChecklist}
                      aria-expanded={checklistOpen}
                      aria-label={`Xem lộ trình (${completedCount}/${JOURNEY_STEPS.length})`}
                      className={`relative inline-flex cursor-pointer items-center gap-1 font-sans text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-pink/75 before:absolute before:-inset-y-2.5 before:-inset-x-1.5 ${
                        checklistOpen
                          ? 'text-pink-200'
                          : 'text-white/65 hover:text-pink-200'
                      }`}
                    >
                      <span>
                        Lộ trình{' '}
                        <span className="font-mono text-pink-300/90 tabular-nums">
                          ({completedCount}/{JOURNEY_STEPS.length})
                        </span>
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleToggleMinimize}
                      aria-label="Thu gọn thanh hướng dẫn"
                      title="Thu gọn"
                      className="relative flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-pink-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-pink/75 before:absolute before:-inset-2"
                    >
                      <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* Row 2: Crisp Concise Guidance + Sleek Compact CTA */}
                <div className="mt-1.5 flex items-center justify-between gap-3">
                  {!allCoreCompleted && activeMeta && nextStep && (
                    <>
                      <p className="min-w-0 flex-1 font-sans text-[12.5px] leading-relaxed text-white/80">
                        {activeMeta.beforeBold}
                        <strong className="font-semibold text-white">{activeMeta.boldText}</strong>
                        {activeMeta.afterBold}
                      </p>

                      <button
                        type="button"
                        onClick={() => navigateToStep(nextStep)}
                        onMouseEnter={() => sfxEngine.playHoverTick()}
                        aria-label={activeMeta.ariaAction}
                        className="relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-1 rounded-full border border-pink-300/45 bg-gradient-to-r from-pink-500/75 via-neon-pink/70 to-fuchsia-500/75 px-4 py-1.5 font-sans text-xs font-medium tracking-wide text-white shadow-[0_0_16px_rgba(255,62,165,0.34)] transition-all duration-200 hover:-translate-y-0.5 hover:border-pink-200/80 hover:shadow-[0_4px_22px_rgba(255,62,165,0.52)] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-pink/80 before:absolute before:-inset-y-1.5 before:-inset-x-1"
                      >
                        <span>{activeMeta.ctaLabel}</span>
                        {activeMeta.ctaIsCelestial && (
                          <Sparkles className="h-3 w-3 text-pink-100" strokeWidth={2} aria-hidden="true" />
                        )}
                      </button>
                    </>
                  )}

                  {isFinaleBanner && (
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-pink-300/45 bg-neon-pink/20 shadow-[0_0_14px_rgba(255,62,165,0.4)]">
                        <Heart
                          className="h-3.5 w-3.5 animate-pulse fill-pink-300 text-pink-300"
                          strokeWidth={1.8}
                          aria-hidden="true"
                        />
                      </span>
                      <p className="min-w-0 flex-1 font-sans text-[12.5px] leading-relaxed text-white/85">
                        Đủ <strong className="font-mono font-semibold text-pink-200 tabular-nums">6/6</strong> kỷ niệm rồi — chạm và{' '}
                        <strong className="font-semibold text-white">giữ giữa Trái Tim 3D 3 giây</strong> để mở món quà cuối nhé.
                      </p>
                    </div>
                  )}

                  {isClosingNote && (
                    <div className="flex items-center gap-2">
                      <Sparkles
                        className="h-3.5 w-3.5 shrink-0 text-pink-300"
                        strokeWidth={1.9}
                        aria-hidden="true"
                      />
                      <p className="min-w-0 flex-1 font-sans text-[12.5px] leading-relaxed text-white/85">
                        Cảm ơn em đã đi trọn hành trình cùng anh — Em có thể tự do ngắm lại mọi kỷ niệm bất cứ lúc nào nhé.
                      </p>
                    </div>
                  )}
                </div>

                {/* Integrated 2px Glowing Pink-to-Violet Bottom Edge Progress Line */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-white/[0.06]"
                >
                  <div
                    className="h-full bg-gradient-to-r from-pink-400 via-neon-pink to-violet-400 shadow-[0_0_10px_rgba(244,114,182,0.75)] transition-all duration-500 ease-out"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
