import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Music2 } from 'lucide-react';
import { ANNIVERSARY_DATA } from '../../data/anniversaryData';
import { useAppStore } from '../../store/useAppStore';
import { musicEngine } from '../../utils/musicEngine';
import { sfxEngine } from '../../utils/sfxEngine';

type SetupPhase = 1 | 2 | 3 | 4 | 'verifying' | 'whisper';

interface StarlightMote {
  id: number;
  left: string;
  top: string;
  size: number;
  driftY: number;
  delay: number;
  peakOpacity: number;
  roseTint: boolean;
}

const WHISPER_STARLIGHT_MOTES: StarlightMote[] = [
  { id: 0, left: '18%', top: '68%', size: 2.5, driftY: -46, delay: 0.05, peakOpacity: 0.62, roseTint: false },
  { id: 1, left: '28%', top: '42%', size: 2, driftY: -38, delay: 0.25, peakOpacity: 0.48, roseTint: true },
  { id: 2, left: '36%', top: '76%', size: 3, driftY: -54, delay: 0.15, peakOpacity: 0.55, roseTint: true },
  { id: 3, left: '44%', top: '34%', size: 2, driftY: -34, delay: 0.4, peakOpacity: 0.44, roseTint: false },
  { id: 4, left: '52%', top: '70%', size: 2.5, driftY: -48, delay: 0.2, peakOpacity: 0.58, roseTint: true },
  { id: 5, left: '61%', top: '36%', size: 2.5, driftY: -40, delay: 0.35, peakOpacity: 0.52, roseTint: false },
  { id: 6, left: '68%', top: '64%', size: 3, driftY: -52, delay: 0.1, peakOpacity: 0.6, roseTint: true },
  { id: 7, left: '77%', top: '46%', size: 2, driftY: -36, delay: 0.3, peakOpacity: 0.46, roseTint: false },
  { id: 8, left: '83%', top: '72%', size: 2.5, driftY: -44, delay: 0.18, peakOpacity: 0.5, roseTint: true },
  { id: 9, left: '24%', top: '54%', size: 2, driftY: -32, delay: 0.45, peakOpacity: 0.42, roseTint: false },
  { id: 10, left: '72%', top: '32%', size: 2, driftY: -30, delay: 0.5, peakOpacity: 0.45, roseTint: true },
  { id: 11, left: '49%', top: '26%', size: 2.5, driftY: -36, delay: 0.28, peakOpacity: 0.48, roseTint: false },
];

const SMOOTH_EASE = [0.22, 1, 0.36, 1] as const;

const STEP_TRANSITION_VARIANTS = {
  initial: { opacity: 0, y: 8, filter: 'blur(4px)' },
  animate: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.7, ease: SMOOTH_EASE },
  },
  exit: {
    opacity: 0,
    y: -6,
    filter: 'blur(4px)',
    transition: { duration: 0.45, ease: SMOOTH_EASE },
  },
};

const STEP_REDUCED_VARIANTS = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.35 } },
  exit: { opacity: 0, transition: { duration: 0.25 } },
};

const CHECK_INITIAL_DELAY_MS = 700;
const CHECK_STEP_INTERVAL_MS = 800;
const CHECK_COMPLETE_HOLD_MS = 900;
const WHISPER_POST_BREATH_MS = 250;
const SOUNDWAVE_BAR_DELAYS = [0, 140, 280, 180, 70];

interface FullscreenDocumentElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

// Module-scoped Screen WakeLock sentinel so the display stays awake across setup -> intro -> warp -> galaxy
let activeWakeLock: WakeLockSentinel | null = null;
let wakeLockReacquireBound = false;

async function acquireScreenWakeLock(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;
  const wakeLockApi = navigator.wakeLock;
  if (!wakeLockApi?.request) return false;

  try {
    activeWakeLock = await wakeLockApi.request('screen');
    if (!wakeLockReacquireBound && typeof document !== 'undefined') {
      wakeLockReacquireBound = true;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && activeWakeLock?.released) {
          void navigator.wakeLock
            ?.request('screen')
            .then((s) => {
              activeWakeLock = s;
            })
            .catch(() => {});
        }
      });
    }
    return true;
  } catch {
    return false;
  }
}

async function tryEnterFullscreen(): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  if (document.fullscreenElement) return true;
  const el = document.documentElement as FullscreenDocumentElement;
  try {
    if (typeof el.requestFullscreen === 'function') {
      await el.requestFullscreen();
      return Boolean(document.fullscreenElement);
    }
    if (typeof el.webkitRequestFullscreen === 'function') {
      await el.webkitRequestFullscreen();
      return true;
    }
  } catch {
    // Graceful fallback on iOS Safari or restricted embedded browsers
  }
  return false;
}

/**
 * Dedicated ~3.6s solo cinematic interlude ("Đi cùng anh nhé...") mounted ONLY after
 * the 4-line checklist has completely faded to pure black (zero overlap with IntroStage).
 * Beat timeline: 0.0-1.2s focus-in -> 1.2-2.7s calm drift -> 2.7-3.6s stardust dissolve -> 0.25s pure-black breath -> Intro.
 */
function WhisperInterlude({
  reducedMotion,
  onComplete,
}: {
  reducedMotion: boolean;
  onComplete: () => void;
}) {
  const [beat, setBeat] = useState<'in' | 'hold' | 'out' | 'breath'>('in');
  const completedRef = useRef(false);

  useEffect(() => {
    sfxEngine.playWhisperBloom();

    const holdId = window.setTimeout(() => setBeat('hold'), 1200);
    const outId = window.setTimeout(() => setBeat('out'), 2700);
    // Guarantee clean exit into pure-black breath even if RAF lags under software WebGL
    const breathFallbackId = window.setTimeout(() => {
      setBeat((prev) => (prev === 'out' ? 'breath' : prev));
    }, 3750);

    return () => {
      window.clearTimeout(holdId);
      window.clearTimeout(outId);
      window.clearTimeout(breathFallbackId);
    };
  }, []);

  useEffect(() => {
    if (beat !== 'breath') return;
    const id = window.setTimeout(() => {
      if (completedRef.current) return;
      completedRef.current = true;
      onComplete();
    }, WHISPER_POST_BREATH_MS);
    return () => {
      window.clearTimeout(id);
    };
  }, [beat, onComplete]);

  const handleOutComplete = useCallback(() => {
    setBeat((prev) => (prev === 'out' ? 'breath' : prev));
  }, []);

  const phraseAnimate = reducedMotion
    ? beat === 'in' || beat === 'hold'
      ? { opacity: 1 }
      : { opacity: 0 }
    : beat === 'in'
      ? { opacity: 1, filter: 'blur(0px)', scale: 1, y: 0, letterSpacing: '0.03em' }
      : beat === 'hold'
        ? { opacity: 1, filter: 'blur(0px)', scale: 1.005, y: -4, letterSpacing: '0.03em' }
        : { opacity: 0, filter: 'blur(10px)', scale: 1.02, y: -14, letterSpacing: '0.055em' };

  const phraseTransition =
    beat === 'in'
      ? { duration: 1.2, ease: SMOOTH_EASE }
      : beat === 'hold'
        ? { duration: 1.5, ease: 'easeInOut' as const }
        : { duration: 0.9, ease: 'easeInOut' as const };

  const haloAnimate =
    beat === 'in'
      ? { opacity: 0.52, scale: 1.04 }
      : beat === 'hold'
        ? { opacity: 0.48, scale: 1.08 }
        : { opacity: 0, scale: 1.16 };

  return (
    <motion.div
      key="setup-whisper"
      role="status"
      aria-live="polite"
      className="relative flex flex-col items-center justify-center"
    >
      {/* Sparse, ultra-delicate GPU-composited starlight motes drifting upward */}
      {!reducedMotion && beat !== 'breath' && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 overflow-hidden"
        >
          {WHISPER_STARLIGHT_MOTES.map((mote) => (
            <motion.span
              key={mote.id}
              initial={{ opacity: 0, y: 12, scale: 0.7 }}
              animate={
                beat === 'out'
                  ? { opacity: 0, y: mote.driftY, scale: 0.65 }
                  : beat === 'hold'
                    ? { opacity: mote.peakOpacity * 0.8, y: mote.driftY * 0.65, scale: 0.96 }
                    : { opacity: mote.peakOpacity, y: mote.driftY * 0.28, scale: 1.04 }
              }
              transition={
                beat === 'in'
                  ? { duration: 1.2, delay: mote.delay * 0.6, ease: SMOOTH_EASE }
                  : beat === 'hold'
                    ? { duration: 1.5, ease: 'easeInOut' }
                    : { duration: 0.85, ease: 'easeInOut' }
              }
              style={{
                left: mote.left,
                top: mote.top,
                width: mote.size,
                height: mote.size,
                willChange: 'transform, opacity',
                backgroundColor: mote.roseTint ? '#fbcfe8' : '#fff7fb',
                boxShadow: mote.roseTint
                  ? '0 0 10px 2px rgba(244, 114, 182, 0.55)'
                  : '0 0 9px 2px rgba(255, 245, 252, 0.5)',
              }}
              className="absolute rounded-full"
            />
          ))}
        </div>
      )}

      {/* Soft ambient rose-pink halo breathing behind the whisper */}
      {beat !== 'breath' && (
        <motion.div
          aria-hidden="true"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={haloAnimate}
          transition={phraseTransition}
          style={{
            willChange: 'transform, opacity',
            background:
              'radial-gradient(circle, rgba(244, 114, 182, 0.24) 0%, rgba(192, 132, 252, 0.1) 45%, rgba(0, 0, 0, 0) 74%)',
          }}
          className="pointer-events-none absolute -inset-x-20 -inset-y-12 rounded-full blur-2xl"
        />
      )}

      {/* Three-beat solo choreography: 1.2s focus-in -> 1.5s calm drift -> 0.9s stardust dissolve */}
      {beat !== 'breath' && (
        <motion.p
          initial={
            reducedMotion
              ? { opacity: 0 }
              : {
                  opacity: 0,
                  filter: 'blur(10px)',
                  scale: 0.96,
                  y: 4,
                  letterSpacing: '0.1em',
                }
          }
          animate={phraseAnimate}
          transition={phraseTransition}
          onAnimationComplete={handleOutComplete}
          style={{
            willChange: 'transform, opacity, filter',
            textShadow: '0 0 28px rgba(244, 114, 182, 0.38)',
          }}
          className={`relative px-2 py-1 font-display text-2xl leading-relaxed font-normal italic sm:text-3xl ${
            reducedMotion ? 'text-pink-100/95' : 'whisper-shimmer-text'
          }`}
        >
          Đi cùng anh nhé...
        </motion.p>
      )}
    </motion.div>
  );
}

/**
 * Minimalist Pure-Black (#000000) Pre-Intro Setup Stage (`stage === 'setup'`).
 * Unlocks Fullscreen, AudioContext, and Screen WakeLock on real user gestures while
 * keeping the main soundtrack completely silent until holding the Intro crystal heart.
 */
export function SetupStage() {
  const setStage = useAppStore((s) => s.setStage);
  const setMuted = useAppStore((s) => s.setMuted);
  const reducedMotion = Boolean(useReducedMotion());
  const stepVariants = reducedMotion ? STEP_REDUCED_VARIANTS : STEP_TRANSITION_VARIANTS;

  const [phase, setPhase] = useState<SetupPhase>(1);
  const [checkedCount, setCheckedCount] = useState(0);
  const [isChimePlaying, setIsChimePlaying] = useState(false);

  const timersRef = useRef<number[]>([]);
  const chimeTimerRef = useRef<number | null>(null);
  const busyRef = useRef(false);

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
    if (chimeTimerRef.current !== null) {
      window.clearTimeout(chimeTimerRef.current);
      chimeTimerRef.current = null;
    }
  }, []);

  // Silently preload fonts & key images in the background while keeping main soundtrack silent
  useEffect(() => {
    if (typeof window === 'undefined') return;

    void document.fonts?.ready?.catch(() => {});

    const preloadUrls = [
      ANNIVERSARY_DATA.puzzle.imageUrl,
      ANNIVERSARY_DATA.secretSupernova.imageUrl,
      ...ANNIVERSARY_DATA.constellationMilestones.slice(0, 3).map((m) => m.image),
    ];
    for (const url of preloadUrls) {
      if (!url) continue;
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
    }

    return () => {
      clearAllTimers();
    };
  }, [clearAllTimers]);

  const triggerChimeTest = useCallback(() => {
    setMuted(false);
    musicEngine.setMuted(false);
    sfxEngine.unlock();
    sfxEngine.playSetupTestChime();

    setIsChimePlaying(true);
    if (chimeTimerRef.current !== null) {
      window.clearTimeout(chimeTimerRef.current);
    }
    chimeTimerRef.current = window.setTimeout(() => {
      chimeTimerRef.current = null;
      setIsChimePlaying(false);
    }, 2450);
  }, [setMuted]);

  // Step 1 -> Step 2: Request Fullscreen, unlock AudioContext, request WakeLock, play confirmation chime
  const handleStep1Confirm = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;

    setMuted(false);
    musicEngine.unlockAndPreload();
    sfxEngine.unlock();

    await Promise.all([tryEnterFullscreen(), acquireScreenWakeLock()]);
    sfxEngine.playStarSelect();

    setPhase(2);
    busyRef.current = false;
  }, [setMuted]);

  // Automatically play the warm celestial chime upon entering Step 2
  useEffect(() => {
    if (phase !== 2) return;
    const id = window.setTimeout(() => {
      triggerChimeTest();
    }, 180);
    timersRef.current.push(id);
    return () => {
      window.clearTimeout(id);
    };
  }, [phase, triggerChimeTest]);

  // Step 2 -> Step 3
  const handleStep2Confirm = useCallback(() => {
    if (busyRef.current) return;
    sfxEngine.playStarSelect();
    setPhase(3);
  }, []);

  // Step 3 -> Step 4
  const handleStep3Confirm = useCallback(() => {
    if (busyRef.current) return;
    sfxEngine.playStarSelect();
    setPhase(4);
  }, []);

  // Step 4 -> enter 'verifying' phase (checklist ticks & whisper run cleanly once the checklist mounts)
  const handleStep4Confirm = useCallback(() => {
    if (busyRef.current) return;
    busyRef.current = true;
    clearAllTimers();
    setCheckedCount(0);
    setPhase('verifying');
  }, [clearAllTimers]);

  // Run the calm 4-item sequential checklist (0.8s apart) -> 0.9s hold -> fade out cleanly -> solo whisper
  useEffect(() => {
    if (phase !== 'verifying') return;

    const localIds: number[] = [];
    for (let idx = 0; idx < 4; idx++) {
      const tickId = window.setTimeout(() => {
        setCheckedCount(idx + 1);
        sfxEngine.playSetupCheckTick(idx);
      }, CHECK_INITIAL_DELAY_MS + idx * CHECK_STEP_INTERVAL_MS);
      localIds.push(tickId);
    }

    const whisperId = window.setTimeout(() => {
      setPhase('whisper');
    }, CHECK_INITIAL_DELAY_MS + 3 * CHECK_STEP_INTERVAL_MS + CHECK_COMPLETE_HOLD_MS);
    localIds.push(whisperId);

    timersRef.current.push(...localIds);
    return () => {
      localIds.forEach((id) => window.clearTimeout(id));
    };
  }, [phase]);

  const handleWhisperComplete = useCallback(() => {
    setStage('intro');
  }, [setStage]);

  const checkItems = [
    'Không gian đã mở rộng trọn vẹn cho em',
    'Nhạc nền của tụi mình đã lên sẵn rồi nè',
    'Màn hình sáng rõ, chỉ chờ mỗi em thôi',
    'Mọi kỷ niệm đã xếp ngay ngắn chờ em mở',
  ];

  return (
    <motion.div
      key="pre-intro-setup-veil"
      role="dialog"
      aria-modal="true"
      aria-label="Nhắn nhỏ em trước khi bắt đầu"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, pointerEvents: 'none', transition: { duration: 1.1, ease: SMOOTH_EASE } }}
      style={{ willChange: 'opacity' }}
      className="pointer-events-auto fixed inset-0 z-40 flex flex-col items-center justify-center bg-[#000000] px-6 py-8 text-center sm:py-10"
    >
      {/* Centered Ultra-Minimal Sequential Prompt Area */}
      <div className="flex w-full max-w-[460px] flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          {phase === 1 && (
            <motion.div
              key="setup-step-1"
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              style={{ willChange: 'transform, opacity, filter' }}
              className="flex flex-col items-center"
            >
              <p className="font-sans text-[11px] font-medium tracking-[0.26em] text-pink-300/80 uppercase">
                ✦ NHẮN NHỎ EM XÍU · 1/4
              </p>

              <h2 className="mt-5 font-display text-xl leading-relaxed font-normal text-white/90 sm:text-2xl sm:leading-relaxed">
                Trước khi bắt đầu, em bấm vào đây để{' '}
                <span className="font-medium text-pink-200">mở rộng hết màn hình</span> cho ngắm
                bầu trời của tụi mình thật đã mắt nha?
              </h2>

              <button
                type="button"
                onClick={handleStep1Confirm}
                className="mt-8 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-pink-300/40 bg-white/[0.04] px-7 py-2.5 font-sans text-xs font-medium tracking-wide text-white shadow-[0_0_24px_rgba(244,114,182,0.16)] transition-all duration-200 hover:-translate-y-0.5 hover:border-pink-300/75 hover:bg-pink-500/15 hover:shadow-[0_0_28px_rgba(244,114,182,0.34)] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300/80 sm:text-[13px]"
              >
                Ừa, mở rộng ra nè
              </button>
            </motion.div>
          )}

          {phase === 2 && (
            <motion.div
              key="setup-step-2"
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              style={{ willChange: 'transform, opacity, filter' }}
              className="flex flex-col items-center"
            >
              <p className="font-sans text-[11px] font-medium tracking-[0.26em] text-pink-300/80 uppercase">
                ✦ CHỈNH NHẠC CHÚT NHA · 2/4
              </p>

              <h2 className="mt-5 font-display text-xl leading-relaxed font-normal text-white/90 sm:text-2xl sm:leading-relaxed">
                Em <span className="font-medium text-pink-200">đeo tai nghe</span> (nếu có) rồi
                vặn âm lượng lên khoảng{' '}
                <span className="font-sans font-medium text-pink-200 tabular-nums">70%</span> nha,
                anh chọn toàn mấy bài hợp với hai đứa lắm đó.
              </h2>

              {/* Delicate Animated Mini Soundwave Indicator + Replay Button */}
              <div className="mt-6 flex items-center gap-3.5">
                <span
                  aria-hidden="true"
                  className="flex h-5 items-center gap-[3px]"
                >
                  {SOUNDWAVE_BAR_DELAYS.map((delay, idx) => (
                    <span
                      key={idx}
                      className={`w-[2.5px] rounded-full bg-gradient-to-t from-pink-400 to-pink-100 transition-all duration-300 ${
                        isChimePlaying ? 'eq-bar-active h-4 opacity-95' : 'h-1.5 opacity-35'
                      }`}
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </span>

                <button
                  type="button"
                  onClick={triggerChimeTest}
                  className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.03] px-4 py-1.5 font-sans text-xs font-medium text-pink-200/90 transition-colors hover:border-pink-300/45 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300/75"
                >
                  <span>Nghe thử lại xíu</span>
                  <Music2 className="h-3.5 w-3.5 text-pink-300" strokeWidth={1.8} aria-hidden="true" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleStep2Confirm}
                className="mt-6 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-pink-300/40 bg-white/[0.04] px-7 py-2.5 font-sans text-xs font-medium tracking-wide text-white shadow-[0_0_24px_rgba(244,114,182,0.16)] transition-all duration-200 hover:-translate-y-0.5 hover:border-pink-300/75 hover:bg-pink-500/15 hover:shadow-[0_0_28px_rgba(244,114,182,0.34)] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300/80 sm:text-[13px]"
              >
                Em nghe rõ rồi nè
              </button>
            </motion.div>
          )}

          {phase === 3 && (
            <motion.div
              key="setup-step-3"
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              style={{ willChange: 'transform, opacity, filter' }}
              className="flex flex-col items-center"
            >
              <p className="font-sans text-[11px] font-medium tracking-[0.26em] text-pink-300/80 uppercase">
                ✦ EM SẴN SÀNG CHƯA? · 3/4
              </p>

              <h2 className="mt-5 font-display text-xl leading-relaxed font-normal text-white/90 sm:text-2xl sm:leading-relaxed">
                Em <span className="font-medium text-pink-200">tăng sáng màn hình</span> lên một
                chút rồi ngồi thật thoải mái nha. Em sẵn sàng bước vào thế giới của tụi mình chưa?
              </h2>

              <button
                type="button"
                onClick={handleStep3Confirm}
                className="mt-8 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-pink-300/40 bg-white/[0.04] px-7 py-2.5 font-sans text-xs font-medium tracking-wide text-white shadow-[0_0_24px_rgba(244,114,182,0.16)] transition-all duration-200 hover:-translate-y-0.5 hover:border-pink-300/75 hover:bg-pink-500/15 hover:shadow-[0_0_28px_rgba(244,114,182,0.34)] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300/80 sm:text-[13px]"
              >
                Em sẵn sàng rồi ♥
              </button>
            </motion.div>
          )}

          {phase === 4 && (
            <motion.div
              key="setup-step-4"
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              style={{ willChange: 'transform, opacity, filter' }}
              className="flex flex-col items-center"
            >
              <p className="font-sans text-[11px] font-medium tracking-[0.26em] text-pink-300/80 uppercase">
                ✦ DẶN DÒ EM XÍU · 4/4
              </p>

              <h2 className="mt-5 font-display text-xl leading-relaxed font-normal text-white/90 sm:text-2xl sm:leading-relaxed">
                Ở{' '}
                <span className="font-medium text-pink-200">
                  góc dưới chính giữa màn hình
                </span>{' '}
                anh có để sẵn hướng dẫn cho em, nếu em không biết bắt đầu từ đâu thì cứ đọc dưới đó
                và bấm hoặc bấm <span className="font-medium text-pink-200">chữ mở</span> nhé.
              </h2>

              <button
                type="button"
                onClick={handleStep4Confirm}
                className="mt-8 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-pink-300/50 bg-gradient-to-r from-pink-500/20 via-fuchsia-500/16 to-pink-500/20 px-7 py-2.5 font-sans text-xs font-medium tracking-wide text-white shadow-[0_0_26px_rgba(244,114,182,0.24)] transition-all duration-200 hover:-translate-y-0.5 hover:border-pink-200/80 hover:shadow-[0_0_32px_rgba(244,114,182,0.42)] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300/80 sm:text-[13px]"
              >
                Em nhớ rồi, vào thôi ♥
              </button>
            </motion.div>
          )}

          {phase === 'verifying' && (
            <motion.div
              key="setup-verifying"
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, filter: 'blur(4px)' }}
              animate={
                reducedMotion
                  ? { opacity: 1, transition: { duration: 0.4 } }
                  : { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.6, ease: SMOOTH_EASE } }
              }
              exit={
                reducedMotion
                  ? { opacity: 0, transition: { duration: 0.35 } }
                  : { opacity: 0, y: -6, filter: 'blur(4px)', transition: { duration: 0.65, ease: SMOOTH_EASE } }
              }
              style={{ willChange: 'transform, opacity, filter' }}
              className="w-full max-w-[360px] text-left"
              role="status"
              aria-live="polite"
            >
              <p className="mb-5 text-center font-sans text-[11px] font-medium tracking-[0.26em] text-pink-300/75 uppercase">
                ✦ CHỜ ANH XÍU NHA
              </p>

              <ul className="space-y-3.5">
                {checkItems.map((label, idx) => {
                  const done = checkedCount > idx;
                  return (
                    <motion.li
                      key={label}
                      initial={{ opacity: 0.22, x: -4 }}
                      animate={{ opacity: done ? 1 : 0.28, x: done ? 0 : -4 }}
                      transition={{ duration: 0.5, ease: SMOOTH_EASE }}
                      className="flex items-center gap-3 font-sans text-xs leading-relaxed text-white/95 sm:text-[13px]"
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-500 ${
                          done
                            ? 'border-pink-300/70 bg-pink-400/20 text-pink-200 shadow-[0_0_14px_rgba(244,114,182,0.52)]'
                            : 'border-white/15 bg-transparent text-transparent'
                        }`}
                      >
                        <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
                      </span>
                      <span>{label}</span>
                    </motion.li>
                  );
                })}
              </ul>
            </motion.div>
          )}

          {phase === 'whisper' && (
            <WhisperInterlude
              key="setup-whisper-interlude"
              reducedMotion={reducedMotion}
              onComplete={handleWhisperComplete}
            />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
