import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Compass,
  Heart,
  Lock,
  Sparkles,
  X,
} from 'lucide-react';
import {
  JOURNEY_STEPS,
  getNextJourneyStep,
  isAllCoreJourneyCompleted,
  useActiveModal,
  useAppStore,
  useCompletedSteps,
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
    ctaLabel: 'Mở ngay',
    beforeBold: 'Mở đầu hành trình bằng lá thư anh viết riêng cho em. Chạm vào biểu tượng ',
    boldText: 'Phong Thư',
    afterBold: ' đang tỏa sáng trên quỹ đạo, hoặc bấm nút bên cạnh để đọc nhé.',
    ariaAction: 'Mở Thư Tình ngay',
  },
  counter: {
    title: 'Đếm Ngày Yêu',
    ctaLabel: 'Mở ngay',
    beforeBold: 'Cùng nhìn lại từng ngày, từng giờ tụi mình đã đi qua cùng nhau. Chạm biểu tượng ',
    boldText: 'Đồng Hồ / Trái Tim',
    afterBold: ' hoặc bấm nút bên cạnh để mở nhé.',
    ariaAction: 'Mở Đếm Ngày Yêu ngay',
  },
  cards: {
    title: 'Lật Thẻ Nhân Phẩm',
    ctaLabel: 'Mở ngay',
    beforeBold: 'Mini-game nhỏ cho em nè! Bấm vào ',
    boldText: 'Lật Thẻ',
    afterBold: ' để tự tay rút những tấm voucher hẹn hò và lời chúc bí mật anh chuẩn bị sẵn.',
    ariaAction: 'Mở Lật Thẻ Nhân Phẩm ngay',
  },
  puzzle: {
    title: 'Ghép Hình 3x3',
    ctaLabel: 'Mở ngay',
    beforeBold: 'Thử ghép lại bức ảnh kỷ niệm của hai đứa trong trò chơi ',
    boldText: 'Ghép Hình 3x3',
    afterBold: ' nha — chạm lần lượt 2 mảnh để đổi chỗ cho nhau.',
    ariaAction: 'Mở Ghép Hình 3x3 ngay',
  },
  gallery: {
    title: 'Bảo Tàng Của Chúng Mình',
    ctaLabel: 'Mở ngay',
    beforeBold: 'Bước vào ',
    boldText: 'Bảo Tàng Của Chúng Mình',
    afterBold: ' để nhập mật mã ngày kỷ niệm, bấm giữ nút đi dọc hành lang ảnh, vẽ tranh và quay xèng nhận quà nhé.',
    ariaAction: 'Mở Bảo Tàng Của Chúng Mình ngay',
  },
  constellation: {
    title: 'Chòm Sao Kỷ Niệm',
    ctaLabel: 'Lên Chòm Sao',
    ctaIsCelestial: true,
    beforeBold: 'Bấm nút ',
    boldText: 'Chòm Sao',
    afterBold: ' ở góc trên bên phải (hoặc nút bên cạnh) để bay lên bầu trời và tự tay thắp sáng từng ngôi sao kỷ niệm của tụi mình.',
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
  const completedSteps = useCompletedSteps();
  const supernovaCompleted = useSupernovaCompleted();

  const openModal = useAppStore((s) => s.openModal);
  const setViewMode = useAppStore((s) => s.setViewMode);

  const [isMinimized, setIsMinimized] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [showControlsTip, setShowControlsTip] = useState(true);

  const nextStep = getNextJourneyStep(completedSteps);
  const allCoreCompleted = isAllCoreJourneyCompleted(completedSteps);
  const completedCount = completedSteps.length;
  const progressPct = Math.round((completedCount / JOURNEY_STEPS.length) * 100);

  const isVisible = stage === 'galaxy' && viewMode === 'galaxy' && activeModal === null;

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
      setShowControlsTip(false);
      if (step === 'constellation') {
        sfxEngine.playCelestialChime('up');
        setViewMode('constellation');
      } else {
        sfxEngine.playStarSelect();
        openModal(step);
      }
    },
    [openModal, setViewMode]
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
      className="pointer-events-none fixed inset-x-3 bottom-3 z-20 flex flex-col items-center transition-opacity duration-150 sm:inset-x-6 sm:bottom-5"
      style={{ opacity: 'calc(1 - var(--supernova-hud-dim, 0) * 0.96)' }}
    >
      <AnimatePresence mode="wait">
        {isVisible && (
          <motion.div
            key={isMinimized ? 'journey-bar-mini' : 'journey-bar-full'}
            role="region"
            aria-label="Hành Trình Của Tụi Mình"
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98, pointerEvents: 'none' }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto relative w-full max-w-[min(94vw,680px)]"
          >
            {/* Expandable "Lộ Trình" Checklist Popover (opens upward cleanly above the bar) */}
            <AnimatePresence>
              {checklistOpen && !isMinimized && (
                <motion.div
                  key="journey-checklist-popover"
                  role="dialog"
                  aria-label="Danh sách lộ trình kỷ niệm"
                  initial={{ opacity: 0, y: 10, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.97, pointerEvents: 'none' }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  className="glass-modal cosmic-scroll absolute inset-x-0 bottom-full z-30 mb-2.5 max-h-[54vh] overflow-y-auto rounded-[24px] !bg-[#120621]/95 p-3.5 shadow-[0_20px_50px_rgba(3,1,10,0.85)] backdrop-blur-xl sm:p-4"
                >
                  <div className="mb-2.5 flex items-center justify-between border-b border-white/10 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Compass className="h-4 w-4 text-pink-400" strokeWidth={1.8} aria-hidden="true" />
                      <span className="font-sans text-xs font-semibold tracking-wide text-starlight sm:text-sm">
                        Lộ Trình Của Tụi Mình
                      </span>
                    </div>
                    <span className="font-mono text-xs text-pink-300 tabular-nums">
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
                            className={`flex min-h-11 w-full cursor-pointer items-center justify-between gap-2.5 rounded-2xl border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-pink/75 ${
                              isCurrent
                                ? 'border-pink-400/55 bg-pink-500/15 text-starlight'
                                : done
                                  ? 'border-white/10 bg-white/[0.03] text-starlight/90 hover:border-pink-300/35 hover:bg-white/[0.06]'
                                  : 'border-white/8 bg-white/[0.02] text-lavender hover:border-white/20 hover:text-starlight'
                            }`}
                          >
                            <span className="flex min-w-0 items-center gap-2.5">
                              <span
                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-mono tabular-nums ${
                                  done
                                    ? 'border-pink-300/50 bg-pink-400/20 text-pink-200'
                                    : isCurrent
                                      ? 'border-neon-pink/70 bg-neon-pink/25 text-starlight'
                                      : 'border-white/15 bg-white/[0.04] text-lavender-muted'
                                }`}
                              >
                                {done ? (
                                  <Check className="h-3.5 w-3.5 text-pink-200" strokeWidth={2.4} aria-hidden="true" />
                                ) : (
                                  idx + 1
                                )}
                              </span>
                              <span className="truncate text-xs font-medium sm:text-[13px]">
                                {meta.title}
                              </span>
                            </span>

                            <span className="shrink-0 text-[11px] font-medium">
                              {isCurrent ? (
                                <span className="rounded-full border border-pink-300/40 bg-pink-400/18 px-2 py-0.5 text-pink-200">
                                  Tiếp theo
                                </span>
                              ) : done ? (
                                <span className="text-pink-300/80">Xem lại</span>
                              ) : (
                                <span className="text-lavender-muted">Mở</span>
                              )}
                            </span>
                          </button>
                        </li>
                      );
                    })}

                    {/* 7th Special Item: Secret Supernova Grand Finale */}
                    <li
                      className={`mt-2 flex min-h-11 items-center justify-between gap-2.5 rounded-2xl border px-3 py-2 ${
                        allCoreCompleted
                          ? 'border-pink-300/50 bg-gradient-to-r from-pink-500/20 via-fuchsia-500/15 to-violet-500/20 text-starlight'
                          : 'border-white/8 bg-white/[0.015] text-lavender-muted'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                            supernovaCompleted
                              ? 'border-pink-300/55 bg-pink-400/25 text-pink-200'
                              : allCoreCompleted
                                ? 'border-pink-300/60 bg-neon-pink/25 text-pink-200'
                                : 'border-white/15 bg-white/[0.03] text-lavender-muted'
                          }`}
                        >
                          {supernovaCompleted ? (
                            <Check className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" />
                          ) : allCoreCompleted ? (
                            <Sparkles className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                          ) : (
                            <Lock className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-semibold sm:text-[13px]">
                            Món Quà Cuối Cùng
                          </span>
                          <span className="block text-[11px] leading-snug text-lavender-muted">
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

            {/* First-Arrival Subtle Controls Micro-Tip (dismissible) */}
            <AnimatePresence>
              {!isMinimized && showControlsTip && completedCount === 0 && (
                <motion.div
                  key="controls-micro-tip"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.25 }}
                  className="mx-auto mb-2 flex max-w-full items-center justify-between gap-2 rounded-full border border-white/12 bg-[#140724]/75 px-3.5 py-1.5 backdrop-blur-md"
                >
                  <p className="text-[11px] leading-snug text-lavender sm:text-xs">
                    <span className="font-semibold text-pink-300">Mẹo:</span> Em có thể kéo xoay không gian 3D, phóng to/thu nhỏ, hoặc bấm trực tiếp vào nút bên dưới để đi từng chặng nhé.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowControlsTip(false)}
                    aria-label="Ẩn mẹo điều khiển"
                    className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-lavender-muted transition-colors hover:bg-white/10 hover:text-starlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-pink/70"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Minimized Compact Pill State */}
            {isMinimized ? (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleToggleMinimize}
                  aria-label="Mở rộng thanh hướng dẫn hành trình"
                  className="glass-surface glass-interactive inline-flex min-h-11 cursor-pointer items-center gap-2.5 rounded-full px-4 py-2 text-xs font-medium text-starlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-pink/75"
                >
                  <Sparkles className="h-3.5 w-3.5 text-pink-400" strokeWidth={1.85} aria-hidden="true" />
                  <span>
                    {isFinaleBanner
                      ? '6/6 · Mở khóa Món Quà Cuối Cùng'
                      : isClosingNote
                        ? 'Hành Trình Của Tụi Mình · 6/6'
                        : `Chặng ${activeStepNumber}/${JOURNEY_STEPS.length} · ${activeMeta?.title ?? ''}`}
                  </span>
                  <ChevronUp className="h-4 w-4 text-pink-300" strokeWidth={1.85} aria-hidden="true" />
                </button>
              </div>
            ) : (
              /* Expanded Refined Glassmorphism Journey Guide Bar */
              <div
                className={`glass-surface rounded-[24px] !bg-[#130622]/88 p-3.5 backdrop-blur-xl sm:px-5 sm:py-4 ${
                  isFinaleBanner
                    ? '!border-pink-300/60 bg-gradient-to-r from-[#240b35]/94 via-[#341042]/94 to-[#220c36]/94 shadow-[0_0_34px_rgba(255,62,165,0.36),0_0_16px_rgba(244,114,182,0.25)]'
                    : ''
                }`}
              >
                {/* Top Row: Step Badge + Progress Bar + Lộ Trình & Thu Gọn Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-pink-300/35 bg-pink-500/15 px-2.5 py-1 text-[11px] leading-none font-semibold text-starlight sm:text-xs">
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-pink-400 shadow-[0_0_8px_#f472b6]"
                        aria-hidden="true"
                      />
                      {isFinaleBanner ? (
                        <span>Hoàn thành 6/6 · Món Quà Cuối Cùng</span>
                      ) : isClosingNote ? (
                        <span>Hoàn Trọn Hành Trình · 6/6</span>
                      ) : (
                        <span>
                          Chặng <span className="font-mono tabular-nums">{activeStepNumber}/{JOURNEY_STEPS.length}</span> · {activeMeta?.title}
                        </span>
                      )}
                    </span>

                    {/* Thin Pink-Violet Gradient Progress Bar */}
                    <div
                      aria-hidden="true"
                      className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-white/10 sm:block"
                    >
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-pink-400 via-neon-pink to-violet-400 transition-all duration-500 ease-out"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Checklist & Minimize Controls (44px touch targets) */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleToggleChecklist}
                      aria-expanded={checklistOpen}
                      aria-label={`Xem lộ trình (${completedCount}/${JOURNEY_STEPS.length})`}
                      className={`glass-interactive inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-pink/75 ${
                        checklistOpen
                          ? 'border-pink-300/55 bg-pink-500/20 text-starlight'
                          : 'border-white/15 bg-white/[0.04] text-lavender hover:text-starlight'
                      }`}
                    >
                      <span>
                        Lộ trình{' '}
                        <span className="font-mono text-pink-300 tabular-nums">
                          ({completedCount}/{JOURNEY_STEPS.length})
                        </span>
                      </span>
                      {checklistOpen ? (
                        <ChevronDown className="h-3.5 w-3.5 text-pink-300" strokeWidth={2} aria-hidden="true" />
                      ) : (
                        <ChevronUp className="h-3.5 w-3.5 text-pink-300" strokeWidth={2} aria-hidden="true" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleToggleMinimize}
                      aria-label="Thu gọn thanh hướng dẫn"
                      title="Thu gọn"
                      className="glass-interactive inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-full border border-transparent px-2.5 text-xs font-medium text-lavender-muted hover:text-starlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-pink/75"
                    >
                      <span className="hidden sm:inline">Thu gọn</span>
                      <ChevronDown className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* Mobile Thin Progress Bar */}
                <div
                  aria-hidden="true"
                  className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10 sm:hidden"
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-pink-400 via-neon-pink to-violet-400 transition-all duration-500 ease-out"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                {/* Main Content Row: Detailed 2-Part Instruction + Direct Rose-Pink CTA Button */}
                <div className="mt-2.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  {!allCoreCompleted && activeMeta && nextStep && (
                    <>
                      <p className="min-w-0 flex-1 font-sans text-xs leading-relaxed text-lavender sm:text-[13.5px]">
                        {activeMeta.beforeBold}
                        <strong className="font-semibold text-starlight">{activeMeta.boldText}</strong>
                        {activeMeta.afterBold}
                      </p>

                      <button
                        type="button"
                        onClick={() => navigateToStep(nextStep)}
                        onMouseEnter={() => sfxEngine.playHoverTick()}
                        aria-label={activeMeta.ariaAction}
                        className="glass-interactive inline-flex min-h-11 w-full shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-pink-300/60 bg-gradient-to-r from-pink-500/30 via-neon-pink/28 to-violet-500/30 px-4 text-xs leading-normal font-semibold text-starlight shadow-[0_0_20px_rgba(255,62,165,0.28)] hover:border-pink-200/85 hover:shadow-[0_0_26px_rgba(255,62,165,0.44)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-pink/80 sm:w-auto"
                      >
                        <span>{activeMeta.ctaLabel}</span>
                        {activeMeta.ctaIsCelestial ? (
                          <Sparkles className="h-3.5 w-3.5 text-pink-200" strokeWidth={2} aria-hidden="true" />
                        ) : (
                          <ArrowRight className="h-3.5 w-3.5 text-pink-200" strokeWidth={2} aria-hidden="true" />
                        )}
                      </button>
                    </>
                  )}

                  {isFinaleBanner && (
                    <div className="flex items-start gap-2.5 sm:items-center">
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-pink-300/50 bg-neon-pink/22 shadow-[0_0_18px_rgba(255,62,165,0.45)] sm:mt-0">
                        <Heart
                          className="h-4 w-4 animate-pulse fill-pink-300 text-pink-300"
                          strokeWidth={1.8}
                          aria-hidden="true"
                        />
                      </span>
                      <p className="min-w-0 flex-1 font-sans text-xs leading-relaxed text-starlight sm:text-[13.5px]">
                        Em đã đi qua trọn vẹn{' '}
                        <strong className="font-mono font-semibold text-pink-200 tabular-nums">6/6</strong>{' '}
                        kỷ niệm rồi! Cho màn kết đặc biệt nhất: hãy{' '}
                        <strong className="font-semibold text-pink-200">
                          chạm và GIỮ chặt trực tiếp vào giữa Trái Tim 3D trong 3 giây
                        </strong>{' '}
                        (đừng thả tay sớm nhé) để mở khóa món quà cuối cùng...
                      </p>
                    </div>
                  )}

                  {isClosingNote && (
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-pink-300/40 bg-pink-500/18">
                        <Sparkles
                          className="h-4 w-4 text-pink-200"
                          strokeWidth={1.8}
                          aria-hidden="true"
                        />
                      </span>
                      <p className="min-w-0 flex-1 font-sans text-xs leading-relaxed text-starlight/95 sm:text-[13.5px]">
                        Cảm ơn em đã đi hết hành trình này cùng anh — Em có thể tự do ngắm lại mọi kỷ niệm bất cứ lúc nào nhé.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
