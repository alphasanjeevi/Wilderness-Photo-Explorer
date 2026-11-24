import { WeatherType } from '../types/game';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private chirpTimer: number | null = null;
  private muted = false;
  private adPaused = false;
  private started = false;
  private currentWeather: WeatherType = 'clear';
  private currentTimeNorm = 0.35;

  private syncMasterGain(): void {
    if (!this.masterGain || !this.ctx) return;
    const effectiveMuted = this.muted || this.adPaused;
    this.masterGain.gain.setTargetAtTime(effectiveMuted ? 0 : 0.55, this.ctx.currentTime, 0.06);
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    this.syncMasterGain();
  }

  public setAdPaused(paused: boolean): void {
    this.adPaused = paused;
    this.syncMasterGain();
    if (this.ctx) {
      if (paused && this.ctx.state === 'running') {
        void this.ctx.suspend();
      } else if (!paused && !this.muted && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public unlockAndStart(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted || this.adPaused ? 0 : 0.55;
      this.masterGain.connect(this.ctx.destination);
      this.setupAmbience();
      this.setupEngine();
      this.scheduleNextBirdChirp();
      this.started = true;
    }
    if (this.ctx.state === 'suspended' && !this.adPaused) {
      void this.ctx.resume();
    }
  }

  private setupAmbience(): void {
    if (!this.ctx || !this.masterGain) return;
    const bufferSize = this.ctx.sampleRate * 3;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.95 * b2 + white * 0.048;
      output[i] = (b0 + b1 + b2 + white * 0.05) * 0.32;
    }

    // Gentle forest breeze
    const windSource = this.ctx.createBufferSource();
    windSource.buffer = noiseBuffer;
    windSource.loop = true;
    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 420;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.14;
    windSource.connect(windFilter);
    windFilter.connect(this.windGain);
    this.windGain.connect(this.masterGain);
    windSource.start();

    // Gentle rainfall layer
    const rainSource = this.ctx.createBufferSource();
    rainSource.buffer = noiseBuffer;
    rainSource.loop = true;
    const rainFilter = this.ctx.createBiquadFilter();
    rainFilter.type = 'bandpass';
    rainFilter.frequency.value = 1800;
    rainFilter.Q.value = 0.7;
    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.value = 0;
    rainSource.connect(rainFilter);
    rainFilter.connect(this.rainGain);
    this.rainGain.connect(this.masterGain);
    rainSource.start();
  }

  private setupEngine(): void {
    if (!this.ctx || !this.masterGain) return;
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'triangle';
    this.engineOsc.frequency.value = 46;

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 140;

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;

    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);
    this.engineOsc.start();
  }

  public updateAmbience(speedKmh: number, weather: WeatherType, timeNorm: number, inPhotoMode: boolean): void {
    this.currentWeather = weather;
    this.currentTimeNorm = timeNorm;
    if (!this.started || !this.ctx) return;

    const now = this.ctx.currentTime;
    if (this.rainGain) {
      const targetRain = weather === 'rainy' ? (inPhotoMode ? 0.14 : 0.2) : 0;
      this.rainGain.gain.setTargetAtTime(targetRain, now, 0.6);
    }
    if (this.windGain) {
      this.windGain.gain.setTargetAtTime(weather === 'rainy' ? 0.1 : 0.15, now, 0.5);
    }

    // Engine turns quiet when parked or in photo mode so wildlife ambiance shines (PRD §6.2)
    if (this.engineGain && this.engineOsc && this.engineFilter) {
      const moving = speedKmh > 0.8 && !inPhotoMode;
      const speedNorm = Math.min(1, speedKmh / 30);
      const targetGain = moving ? 0.04 + speedNorm * 0.05 : 0;
      const targetFreq = 42 + speedNorm * 48;
      this.engineGain.gain.setTargetAtTime(targetGain, now, 0.12);
      this.engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.12);
      this.engineFilter.frequency.setTargetAtTime(120 + speedNorm * 160, now, 0.12);
    }
  }

  private scheduleNextBirdChirp(): void {
    const delayMs = 2800 + Math.random() * 4800;
    this.chirpTimer = window.setTimeout(() => {
      this.playAmbientWildlifeCall();
      this.scheduleNextBirdChirp();
    }, delayMs);
  }

  private playAmbientWildlifeCall(): void {
    if (!this.ctx || !this.masterGain || this.muted || this.adPaused || this.ctx.state !== 'running') return;
    if (this.currentWeather === 'rainy' && Math.random() < 0.55) return;

    const now = this.ctx.currentTime;
    const isDusk = this.currentTimeNorm > 0.68;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';

    if (isDusk) {
      // Soft cricket / treefrog dusk pulse
      const base = 1700 + Math.random() * 600;
      osc.frequency.setValueAtTime(base, now);
      osc.frequency.exponentialRampToValueAtTime(base * 1.06, now + 0.07);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.024, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.12);
    } else {
      // Gentle tropical songbird two-note chirp
      const f1 = 1250 + Math.random() * 700;
      const f2 = f1 * (1.18 + Math.random() * 0.22);
      osc.frequency.setValueAtTime(f1, now);
      osc.frequency.exponentialRampToValueAtTime(f2, now + 0.08);
      osc.frequency.setValueAtTime(f2 * 0.96, now + 0.14);
      osc.frequency.exponentialRampToValueAtTime(f1 * 1.05, now + 0.24);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.032, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.002, now + 0.11);
      gain.gain.linearRampToValueAtTime(0.028, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  }

  public playFocusLock(): void {
    this.unlockAndStart();
    if (!this.ctx || !this.masterGain || this.muted || this.adPaused) return;
    const now = this.ctx.currentTime;
    const notes = [880, 1174.66];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.055);
      gain.gain.setValueAtTime(0.0001, now + idx * 0.055);
      gain.gain.linearRampToValueAtTime(0.08, now + idx * 0.055 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.055 + 0.16);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + idx * 0.055);
      osc.stop(now + idx * 0.055 + 0.18);
    });
  }

  public playShutterClick(): void {
    this.unlockAndStart();
    if (!this.ctx || !this.masterGain || this.muted || this.adPaused) return;
    const now = this.ctx.currentTime;

    // Crisp mechanical shutter transient
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.06);
    const buf = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const env = Math.exp(-i / (bufferSize * 0.22));
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1400;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(now);

    // Second blade click
    const noise2 = this.ctx.createBufferSource();
    noise2.buffer = buf;
    const gain2 = this.ctx.createGain();
    gain2.gain.setValueAtTime(0.22, now + 0.065);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    noise2.connect(filter);
    filter.connect(gain2);
    gain2.connect(this.masterGain);
    noise2.start(now + 0.065);
  }

  public playSpeciesUnlock(): void {
    this.unlockAndStart();
    if (!this.ctx || !this.masterGain || this.muted || this.adPaused) return;
    const now = this.ctx.currentTime;
    const chord = [523.25, 659.25, 783.99, 1046.5];
    chord.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.07;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.11, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.48);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.5);
    });
  }

  public playHorn(): void {
    this.unlockAndStart();
    if (!this.ctx || !this.masterGain || this.muted || this.adPaused) return;
    const now = this.ctx.currentTime;
    [392, 493.88].forEach((freq) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.26);
    });
  }

  public playBump(strength = 1): void {
    this.unlockAndStart();
    if (!this.ctx || !this.masterGain || this.muted || this.adPaused) return;
    const now = this.ctx.currentTime;
    const vol = Math.min(0.18, 0.04 + strength * 0.025);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(105, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.11);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  public dispose(): void {
    if (this.chirpTimer !== null) {
      window.clearTimeout(this.chirpTimer);
      this.chirpTimer = null;
    }
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}

export const soundEngine = new SoundEngine();
