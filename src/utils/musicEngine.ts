import { ANNIVERSARY_DATA, type PlaylistTrack } from '../data/anniversaryData';
import { useAppStore } from '../store/useAppStore';
import { sfxEngine } from './sfxEngine';

interface Deck {
  audio: HTMLAudioElement;
  source: MediaElementAudioSourceNode | null;
  gain: GainNode | null;
}

interface ProceduralTrackSong {
  /** Tempo step duration in ms (eighth-note gentle ballad pulse) */
  stepMs: number;
  /** 4-bar romantic K-Drama chord progression (root bass + warm strings voicing in Hz) */
  chords: { bass: number; pad: number[]; arp: number[]; melody: (number | null)[] }[];
}

const FADE_IN_SEC = 1.5;
const CROSSFADE_SEC = 0.9;
const SUPERNOVA_DUCK_FACTOR = 0.65; // Gently duck volume by ~35% during pinpoint silence

/**
 * 3 distinct, emotional K-Drama OST piano + warm strings compositions used seamlessly
 * whenever local `.mp3` files have not been dropped into `public/music/` yet.
 */
const FALLBACK_SONGS: ProceduralTrackSong[] = [
  // Track 1: "Dưới Bầu Trời Sao Đêm" — Warm D Major Ballad (Dmaj9 -> A/C# -> Bm7 -> Gmaj7)
  {
    stepMs: 420,
    chords: [
      {
        bass: 73.42, // D2
        pad: [146.83, 220.0, 277.18, 369.99],
        arp: [293.66, 369.99, 440.0, 554.37, 587.33, 440.0, 369.99, 554.37],
        melody: [739.99, null, 659.25, 587.33, 659.25, null, 440.0, null],
      },
      {
        bass: 69.3, // C#2
        pad: [138.59, 220.0, 277.18, 329.63],
        arp: [277.18, 329.63, 440.0, 554.37, 659.25, 440.0, 329.63, 440.0],
        melody: [659.25, null, 554.37, 659.25, 739.99, null, 554.37, null],
      },
      {
        bass: 61.74, // B1
        pad: [123.47, 185.0, 220.0, 293.66],
        arp: [246.94, 293.66, 369.99, 440.0, 587.33, 440.0, 369.99, 293.66],
        melody: [587.33, null, 659.25, 739.99, 880.0, null, 739.99, 659.25],
      },
      {
        bass: 98.0, // G2
        pad: [146.83, 196.0, 246.94, 369.99],
        arp: [196.0, 293.66, 369.99, 493.88, 587.33, 493.88, 369.99, 293.66],
        melody: [739.99, null, 659.25, 587.33, 493.88, null, 587.33, null],
      },
    ],
  },
  // Track 2: "Giai Điệu Mùa Thu Bên Em" — Nostalgic F Major Waltz (Fmaj7 -> C/E -> Dm9 -> Bbmaj7)
  {
    stepMs: 440,
    chords: [
      {
        bass: 87.31, // F2
        pad: [174.61, 220.0, 261.63, 329.63],
        arp: [261.63, 349.23, 440.0, 523.25, 659.25, 523.25, 440.0, 349.23],
        melody: [659.25, null, 698.46, 880.0, 783.99, null, 659.25, null],
      },
      {
        bass: 82.41, // E2
        pad: [164.81, 196.0, 261.63, 329.63],
        arp: [261.63, 329.63, 392.0, 523.25, 659.25, 523.25, 392.0, 329.63],
        melody: [587.33, null, 659.25, 783.99, 659.25, null, 523.25, null],
      },
      {
        bass: 73.42, // D2
        pad: [146.83, 220.0, 261.63, 329.63],
        arp: [220.0, 293.66, 349.23, 440.0, 523.25, 440.0, 349.23, 293.66],
        melody: [523.25, null, 587.33, 659.25, 698.46, null, 659.25, 587.33],
      },
      {
        bass: 58.27, // Bb1
        pad: [116.54, 174.61, 220.0, 293.66],
        arp: [233.08, 293.66, 349.23, 440.0, 587.33, 440.0, 349.23, 293.66],
        melody: [659.25, null, 587.33, 523.25, 440.0, null, 523.25, null],
      },
    ],
  },
  // Track 3: "Ánh Trăng Của Riêng Hai Đứa" — Dreamy Eb Major Nocturne (Ebmaj7 -> Bb/D -> Cm9 -> Abmaj7)
  {
    stepMs: 460,
    chords: [
      {
        bass: 77.78, // Eb2
        pad: [155.56, 233.08, 293.66, 392.0],
        arp: [311.13, 392.0, 466.16, 587.33, 622.25, 466.16, 392.0, 311.13],
        melody: [783.99, null, 698.46, 622.25, 587.33, null, 466.16, null],
      },
      {
        bass: 73.42, // D2
        pad: [146.83, 233.08, 293.66, 349.23],
        arp: [293.66, 349.23, 466.16, 587.33, 698.46, 587.33, 466.16, 349.23],
        melody: [698.46, null, 783.99, 932.33, 783.99, null, 587.33, null],
      },
      {
        bass: 65.41, // C2
        pad: [130.81, 196.0, 233.08, 293.66],
        arp: [261.63, 311.13, 392.0, 466.16, 587.33, 466.16, 392.0, 311.13],
        melody: [622.25, null, 698.46, 783.99, 932.33, null, 783.99, 698.46],
      },
      {
        bass: 103.83, // Ab2
        pad: [155.56, 207.65, 261.63, 392.0],
        arp: [207.65, 311.13, 392.0, 523.25, 622.25, 523.25, 392.0, 311.13],
        melody: [783.99, null, 698.46, 622.25, 523.25, null, 622.25, null],
      },
    ],
  },
];

/**
 * Continuous Multi-Track Playlist Engine persisted outside React stage lifecycles.
 * Guarantees uninterrupted playback across Intro -> Warp -> Galaxy -> Constellation -> Modals -> Supernova,
 * feeds the shared Web Audio AnalyserNode for the audio-reactive 3D heart, supports drop-in `.mp3` files
 * in `public/music/`, and plays a genuine romantic K-Drama piano + strings composition as fallback.
 */
class ContinuousMusicEngine {
  private decks: [Deck, Deck] | null = null;
  private activeDeckIdx: 0 | 1 = 0;
  private masterGain: GainNode | null = null;
  private duckGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private frequencyData: Uint8Array<ArrayBuffer> | null = null;
  private graphReady = false;

  private started = false;
  private currentIndex = 0;
  private transitionLockUntil = 0;
  private activeMode: 'none' | 'html-audio' | 'procedural-ost' = 'none';

  // Procedural K-Drama OST sequencer state
  private seqTimer: number | null = null;
  private seqStep = 0;
  private seqBarsPlayed = 0;
  private seqBusGain: GainNode | null = null;
  private seqActiveNodes = new Set<OscillatorNode>();

  private availableFiles: Set<string>;
  private gestureListenersInstalled = false;

  constructor() {
    const discovered =
      typeof __AVAILABLE_MUSIC_FILES__ !== 'undefined' && Array.isArray(__AVAILABLE_MUSIC_FILES__)
        ? __AVAILABLE_MUSIC_FILES__
        : [];
    this.availableFiles = new Set(discovered);
  }

  private getPlaylist(): PlaylistTrack[] {
    return ANNIVERSARY_DATA.playlist.length > 0
      ? ANNIVERSARY_DATA.playlist
      : [
          {
            id: 'default',
            title: ANNIVERSARY_DATA.audio.trackTitle,
            artist: ANNIVERSARY_DATA.audio.artist,
            src: ANNIVERSARY_DATA.audio.src,
          },
        ];
  }

  private getTargetVolume(): number {
    return useAppStore.getState().isMuted ? 0 : ANNIVERSARY_DATA.audio.defaultVolume;
  }

  private isLocalFileAvailable(src: string): boolean {
    if (!src) return false;
    if (src.startsWith('/music/')) {
      return this.availableFiles.has(src);
    }
    return true;
  }

  private createDeck(index: 0 | 1): Deck {
    const el = new Audio();
    el.crossOrigin = 'anonymous';
    el.preload = 'auto';
    el.loop = false;
    el.muted = false;
    el.volume = 1;
    el.setAttribute('playsinline', 'true');

    el.addEventListener('ended', () => {
      if (this.activeDeckIdx === index && this.activeMode === 'html-audio') {
        this.nextTrack(true);
      }
    });

    el.addEventListener('error', () => {
      if (this.activeDeckIdx === index && this.started) {
        this.startProceduralOst(this.currentIndex, 1.0);
      }
    });

    return { audio: el, source: null, gain: null };
  }

  private ensureDecks(): [Deck, Deck] | null {
    if (typeof window === 'undefined') return null;
    if (!this.decks) {
      this.decks = [this.createDeck(0), this.createDeck(1)];
    }
    return this.decks;
  }

  /** Lazily wires decks + procedural OST into masterGain -> duckGain -> analyser -> destination. */
  private ensureAudioGraph(): AudioContext | null {
    const ctx = sfxEngine.getContext();
    if (!ctx) return null;

    if (!this.graphReady) {
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, ctx.currentTime);

      const duck = ctx.createGain();
      duck.gain.setValueAtTime(1.0, ctx.currentTime);

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.82;

      master.connect(duck);
      duck.connect(analyser);
      analyser.connect(ctx.destination);

      this.masterGain = master;
      this.duckGain = duck;
      this.analyser = analyser;
      this.frequencyData = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
      this.graphReady = true;
    }

    const decks = this.ensureDecks();
    if (decks && this.masterGain) {
      for (const deck of decks) {
        if (!deck.source) {
          try {
            const src = ctx.createMediaElementSource(deck.audio);
            const g = ctx.createGain();
            g.gain.setValueAtTime(0, ctx.currentTime);
            src.connect(g);
            g.connect(this.masterGain);
            deck.source = src;
            deck.gain = g;
          } catch {
            // Headless / Safari fallback: element uses native volume
          }
        }
      }
    }

    return ctx;
  }

  /** Smoothly schedules master gain so AudioContext never stalls at 0.0001 after resume(). */
  private rampMasterGain(targetVol: number, fadeSec: number): void {
    const ctx = sfxEngine.getContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const safeTarget = targetVol > 0 ? targetVol : 0.0001;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(Math.max(0.0001, this.masterGain.gain.value), now);
    this.masterGain.gain.linearRampToValueAtTime(safeTarget, now + Math.max(0.08, fadeSec));
  }

  private stopProceduralOst(fadeSec = 0.4): void {
    if (this.seqTimer !== null) {
      window.clearInterval(this.seqTimer);
      this.seqTimer = null;
    }

    const bus = this.seqBusGain;
    this.seqBusGain = null;
    const ctx = sfxEngine.getContext();

    if (bus && ctx) {
      const now = ctx.currentTime;
      try {
        bus.gain.cancelScheduledValues(now);
        bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), now);
        bus.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.08, fadeSec));
        window.setTimeout(() => {
          try {
            bus.disconnect();
          } catch {
            // Already disconnected
          }
        }, fadeSec * 1000 + 120);
      } catch {
        // Ignore
      }
    }

    if (ctx) {
      const stopAt = ctx.currentTime + Math.max(0.08, fadeSec) + 0.05;
      for (const osc of this.seqActiveNodes) {
        try {
          osc.stop(stopAt);
        } catch {
          // Already stopped
        }
      }
    }
    this.seqActiveNodes.clear();
  }

  /** Synthesizes one warm romantic electric-piano / music-box note with soft acoustic decay. */
  private triggerPianoNote(
    ctx: AudioContext,
    bus: GainNode,
    freq: number,
    peakGain: number,
    durationSec: number,
    bright = false
  ): void {
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const env = ctx.createGain();

    osc1.type = 'triangle';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(freq, now);
    osc2.frequency.setValueAtTime(freq * 2, now); // Warm octave overtone

    const overtoneGain = ctx.createGain();
    overtoneGain.gain.setValueAtTime(bright ? 0.24 : 0.14, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(bright ? 3400 : 2100, now);
    filter.frequency.exponentialRampToValueAtTime(720, now + durationSec);

    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(peakGain, now + 0.018);
    env.gain.exponentialRampToValueAtTime(peakGain * 0.34, now + durationSec * 0.35);
    env.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc1.connect(filter);
    osc2.connect(overtoneGain);
    overtoneGain.connect(filter);
    filter.connect(env);
    env.connect(bus);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + durationSec + 0.05);
    osc2.stop(now + durationSec + 0.05);

    this.seqActiveNodes.add(osc1);
    this.seqActiveNodes.add(osc2);

    osc1.onended = () => {
      this.seqActiveNodes.delete(osc1);
      this.seqActiveNodes.delete(osc2);
      osc1.disconnect();
      osc2.disconnect();
      overtoneGain.disconnect();
      filter.disconnect();
      env.disconnect();
    };
  }

  /** Synthesizes one lush warm K-Drama strings chord + deep bass root lasting a full bar. */
  private triggerWarmStringsBar(
    ctx: AudioContext,
    bus: GainNode,
    bassHz: number,
    padHz: number[],
    barSec: number
  ): void {
    const now = ctx.currentTime;

    // Deep warm bass note (drives the AnalyserNode bass band for the Audio-Reactive 3D Heart!)
    const bassOsc = ctx.createOscillator();
    const bassEnv = ctx.createGain();
    bassOsc.type = 'sine';
    bassOsc.frequency.setValueAtTime(bassHz, now);

    bassEnv.gain.setValueAtTime(0.0001, now);
    bassEnv.gain.linearRampToValueAtTime(0.32, now + 0.28);
    bassEnv.gain.setValueAtTime(0.28, now + barSec * 0.72);
    bassEnv.gain.exponentialRampToValueAtTime(0.0001, now + barSec + 0.35);

    bassOsc.connect(bassEnv);
    bassEnv.connect(bus);
    bassOsc.start(now);
    bassOsc.stop(now + barSec + 0.4);
    this.seqActiveNodes.add(bassOsc);
    bassOsc.onended = () => {
      this.seqActiveNodes.delete(bassOsc);
      bassOsc.disconnect();
      bassEnv.disconnect();
    };

    // Soft strings swell bed
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1250, now);
    lp.Q.setValueAtTime(0.6, now);

    const padEnv = ctx.createGain();
    padEnv.gain.setValueAtTime(0.0001, now);
    padEnv.gain.linearRampToValueAtTime(0.16, now + barSec * 0.32);
    padEnv.gain.exponentialRampToValueAtTime(0.0001, now + barSec + 0.45);

    lp.connect(padEnv);
    padEnv.connect(bus);

    padHz.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = i % 2 === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.detune.setValueAtTime((i % 2 === 0 ? 1 : -1) * 5.5, now);
      osc.connect(lp);
      osc.start(now);
      osc.stop(now + barSec + 0.5);
      this.seqActiveNodes.add(osc);
      osc.onended = () => {
        this.seqActiveNodes.delete(osc);
        osc.disconnect();
        if (i === padHz.length - 1) {
          lp.disconnect();
          padEnv.disconnect();
        }
      };
    });
  }

  /**
   * Starts a genuine, audible romantic K-Drama piano + warm strings song routed straight into
   * `masterGain -> duckGain -> analyser -> destination`. Auto-advances after 12 bars (~42s).
   */
  private startProceduralOst(trackIndex: number, fadeSec: number): void {
    const ctx = this.ensureAudioGraph();
    if (!ctx || !this.masterGain) return;

    this.stopProceduralOst(0.35);
    this.activeMode = 'procedural-ost';

    const song = FALLBACK_SONGS[trackIndex % FALLBACK_SONGS.length];
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, ctx.currentTime);
    bus.gain.linearRampToValueAtTime(0.92, ctx.currentTime + Math.max(0.25, fadeSec));
    bus.connect(this.masterGain);
    this.seqBusGain = bus;

    this.seqStep = 0;
    this.seqBarsPlayed = 0;

    const tick = () => {
      if (this.activeMode !== 'procedural-ost' || !this.seqBusGain) return;
      const activeCtx = sfxEngine.getContext();
      if (!activeCtx || activeCtx.state !== 'running') return;

      const stepInBar = this.seqStep % 8;
      const chordIdx = Math.floor(this.seqStep / 8) % song.chords.length;
      const chord = song.chords[chordIdx];

      // Trigger lush strings + warm sub-bass on downbeat of every bar
      if (stepInBar === 0) {
        const barSec = (song.stepMs * 8) / 1000;
        this.triggerWarmStringsBar(activeCtx, this.seqBusGain, chord.bass, chord.pad, barSec);
        this.seqBarsPlayed += 1;

        // Smoothly auto-advance to next track after 12 bars (~42s) for endless playlist flow
        if (this.seqBarsPlayed > 12) {
          this.nextTrack(true);
          return;
        }
      }

      // Expressive flowing piano arpeggio
      const arpFreq = chord.arp[stepInBar % chord.arp.length];
      this.triggerPianoNote(activeCtx, this.seqBusGain, arpFreq, 0.145, 1.55, false);

      // Lyrical K-Drama top melody
      const melFreq = chord.melody[stepInBar];
      if (melFreq) {
        this.triggerPianoNote(activeCtx, this.seqBusGain, melFreq, 0.21, 2.35, true);
      }

      this.seqStep += 1;
    };

    // Fire bar 0 immediately once AudioContext is running (or right after resume resolves)
    if (ctx.state === 'running') {
      tick();
    } else {
      void ctx.resume().then(() => {
        if (this.activeMode === 'procedural-ost' && this.seqStep === 0) {
          tick();
        }
      }).catch(() => {});
    }

    this.seqTimer = window.setInterval(tick, song.stepMs);
    useAppStore.getState().setIsMusicPlaying(!useAppStore.getState().isMuted);
  }

  private playTrackAt(index: number, fadeSec: number): void {
    const playlist = this.getPlaylist();
    const safeIdx = ((index % playlist.length) + playlist.length) % playlist.length;
    this.currentIndex = safeIdx;
    useAppStore.getState().setCurrentTrackIndex(safeIdx);

    const track = playlist[safeIdx];
    const ctx = this.ensureAudioGraph();
    if (ctx && this.masterGain) {
      this.rampMasterGain(this.getTargetVolume(), fadeSec);
    }

    // If local .mp3 has not been dropped into public/music/ yet, play built-in K-Drama piano + strings OST
    if (!this.isLocalFileAvailable(track.src)) {
      this.pauseHtmlDecks(0.4);
      this.startProceduralOst(safeIdx, fadeSec);
      return;
    }

    const decks = this.ensureDecks();
    if (!decks) return;

    this.stopProceduralOst(0.45);
    this.activeMode = 'html-audio';

    const prevDeck = decks[this.activeDeckIdx];
    const nextIdx: 0 | 1 = this.activeDeckIdx === 0 ? 1 : 0;
    const nextDeck = decks[nextIdx];
    this.activeDeckIdx = nextIdx;

    if (ctx && prevDeck.gain) {
      const now = ctx.currentTime;
      prevDeck.gain.gain.cancelScheduledValues(now);
      prevDeck.gain.gain.setValueAtTime(Math.max(0.0001, prevDeck.gain.gain.value), now);
      prevDeck.gain.gain.linearRampToValueAtTime(0.0001, now + CROSSFADE_SEC);
      window.setTimeout(() => {
        if (this.activeDeckIdx !== (nextIdx === 0 ? 1 : 0)) {
          prevDeck.audio.pause();
        }
      }, CROSSFADE_SEC * 1000 + 80);
    } else {
      prevDeck.audio.pause();
    }

    nextDeck.audio.src = track.src;
    nextDeck.audio.currentTime = 0;

    if (ctx && nextDeck.gain) {
      const now = ctx.currentTime;
      nextDeck.gain.gain.cancelScheduledValues(now);
      nextDeck.gain.gain.setValueAtTime(0.0001, now);
      nextDeck.gain.gain.linearRampToValueAtTime(1.0, now + fadeSec);
    } else {
      nextDeck.audio.volume = this.getTargetVolume();
    }

    void nextDeck.audio
      .play()
      .then(() => {
        useAppStore.getState().setIsMusicPlaying(!useAppStore.getState().isMuted);
      })
      .catch(() => {
        // Keep waiting cleanly for next user gesture
      });
  }

  private pauseHtmlDecks(fadeSec: number): void {
    if (!this.decks) return;
    const ctx = sfxEngine.getContext();
    for (const deck of this.decks) {
      if (ctx && deck.gain) {
        const now = ctx.currentTime;
        deck.gain.gain.cancelScheduledValues(now);
        deck.gain.gain.linearRampToValueAtTime(0.0001, now + fadeSec);
      }
      if (!deck.audio.paused) {
        deck.audio.pause();
      }
    }
  }

  /** Unlocks Web Audio on the first user gesture and starts Track 1 with a silky 1.5s fade-in. */
  public startOnFirstGesture(): void {
    sfxEngine.unlock();
    const ctx = this.ensureAudioGraph();

    const beginOrResume = () => {
      if (this.started) {
        this.rampMasterGain(this.getTargetVolume(), 0.45);
        if (this.activeMode === 'html-audio' && this.decks) {
          const active = this.decks[this.activeDeckIdx];
          if (active.audio.paused && !useAppStore.getState().isMuted) {
            void active.audio.play().catch(() => {});
          }
        } else if (this.activeMode === 'procedural-ost' && !this.seqBusGain) {
          this.startProceduralOst(this.currentIndex, 0.8);
        }
        return;
      }

      this.started = true;
      this.playTrackAt(this.currentIndex, FADE_IN_SEC);
    };

    if (ctx && ctx.state === 'suspended') {
      void ctx
        .resume()
        .then(() => {
          beginOrResume();
        })
        .catch(() => {
          // Will retry on next click/touchstart
        });
      // Also kick off synchronously so UI state updates immediately on gesture
      if (!this.started) {
        this.started = true;
        this.playTrackAt(this.currentIndex, FADE_IN_SEC);
      }
    } else {
      beginOrResume();
    }
  }

  /** Installs global gesture listeners outside stage components so music unlocks reliably on iOS/Chrome & persists everywhere. */
  public installPersistence(): () => void {
    if (typeof window === 'undefined' || this.gestureListenersInstalled) return () => {};
    this.gestureListenersInstalled = true;

    const onGesture = () => {
      this.startOnFirstGesture();
      const ctx = sfxEngine.getContext();
      if (this.started && ctx && ctx.state === 'running') {
        cleanup();
      }
    };

    const cleanup = () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('touchstart', onGesture);
      window.removeEventListener('click', onGesture);
      window.removeEventListener('keydown', onGesture);
      this.gestureListenersInstalled = false;
    };

    window.addEventListener('pointerdown', onGesture, { passive: true });
    window.addEventListener('touchstart', onGesture, { passive: true });
    window.addEventListener('click', onGesture, { passive: true });
    window.addEventListener('keydown', onGesture, { passive: true });
    return cleanup;
  }

  /** Smoothly crossfades to the next track in the playlist (endless loop). */
  public nextTrack(automatic = false): void {
    const nowMs = performance.now();
    if (!automatic && nowMs < this.transitionLockUntil) return;
    this.transitionLockUntil = nowMs + 320;

    sfxEngine.unlock();
    const ctx = this.ensureAudioGraph();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }
    if (!this.started) {
      this.started = true;
    }
    this.playTrackAt(this.currentIndex + 1, CROSSFADE_SEC);
  }

  /** Smoothly mutes or unmutes playback via Web Audio GainNode (iOS Safari + Desktop safe). */
  public setMuted(muted: boolean): void {
    useAppStore.getState().setMuted(muted);

    if (!muted && !this.started) {
      this.startOnFirstGesture();
      return;
    }

    const ctx = sfxEngine.getContext();
    if (ctx && this.masterGain) {
      if (!muted && ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
      }
      this.rampMasterGain(muted ? 0 : ANNIVERSARY_DATA.audio.defaultVolume, muted ? 0.18 : 0.35);
    } else if (this.decks) {
      const active = this.decks[this.activeDeckIdx];
      active.audio.volume = muted ? 0 : ANNIVERSARY_DATA.audio.defaultVolume;
    }

    useAppStore.getState().setIsMusicPlaying(!muted && this.started);
  }

  public toggleMuted(): void {
    this.setMuted(!useAppStore.getState().isMuted);
  }

  /**
   * Cinematic Ducking: gently ducks background music by ~35% during the Supernova pinpoint silence
   * so the detonation drop hits with maximum impact.
   */
  public duckForSupernova(): void {
    const ctx = sfxEngine.getContext();
    if (!ctx || !this.duckGain) return;
    const now = ctx.currentTime;
    this.duckGain.gain.cancelScheduledValues(now);
    this.duckGain.gain.setValueAtTime(Math.max(0.01, this.duckGain.gain.value), now);
    this.duckGain.gain.linearRampToValueAtTime(SUPERNOVA_DUCK_FACTOR, now + 0.08);
  }

  /** Swells background music smoothly back to 100% during the slow-motion stardust finale. */
  public swellFromSupernova(delaySec = 0.35, rampSec = 1.45): void {
    const ctx = sfxEngine.getContext();
    if (!ctx || !this.duckGain) return;
    const now = ctx.currentTime;
    this.duckGain.gain.cancelScheduledValues(now);
    this.duckGain.gain.setValueAtTime(Math.max(0.01, this.duckGain.gain.value), now);
    this.duckGain.gain.setValueAtTime(Math.max(0.01, this.duckGain.gain.value), now + delaySec);
    this.duckGain.gain.linearRampToValueAtTime(1.0, now + delaySec + rampSec);
  }

  /**
   * Zero-allocation low-frequency bass sampler [0..1] for the Audio-Reactive 3D Heart & Galaxy Core.
   * Returns `null` when muted/inactive so scenes seamlessly fall back to procedural breathing.
   */
  public sampleBass(): number | null {
    if (useAppStore.getState().isMuted || !this.started) return null;
    const ctx = sfxEngine.getContext();
    if (!this.analyser || !this.frequencyData || !ctx || ctx.state !== 'running') {
      return null;
    }

    this.analyser.getByteFrequencyData(this.frequencyData);

    let sum = 0;
    const startBin = 1;
    const endBin = Math.min(11, this.frequencyData.length);
    for (let i = startBin; i < endBin; i++) {
      sum += this.frequencyData[i];
    }

    const avg = sum / ((endBin - startBin) * 255);
    return avg > 0.004 ? Math.min(1, avg * 1.85) : null;
  }
}

export const musicEngine = new ContinuousMusicEngine();
