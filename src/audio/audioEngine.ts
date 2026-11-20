import { ANNIVERSARY_DATA } from '../data/anniversaryData';

let audioElement: HTMLAudioElement | null = null;

function getAudioElement(): HTMLAudioElement | null {
  if (typeof window === 'undefined' || !ANNIVERSARY_DATA.audio.src) {
    return null;
  }

  if (!audioElement) {
    const el = new Audio(ANNIVERSARY_DATA.audio.src);
    el.loop = true;
    el.preload = 'auto';
    el.muted = false;
    el.volume = ANNIVERSARY_DATA.audio.defaultVolume;
    audioElement = el;
  }

  return audioElement;
}

/**
 * Starts ambient background audio unmuted. Safe to call repeatedly across user gestures;
 * swallows browser autoplay rejections silently so zero console errors occur.
 */
export function startAmbientAudio(): void {
  const el = getAudioElement();
  if (!el) return;

  el.muted = false;
  el.volume = ANNIVERSARY_DATA.audio.defaultVolume;

  if (el.paused) {
    void el.play().catch(() => {
      // Browser autoplay policy requires a user gesture; listener will unlock on first tap/key
    });
  }
}

/**
 * Attempts immediate unmuted playback and guarantees playback begins on the first user interaction
 * if blocked by browser autoplay policies. Sound stays permanently enabled.
 */
export function installAlwaysOnAmbientAudio(): () => void {
  if (typeof window === 'undefined') return () => {};

  const el = getAudioElement();
  if (!el) return () => {};

  const cleanup = () => {
    window.removeEventListener('pointerdown', onFirstGesture);
    window.removeEventListener('keydown', onFirstGesture);
  };

  const tryPlay = () => {
    el.muted = false;
    el.volume = ANNIVERSARY_DATA.audio.defaultVolume;
    if (!el.paused) {
      cleanup();
      return;
    }
    void el
      .play()
      .then(() => {
        cleanup();
      })
      .catch(() => {
        // Keep gesture listeners attached until browser permits playback
      });
  };

  const onFirstGesture = () => {
    tryPlay();
  };

  window.addEventListener('pointerdown', onFirstGesture, { passive: true });
  window.addEventListener('keydown', onFirstGesture, { passive: true });
  tryPlay();

  return cleanup;
}
