import { musicEngine } from '../utils/musicEngine';

/**
 * Backward-compatible bridge delegating to the Continuous Multi-Track Playlist Engine (`musicEngine`).
 */
export function sampleAudioBass(): number | null {
  return musicEngine.sampleBass();
}

export function startAmbientAudio(): void {
  musicEngine.startOnFirstGesture();
}

export function installAlwaysOnAmbientAudio(): () => void {
  return musicEngine.installPersistence();
}
