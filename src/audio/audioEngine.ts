import { ANNIVERSARY_DATA } from '../data/anniversaryData';
import { useAppStore } from '../store/useAppStore';
import { sfxEngine } from '../utils/sfxEngine';

let audioElement: HTMLAudioElement | null = null;
let analyserNode: AnalyserNode | null = null;
let frequencyData: Uint8Array<ArrayBuffer> | null = null;
let analyserConnected = false;

function getAudioElement(): HTMLAudioElement | null {
  if (typeof window === 'undefined' || !ANNIVERSARY_DATA.audio.src) {
    return null;
  }

  if (!audioElement) {
    const el = new Audio();
    el.crossOrigin = 'anonymous';
    el.src = ANNIVERSARY_DATA.audio.src;
    el.loop = true;
    el.preload = 'auto';
    el.muted = false;
    el.volume = ANNIVERSARY_DATA.audio.defaultVolume;
    audioElement = el;
  }

  return audioElement;
}

/** Lazily connects the `<audio>` element to a single Web Audio `AnalyserNode` (`fftSize = 256`). */
function ensureAnalyserConnected(): void {
  if (analyserConnected || !audioElement) return;
  const ctx = sfxEngine.getContext();
  if (!ctx) return;

  try {
    const source = ctx.createMediaElementSource(audioElement);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.82;

    source.connect(analyser);
    analyser.connect(ctx.destination);

    analyserNode = analyser;
    frequencyData = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
    analyserConnected = true;
  } catch {
    // Gracefully fall back to procedural breathing wave if media element cannot bind
  }
}

/**
 * Samples the low-frequency (bass) band into a normalized [0..1] value with zero per-frame allocations.
 * Returns `null` when muted, paused, or analyser inactive so scenes fall back to procedural breathing.
 */
export function sampleAudioBass(): number | null {
  if (useAppStore.getState().isMuted) return null;
  if (!audioElement || audioElement.paused || audioElement.muted) return null;

  if (!analyserConnected) {
    ensureAnalyserConnected();
  }

  const ctx = sfxEngine.getContext();
  if (!analyserNode || !frequencyData || !ctx || ctx.state !== 'running') {
    return null;
  }

  analyserNode.getByteFrequencyData(frequencyData);

  // Average low-frequency bass bins (bins 1..10)
  let sum = 0;
  const startBin = 1;
  const endBin = Math.min(11, frequencyData.length);
  for (let i = startBin; i < endBin; i++) {
    sum += frequencyData[i];
  }

  const avg = sum / ((endBin - startBin) * 255);
  // If audio file outputs near-silence in headless mode, blend softly rather than flatlining
  return avg > 0.004 ? Math.min(1, avg * 1.85) : null;
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
  ensureAnalyserConnected();

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
    ensureAnalyserConnected();
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
