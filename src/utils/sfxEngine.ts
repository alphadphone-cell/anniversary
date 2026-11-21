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

  // Active heart coalescence sound timers/nodes
  private coalesceCleanup: (() => void) | null = null;

  // Active Supernova implosion suction hum nodes
  private implosionNodes: {
    osc1: OscillatorNode;
    osc2: OscillatorNode;
    noise: AudioBufferSourceNode;
    filter: BiquadFilterNode;
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
      this.stopHeartCoalescence();
      this.cutSupernovaImplosion();
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

  /** Beat 1: Rising resonant energy suction hum that sweeps sharply upward during heart implosion. */
  public startSupernovaImplosion(): void {
    if (useAppStore.getState().isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.implosionNodes) return;

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const noise = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(84, now);
    osc2.frequency.setValueAtTime(126, now);

    noise.buffer = this.getNoiseBuffer(ctx);
    noise.loop = true;

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(220, now);
    filter.Q.setValueAtTime(2.5, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.045, now + 0.14);

    osc1.connect(filter);
    osc2.connect(filter);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(now);
    osc2.start(now);
    noise.start(now);

    this.implosionNodes = { osc1, osc2, noise, filter, gain };
  }

  public updateSupernovaImplosion(progress01: number): void {
    if (!this.ctx || !this.implosionNodes) return;
    const p = Math.max(0, Math.min(1, progress01));
    const now = this.ctx.currentTime;
    const { osc1, osc2, filter, gain } = this.implosionNodes;

    // Sharp exponential upward pitch & resonant filter suction sweep toward singularity
    const freq = 84 + Math.pow(p, 1.75) * 390;
    osc1.frequency.setTargetAtTime(freq, now, 0.035);
    osc2.frequency.setTargetAtTime(freq * 1.5, now, 0.035);
    filter.frequency.setTargetAtTime(220 + Math.pow(p, 2.0) * 3200, now, 0.04);
    filter.Q.setTargetAtTime(2.5 + p * 7.5, now, 0.04);
    gain.gain.setTargetAtTime(0.045 + p * 0.115, now, 0.04);
  }

  /** Hard-cuts the rising suction hum cleanly in ~12ms to create the 150ms vacuum silence beat. */
  public cutSupernovaImplosion(): void {
    if (!this.ctx || !this.implosionNodes) return;
    const now = this.ctx.currentTime;
    const { osc1, osc2, noise, filter, gain } = this.implosionNodes;
    this.implosionNodes = null;

    try {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.015);
      osc1.stop(now + 0.03);
      osc2.stop(now + 0.03);
      noise.stop(now + 0.03);
      osc1.onended = () => {
        osc1.disconnect();
        osc2.disconnect();
        noise.disconnect();
        filter.disconnect();
        gain.disconnect();
      };
    } catch {
      // ignore already stopped nodes
    }
  }

  /** Rhythmic double-beat heartbeat pulse sweeping upward in pitch during the Beat 1 implosion. */
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
      osc.frequency.setValueAtTime(startHz + p * p * 44, now + offset);
      osc.frequency.exponentialRampToValueAtTime(36 + p * 14, now + offset + 0.13);

      lpf.type = 'lowpass';
      lpf.frequency.setValueAtTime(190 + p * 260, now + offset);

      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.linearRampToValueAtTime(peakGain, now + offset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.16);

      osc.connect(lpf);
      lpf.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(now + offset);
      osc.stop(now + offset + 0.18);
      osc.onended = () => {
        osc.disconnect();
        lpf.disconnect();
        gain.disconnect();
      };
    };

    const baseGain = 0.12 + p * 0.15;
    triggerBeat(0, baseGain, 76);
    triggerBeat(0.11 - p * 0.038, baseGain * 0.74, 68);
  }

  /**
   * Grand Finale Detonation:
   * 1. Cinematic deep sub-bass drop (50Hz -> 28Hz) + harmonic chest-punch body
   * 2. Crisp crystalline shatter + white-noise transient burst
   * 3. Broad cosmic shockwave air sweep
   * 4. Lush sustained ethereal Dmaj9 shimmer pad lingering through aftermath & finale letter
   */
  public playSupernovaBurst(): void {
    this.cutSupernovaImplosion();
    if (useAppStore.getState().isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;

    // 1. Cinematic deep sub-bass drop (50Hz -> 28Hz pitch bend) + subtle 2nd harmonic punch
    const sub = ctx.createOscillator();
    const subPunch = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(50, now);
    sub.frequency.exponentialRampToValueAtTime(28, now + 1.45);

    subPunch.type = 'triangle';
    subPunch.frequency.setValueAtTime(102, now);
    subPunch.frequency.exponentialRampToValueAtTime(44, now + 0.42);
    const punchGain = ctx.createGain();
    punchGain.gain.setValueAtTime(0.0001, now);
    punchGain.gain.linearRampToValueAtTime(0.18, now + 0.008);
    punchGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

    subGain.gain.setValueAtTime(0.0001, now);
    subGain.gain.linearRampToValueAtTime(0.42, now + 0.012);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.05);

    sub.connect(subGain);
    subGain.connect(this.masterGain);
    subPunch.connect(punchGain);
    punchGain.connect(this.masterGain);

    sub.start(now);
    sub.stop(now + 2.1);
    subPunch.start(now);
    subPunch.stop(now + 0.5);
    sub.onended = () => {
      sub.disconnect();
      subGain.disconnect();
      subPunch.disconnect();
      punchGain.disconnect();
    };

    // 2. Crisp crystalline shatter + white-noise burst right at whiteout impact (0 -> 220ms)
    const crackle = ctx.createBufferSource();
    crackle.buffer = this.getNoiseBuffer(ctx);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(3400, now);

    const cGain = ctx.createGain();
    cGain.gain.setValueAtTime(0.0001, now);
    cGain.gain.linearRampToValueAtTime(0.28, now + 0.005);
    cGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    crackle.connect(hp);
    hp.connect(cGain);
    cGain.connect(this.masterGain);
    crackle.start(now);
    crackle.stop(now + 0.25);
    crackle.onended = () => {
      crackle.disconnect();
      hp.disconnect();
      cGain.disconnect();
    };

    // Sparkling glass-crystal shatter micro-partials (2.6kHz - 5.2kHz)
    const shards = [2637.02, 3135.96, 3951.07, 4698.63, 5274.04];
    shards.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const t0 = now + 0.006 + i * 0.022;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.04, t0 + 0.28);

      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.042, t0 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.36);

      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(t0);
      osc.stop(t0 + 0.4);
      osc.onended = () => {
        osc.disconnect();
        g.disconnect();
      };
    });

    // 3. Broad cosmic shockwave air sweep
    const sweep = ctx.createBufferSource();
    sweep.buffer = this.getNoiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(720, now);
    bp.frequency.exponentialRampToValueAtTime(3800, now + 1.05);
    bp.Q.setValueAtTime(1.0, now);

    const sGain = ctx.createGain();
    sGain.gain.setValueAtTime(0.0001, now);
    sGain.gain.linearRampToValueAtTime(0.18, now + 0.035);
    sGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.15);

    sweep.connect(bp);
    bp.connect(sGain);
    sGain.connect(this.masterGain);
    sweep.start(now);
    sweep.stop(now + 2.2);
    sweep.onended = () => {
      sweep.disconnect();
      bp.disconnect();
      sGain.disconnect();
    };

    // 4. Lush sustained ethereal Dmaj9 shimmer pad (lingers ~6.2s through aftermath & finale modal)
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.setValueAtTime(620, now + 0.08);
    padFilter.frequency.exponentialRampToValueAtTime(2800, now + 1.5);
    padFilter.frequency.exponentialRampToValueAtTime(1100, now + 6.2);

    const padMaster = ctx.createGain();
    padMaster.gain.setValueAtTime(0.0001, now + 0.06);
    padMaster.gain.linearRampToValueAtTime(0.135, now + 0.65);
    padMaster.gain.setValueAtTime(0.135, now + 2.6);
    padMaster.gain.exponentialRampToValueAtTime(0.0001, now + 6.4);

    padFilter.connect(padMaster);
    padMaster.connect(this.masterGain);

    // D3, A3, F#4, C#5, E5, A5 (ethereal major-9th voicing with gentle detune warmth)
    const padNotes = [146.83, 220.0, 369.99, 554.37, 659.25, 880.0];
    padNotes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const vGain = ctx.createGain();
      osc.type = idx < 2 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now + 0.06);
      osc.detune.setValueAtTime((idx % 2 === 0 ? 1 : -1) * (4 + idx * 1.4), now + 0.06);

      vGain.gain.setValueAtTime(idx < 2 ? 0.24 : 0.14, now + 0.06);
      osc.connect(vGain);
      vGain.connect(padFilter);

      osc.start(now + 0.06);
      osc.stop(now + 6.5);
      osc.onended = () => {
        osc.disconnect();
        vGain.disconnect();
        if (idx === padNotes.length - 1) {
          padFilter.disconnect();
          padMaster.disconnect();
        }
      };
    });

    // 5. Shimmering high-register stardust cascade twinkling over the first 2.2s
    const cascade = [587.33, 880.0, 1174.66, 1318.51, 1479.98, 1760.0, 2217.46, 2637.02, 2959.96];
    cascade.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t0 = now + 0.06 + idx * 0.09;
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, t0);

      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.052 - idx * 0.0035, t0 + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.2);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t0);
      osc.stop(t0 + 2.3);
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

  /** Subtle celestial harp chime when gliding between Galaxy View and Constellation View. */
  public playCelestialChime(direction: 'up' | 'down' = 'up'): void {
    if (useAppStore.getState().isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const notes =
      direction === 'up'
        ? [587.33, 880.0, 1318.51, 1479.98] // D5 -> A5 -> E6 -> F#6
        : [1318.51, 880.0, 587.33]; // E6 -> A5 -> D5

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t0 = now + idx * 0.075;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0);

      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.048 - idx * 0.006, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.15);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t0);
      osc.stop(t0 + 1.2);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    });
  }

  /** Crisp starlight ping when selecting or stepping through Constellation milestone stars. */
  public playStarSelect(): void {
    if (useAppStore.getState().isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    [987.77, 1479.98].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t0 = now + idx * 0.03;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0);

      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.044 - idx * 0.014, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.52);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t0);
      osc.stop(t0 + 0.56);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    });
  }

  /** Rising celestial harp ignition chime when lighting up the next milestone star & connecting line. */
  public playStarIgnite(stepIndex: number): void {
    if (useAppStore.getState().isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    // Ascending D major pentatonic scale so each newly lit star feels progressively brighter
    const scale = [587.33, 659.25, 739.99, 880.0, 987.77, 1174.66, 1318.51, 1479.98];
    const baseFreq = scale[Math.max(0, Math.min(scale.length - 1, stepIndex))];
    const shimmerFreq = baseFreq * 1.5; // Perfect fifth sparkle
    const octFreq = baseFreq * 2.0;

    const now = ctx.currentTime;
    [
      { freq: baseFreq, delay: 0, peak: 0.056, dur: 0.95, type: 'sine' as OscillatorType },
      { freq: shimmerFreq, delay: 0.055, peak: 0.042, dur: 0.85, type: 'triangle' as OscillatorType },
      { freq: octFreq, delay: 0.11, peak: 0.028, dur: 0.78, type: 'sine' as OscillatorType },
    ].forEach(({ freq, delay, peak, dur, type }) => {
      const osc = ctx.createOscillator();
      const lpf = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      const t0 = now + delay;

      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);

      lpf.type = 'lowpass';
      lpf.frequency.setValueAtTime(3400, t0);

      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(peak, t0 + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

      osc.connect(lpf);
      lpf.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t0);
      osc.stop(t0 + dur + 0.06);
      osc.onended = () => {
        osc.disconnect();
        lpf.disconnect();
        gain.disconnect();
      };
    });
  }

  /**
   * Balanced 5.2s Constellation Emblem Reveal & Starfall Cascade Audio Choreography:
   * - 0.85s -> 1.76s: Smoother rising 7-note crystalline circuit arpeggio synced to the golden-white surge
   * - 1.80s: Warm majestic Dmaj9 celestial chord holding ~2.0s under the glowing Constellation Emblem
   * - 3.95s: Shimmering Celestial Burst Chime + soft sub-bass swell as the Emblem dissolves into Starfall
   */
  public playConstellationAwakeningSequence(starCount = 7): void {
    if (useAppStore.getState().isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    // Phase 2 (0.85s -> 1.74s): Smoother rising crystalline circuit arpeggio across all 7 stars
    const surgeScale = [587.33, 659.25, 739.99, 880.0, 987.77, 1174.66, 1479.98];
    const count = Math.max(2, Math.min(surgeScale.length, starCount));
    for (let i = 0; i < count; i++) {
      const t0 = now + 0.85 + (i / (count - 1)) * 0.86;
      const freq = surgeScale[i];

      const osc = ctx.createOscillator();
      const overtone = ctx.createOscillator();
      const gain = ctx.createGain();
      const overGain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      overtone.type = 'triangle';
      overtone.frequency.setValueAtTime(freq * 2, t0);
      overGain.gain.setValueAtTime(0.28, t0);

      const peak = 0.036 + i * 0.0055;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(peak, t0 + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.65);

      osc.connect(gain);
      overtone.connect(overGain);
      overGain.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t0);
      overtone.start(t0);
      osc.stop(t0 + 0.68);
      overtone.stop(t0 + 0.68);
      osc.onended = () => {
        osc.disconnect();
        overtone.disconnect();
        overGain.disconnect();
        gain.disconnect();
      };
    }

    // Phase 3 (1.80s): Warm, majestic Dmaj9 Celestial Chord holding proudly under the glowing Emblem (~2.15s)
    const emblemAt = now + 1.8;
    const emblemChord = [293.66, 440.0, 587.33, 739.99, 880.0, 1108.73, 1318.51];
    emblemChord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const lpf = ctx.createBiquadFilter();
      const env = ctx.createGain();
      const t0 = emblemAt + idx * 0.04;

      osc.type = idx < 3 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, t0);
      osc.detune.setValueAtTime((idx - 3) * 2.6, t0);

      lpf.type = 'lowpass';
      lpf.frequency.setValueAtTime(2150 + idx * 210, t0);
      lpf.frequency.exponentialRampToValueAtTime(1020, t0 + 2.3);

      const peak = 0.044 - idx * 0.0032;
      env.gain.setValueAtTime(0.0001, t0);
      env.gain.linearRampToValueAtTime(peak, t0 + 0.16);
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.45);

      osc.connect(lpf);
      lpf.connect(env);
      env.connect(this.masterGain!);
      osc.start(t0);
      osc.stop(t0 + 2.52);
      osc.onended = () => {
        osc.disconnect();
        lpf.disconnect();
        env.disconnect();
      };
    });

    // Phase 4 (3.95s): Emblem Dissolve -> Simultaneous Starfall Burst Chime + Soft Sub-Bass Swell
    const burstAt = now + 3.95;

    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(55, burstAt);
    sub.frequency.exponentialRampToValueAtTime(44, burstAt + 1.35);

    subGain.gain.setValueAtTime(0.0001, burstAt);
    subGain.gain.linearRampToValueAtTime(0.24, burstAt + 0.08);
    subGain.gain.exponentialRampToValueAtTime(0.0001, burstAt + 1.55);

    sub.connect(subGain);
    subGain.connect(this.masterGain);
    sub.start(burstAt);
    sub.stop(burstAt + 1.62);
    sub.onended = () => {
      sub.disconnect();
      subGain.disconnect();
    };

    const burstFreqs = [587.33, 739.99, 880.0, 1174.66, 1318.51, 1760.0];
    burstFreqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const lpf = ctx.createBiquadFilter();
      const env = ctx.createGain();
      const t0 = burstAt + idx * 0.025;

      osc.type = idx < 3 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, t0);
      osc.detune.setValueAtTime((idx - 2.5) * 3.0, t0);

      lpf.type = 'lowpass';
      lpf.frequency.setValueAtTime(3000 + idx * 240, t0);
      lpf.frequency.exponentialRampToValueAtTime(1150, t0 + 1.6);

      const peak = 0.044 - idx * 0.0034;
      env.gain.setValueAtTime(0.0001, t0);
      env.gain.linearRampToValueAtTime(peak, t0 + 0.04);
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.75);

      osc.connect(lpf);
      lpf.connect(env);
      env.connect(this.masterGain!);
      osc.start(t0);
      osc.stop(t0 + 1.82);
      osc.onended = () => {
        osc.disconnect();
        lpf.disconnect();
        env.disconnect();
      };
    });
  }

  /** Brief, magical ascending rose-gold sparkle chime when 6/6 core memories unlock the Secret Supernova hint. */
  public playFinaleUnlockChime(): void {
    if (useAppStore.getState().isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const notes = [587.33, 739.99, 880.0, 1108.73, 1174.66, 1479.98]; // D5 -> F#5 -> A5 -> C#6 -> D6 -> F#6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t0 = now + idx * 0.065;

      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, t0);

      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.048 - idx * 0.0035, t0 + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.18);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t0);
      osc.stop(t0 + 1.24);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    });
  }

  /** Warm crystalline absorption shimmer when falling starlight merges into the 3D Particle Heart. */
  public playHeartAbsorptionShimmer(): void {
    if (useAppStore.getState().isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const notes = [587.33, 739.99, 880.0, 1174.66, 1479.98];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t0 = now + idx * 0.04;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0);

      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.036 - idx * 0.003, t0 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.15);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t0);
      osc.stop(t0 + 1.22);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    });
  }

  /** Warm harmonic completion chord (Dmaj9) played during the full-constellation finale showcase. */
  public playConstellationFinaleChord(): void {
    if (useAppStore.getState().isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    // Lush Dmaj9 voicing: D4, A4, D5, F#5, A5, C#6, E6
    const freqs = [293.66, 440.0, 587.33, 739.99, 880.0, 1108.73, 1318.51];
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const lpf = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      const t0 = now + idx * 0.045;

      osc.type = idx < 3 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, t0);
      osc.detune.setValueAtTime((idx - 3) * 2.8, t0);

      lpf.type = 'lowpass';
      lpf.frequency.setValueAtTime(1600 + idx * 240, t0);
      lpf.frequency.exponentialRampToValueAtTime(900, t0 + 2.0);

      const peak = 0.046 - idx * 0.0038;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(peak, t0 + 0.14);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.15);

      osc.connect(lpf);
      lpf.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t0);
      osc.stop(t0 + 2.25);
      osc.onended = () => {
        osc.disconnect();
        lpf.disconnect();
        gain.disconnect();
      };
    });
  }

  /**
   * Synced 2.8s audio choreography for the Shooting Star Scatter-to-Heart Coalescence:
   * - Phase A (0.0s -> 0.8s): sparkling high-frequency stardust scatter shimmer
   * - Phase B -> C (0.8s -> 2.8s): gentle reverse-shimmer swell resolving into an ethereal chord
   */
  public playHeartCoalescenceSequence(): void {
    this.stopHeartCoalescence();
    if (useAppStore.getState().isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const activeStops: Array<() => void> = [];

    // Phase A: Sparkling high-frequency stardust scatter shimmer (8 rapid crystalline pings)
    const sparkleFreqs = [1760, 2217.46, 2637.02, 2959.96, 3520, 2349.32, 3135.96, 3951.07];
    sparkleFreqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t0 = now + i * 0.075;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.06, t0 + 0.16);

      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(0.032 - i * 0.002, t0 + 0.014);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);

      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(t0);
      osc.stop(t0 + 0.32);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
      activeStops.push(() => {
        try {
          osc.stop();
        } catch {
          // ignore
        }
      });
    });

    // Phase A airy stardust burst hiss
    const burstNoise = ctx.createBufferSource();
    burstNoise.buffer = this.getNoiseBuffer(ctx);
    const burstFilter = ctx.createBiquadFilter();
    burstFilter.type = 'highpass';
    burstFilter.frequency.setValueAtTime(2200, now);
    burstFilter.frequency.exponentialRampToValueAtTime(5200, now + 0.72);

    const burstGain = ctx.createGain();
    burstGain.gain.setValueAtTime(0.0001, now);
    burstGain.gain.linearRampToValueAtTime(0.06, now + 0.08);
    burstGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.82);

    burstNoise.connect(burstFilter);
    burstFilter.connect(burstGain);
    burstGain.connect(this.masterGain);
    burstNoise.start(now);
    burstNoise.stop(now + 0.86);
    burstNoise.onended = () => {
      burstNoise.disconnect();
      burstFilter.disconnect();
      burstGain.disconnect();
    };
    activeStops.push(() => {
      try {
        burstNoise.stop();
      } catch {
        // ignore
      }
    });

    // Phase B -> C: Reverse-shimmer noise swell peaking precisely at heart lock-in (~2.65s)
    const revStart = now + 0.78;
    const lockPeak = now + 2.66;
    const revNoise = ctx.createBufferSource();
    revNoise.buffer = this.getNoiseBuffer(ctx);
    revNoise.loop = true;

    const revFilter = ctx.createBiquadFilter();
    revFilter.type = 'bandpass';
    revFilter.frequency.setValueAtTime(360, revStart);
    revFilter.frequency.exponentialRampToValueAtTime(2900, lockPeak);
    revFilter.Q.setValueAtTime(2.4, revStart);

    const revGain = ctx.createGain();
    revGain.gain.setValueAtTime(0.0001, revStart);
    revGain.gain.exponentialRampToValueAtTime(0.095, lockPeak);
    revGain.gain.exponentialRampToValueAtTime(0.0001, lockPeak + 0.45);

    revNoise.connect(revFilter);
    revFilter.connect(revGain);
    revGain.connect(this.masterGain);
    revNoise.start(revStart);
    revNoise.stop(lockPeak + 0.5);
    revNoise.onended = () => {
      revNoise.disconnect();
      revFilter.disconnect();
      revGain.disconnect();
    };
    activeStops.push(() => {
      try {
        revNoise.stop();
      } catch {
        // ignore
      }
    });

    // Phase B -> C: Ethereal swelling harmonic chord resolving cleanly at 2.65s -> 2.8s
    const chordFreqs = [293.66, 440.0, 587.33, 739.99, 880.0, 1174.66]; // Dmaj resolve
    chordFreqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const lpf = ctx.createBiquadFilter();
      const env = ctx.createGain();

      osc.type = idx < 3 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, revStart);
      osc.detune.setValueAtTime((idx - 2.5) * 3.5, revStart);

      lpf.type = 'lowpass';
      lpf.frequency.setValueAtTime(550, revStart);
      lpf.frequency.exponentialRampToValueAtTime(2400, lockPeak);

      env.gain.setValueAtTime(0.0001, revStart);
      env.gain.linearRampToValueAtTime(0.036 - idx * 0.0025, lockPeak);
      env.gain.exponentialRampToValueAtTime(0.0001, lockPeak + 1.55);

      osc.connect(lpf);
      lpf.connect(env);
      env.connect(this.masterGain!);
      osc.start(revStart);
      osc.stop(lockPeak + 1.65);
      osc.onended = () => {
        osc.disconnect();
        lpf.disconnect();
        env.disconnect();
      };
      activeStops.push(() => {
        try {
          osc.stop();
        } catch {
          // ignore
        }
      });
    });

    this.coalesceCleanup = () => {
      activeStops.forEach((fn) => fn());
    };
  }

  public stopHeartCoalescence(): void {
    this.coalesceCleanup?.();
    this.coalesceCleanup = null;
  }

  public dispose(): void {
    this.stopChargeHum();
    this.stopWarpWhoosh();
    this.stopHeartCoalescence();
    this.cutSupernovaImplosion();
    this.unsubStore?.();
    this.unsubStore = null;
  }
}

export const sfxEngine = new ProceduralSfxEngine();
