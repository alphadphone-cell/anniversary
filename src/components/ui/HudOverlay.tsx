import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  useCurrentTrackIndex,
  useIsMusicPlaying,
  useIsMuted,
  useIsSupernovaTrackActive,
  useIsTransitionFlashing,
  useStage,
  useSupernovaFlashKey,
} from '../../store/useAppStore';
import { ANNIVERSARY_DATA } from '../../data/anniversaryData';
import { installAlwaysOnAmbientAudio } from '../../audio/audioEngine';
import { sfxEngine } from '../../utils/sfxEngine';
import { SetupStage } from './SetupStage';
import { IntroStage } from './IntroStage';
import { ModalShell } from './ModalShell';
import { ConstellationCard } from './ConstellationCard';
import { JourneyGuidePill } from './JourneyGuidePill';

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

/** Passive, read-only "Now Playing" status badge (no play/skip buttons) that reflects Deck A vs Supernova Deck B. */
function NowPlayingBadge() {
  const isMuted = useIsMuted();
  const isPlaying = useIsMusicPlaying();
  const trackIndex = useCurrentTrackIndex();
  const isSupernovaTrack = useIsSupernovaTrackActive();

  const playlist = ANNIVERSARY_DATA.playlist;
  const activeDeckATrack = playlist[trackIndex % Math.max(1, playlist.length)] ?? {
    id: 'default',
    title: ANNIVERSARY_DATA.audio.trackTitle,
    artist: ANNIVERSARY_DATA.audio.artist,
    src: ANNIVERSARY_DATA.audio.src,
  };

  const displayTitle = isSupernovaTrack
    ? ANNIVERSARY_DATA.supernovaFinaleTrack.title
    : activeDeckATrack.title;
  const displayArtist = isSupernovaTrack
    ? ANNIVERSARY_DATA.supernovaFinaleTrack.artist
    : activeDeckATrack.artist;
  const activeBars = isPlaying && !isMuted;

  return (
    <motion.div
      key="now-playing-badge"
      role="status"
      aria-live="polite"
      aria-label={`Đang phát: ${displayTitle}`}
      title={`${displayTitle} — ${displayArtist}`}
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.65, delay: 0.85, ease: [0.22, 1, 0.36, 1] }}
      className={`glass-surface hidden h-11 items-center gap-2 rounded-full px-3.5 md:inline-flex ${
        isSupernovaTrack ? 'border-pink-300/45 shadow-[0_0_20px_rgba(255,95,180,0.34)]' : ''
      }`}
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

      <span className="max-w-[168px] truncate text-xs leading-normal font-medium text-starlight">
        {displayTitle}
      </span>
    </motion.div>
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

        <div className="flex items-center gap-2">
          <AnimatePresence>{stage === 'galaxy' && <NowPlayingBadge />}</AnimatePresence>
        </div>
      </header>

      {/* Center Stage Overlay (Stage 1 Intro Card) */}
      <div className="pointer-events-none flex flex-1 items-center justify-center">
        <AnimatePresence mode="wait">
          {stage === 'intro' && <IntroStage key="intro" />}
        </AnimatePresence>
      </div>

      <JourneyGuidePill />
      <ConstellationCard />
      <ModalShell />
      <WarpFlashOverlay />
      <SupernovaImpactOverlay />

      {/* Pure Obsidian-Black Pre-Intro Setup Veil (fades out smoothly over 800ms into IntroStage) */}
      <AnimatePresence>{stage === 'setup' && <SetupStage key="setup" />}</AnimatePresence>
    </div>
  );
}
