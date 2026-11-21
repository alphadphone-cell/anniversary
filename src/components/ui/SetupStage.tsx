import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Music2 } from 'lucide-react';
import { ANNIVERSARY_DATA } from '../../data/anniversaryData';
import { useAppStore } from '../../store/useAppStore';
import { musicEngine } from '../../utils/musicEngine';
import { sfxEngine } from '../../utils/sfxEngine';

type SetupPhase = 1 | 2 | 3 | 4 | 'verifying' | 'whisper';

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

const CHECK_STEP_INTERVAL_MS = 280;
const WHISPER_HOLD_MS = 650;
const SOUNDWAVE_BAR_DELAYS = [0, 140, 280, 180, 70];

/**
 * Minimalist Pure-Black (#000000) Pre-Intro Setup Stage (`stage === 'setup'`).
 * Unlocks Fullscreen, AudioContext, and Screen WakeLock on real user gestures while
 * keeping the main soundtrack completely silent until entering the existing Intro stage.
 */
export function SetupStage() {
  const setStage = useAppStore((s) => s.setStage);
  const setMuted = useAppStore((s) => s.setMuted);

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
    }, 1550);
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

  // Run the 4-item sequential verification (~1.4s) -> poetic whisper (~0.65s) -> smooth transition into Intro
  useEffect(() => {
    if (phase !== 'verifying') return;

    const localIds: number[] = [];
    for (let idx = 0; idx < 4; idx++) {
      const tickId = window.setTimeout(() => {
        setCheckedCount(idx + 1);
        sfxEngine.playSetupCheckTick(idx);
      }, 360 + idx * CHECK_STEP_INTERVAL_MS);
      localIds.push(tickId);
    }

    const whisperId = window.setTimeout(() => {
      setPhase('whisper');
    }, 360 + 3 * CHECK_STEP_INTERVAL_MS + 380);
    localIds.push(whisperId);

    timersRef.current.push(...localIds);
    return () => {
      localIds.forEach((id) => window.clearTimeout(id));
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'whisper') return;
    const finishId = window.setTimeout(() => {
      setStage('intro');
    }, WHISPER_HOLD_MS);
    timersRef.current.push(finishId);
    return () => {
      window.clearTimeout(finishId);
    };
  }, [phase, setStage]);

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
      exit={{ opacity: 0, pointerEvents: 'none', transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } }}
      style={{ willChange: 'opacity' }}
      className="pointer-events-auto fixed inset-0 z-40 flex flex-col items-center justify-center bg-[#000000] px-6 py-8 text-center sm:py-10"
    >
      {/* Centered Ultra-Minimal Sequential Prompt Area */}
      <div className="flex w-full max-w-[460px] flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          {phase === 1 && (
            <motion.div
              key="setup-step-1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
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
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
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
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
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
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
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
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-[360px] text-left"
              role="status"
              aria-live="polite"
            >
              <p className="mb-5 text-center font-sans text-[11px] font-medium tracking-[0.26em] text-pink-300/75 uppercase">
                ✦ CHỜ ANH XÍU NHA
              </p>

              <ul className="space-y-3">
                {checkItems.map((label, idx) => {
                  const done = checkedCount > idx;
                  return (
                    <motion.li
                      key={label}
                      initial={{ opacity: 0.25, x: -4 }}
                      animate={{ opacity: done ? 1 : 0.3, x: done ? 0 : -4 }}
                      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                      className="flex items-center gap-3 font-sans text-xs leading-relaxed text-white/90 sm:text-[13px]"
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-250 ${
                          done
                            ? 'border-pink-300/65 bg-pink-400/20 text-pink-200 shadow-[0_0_12px_rgba(244,114,182,0.45)]'
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
            <motion.div
              key="setup-whisper"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              role="status"
              aria-live="polite"
              className="flex flex-col items-center"
            >
              <p
                className="font-display text-2xl font-normal italic tracking-wide text-pink-100/95 sm:text-3xl"
                style={{ textShadow: '0 0 26px rgba(244, 114, 182, 0.42)' }}
              >
                Đi cùng anh nhé...
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
