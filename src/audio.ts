import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

// Wood, bubbling sauce and little brass bells replace the old arcade beeps.
type Tone = {
  frequency: number; duration: number; volume: number; wave?: OscillatorType;
  end?: number; delay?: number; attack?: number; cutoff?: number;
};

class Sfx {
  ctx?: AudioContext;
  noiseBuf?: AudioBuffer;
  private master?: GainNode;
  private room?: GainNode;
  private unlockCbs = new Set<() => void>();
  private last: Record<string, number> = {};
  enabled = true;

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      const ctx: AudioContext = new AC();
      this.ctx = ctx;

      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -15;
      compressor.knee.value = 16;
      compressor.ratio.value = 3;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.18;
      compressor.connect(ctx.destination);
      this.master = ctx.createGain();
      this.master.gain.value = 0.72;
      this.master.connect(compressor);

      // A short room tail joins sounds without washing out repeated attacks.
      const impulse = ctx.createBuffer(2, Math.round(ctx.sampleRate * 0.7), ctx.sampleRate);
      for (let channel = 0; channel < 2; channel++) {
        const samples = impulse.getChannelData(channel);
        for (let i = 0; i < samples.length; i++) {
          samples[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / samples.length, 2.8) * 0.38;
        }
      }
      const reverb = ctx.createConvolver();
      reverb.buffer = impulse;
      const wet = ctx.createGain();
      wet.gain.value = 0.12;
      reverb.connect(wet).connect(compressor);
      this.room = ctx.createGain();
      this.room.connect(reverb);

      this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const noise = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < noise.length; i++) noise[i] = Math.random() * 2 - 1;

      document.addEventListener('visibilitychange', () => {
        if (document.hidden) void ctx.suspend();
        else void ctx.resume().catch(() => {});
      });
      for (const cb of this.unlockCbs) cb();
      this.unlockCbs.clear();
    }
    if (this.ctx.state === 'suspended' && !document.hidden) void this.ctx.resume().catch(() => {});
  }

  onUnlock(cb: () => void) {
    if (this.ctx) cb();
    else this.unlockCbs.add(cb);
  }

  private throttle(key: string, ms: number) {
    const now = performance.now();
    if (now - (this.last[key] ?? -Infinity) < ms) return true;
    this.last[key] = now;
    return false;
  }

  private tone({ frequency, duration, volume, wave = 'sine', end, delay = 0, attack = 0.006, cutoff }: Tone) {
    const ctx = this.ctx;
    if (!this.enabled || !ctx || !this.master) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const envelope = ctx.createGain();
    let filter: BiquadFilterNode | undefined;
    osc.type = wave;
    osc.frequency.setValueAtTime(frequency, t);
    if (end) osc.frequency.exponentialRampToValueAtTime(Math.max(25, end), t + duration * 0.86);
    envelope.gain.setValueAtTime(0.0001, t);
    envelope.gain.linearRampToValueAtTime(volume, t + Math.min(attack, duration * 0.35));
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    if (cutoff) {
      filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      osc.connect(filter).connect(envelope);
    } else osc.connect(envelope);
    envelope.connect(this.master);
    envelope.connect(this.room!);
    osc.onended = () => { osc.disconnect(); filter?.disconnect(); envelope.disconnect(); };
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  private noise(duration: number, volume: number, frequency: number, delay = 0, type: BiquadFilterType = 'lowpass') {
    const ctx = this.ctx;
    if (!this.enabled || !ctx || !this.master || !this.noiseBuf) return;
    const t = ctx.currentTime + delay;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(frequency, t);
    if (type === 'lowpass') filter.frequency.exponentialRampToValueAtTime(Math.max(100, frequency * 0.45), t + duration);
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, t);
    envelope.gain.linearRampToValueAtTime(volume, t + Math.min(0.012, duration * 0.3));
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    source.connect(filter).connect(envelope).connect(this.master);
    source.onended = () => { source.disconnect(); filter.disconnect(); envelope.disconnect(); };
    source.start(t, Math.random() * Math.max(0, 1.9 - duration));
    source.stop(t + duration + 0.01);
  }

  private bell(frequency: number, delay = 0, volume = 0.075) {
    this.tone({ frequency, duration: 0.36, volume, delay });
    this.tone({ frequency: frequency * 2.41, duration: 0.16, volume: volume * 0.25, delay });
    this.tone({ frequency: frequency * 3.87, duration: 0.09, volume: volume * 0.12, delay });
  }

  shoot() {
    if (this.throttle('shoot', 72)) return;
    const pitch = 670 + Math.random() * 90;
    this.tone({ frequency: pitch, end: pitch * 0.62, duration: 0.105, volume: 0.046, wave: 'triangle' });
    this.noise(0.045, 0.018, 1700);
  }
  hit() {
    if (this.throttle('hit', 53)) return;
    this.tone({ frequency: 330 + Math.random() * 80, end: 160, duration: 0.09, volume: 0.055 });
    this.noise(0.07, 0.035, 1100);
  }
  kill() {
    if (this.throttle('kill', 48)) return;
    this.tone({ frequency: 240, end: 115, duration: 0.15, volume: 0.065 });
    this.noise(0.12, 0.045, 1700);
  }
  boom() {
    if (this.throttle('boom', 110)) return;
    this.tone({ frequency: 155, end: 46, duration: 0.37, volume: 0.21, attack: 0.002 });
    this.noise(0.31, 0.1, 1200);
    this.bell(196, 0.025, 0.025);
  }
  zap() {
    if (this.throttle('zap', 80)) return;
    this.noise(0.18, 0.05, 3800, 0, 'highpass');
    this.tone({ frequency: 920, end: 480, duration: 0.15, volume: 0.026, wave: 'triangle' });
  }
  nova() {
    this.tone({ frequency: 180, end: 80, duration: 0.45, volume: 0.17 });
    this.noise(0.4, 0.065, 1800);
    [523, 659, 880].forEach((f, i) => this.bell(f, i * 0.065, 0.04));
  }
  hurt() {
    if (this.throttle('hurt', 150)) return;
    this.tone({ frequency: 245, end: 85, duration: 0.28, volume: 0.12, wave: 'triangle' });
    this.noise(0.18, 0.065, 680);
    this.bell(185, 0, 0.036);
  }
  click() {
    this.tone({ frequency: 590, end: 430, duration: 0.075, volume: 0.052, wave: 'triangle' });
    this.noise(0.035, 0.011, 1300);
  }
  pick() { [440, 523, 659, 880].forEach((f, i) => this.bell(f, i * 0.09, 0.075)); }
  waveStart() {
    this.bell(392, 0, 0.06);
    this.bell(523, 0.17, 0.075);
    this.noise(0.07, 0.024, 650, 0.17);
  }
  waveClear() { [392, 523, 659, 880].forEach((f, i) => this.bell(f, i * 0.12, 0.085)); }
  boss() {
    [0, 0.34, 0.68].forEach((delay, i) => {
      this.tone({ frequency: 135, end: 55, duration: 0.42, volume: 0.16 + i * 0.02, delay });
      this.noise(0.16, 0.055, 620, delay);
    });
    this.bell(220, 0.7, 0.08);
  }
  lose() {
    [440, 349, 261].forEach((f, i) => this.bell(f, i * 0.24, 0.05));
    this.tone({ frequency: 110, end: 55, duration: 0.75, volume: 0.08, delay: 0.15 });
  }
  buy() {
    this.bell(784, 0, 0.09);
    this.bell(1175, 0.09, 0.085);
    this.bell(1568, 0.17, 0.05);
  }
  deny() {
    this.tone({ frequency: 240, end: 180, duration: 0.12, volume: 0.06, wave: 'triangle' });
    this.noise(0.055, 0.018, 480);
  }
}

export const sfx = new Sfx();
export const haptics = { enabled: true };

export function vibrate(ms: number) {
  if (!haptics.enabled) return;
  if (Capacitor.isNativePlatform()) {
    Haptics.impact({ style: ms >= 150 ? ImpactStyle.Heavy : ms >= 60 ? ImpactStyle.Medium : ImpactStyle.Light }).catch(() => {});
    return;
  }
  try { navigator.vibrate?.(ms); } catch { /* unsupported device */ }
}
