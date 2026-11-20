import { useAppStore } from '../store/useAppStore';

class ProceduralSfxEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private unsubStore: (() => void) | null = null;
  private lastHoverAt = 0;

  // Active charging hum nodes
  private chargeNodes: {
    osc1: OscillatorNode;
    osc2: OscillatorNode;
    filter: BiquadFilterNode;
    gain: GainNode;
  } | null = null;

  // Active warp whoosh nodes
  private warpNodes: {
    source: AudioBufferSourceNode;
    gain: GainNode;
  } | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;

      try {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        const isMuted = useAppStore.getState().isMuted;
        this.masterGain.gain.setValueAtTime(isMuted ? 0 : 1, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);

        // Stay synced with Zustand isMuted state and fade gracefully when muted
        this.unsubStore = useAppStore.subscribe((state, prev) => {
          if (state.isMuted !== prev.isMuted) {
            this.applyMuteState(state.isMuted);
          }
        });
      } catch {
        return null;
      }
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {
        // Autoplay restriction until user gesture — ignore silently
      });
    }

    return this.ctx;
  }

  private applyMuteState(isMuted: boolean): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(isMuted ? 0 : 1, now, 0.045);

    if (isMuted) {
      this.stopChargeHum();
      this.stopWarpWhoosh();
    }
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }

    const length = ctx.sampleRate * 3;
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);

    // Warm pink-tinted stereo noise (Paul Kellet filter)
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      let b3 = 0;
      let b4 = 0;
      let b5 = 0;
      let b6 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.09;
        b6 = white * 0.115926;
      }
    }

    this.noiseBuffer = buffer;
    return buffer;
  }

  public unlock(): void {
    this.ensureContext();
  }

  public getContext(): AudioContext | null {
    return this.ensureContext();
  }

  /** Rhythmic double-beat heartbeat pulse synthesized for the 3.0s Secret Supernova hold. */
  public playHeartbeatPulse(intensity01: number): void {
    if (useAppStore.getState().isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || ctx.state !== 'running') return;

    const p = Math.max(0, Math.min(1, intensity01));
    const now = ctx.currentTime;

    const triggerBeat = (offset: number, peakGain: number, startHz: number) => {
      const osc = ctx.createOscillator();
      const lpf = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(startHz + p * 18, now + offset);
      osc.frequency.exponentialRampToValueAtTime(34, now + offset + 0.14);

      lpf.type = 'lowpass';
      lpf.frequency.setValueAtTime(180 + p * 160, now + offset);

      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.linearRampToValueAtTime(peakGain, now + offset + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.18);

      osc.connect(lpf);
      lpf.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(now + offset);
      osc.stop(now + offset + 0.2);
      osc.onended = () => {
        osc.disconnect();
        lpf.disconnect();
        gain.disconnect();
      };
    };

    const baseGain = 0.11 + p * 0.14;
    triggerBeat(0, baseGain, 76);
    triggerBeat(0.115 - p * 0.035, baseGain * 0.72, 66);
  }

  /** Ethereal sub-bass shockwave + shimmering starlight chime cascade for Supernova burst. */
  public playSupernovaBurst(): void {
    if (useAppStore.getState().isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;

    // Deep cosmic sub-bass impact
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(128, now);
    sub.frequency.exponentialRampToValueAtTime(28, now + 1.05);

    subGain.gain.setValueAtTime(0.0001, now);
    subGain.gain.linearRampToValueAtTime(0.28, now + 0.03);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.25);

    sub.connect(subGain);
    subGain.connect(this.masterGain);
    sub.start(now);
    sub.stop(now + 1.3);
    sub.onended = () => {
      sub.disconnect();
      subGain.disconnect();
    };

    // Shimmering stardust burst sweep
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(420, now);
    filter.frequency.exponentialRampToValueAtTime(3400, now + 0.65);
    filter.Q.setValueAtTime(1.5, now);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.0001, now);
    nGain.gain.linearRampToValueAtTime(0.14, now + 0.08);
    nGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.45);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.masterGain);
    noise.start(now);
    noise.stop(now + 1.5);
    noise.onended = () => {
      noise.disconnect();
      filter.disconnect();
      nGain.disconnect();
    };

    // Ascending luminous supernova chimes (D5, A5, D6, F#6, A6, C#7)
    const notes = [587.33, 880.0, 1174.66, 1479.98, 1760.0, 2217.46];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t0 = now + idx * 0.065;
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, t0);

      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.068 - idx * 0.006, t0 + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.65);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t0);
      osc.stop(t0 + 1.75);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    });
  }

  /** Warm rising harmonic hum while holding/charging the Intro heart (0..1). */
  public startChargeHum(): void {
    if (useAppStore.getState().isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.chargeNodes) return;

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(118, now);
    osc2.frequency.setValueAtTime(177, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, now);
    filter.Q.setValueAtTime(2.2, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.045, now + 0.12);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(now);
    osc2.start(now);

    this.chargeNodes = { osc1, osc2, filter, gain };
  }

  public updateChargeHum(progress01: number): void {
    if (!this.ctx || !this.chargeNodes) return;
    const p = Math.max(0, Math.min(1, progress01));
    const now = this.ctx.currentTime;
    const { osc1, osc2, filter, gain } = this.chargeNodes;

    // Smooth harmonic rise as charge approaches 100%
    const baseFreq = 118 + p * 174;
    osc1.frequency.setTargetAtTime(baseFreq, now, 0.04);
    osc2.frequency.setTargetAtTime(baseFreq * 1.5, now, 0.04);
    filter.frequency.setTargetAtTime(320 + p * p * 2200, now, 0.05);
    gain.gain.setTargetAtTime(0.04 + p * 0.085, now, 0.05);
  }

  public stopChargeHum(): void {
    if (!this.ctx || !this.chargeNodes) return;
    const now = this.ctx.currentTime;
    const { osc1, osc2, filter, gain } = this.chargeNodes;
    this.chargeNodes = null;

    try {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(0.0001, now, 0.04);
      osc1.stop(now + 0.18);
      osc2.stop(now + 0.18);
      osc1.onended = () => {
        osc1.disconnect();
        osc2.disconnect();
        filter.disconnect();
        gain.disconnect();
      };
    } catch {
      // Ignore already stopped oscillators
    }
  }

  /** Crystalline shimmer chime + soft sub-bass impact at 100% love charge. */
  public playChargeComplete(): void {
    this.stopChargeHum();
    if (useAppStore.getState().isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;

    // Soft sub-bass portal ignition impact
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(108, now);
    subOsc.frequency.exponentialRampToValueAtTime(38, now + 0.55);
    subGain.gain.setValueAtTime(0.0001, now);
    subGain.gain.linearRampToValueAtTime(0.22, now + 0.025);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
    subOsc.connect(subGain);
    subGain.connect(this.masterGain);
    subOsc.start(now);
    subOsc.stop(now + 0.7);
    subOsc.onended = () => {
      subOsc.disconnect();
      subGain.disconnect();
    };

    // Crystalline staggered sparkle triad (D5, F#5, A5, D6)
    const freqs = [587.33, 739.99, 880.0, 1174.66];
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t0 = now + idx * 0.055;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0);

      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.075 - idx * 0.01, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.95);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t0);
      osc.stop(t0 + 1.0);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    });
  }

  /** Filtered stereo noise sweep rising through Warp, peaking into an ethereal bloom chord. */
  public playWarpWhoosh(durationSec = 2.5): void {
    this.stopWarpWhoosh();
    if (useAppStore.getState().isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = this.getNoiseBuffer(ctx);
    source.loop = true;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(210, now);
    bandpass.frequency.exponentialRampToValueAtTime(2400, now + durationSec * 0.85);
    bandpass.Q.setValueAtTime(1.1, now);
    bandpass.Q.linearRampToValueAtTime(2.6, now + durationSec * 0.85);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.45);
    gain.gain.linearRampToValueAtTime(0.19, now + durationSec * 0.82);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec + 0.2);

    source.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(this.masterGain);

    source.start(now);
    source.stop(now + durationSec + 0.25);
    this.warpNodes = { source, gain };

    source.onended = () => {
      source.disconnect();
      bandpass.disconnect();
      gain.disconnect();
      if (this.warpNodes?.source === source) {
        this.warpNodes = null;
      }
    };

    // Dreamy ethereal Galaxy bloom chord timed right at warp peak
    const bloomAt = now + Math.max(0.2, durationSec - 0.36);
    const chord = [293.66, 440.0, 554.37, 659.25, 880.0]; // Dmaj9 shimmer
    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const lpf = ctx.createBiquadFilter();
      const env = ctx.createGain();

      osc.type = idx < 2 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, bloomAt);
      osc.detune.setValueAtTime((idx - 2) * 4.5, bloomAt);

      lpf.type = 'lowpass';
      lpf.frequency.setValueAtTime(1650, bloomAt);

      env.gain.setValueAtTime(0.0001, bloomAt);
      env.gain.linearRampToValueAtTime(0.042, bloomAt + 0.35);
      env.gain.exponentialRampToValueAtTime(0.0001, bloomAt + 2.4);

      osc.connect(lpf);
      lpf.connect(env);
      env.connect(this.masterGain!);

      osc.start(bloomAt);
      osc.stop(bloomAt + 2.5);
      osc.onended = () => {
        osc.disconnect();
        lpf.disconnect();
        env.disconnect();
      };
    });
  }

  public stopWarpWhoosh(): void {
    if (!this.ctx || !this.warpNodes) return;
    const now = this.ctx.currentTime;
    const { source, gain } = this.warpNodes;
    this.warpNodes = null;
    try {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(0.0001, now, 0.04);
      source.stop(now + 0.16);
    } catch {
      // Ignore already stopped source
    }
  }

  /** Ultra-subtle high-frequency starlight glass tick on 3D node / UI hover. */
  public playHoverTick(): void {
    if (useAppStore.getState().isMuted) return;
    const perfNow = performance.now();
    if (perfNow - this.lastHoverAt < 55) return;
    this.lastHoverAt = perfNow;

    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(2480, now);
    osc.frequency.exponentialRampToValueAtTime(3280, now + 0.032);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.022, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.048);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.055);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  /** Soft airy whoosh + gentle crystalline bell chime on node click / modal open. */
  public playModalOpen(): void {
    if (useAppStore.getState().isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;

    // Airy micro-whoosh
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.exponentialRampToValueAtTime(1900, now + 0.14);
    filter.Q.setValueAtTime(1.4, now);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.0001, now);
    nGain.gain.linearRampToValueAtTime(0.04, now + 0.03);
    nGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.masterGain);
    noise.start(now);
    noise.stop(now + 0.18);
    noise.onended = () => {
      noise.disconnect();
      filter.disconnect();
      nGain.disconnect();
    };

    // Gentle bell pair
    [783.99, 1174.66].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t0 = now + idx * 0.035;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0);

      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.048 - idx * 0.012, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.42);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t0);
      osc.stop(t0 + 0.45);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    });
  }

  /** Soft downward muted plink on modal close. */
  public playModalClose(): void {
    if (useAppStore.getState().isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const lpf = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(540, now);
    osc.frequency.exponentialRampToValueAtTime(310, now + 0.15);

    lpf.type = 'lowpass';
    lpf.frequency.setValueAtTime(980, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.045, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    osc.connect(lpf);
    lpf.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.2);
    osc.onended = () => {
      osc.disconnect();
      lpf.disconnect();
      gain.disconnect();
    };
  }

  public dispose(): void {
    this.stopChargeHum();
    this.stopWarpWhoosh();
    this.unsubStore?.();
    this.unsubStore = null;
  }
}

export const sfxEngine = new ProceduralSfxEngine();
