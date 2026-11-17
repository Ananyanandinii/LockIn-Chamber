const HARMONIC_SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];

export function warmthToHz(v: number): number {
  return Math.round(140 * Math.pow(20, Math.max(0, Math.min(1, v))));
}

export function warmthToRainHz(v: number): number {
  return Math.round(1400 * Math.pow(6.1, Math.max(0, Math.min(1, v))));
}

export function warmthLabel(v: number): string {
  if (v < 0.35) return 'Velvet Dark';
  if (v < 0.7) return 'Warm Dusk';
  return 'Crisp Air';
}

function applyOverlapCrossfade(
  buf: AudioBuffer,
  fadeSamples: number,
  fillChannel: (ch: number, data: Float32Array) => void,
): void {
  const len = buf.length;
  const f = Math.min(fadeSamples, Math.floor(len / 4));
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const ext = new Float32Array(len + f);
    fillChannel(ch, ext);
    for (let i = 0; i < f; i++) {
      const t = i / f;
      const a = Math.sin(t * Math.PI * 0.5);
      const b = Math.cos(t * Math.PI * 0.5);
      ext[i] = ext[i] * a + ext[len + i] * b;
    }
    buf.getChannelData(ch).set(ext.subarray(0, len));
  }
}

class SolarisAudioEngine {
  private ctx: AudioContext | null = null;
  private masterFilter: BiquadFilterNode | null = null;
  private rainToneFilter: BiquadFilterNode | null = null;
  private brownGain: GainNode | null = null;
  private rainGain: GainNode | null = null;

  private micStream: MediaStream | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private micTimer: number | null = null;

  private knobVal = 0.42;
  private brownOn = false;
  private brownVol = 0.6;
  private autoPaused = false;

  private ensureContext(): AudioContext {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return this.ctx;
    }

    const AudioCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtor();
    this.ctx = ctx;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 1.0;
    filter.frequency.value = warmthToHz(this.knobVal);
    filter.connect(ctx.destination);
    this.masterFilter = filter;

    const rainTone = ctx.createBiquadFilter();
    rainTone.type = 'lowpass';
    rainTone.Q.value = 0.65;
    rainTone.frequency.value = warmthToRainHz(this.knobVal);
    rainTone.connect(ctx.destination);
    this.rainToneFilter = rainTone;

    // 1. Deep Brown Noise Channel
    const brownSize = ctx.sampleRate * 4;
    const bBuf = ctx.createBuffer(1, brownSize, ctx.sampleRate);
    applyOverlapCrossfade(bBuf, Math.floor(ctx.sampleRate * 0.25), (_ch, bData) => {
      let last = 0;
      for (let i = 0; i < bData.length; i++) {
        const w = Math.random() * 2 - 1;
        bData[i] = (last + 0.02 * w) / 1.02;
        last = bData[i];
        bData[i] *= 3.0;
      }
    });
    const bSrc = ctx.createBufferSource();
    bSrc.buffer = bBuf;
    bSrc.loop = true;

    const brownGain = ctx.createGain();
    brownGain.gain.value = 0.0001;
    bSrc.connect(brownGain).connect(filter);
    bSrc.start();
    this.brownGain = brownGain;

    // 2. Realistic 4-Layer Stereo Rainfall Synthesis
    const rainGain = ctx.createGain();
    rainGain.gain.value = 0.0001;
    rainGain.connect(rainTone);
    this.rainGain = rainGain;

    const sr = ctx.sampleRate;

    // Layer A: Stereo Ambient Rainfall Wash (uncorrelated L/R pink-weighted noise + slow weather LFO)
    const washLen = Math.floor(sr * 7.3);
    const washBuf = ctx.createBuffer(2, washLen, sr);
    applyOverlapCrossfade(washBuf, Math.floor(sr * 0.35), (_ch, data) => {
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      let b3 = 0;
      let b4 = 0;
      let b5 = 0;
      for (let i = 0; i < data.length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + white * 0.5362) * 0.045;
      }
    });

    const washSrc = ctx.createBufferSource();
    washSrc.buffer = washBuf;
    washSrc.loop = true;

    const washHP = ctx.createBiquadFilter();
    washHP.type = 'highpass';
    washHP.frequency.value = 340;
    washHP.Q.value = 0.5;

    const washShape = ctx.createBiquadFilter();
    washShape.type = 'peaking';
    washShape.frequency.value = 2100;
    washShape.Q.value = 0.7;
    washShape.gain.value = 3.5;

    const washLP = ctx.createBiquadFilter();
    washLP.type = 'lowpass';
    washLP.frequency.value = 6200;
    washLP.Q.value = 0.6;

    const washLevel = ctx.createGain();
    washLevel.gain.value = 0.42;

    // Gentle dual-LFO gust modulation so rain breathes naturally
    const gustLfo = ctx.createOscillator();
    gustLfo.type = 'sine';
    gustLfo.frequency.value = 0.11;
    const gustDepth = ctx.createGain();
    gustDepth.gain.value = 0.08;
    gustLfo.connect(gustDepth).connect(washLevel.gain);
    gustLfo.start();

    washSrc.connect(washHP).connect(washShape).connect(washLP).connect(washLevel).connect(rainGain);
    washSrc.start();

    // Layer B: Warm Distant Rain Rumble / Outdoor Body (160 Hz - 420 Hz)
    const bodyFilter = ctx.createBiquadFilter();
    bodyFilter.type = 'bandpass';
    bodyFilter.frequency.value = 270;
    bodyFilter.Q.value = 0.7;
    const bodyGain = ctx.createGain();
    bodyGain.gain.value = 0.22;
    washSrc.connect(bodyFilter).connect(bodyGain).connect(rainGain);

    // Layer C: High-Density Stereo Surface Patter (~160 soft water splashes/sec across L & R)
    const patterLen = Math.floor(sr * 8.9);
    const patterBuf = ctx.createBuffer(2, patterLen, sr);
    applyOverlapCrossfade(patterBuf, Math.floor(sr * 0.3), (_ch, pData) => {
      let idx = Math.floor(Math.random() * 200);
      while (idx < pData.length) {
        const gap = Math.floor(sr * (0.002 + Math.pow(Math.random(), 1.8) * 0.015));
        idx += gap;
        if (idx >= pData.length) break;

        const amp = (0.12 + Math.random() * 0.55) * (Math.random() > 0.86 ? 1.5 : 0.75);
        const splashSamples = Math.floor(sr * (0.003 + Math.random() * 0.0045));
        const attackSamples = Math.max(4, Math.floor(splashSamples * 0.12));
        let lpState = 0;
        const alpha = 0.25 + Math.random() * 0.45;
        for (let s = 0; s < splashSamples && idx + s < pData.length; s++) {
          const env =
            s < attackSamples
              ? s / attackSamples
              : Math.exp(-(s - attackSamples) / (splashSamples * 0.28));
          const w = Math.random() * 2 - 1;
          lpState += alpha * (w - lpState);
          pData[idx + s] += lpState * env * amp;
        }
      }
    });

    const patterSrc = ctx.createBufferSource();
    patterSrc.buffer = patterBuf;
    patterSrc.loop = true;

    const patterHP = ctx.createBiquadFilter();
    patterHP.type = 'highpass';
    patterHP.frequency.value = 850;

    const patterBP = ctx.createBiquadFilter();
    patterBP.type = 'peaking';
    patterBP.frequency.value = 2600;
    patterBP.Q.value = 0.85;
    patterBP.gain.value = 4.5;

    const patterLP = ctx.createBiquadFilter();
    patterLP.type = 'lowpass';
    patterLP.frequency.value = 6800;

    const patterGain = ctx.createGain();
    patterGain.gain.value = 0.68;

    patterSrc
      .connect(patterHP)
      .connect(patterBP)
      .connect(patterLP)
      .connect(patterGain)
      .connect(rainGain);
    patterSrc.start();

    // Layer D: Close Windowpane & Puddle Droplets (organic water-bubble cavity resonance)
    const dropLen = Math.floor(sr * 10.7);
    const dropFade = Math.floor(sr * 0.3);
    const dropBuf = ctx.createBuffer(2, dropLen, sr);
    const leftExt = new Float32Array(dropLen + dropFade);
    const rightExt = new Float32Array(dropLen + dropFade);

    let dIdx = Math.floor(sr * 0.05);
    while (dIdx < leftExt.length) {
      const gap = Math.floor(sr * (0.045 + Math.pow(Math.random(), 1.9) * 0.19));
      dIdx += gap;
      if (dIdx >= leftExt.length) break;

      const pan = Math.random() * 2 - 1;
      const gL = Math.cos(((pan + 1) * Math.PI) / 4);
      const gR = Math.sin(((pan + 1) * Math.PI) / 4);
      const amp = 0.09 + Math.random() * 0.18;

      const durSamples = Math.floor(sr * (0.012 + Math.random() * 0.014));
      const f0 = 720 + Math.random() * 1150;
      const f1 = f0 * (1.18 + Math.random() * 0.22);
      let phase = 0;

      for (let k = 0; k < durSamples && dIdx + k < leftExt.length; k++) {
        const progress = k / durSamples;
        const env = Math.sin(Math.min(1, progress * 6) * Math.PI * 0.5) * Math.exp(-progress * 5.2);
        const freq = f0 + (f1 - f0) * progress;
        phase += (2 * Math.PI * freq) / sr;
        const splash = k < durSamples * 0.2 ? (Math.random() * 2 - 1) * 0.35 : 0;
        const sample = (Math.sin(phase) * 0.55 + splash) * env * amp;
        leftExt[dIdx + k] += sample * gL;
        rightExt[dIdx + k] += sample * gR;
      }
    }
    for (let i = 0; i < dropFade; i++) {
      const t = i / dropFade;
      const a = Math.sin(t * Math.PI * 0.5);
      const b = Math.cos(t * Math.PI * 0.5);
      leftExt[i] = leftExt[i] * a + leftExt[dropLen + i] * b;
      rightExt[i] = rightExt[i] * a + rightExt[dropLen + i] * b;
    }
    dropBuf.getChannelData(0).set(leftExt.subarray(0, dropLen));
    dropBuf.getChannelData(1).set(rightExt.subarray(0, dropLen));

    const dropSrc = ctx.createBufferSource();
    dropSrc.buffer = dropBuf;
    dropSrc.loop = true;

    const dropSoftLP = ctx.createBiquadFilter();
    dropSoftLP.type = 'lowpass';
    dropSoftLP.frequency.value = 3400;

    const dropGain = ctx.createGain();
    dropGain.gain.value = 0.42;

    dropSrc.connect(dropSoftLP).connect(dropGain).connect(rainGain);
    dropSrc.start();

    return ctx;
  }

  public syncState(opts: {
    brownOn: boolean;
    rainOn: boolean;
    brownVol: number;
    rainVol: number;
    autoPaused: boolean;
    warmth: number;
  }): void {
    this.brownOn = opts.brownOn;
    this.brownVol = opts.brownVol;
    this.autoPaused = opts.autoPaused;
    this.knobVal = opts.warmth;

    if (!this.ctx && (opts.brownOn || opts.rainOn)) {
      this.ensureContext();
    }

    if (!this.ctx || !this.brownGain || !this.rainGain || !this.masterFilter) return;

    const now = this.ctx.currentTime;
    const bTarget = opts.brownOn && !opts.autoPaused ? opts.brownVol * 0.9 : 0.0001;
    const rTarget = opts.rainOn && !opts.autoPaused ? opts.rainVol * 0.95 : 0.0001;

    this.brownGain.gain.setTargetAtTime(Math.max(0.0001, bTarget), now, 0.18);
    this.rainGain.gain.setTargetAtTime(Math.max(0.0001, rTarget), now, 0.18);
    this.masterFilter.frequency.setTargetAtTime(warmthToHz(opts.warmth), now, 0.06);
    if (this.rainToneFilter) {
      this.rainToneFilter.frequency.setTargetAtTime(warmthToRainHz(opts.warmth), now, 0.06);
    }
  }

  public playMechClick(pitch = 680, vol = 0.12): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.035);
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(g).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.045);
  }

  public playClack(on: boolean): void {
    this.playMechClick(on ? 640 : 460, 0.15);
    window.setTimeout(() => this.playMechClick(on ? 300 : 240, 0.055), 75);
  }

  public playBootChime(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    [440, 554.37, 659.25, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.055);
      g.gain.setValueAtTime(0.08, now + i * 0.055);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.055 + 0.35);
      osc.connect(g).connect(ctx.destination);
      osc.start(now + i * 0.055);
      osc.stop(now + i * 0.055 + 0.36);
    });
  }

  public playSingingBowl(): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    [256, 512, 768].forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);
      g.gain.setValueAtTime(0.001, now);
      g.gain.exponentialRampToValueAtTime(0.14 / (idx + 1), now + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 4.0);
      osc.connect(g).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 4.1);
    });
  }

  public pluckHarmonic(nx: number, ny: number): number {
    const ctx = this.ensureContext();
    const idx = Math.min(
      HARMONIC_SCALE.length - 1,
      Math.max(0, Math.floor(nx * HARMONIC_SCALE.length)),
    );
    const freq = HARMONIC_SCALE[idx] * (ny < 0.45 ? 2 : 1);
    const now = ctx.currentTime;
    [1, 2].forEach((mult, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq * mult, now);
      g.gain.setValueAtTime(0.001, now);
      g.gain.exponentialRampToValueAtTime(0.09 / (i + 1), now + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
      osc.connect(g).connect(this.masterFilter ?? ctx.destination);
      osc.start(now);
      osc.stop(now + 1.55);
    });
    return idx;
  }

  public playOrbGather(count = 1): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const baseFreq = HARMONIC_SCALE[count % HARMONIC_SCALE.length] * 2;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.25, now + 0.14);
    g.gain.setValueAtTime(0.001, now);
    g.gain.exponentialRampToValueAtTime(0.032, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    osc.connect(g).connect(this.masterFilter ?? ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  public async startMicShield(): Promise<boolean> {
    try {
      const ctx = this.ensureContext();
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const src = ctx.createMediaStreamSource(this.micStream);
      this.micAnalyser = ctx.createAnalyser();
      this.micAnalyser.fftSize = 256;
      src.connect(this.micAnalyser);

      const poll = () => {
        if (!this.micAnalyser) return;
        const arr = new Uint8Array(this.micAnalyser.frequencyBinCount);
        this.micAnalyser.getByteTimeDomainData(arr);
        let sum = 0;
        for (let i = 0; i < arr.length; i++) {
          const v = (arr[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / arr.length);
        if (this.brownOn && !this.autoPaused && this.brownGain && this.ctx) {
          const base = this.brownVol * 0.9;
          const target = rms > 0.06 ? Math.min(1, base + (rms - 0.06) * 3) : base;
          this.brownGain.gain.setTargetAtTime(
            Math.max(0.0001, target),
            this.ctx.currentTime,
            0.25,
          );
        }
        this.micTimer = window.setTimeout(poll, 300);
      };
      poll();
      return true;
    } catch {
      this.stopMicShield();
      return false;
    }
  }

  public stopMicShield(): void {
    if (this.micTimer !== null) {
      window.clearTimeout(this.micTimer);
      this.micTimer = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    this.micAnalyser = null;
  }
}

export const solarisAudio = new SolarisAudioEngine();
