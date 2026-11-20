import { ANNIVERSARY_DATA } from '../data/anniversaryData';

let audioElement: HTMLAudioElement | null = null;
let hasStartedOnce = false;

function getAudioElement(): HTMLAudioElement | null {
  if (typeof window === 'undefined' || !ANNIVERSARY_DATA.audio.src) {
    return null;
  }

  if (!audioElement) {
    const el = new Audio(ANNIVERSARY_DATA.audio.src);
    el.loop = true;
    el.preload = 'none';
    el.volume = ANNIVERSARY_DATA.audio.defaultVolume;
    audioElement = el;
  }

  return audioElement;
}

/**
 * Starts ambient background audio from a user gesture to satisfy browser autoplay rules.
 * Never throws or logs unhandled promise rejections if blocked in restricted environments.
 */
export function startAmbientAudio(): void {
  const el = getAudioElement();
  if (!el) return;

  el.muted = false;
  el.volume = ANNIVERSARY_DATA.audio.defaultVolume;
  hasStartedOnce = true;

  if (el.paused) {
    void el.play().catch(() => {
      // Autoplay or headless audio backend unavailable — keep UI responsive with zero console noise
    });
  }
}

export function syncAudioMuted(isMuted: boolean): void {
  const el = getAudioElement();
  if (!el) return;

  el.muted = isMuted;

  if (isMuted) {
    if (!el.paused) {
      el.pause();
    }
    return;
  }

  hasStartedOnce = true;
  if (el.paused) {
    void el.play().catch(() => {
      // Ignore blocked playback gracefully
    });
  }
}

export function hasAudioStarted(): boolean {
  return hasStartedOnce;
}
