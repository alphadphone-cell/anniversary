import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ANNIVERSARY_DATA } from '../../data/anniversaryData';
import { galaxySignals } from '../../canvas/galaxySignals';
import { useAppStore } from '../../store/useAppStore';
import { musicEngine } from '../../utils/musicEngine';
import { sfxEngine } from '../../utils/sfxEngine';

const HEART_PATH =
  'M60 98 C57 95 16 66 16 37 C16 21 28 11 42 11 C50 11 56 15 60 22 C64 15 70 11 78 11 C92 11 104 21 104 37 C104 66 63 95 60 98 Z';

// Slower, musical ~3.4s tactile charge with a smooth accelerating curve (lets piano intro breathe)
const BASE_CHARGE_PER_SEC = 21.5; // Starts calm & tactile
const ACCEL_CHARGE_BONUS = 17.5; // Accelerates smoothly toward 100% (~3.39s total)
const DECAY_RATE = 24;
const PEAK_LOCK_HOLD_MS = 250; // Crisp 250ms 100% peak glow beat before dissolving into Warp

const RING_RADIUS = 66;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** Minimalist 4-point celestial star accent (pure SVG, zero emoji). */
function FourPointStar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M8 0.5 C8.5 5.4 10.6 7.5 15.5 8 C10.6 8.5 8.5 10.6 8 15.5 C7.5 10.6 5.4 8.5 0.5 8 C5.4 7.5 7.5 5.4 8 0.5 Z" />
    </svg>
  );
}

export function IntroStage() {
  const [progress, setProgress] = useState(0);
  const [isCharging, setIsCharging] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isDissolving, setIsDissolving] = useState(false);

  const progressRef = useRef(0);
  const isHoldingRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const hasCompletedRef = useRef(false);
  const dissolveTimerRef = useRef<number | null>(null);
  const warpTimerRef = useRef<number | null>(null);

  const setStage = useAppStore((s) => s.setStage);

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
    activePointerIdRef.current = null;
    stopLoop();
    progressRef.current = 100;
    galaxySignals.introCharge = 1;
    setProgress(100);
    setIsCharging(false);
    setIsComplete(true);

    // Chime + sub-bass impact as progress ring locks at 360° (music keeps playing continuously!)
    sfxEngine.playChargeComplete();

    // Crisp 250ms peak glow hold -> smoothly dissolve glass & text outward -> ignite Warp portal
    dissolveTimerRef.current = window.setTimeout(() => {
      setIsDissolving(true);
    }, PEAK_LOCK_HOLD_MS);

    warpTimerRef.current = window.setTimeout(() => {
      setStage('warp');
    }, PEAK_LOCK_HOLD_MS + 220);
  }, [setStage, stopLoop]);

  const ensureLoopRunning = useCallback(() => {
    if (rafRef.current !== null || hasCompletedRef.current) return;

    const tick = (now: number) => {
      if (hasCompletedRef.current) {
        stopLoop();
        return;
      }

      const prev = lastTimeRef.current ?? now;
      // Allow up to 250ms per tick so charge stays wall-clock synced (~3.4s) to the piano intro even on low-FPS GPUs
      const dt = Math.min((now - prev) / 1000, 0.25);
      lastTimeRef.current = now;

      let next = progressRef.current;
      const u = next / 100;
      const currentRate = BASE_CHARGE_PER_SEC + ACCEL_CHARGE_BONUS * u;

      if (isHoldingRef.current) {
        next = Math.min(100, next + currentRate * dt);
      } else if (next > 0) {
        next = Math.max(0, next - DECAY_RATE * dt);
      }

      progressRef.current = next;
      galaxySignals.introCharge = next / 100;
      setProgress(next);

      if (isHoldingRef.current) {
        sfxEngine.updateChargeHum(next / 100);
      }

      if (next >= 100) {
        completeCharge();
        return;
      }

      if (!isHoldingRef.current && next <= 0) {
        galaxySignals.introCharge = 0;
        setIsCharging(false);
        sfxEngine.stopChargeHum();
        stopLoop();
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [completeCharge, stopLoop]);

  const handlePressStart = useCallback(
    (pointerId: number | null = null) => {
      if (hasCompletedRef.current || isHoldingRef.current) return;
      activePointerIdRef.current = pointerId;
      isHoldingRef.current = true;
      setIsCharging(true);
      sfxEngine.unlock();
      musicEngine.startIntroHoldPlayback();
      sfxEngine.startChargeHum();
      ensureLoopRunning();
    },
    [ensureLoopRunning]
  );

  const handlePressEnd = useCallback(
    (pointerId: number | null = null) => {
      if (hasCompletedRef.current) return;
      if (!isHoldingRef.current) return;
      if (pointerId !== null && activePointerIdRef.current !== null && pointerId !== activePointerIdRef.current) {
        return;
      }

      activePointerIdRef.current = null;
      isHoldingRef.current = false;
      setIsCharging(false);
      sfxEngine.stopChargeHum();
      // Released before completing heart unlock -> stop music & reset to 0:00 so next hold restarts from beginning
      musicEngine.stopAndResetIntroPlayback();
      ensureLoopRunning();
    },
    [ensureLoopRunning]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.repeat) return;
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        handlePressStart(null);
      }
    },
    [handlePressStart]
  );

  const handleKeyUp = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        handlePressEnd(null);
      }
    },
    [handlePressEnd]
  );

  // Global release/blur safety net so releasing outside the viewport or switching tabs always stops the hold & music
  useEffect(() => {
    const onWindowPointerUp = (e: PointerEvent) => {
      if (isHoldingRef.current) {
        handlePressEnd(e.pointerId);
      }
    };
    const onWindowBlur = () => {
      if (isHoldingRef.current) {
        handlePressEnd(null);
      }
    };

    window.addEventListener('pointerup', onWindowPointerUp);
    window.addEventListener('pointercancel', onWindowPointerUp);
    window.addEventListener('blur', onWindowBlur);

    return () => {
      window.removeEventListener('pointerup', onWindowPointerUp);
      window.removeEventListener('pointercancel', onWindowPointerUp);
      window.removeEventListener('blur', onWindowBlur);
      stopLoop();
      sfxEngine.stopChargeHum();
      if (!hasCompletedRef.current) {
        musicEngine.stopAndResetIntroPlayback();
      }
      galaxySignals.introCharge = 0;
      if (dissolveTimerRef.current !== null) window.clearTimeout(dissolveTimerRef.current);
      if (warpTimerRef.current !== null) window.clearTimeout(warpTimerRef.current);
    };
  }, [handlePressEnd, stopLoop]);

  const roundedPercent = Math.round(progress);
  const chargeRatio = progress / 100;
  const isActive = isCharging || isComplete;
  const dashOffset = RING_CIRCUMFERENCE * (1 - chargeRatio);

  // Exact SVG coordinates of the glowing leading tip dot along the circular progress ring
  const tipAngleRad = (chargeRatio * 360 - 90) * (Math.PI / 180);
  const tipX = 80 + Math.cos(tipAngleRad) * RING_RADIUS;
  const tipY = 80 + Math.sin(tipAngleRad) * RING_RADIUS;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 8 }}
      animate={{
        opacity: isDissolving ? 0 : 1,
        scale: isDissolving ? 1.07 : 1,
        y: 0,
      }}
      exit={{ opacity: 0, scale: 1.08 }}
      transition={{ duration: isDissolving ? 0.34 : 1.1, ease: [0.22, 1, 0.36, 1] }}
      style={{ willChange: 'transform, opacity' }}
      className="pointer-events-auto relative mx-auto w-[min(92vw,484px)]"
    >
      {/* Subtle Radial Aurora Backlight Behind the Celestial Invitation */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-10 -z-10 rounded-full blur-3xl transition-opacity duration-500"
        style={{
          opacity: 0.45 + chargeRatio * 0.55,
          background:
            'radial-gradient(circle at 50% 48%, rgba(255, 62, 165, 0.28) 0%, rgba(168, 85, 247, 0.2) 45%, rgba(5, 2, 10, 0) 72%)',
        }}
      />

      {/* Delicate 1px Rose-Pink -> Violet Hairline Gradient Border Wrapper */}
      <div className="relative rounded-[36px] bg-gradient-to-b from-pink-300/35 via-fuchsia-400/18 to-violet-400/25 p-[1px] shadow-[0_24px_80px_rgba(4,1,12,0.75),0_0_48px_rgba(255,62,165,0.12)]">
        {/* Top Axis Celestial 4-Point Star Accent */}
        <FourPointStar className="pointer-events-none absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 text-pink-200 drop-shadow-[0_0_10px_rgba(255,118,198,0.9)]" />
        {/* Bottom Axis Celestial 4-Point Star Accent */}
        <FourPointStar className="pointer-events-none absolute -bottom-2 left-1/2 h-3.5 w-3.5 -translate-x-1/2 text-violet-200/80 drop-shadow-[0_0_8px_rgba(192,132,252,0.85)]" />

        {/* Ethereal Obsidian-Glass Invitation Surface */}
        <div className="relative overflow-hidden rounded-[35px] bg-[#0b0416]/68 px-7 py-10 text-center backdrop-blur-2xl sm:px-10 sm:py-12">
          {/* Soft internal top specular sheen */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-pink-200/60 to-transparent"
          />

          {/* Wide-Tracked Eyebrow Label */}
          <motion.div
            animate={{ opacity: isDissolving ? 0 : 1, y: isDissolving ? -6 : 0 }}
            transition={{ duration: 0.26 }}
            className="flex items-center justify-center gap-2 font-sans text-[11px] leading-normal font-medium tracking-[0.28em] text-pink-200/75 uppercase"
          >
            <FourPointStar className="h-2.5 w-2.5 text-pink-300/80" />
            <span>Dành Riêng Cho Em</span>
            <FourPointStar className="h-2.5 w-2.5 text-pink-300/80" />
          </motion.div>

          {/* Elegant Lighter-Weight Playfair Display Title (Zero Diacritic Clipping) */}
          <motion.h1
            animate={{ opacity: isDissolving ? 0 : 1, y: isDissolving ? -8 : 0 }}
            transition={{ duration: 0.28 }}
            className="mt-3.5 bg-gradient-to-b from-[#fffbfd] via-[#fce7f3] to-[#f9a8d4] bg-clip-text py-1 font-display text-[34px] leading-[1.28] font-medium tracking-tight text-transparent sm:text-[42px]"
            style={{
              filter: 'drop-shadow(0 0 22px rgba(255, 118, 198, 0.32))',
            }}
          >
            {ANNIVERSARY_DATA.introHeadline}
          </motion.h1>

          {/* Interactive Luminous Crystal Heart + SVG Circular Progress Ring */}
          <div className="relative my-8 flex items-center justify-center">
            <div className="relative flex h-44 w-44 items-center justify-center select-none">
              {/* Concentric Breathing Ripple Rings (expanding gently outward) */}
              <motion.span
                aria-hidden="true"
                animate={{
                  scale: isComplete ? [1, 1.55] : [0.88, 1.24],
                  opacity: isComplete ? [0.65, 0] : [0.34 + chargeRatio * 0.28, 0],
                }}
                transition={{
                  duration: isComplete ? 0.55 : isActive ? 1.15 : 2.6,
                  repeat: isComplete ? 0 : Infinity,
                  ease: 'easeOut',
                }}
                className="pointer-events-none absolute inset-3 rounded-full border border-pink-300/45"
              />
              <motion.span
                aria-hidden="true"
                animate={{
                  scale: [0.82, 1.18],
                  opacity: [0.24 + chargeRatio * 0.22, 0],
                }}
                transition={{
                  duration: isActive ? 1.15 : 2.6,
                  delay: isActive ? 0.55 : 1.3,
                  repeat: isComplete ? 0 : Infinity,
                  ease: 'easeOut',
                }}
                className="pointer-events-none absolute inset-5 rounded-full border border-fuchsia-300/35"
              />

              {/* Soft Radial Heart Glow Aura (intensifies smoothly 0% -> 100%) */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-4 rounded-full blur-2xl transition-all duration-150"
                style={{
                  opacity: 0.3 + chargeRatio * 0.68,
                  transform: `scale(${0.86 + chargeRatio * 0.34})`,
                  background:
                    'radial-gradient(circle, rgba(255, 228, 245, 0.72) 0%, rgba(255, 62, 165, 0.58) 42%, rgba(168, 85, 247, 0.22) 72%, rgba(0, 0, 0, 0) 100%)',
                }}
              />

              {/* Sleek SVG Circular Progress Ring (0° -> 360°) + Glowing Tip Dot */}
              <svg
                viewBox="0 0 160 160"
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
              >
                <defs>
                  <linearGradient id="intro-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fff5fb" />
                    <stop offset="45%" stopColor="#f472b6" />
                    <stop offset="100%" stopColor="#d946ef" />
                  </linearGradient>
                  <filter id="intro-tip-glow" x="-80%" y="-80%" width="260%" height="260%">
                    <feGaussianBlur stdDeviation="3.2" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Hairline subtle orbital track */}
                <circle
                  cx="80"
                  cy="80"
                  r={RING_RADIUS}
                  fill="none"
                  stroke="rgba(255, 240, 250, 0.1)"
                  strokeWidth="1.5"
                />

                {/* Active Rose-Pink / Magenta Progress Arc */}
                <circle
                  cx="80"
                  cy="80"
                  r={RING_RADIUS}
                  fill="none"
                  stroke="url(#intro-ring-grad)"
                  strokeWidth={isComplete ? '3' : '2.4'}
                  strokeLinecap="round"
                  strokeDasharray={RING_CIRCUMFERENCE}
                  strokeDashoffset={dashOffset}
                  transform="rotate(-90 80 80)"
                  style={{
                    filter: 'drop-shadow(0 0 8px rgba(255, 62, 165, 0.75))',
                  }}
                />

                {/* Glowing Leading Tip Sparkle Dot */}
                {chargeRatio > 0.008 && (
                  <circle
                    cx={tipX}
                    cy={tipY}
                    r={isComplete ? 4.4 : 3.6}
                    fill="#fff9fe"
                    filter="url(#intro-tip-glow)"
                  />
                )}
              </svg>

              {/* Strict Heart-Shaped Interactive Trigger (left-click / touch inside heart silhouette only) */}
              <button
                type="button"
                onPointerDown={(e) => {
                  // Only primary left mouse button or touch/pen contact inside the heart shape
                  if (e.button !== 0) return;
                  e.preventDefault();
                  handlePressStart(e.pointerId);
                }}
                onPointerUp={(e) => {
                  if (e.button !== 0) return;
                  handlePressEnd(e.pointerId);
                }}
                onPointerLeave={(e) => {
                  if (isHoldingRef.current) handlePressEnd(e.pointerId);
                }}
                onPointerCancel={(e) => handlePressEnd(e.pointerId)}
                onContextMenu={(e) => e.preventDefault()}
                onKeyDown={handleKeyDown}
                onKeyUp={handleKeyUp}
                aria-label="Em chạm và giữ tay vào trái tim để mở cổng ngân hà nhé"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={roundedPercent}
                role="slider"
                className="pointer-events-none relative flex h-24 w-24 items-center justify-center rounded-full select-none touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-300/80 focus-visible:ring-offset-4 focus-visible:ring-offset-[#0b0416]"
              >
                {/* Multi-Layered Luminous Crystal Heart Centerpiece */}
                <motion.div
                  animate={
                    isDissolving
                      ? { scale: 0.18, opacity: 0 }
                      : isComplete
                        ? { scale: 1.16, opacity: 1 }
                        : isActive
                          ? { scale: 1 + chargeRatio * 0.1 + Math.sin(chargeRatio * 24) * 0.015 }
                          : { scale: [1, 1.045, 1] }
                  }
                  transition={
                    isDissolving
                      ? { duration: 0.28, ease: [0.4, 0, 1, 1] }
                      : isComplete
                        ? { duration: 0.22, ease: [0.16, 1, 0.3, 1] }
                        : isActive
                          ? { duration: 0.08 }
                          : { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }
                  }
                  style={{ willChange: 'transform, opacity' }}
                  className="pointer-events-none relative flex h-24 w-24 items-center justify-center"
                >
                  <svg
                    viewBox="0 0 120 112"
                    aria-hidden="true"
                    className="pointer-events-none h-20 w-20 overflow-visible sm:h-[86px] sm:w-[86px]"
                    style={{
                      filter: `drop-shadow(0 0 ${14 + chargeRatio * 24}px rgba(255, 62, 165, ${0.55 + chargeRatio * 0.4}))`,
                    }}
                  >
                    <defs>
                      {/* Rich inner crystal heart radial gradient */}
                      <radialGradient id="crystal-heart-core" cx="38%" cy="30%" r="72%">
                        <stop offset="0%" stopColor="#fff5fc" />
                        <stop offset="32%" stopColor="#ff7ac8" />
                        <stop offset="72%" stopColor="#ec4899" />
                        <stop offset="100%" stopColor="#86198f" />
                      </radialGradient>

                      {/* Frosted glass specular top-left highlight */}
                      <linearGradient id="crystal-heart-sheen" x1="15%" y1="5%" x2="75%" y2="85%">
                        <stop offset="0%" stopColor="rgba(255, 255, 255, 0.72)" />
                        <stop offset="38%" stopColor="rgba(255, 228, 245, 0.22)" />
                        <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
                      </linearGradient>

                      {/* Soft seamless radial inner bloom inside crystal heart */}
                      <radialGradient id="crystal-inner-bloom" cx="50%" cy="46%" r="50%">
                        <stop offset="0%" stopColor="#fff9fe" stopOpacity="0.85" />
                        <stop offset="55%" stopColor="#ffb6e3" stopOpacity="0.28" />
                        <stop offset="100%" stopColor="#ff3ea5" stopOpacity="0" />
                      </radialGradient>

                      <clipPath id="crystal-heart-clip">
                        <path d={HEART_PATH} />
                      </clipPath>
                    </defs>

                    {/* Base Translucent Crystal Shell */}
                    <path
                      d={HEART_PATH}
                      fill="rgba(255, 62, 165, 0.16)"
                      stroke="rgba(255, 198, 232, 0.58)"
                      strokeWidth="1.8"
                    />

                    {/* Liquid Starlight Fill Rising Smoothly Inside the Crystal Heart */}
                    <g clipPath="url(#crystal-heart-clip)">
                      <rect
                        x="0"
                        y={104 - (18 + chargeRatio * 94)}
                        width="120"
                        height="112"
                        fill="url(#crystal-heart-core)"
                        opacity={0.42 + chargeRatio * 0.58}
                      />
                      {/* Seamless Luminous Inner Core Bloom */}
                      <circle
                        cx="60"
                        cy="48"
                        r={28 + chargeRatio * 34}
                        fill="url(#crystal-inner-bloom)"
                        opacity={0.42 + chargeRatio * 0.55}
                      />
                    </g>

                    {/* Frosted Specular Crescent Highlight */}
                    <path
                      d={HEART_PATH}
                      fill="url(#crystal-heart-sheen)"
                      stroke="rgba(255, 244, 252, 0.72)"
                      strokeWidth="1.15"
                    />

                    {/* Exact Vector Heart Hit-Target Surface */}
                    <path
                      d={HEART_PATH}
                      fill="transparent"
                      className="pointer-events-auto cursor-pointer touch-none"
                    />
                  </svg>
                </motion.div>
              </button>
            </div>
          </div>

          {/* Crisp Status Text & Subtle Percentage Readout Underneath */}
          <motion.div
            animate={{ opacity: isDissolving ? 0 : 1, y: isDissolving ? 6 : 0 }}
            transition={{ duration: 0.24 }}
            className="flex min-h-[44px] flex-col items-center justify-center gap-1.5"
          >
            {isComplete ? (
              <p className="inline-flex items-center gap-2 font-sans text-xs leading-normal font-medium tracking-wide text-pink-100 sm:text-[13px]">
                <span>Cổng ngân hà mở rồi, đi thôi em</span>
                <FourPointStar className="h-3 w-3 text-pink-200" />
              </p>
            ) : isActive || roundedPercent > 0 ? (
              <div className="flex flex-wrap items-center justify-center gap-2 font-sans text-xs leading-normal text-pink-100/90 sm:text-[13px]">
                <span>
                  {roundedPercent <= 45
                    ? 'Giữ thêm chút nữa nha em...'
                    : 'Sắp mở ra rồi nè, đừng thả tay nha...'}
                </span>
                <span className="rounded-full border border-pink-300/35 bg-pink-500/18 px-2 py-0.5 font-mono text-[11px] font-medium text-starlight tabular-nums">
                  {roundedPercent}%
                </span>
              </div>
            ) : (
              <p className="font-sans text-xs leading-relaxed text-lavender sm:text-[13px]">
                Em chạm và giữ tay vào trái tim này một xíu nha...
              </p>
            )}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
