import { useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Orbit, SkipForward, Sparkles, Volume2, VolumeX } from 'lucide-react';
import {
  useAppStore,
  useCurrentTrackIndex,
  useIsMusicPlaying,
  useIsMuted,
  useIsTransitionFlashing,
  useStage,
  useSupernovaFlashKey,
  useViewMode,
  type ViewMode,
} from '../../store/useAppStore';
import { ANNIVERSARY_DATA } from '../../data/anniversaryData';
import { installAlwaysOnAmbientAudio } from '../../audio/audioEngine';
import { musicEngine } from '../../utils/musicEngine';
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

/**
 * Grand Finale Supernova Whiteout Splash + Lightweight Chromatic Radial Lens Kick (`z-30`).
 * Exact envelope: 0 -> 0.95 in 40ms, hold peak 80ms, smooth decay over 650ms (total 770ms) with mix-blend-mode: screen.
 */
function SupernovaImpactOverlay() {
  const flashKey = useSupernovaFlashKey();
  if (flashKey === 0) return null;

  return (
    <div key={flashKey} aria-hidden="true" className="pointer-events-none fixed inset-0 z-30">
      {/* Primary pure-white -> soft rose-pink radial whiteout flash */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.95, 0.95, 0] }}
        transition={{
          duration: 0.77,
          times: [0, 0.052, 0.156, 1],
          ease: ['easeOut', 'linear', [0.16, 1, 0.3, 1]],
        }}
        className="absolute inset-0"
        style={{
          mixBlendMode: 'screen',
          background:
            'radial-gradient(circle at 50% 42%, rgba(255, 255, 255, 1) 0%, rgba(255, 240, 249, 0.96) 28%, rgba(255, 118, 198, 0.76) 58%, rgba(253, 212, 148, 0.38) 82%, rgba(18, 6, 30, 0) 100%)',
        }}
      />

      {/* Anime-style 160ms radial chromatic lens kick */}
      <motion.div
        initial={{ opacity: 0, scale: 0.86 }}
        animate={{ opacity: [0, 0.78, 0], scale: [0.86, 1.16, 1.38] }}
        transition={{
          duration: 0.22,
          times: [0, 0.28, 1],
          ease: [0.16, 1, 0.3, 1],
        }}
        className="absolute inset-0"
        style={{
          mixBlendMode: 'screen',
          background:
            'radial-gradient(circle at 50% 42%, rgba(255, 255, 255, 0) 18%, rgba(254, 240, 138, 0.45) 36%, rgba(255, 62, 165, 0.52) 48%, rgba(125, 211, 252, 0.32) 58%, rgba(0, 0, 0, 0) 74%)',
        }}
      />
    </div>
  );
}

/** Minimal glassmorphism "Now Playing" HUD pill with animated equalizer bars, title, Mute/Unmute, and Next Track. */
function NowPlayingPill() {
  const isMuted = useIsMuted();
  const isPlaying = useIsMusicPlaying();
  const trackIndex = useCurrentTrackIndex();

  const playlist = ANNIVERSARY_DATA.playlist;
  const currentTrack = playlist[trackIndex % Math.max(1, playlist.length)] ?? {
    id: 'default',
    title: ANNIVERSARY_DATA.audio.trackTitle,
    artist: ANNIVERSARY_DATA.audio.artist,
    src: ANNIVERSARY_DATA.audio.src,
  };

  const activeBars = isPlaying && !isMuted;

  const handleToggleMute = useCallback(() => {
    musicEngine.toggleMuted();
  }, []);

  const handleNextTrack = useCallback(() => {
    sfxEngine.playHoverTick();
    musicEngine.nextTrack();
  }, []);

  return (
    <motion.div
      key="now-playing-pill"
      role="region"
      aria-label="Trình phát nhạc nền"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.65, delay: 0.85, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-auto glass-surface inline-flex max-w-full items-center gap-1 rounded-full p-1"
    >
      {/* Mute / Unmute Button + Mini Equalizer */}
      <button
        type="button"
        onClick={handleToggleMute}
        onMouseEnter={() => sfxEngine.playHoverTick()}
        aria-pressed={isMuted}
        aria-label={isMuted ? 'Bật nhạc nền' : 'Tắt nhạc nền'}
        className={`glass-interactive flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full px-2.5 ${
          isMuted
            ? 'border border-transparent text-lavender-muted hover:text-starlight'
            : 'glass-active text-starlight'
        }`}
      >
        {isMuted ? (
          <VolumeX className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <Volume2 className="h-4 w-4 shrink-0 text-neon-pink" strokeWidth={1.75} aria-hidden="true" />
        )}
      </button>

      {/* Animated Equalizer Bars + Song Title */}
      <div
        className="hidden items-center gap-2 px-1.5 md:flex"
        title={`${currentTrack.title} — ${currentTrack.artist}`}
      >
        <span className="flex h-3.5 items-end gap-[2.5px]" aria-hidden="true">
          <span
            className={`w-[2.5px] rounded-full bg-neon-pink transition-all duration-300 ${
              activeBars ? 'eq-bar-active h-3.5' : 'h-1 opacity-45'
            }`}
            style={{ animationDelay: '0ms' }}
          />
          <span
            className={`w-[2.5px] rounded-full bg-neon-magenta transition-all duration-300 ${
              activeBars ? 'eq-bar-active h-3.5' : 'h-1.5 opacity-45'
            }`}
            style={{ animationDelay: '220ms' }}
          />
          <span
            className={`w-[2.5px] rounded-full bg-starlight transition-all duration-300 ${
              activeBars ? 'eq-bar-active h-3' : 'h-1 opacity-45'
            }`}
            style={{ animationDelay: '440ms' }}
          />
        </span>

        <span className="max-w-[144px] truncate text-xs leading-normal font-medium text-starlight">
          {currentTrack.title}
        </span>
      </div>

      {/* Subtle Next Track Button */}
      <button
        type="button"
        onClick={handleNextTrack}
        onMouseEnter={() => sfxEngine.playHoverTick()}
        aria-label="Chuyển bài tiếp theo"
        title="Chuyển bài tiếp theo"
        className="glass-interactive flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full border border-transparent text-lavender hover:text-starlight"
      >
        <SkipForward className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      </button>
    </motion.div>
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
      aria-label="Chế độ góc nhìn bầu trời"
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
        aria-label="Góc nhìn Ngân Hà"
        className={`glass-interactive flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 text-xs leading-normal font-medium sm:px-3.5 ${
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
        <span className="hidden sm:inline">Ngân Hà</span>
      </button>

      <button
        type="button"
        onClick={() => handleSelect('constellation')}
        onMouseEnter={() => sfxEngine.playHoverTick()}
        aria-pressed={viewMode === 'constellation'}
        aria-label="Góc nhìn Chòm Sao"
        className={`glass-interactive flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 text-xs leading-normal font-medium sm:px-3.5 ${
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
        <span className="hidden sm:inline">Chòm Sao</span>
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
      {/* Top Bar — staggered reveal ~0.8s after Galaxy blooms; dims during Supernova build-up */}
      <header
        className="flex items-start justify-between gap-3 transition-opacity duration-150"
        style={{ opacity: 'calc(1 - var(--supernova-hud-dim, 0) * 0.88)' }}
      >
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
                <h1 className="font-display text-lg leading-snug font-semibold tracking-tight text-starlight sm:text-xl">
                  {ANNIVERSARY_DATA.experienceTitle}
                </h1>
              </div>
              <p className="mt-1 text-xs leading-normal text-lavender">
                {ANNIVERSARY_DATA.coupleNames[0]} &amp; {ANNIVERSARY_DATA.coupleNames[1]} ·{' '}
                <span className="tabular-nums">{ANNIVERSARY_DATA.anniversaryOrdinal}</span>
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-2">
          <AnimatePresence>{stage === 'galaxy' && <NowPlayingPill />}</AnimatePresence>
          <AnimatePresence>{stage === 'galaxy' && <ViewModeToggle />}</AnimatePresence>
        </div>
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
      <SupernovaImpactOverlay />
    </div>
  );
}
