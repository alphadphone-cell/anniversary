import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ANNIVERSARY_DATA } from '../../data/anniversaryData';
import { useAppStore } from '../../store/useAppStore';
import { startAmbientAudio } from '../../audio/audioEngine';

const HEART_PATH =
  'M60 98 C57 95 16 66 16 37 C16 21 28 11 42 11 C50 11 56 15 60 22 C64 15 70 11 78 11 C92 11 104 21 104 37 C104 66 63 95 60 98 Z';

const HOLD_CHARGE_RATE = 74; // % per second while held (~1.35s)
const AUTO_CHARGE_RATE = 78; // % per second after a deliberate click (~1.28s)
const DECAY_RATE = 26; // gentle ease-back if long-hold released early

export function IntroStage() {
  const [progress, setProgress] = useState(0);
  const [isCharging, setIsCharging] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const progressRef = useRef(0);
  const isHoldingRef = useRef(false);
  const autoChargingRef = useRef(false);
  const pressStartRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const hasCompletedRef = useRef(false);
  const transitionTimerRef = useRef<number | null>(null);

  const setStage = useAppStore((s) => s.setStage);
  const setMuted = useAppStore((s) => s.setMuted);

  const triggerAudioOnGesture = useCallback(() => {
    startAmbientAudio();
    setMuted(false);
  }, [setMuted]);

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastTimeRef.current = null;
  }, []);

  const completeCharge = useCallback(() => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;
    isHoldingRef.current = false;
    autoChargingRef.current = false;
    stopLoop();
    progressRef.current = 100;
    setProgress(100);
    setIsCharging(false);
    setIsComplete(true);

    // Brief radiant beat at 100% before fading Intro out into Warp Speed
    transitionTimerRef.current = window.setTimeout(() => {
      setStage('warp');
    }, 260);
  }, [setStage, stopLoop]);

  const ensureLoopRunning = useCallback(() => {
    if (rafRef.current !== null || hasCompletedRef.current) return;

    const tick = (now: number) => {
      if (hasCompletedRef.current) {
        stopLoop();
        return;
      }

      const prev = lastTimeRef.current ?? now;
      const dt = Math.min((now - prev) / 1000, 0.05);
      lastTimeRef.current = now;

      let next = progressRef.current;

      if (isHoldingRef.current) {
        next = Math.min(100, next + HOLD_CHARGE_RATE * dt);
      } else if (autoChargingRef.current) {
        next = Math.min(100, next + AUTO_CHARGE_RATE * dt);
      } else if (next > 0) {
        next = Math.max(0, next - DECAY_RATE * dt);
      }

      progressRef.current = next;
      setProgress(next);

      if (next >= 100) {
        completeCharge();
        return;
      }

      if (!isHoldingRef.current && !autoChargingRef.current && next <= 0) {
        setIsCharging(false);
        stopLoop();
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [completeCharge, stopLoop]);

  const handlePressStart = useCallback(() => {
    if (hasCompletedRef.current) return;
    triggerAudioOnGesture();
    pressStartRef.current = performance.now();
    isHoldingRef.current = true;
    setIsCharging(true);
    ensureLoopRunning();
  }, [ensureLoopRunning, triggerAudioOnGesture]);

  const handlePressEnd = useCallback(
    (canceled = false) => {
      if (hasCompletedRef.current) return;
      if (!isHoldingRef.current) return;

      const heldMs = performance.now() - pressStartRef.current;
      isHoldingRef.current = false;

      // Support both holding AND clicking: a crisp click/tap latches smooth auto-charge to 100%
      if (!canceled && heldMs < 260) {
        autoChargingRef.current = true;
        setIsCharging(true);
      } else if (!autoChargingRef.current) {
        setIsCharging(false);
      }

      ensureLoopRunning();
    },
    [ensureLoopRunning]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.repeat) return;
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        handlePressStart();
      }
    },
    [handlePressStart]
  );

  const handleKeyUp = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        handlePressEnd(false);
      }
    },
    [handlePressEnd]
  );

  useEffect(() => {
    return () => {
      stopLoop();
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
      }
    };
  }, [stopLoop]);

  const roundedPercent = Math.round(progress);
  const chargeRatio = progress / 100;
  const isActive = isCharging || isComplete;

  return (
    <motion.div
      key="intro-stage"
      initial={{ opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
      transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-auto relative flex w-full max-w-[560px] flex-col items-center justify-center px-2"
    >
      {/* Ambient nebula radial backing */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-8 rounded-[44px] opacity-70 blur-3xl"
        style={{
          background:
            'radial-gradient(ellipse at 50% 45%, rgba(217, 70, 239, 0.24), rgba(139, 92, 246, 0.12) 48%, transparent 74%)',
        }}
      />

      <section
        aria-label="Anniversary welcome"
        className="relative flex w-full flex-col items-center rounded-[28px] px-6 py-10 text-center sm:px-12 sm:py-12"
        style={{
          background:
            'linear-gradient(155deg, rgba(24, 11, 44, 0.78) 0%, rgba(12, 5, 24, 0.84) 55%, rgba(20, 8, 36, 0.78) 100%)',
          backdropFilter: 'blur(22px) saturate(150%)',
          WebkitBackdropFilter: 'blur(22px) saturate(150%)',
          border: `1px solid ${
            isActive ? 'rgba(255, 62, 165, 0.56)' : 'rgba(217, 70, 239, 0.32)'
          }`,
          boxShadow: isActive
            ? 'inset 0 1px 0 rgba(255, 255, 255, 0.16), 0 28px 72px -20px rgba(3, 1, 10, 0.94), 0 12px 44px -10px rgba(255, 62, 165, 0.34)'
            : 'inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 28px 64px -20px rgba(3, 1, 10, 0.92), 0 10px 36px -14px rgba(139, 92, 246, 0.28)',
          transition: 'border-color 260ms ease, box-shadow 300ms ease',
        }}
      >
        <h1
          className="font-sans text-3xl font-bold tracking-[-0.025em] text-starlight sm:text-5xl"
          style={{
            textShadow:
              '0 0 26px rgba(224, 200, 255, 0.38), 0 2px 12px rgba(217, 70, 239, 0.28)',
          }}
        >
          {ANNIVERSARY_DATA.introHeadline}
        </h1>

        {/* Interactive Glowing Heart Charge Button */}
        <div className="relative mt-8 mb-7 flex items-center justify-center sm:mt-9 sm:mb-8">
          {/* Dynamic charge aura behind heart */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute h-36 w-36 rounded-full blur-2xl transition-opacity duration-200"
            style={{
              background:
                'radial-gradient(circle, rgba(255, 62, 165, 0.55) 0%, rgba(217, 70, 239, 0.24) 55%, transparent 75%)',
              opacity: 0.25 + chargeRatio * 0.75,
              transform: `scale(${0.92 + chargeRatio * 0.32})`,
            }}
          />

          <motion.button
            type="button"
            onPointerDown={handlePressStart}
            onPointerUp={() => handlePressEnd(false)}
            onPointerLeave={() => {
              if (isHoldingRef.current) handlePressEnd(true);
            }}
            onPointerCancel={() => handlePressEnd(true)}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            aria-label={
              isComplete
                ? 'Love charged, launching warp transition'
                : 'Hold or click heart to charge love'
            }
            className="group relative flex h-36 w-36 cursor-pointer touch-none select-none items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neon-pink"
          >
            <svg
              viewBox="0 0 120 112"
              className="h-32 w-32 overflow-visible"
              aria-hidden="true"
            >
              <defs>
                <filter id="anni-heart-glow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="3.2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <linearGradient id="anni-heart-stroke" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ff3ea5" />
                  <stop offset="55%" stopColor="#f43f97" />
                  <stop offset="100%" stopColor="#d946ef" />
                </linearGradient>
                <radialGradient id="anni-heart-fill" cx="50%" cy="45%" r="60%">
                  <stop offset="0%" stopColor="rgba(255, 62, 165, 0.22)" />
                  <stop offset="100%" stopColor="rgba(139, 92, 246, 0.08)" />
                </radialGradient>
              </defs>

              {/* Subtle translucent inner heart well */}
              <path
                d={HEART_PATH}
                fill="url(#anni-heart-fill)"
                stroke="rgba(168, 85, 247, 0.42)"
                strokeWidth="4.5"
                strokeLinejoin="round"
              />

              {/* Animated neon pink heart perimeter charge ring */}
              <path
                d={HEART_PATH}
                fill="none"
                stroke="url(#anni-heart-stroke)"
                strokeWidth="5.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={100}
                strokeDasharray={100}
                strokeDashoffset={100 - progress}
                filter="url(#anni-heart-glow)"
                style={{
                  opacity: progress > 0.5 ? 1 : 0,
                  transition: 'opacity 140ms ease',
                }}
              />
            </svg>

            {/* Pulsing inner core heart */}
            <motion.span
              aria-hidden="true"
              className="pointer-events-none absolute flex items-center justify-center"
              animate={
                isComplete
                  ? { scale: [1.18, 1.35], opacity: [1, 1] }
                  : isCharging
                    ? { scale: [1.05, 1.2, 1.08], opacity: 1 }
                    : { scale: [1, 1.09, 1, 1.05, 1], opacity: 0.92 }
              }
              transition={
                isComplete
                  ? { duration: 0.24, ease: [0.22, 1, 0.36, 1] }
                  : isCharging
                    ? { duration: 0.52, repeat: Infinity, ease: 'easeInOut' }
                    : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }
              }
            >
              <svg viewBox="0 0 120 112" className="h-9 w-9 overflow-visible">
                <path
                  d={HEART_PATH}
                  fill="#ff3ea5"
                  style={{
                    filter: `drop-shadow(0 0 ${8 + chargeRatio * 14}px rgba(255, 62, 165, 0.88))`,
                  }}
                />
              </svg>
            </motion.span>
          </motion.button>
        </div>

        {/* Status Readout & Accessible Progressbar */}
        <div
          role="progressbar"
          aria-label="Love charge progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={roundedPercent}
          className="flex flex-col items-center gap-1.5"
        >
          <p className="font-mono text-xs font-medium tracking-[0.28em] text-lavender uppercase sm:text-[13px]">
            {isComplete
              ? 'LOVE CHARGED'
              : ANNIVERSARY_DATA.introStatusLabel}
            {progress > 0 && !isComplete && (
              <span className="ml-2 text-neon-pink tabular-nums">{roundedPercent}%</span>
            )}
          </p>
          <p className="text-xs text-lavender-muted">
            {isComplete
              ? 'Entering hyperspace...'
              : isCharging
                ? 'Keep holding to ignite the portal'
                : 'Hold or click the heart to begin'}
          </p>
        </div>
      </section>
    </motion.div>
  );
}
