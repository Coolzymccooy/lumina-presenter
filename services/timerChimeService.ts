/**
 * Timer Chime Service
 *
 * Synthesized audio chimes for speaker timer threshold alerts.
 * Uses Web Audio API — no external audio files required.
 */

type ChimeType = 'amber' | 'red' | 'milestone' | 'overtime';

interface ChimeConfig {
  frequency: number;
  duration: number;
  repeats: number;
  gap: number;
  waveform: OscillatorType;
  gainPeak: number;
}

const CHIME_CONFIGS: Record<ChimeType, ChimeConfig> = {
  amber: {
    frequency: 880,
    duration: 0.2,
    repeats: 1,
    gap: 0,
    waveform: 'sine',
    gainPeak: 0.35,
  },
  red: {
    frequency: 1047,
    duration: 0.15,
    repeats: 2,
    gap: 0.12,
    waveform: 'sine',
    gainPeak: 0.4,
  },
  milestone: {
    frequency: 660,
    duration: 0.1,
    repeats: 1,
    gap: 0,
    waveform: 'sine',
    gainPeak: 0.25,
  },
  overtime: {
    frequency: 1175,
    duration: 0.12,
    repeats: 3,
    gap: 0.1,
    waveform: 'square',
    gainPeak: 0.3,
  },
};

class TimerChimeService {
  private ctx: AudioContext | null = null;
  private _muted = false;
  private _volume = 0.7;

  get muted(): boolean {
    return this._muted;
  }

  set muted(value: boolean) {
    this._muted = value;
  }

  get volume(): number {
    return this._volume;
  }

  set volume(value: number) {
    this._volume = Math.max(0, Math.min(1, value));
  }

  private ensureContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(config: ChimeConfig): void {
    if (this._muted) return;

    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    for (let i = 0; i < config.repeats; i++) {
      const startTime = now + i * (config.duration + config.gap);

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = config.waveform;
      osc.frequency.setValueAtTime(config.frequency, startTime);

      const peakGain = config.gainPeak * this._volume;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.01);
      gain.gain.setValueAtTime(peakGain, startTime + config.duration * 0.6);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + config.duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + config.duration + 0.05);
    }
  }

  playAmberChime(): void {
    this.playTone(CHIME_CONFIGS.amber);
  }

  playRedChime(): void {
    this.playTone(CHIME_CONFIGS.red);
  }

  playMilestoneChime(): void {
    this.playTone(CHIME_CONFIGS.milestone);
  }

  playOvertimeChime(): void {
    this.playTone(CHIME_CONFIGS.overtime);
  }

  dispose(): void {
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
    }
    this.ctx = null;
  }
}

export const timerChimeService = new TimerChimeService();
export type { ChimeType };
