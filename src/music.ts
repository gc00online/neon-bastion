import { sfx } from './audio';

// One continuous eight-bar theme changes its arrangement with the game state.
// 0 = quiet stall, 1 = service, 2 = a tense rush of customers.
export type MusicLevel = 0 | 1 | 2;

const BPM = 92;
const STEP = 60 / BPM / 4;
const CHORDS = [
  [57, 60, 64, 69], // Am
  [53, 57, 60, 64], // Fmaj7
  [48, 55, 59, 64], // Cmaj7
  [55, 59, 62, 69], // Gadd9
];
const ROOTS = [45, 41, 48, 43];
const MELODY: ReadonlyArray<Readonly<Record<number, number>>> = [
  { 0: 69, 3: 72, 6: 76, 10: 74, 12: 72 },
  { 0: 69, 4: 72, 7: 74, 10: 72, 13: 69 },
  { 0: 67, 3: 72, 6: 76, 8: 79, 12: 76 },
  { 0: 74, 4: 72, 7: 69, 10: 67, 12: 69 },
  { 0: 69, 3: 72, 6: 76, 9: 79, 12: 76, 14: 74 },
  { 0: 72, 4: 69, 7: 72, 10: 74, 12: 76 },
  { 0: 79, 3: 76, 6: 72, 10: 74, 12: 76 },
  { 0: 74, 4: 72, 7: 69, 10: 67, 12: 69 },
];
const freq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

class Music {
  enabled = true;
  private level: MusicLevel = 0;
  private timer?: number;
  private bus?: GainNode;
  private echo?: GainNode;
  private rainGain?: GainNode;
  private rainSource?: AudioBufferSourceNode;
  private rainBuffer?: AudioBuffer;
  private step = 0;
  private next = 0;
  private wanted = false;
  private readonly unlockBound = () => this.start();

  play(level: MusicLevel) {
    this.level = level;
    this.wanted = true;
    if (!this.enabled) return;
    if (this.timer !== undefined) {
      this.setRainLevel();
      return;
    }
    sfx.onUnlock(this.unlockBound);
  }

  stop() {
    this.wanted = false;
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    const ctx = sfx.ctx;
    if (ctx && this.bus) {
      this.bus.gain.cancelScheduledValues(ctx.currentTime);
      this.bus.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
    }
    this.rainSource?.stop();
    this.rainSource = undefined;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) {
      const wanted = this.wanted;
      this.stop();
      this.wanted = wanted;
    } else if (this.wanted) this.play(this.level);
  }

  private start() {
    const ctx = sfx.ctx;
    if (!ctx || !this.enabled || !this.wanted || this.timer !== undefined) return;
    if (!this.bus) {
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -19;
      compressor.knee.value = 18;
      compressor.ratio.value = 2.3;
      compressor.attack.value = 0.012;
      compressor.release.value = 0.23;
      compressor.connect(ctx.destination);
      this.bus = ctx.createGain();
      this.bus.gain.value = 0;
      this.bus.connect(compressor);

      const delay = ctx.createDelay(1);
      delay.delayTime.value = STEP * 3;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.21;
      const wet = ctx.createGain();
      wet.gain.value = 0.23;
      this.echo = ctx.createGain();
      this.echo.connect(delay);
      delay.connect(feedback).connect(delay);
      delay.connect(wet).connect(this.bus);
    }
    this.bus.gain.cancelScheduledValues(ctx.currentTime);
    this.bus.gain.setTargetAtTime(0.52, ctx.currentTime, 0.19);
    this.startRain(ctx);
    this.next = ctx.currentTime + 0.08;
    this.timer = window.setInterval(() => this.tick(), 25);
  }

  private startRain(ctx: AudioContext) {
    if (!this.bus) return;
    if (!this.rainBuffer) {
      const length = Math.round(ctx.sampleRate * 4);
      const overlap = Math.round(ctx.sampleRate * 0.2);
      const raw = new Float32Array(length + overlap);
      for (let i = 0; i < raw.length; i++) raw[i] = Math.random() * 2 - 1;
      this.rainBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const samples = this.rainBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) samples[i] = raw[overlap + i];
      // The overlap ends immediately before the loop's first sample in raw,
      // so the join has the same continuity as any other pair of noise samples.
      for (let i = 0; i < overlap; i++) {
        const mix = (i + 1) / overlap;
        samples[length - overlap + i] = raw[length + i] * (1 - mix) + raw[i] * mix;
      }
    }
    const source = ctx.createBufferSource();
    source.buffer = this.rainBuffer;
    source.loop = true;
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 2300;
    const high = ctx.createBiquadFilter();
    high.type = 'highpass';
    high.frequency.value = 540;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0;
    source.connect(high).connect(low).connect(this.rainGain).connect(this.bus);
    const rainGain = this.rainGain;
    source.onended = () => { source.disconnect(); high.disconnect(); low.disconnect(); rainGain.disconnect(); };
    source.start();
    this.rainSource = source;
    this.setRainLevel();
  }

  private setRainLevel() {
    const ctx = sfx.ctx;
    if (!ctx || !this.rainGain) return;
    this.rainGain.gain.setTargetAtTime(this.level === 0 ? 0.012 : 0.006, ctx.currentTime, 0.3);
  }

  private tick() {
    const ctx = sfx.ctx;
    if (!ctx || ctx.state !== 'running') return;
    if (this.next < ctx.currentTime - 0.2) this.next = ctx.currentTime + 0.05;
    while (this.next < ctx.currentTime + 0.16) {
      this.schedule(this.step, this.next);
      this.next += STEP;
      this.step = (this.step + 1) % 128;
    }
  }

  private schedule(i: number, when: number) {
    const lv = this.level;
    const phraseBar = Math.floor(i / 16);
    const chordIndex = phraseBar % 4;
    const s = i % 16;
    const chord = CHORDS[chordIndex];
    // Swing is subtle; the pulse stays steady for aiming and UI feedback.
    const t = when + (s % 2 ? 0.028 : 0);

    if (s === 0) {
      for (const note of chord) this.pad(freq(note), t, STEP * 15.5, lv === 2 ? 0.009 : 0.016);
    }
    const melody = MELODY[phraseBar][s];
    if (melody !== undefined) this.flute(freq(melody), t, STEP * (s === 0 ? 2.9 : 2.1), lv === 0 ? 0.032 : 0.046);
    if (s === 2 || s === 6 || s === 10 || s === 14 || (lv === 2 && (s === 4 || s === 12))) {
      const note = chord[(s / 4 | 0) % chord.length] + 12;
      this.pluck(freq(note), t, STEP * 2.1, lv === 0 ? 0.027 : 0.038);
    }

    if (lv >= 1) {
      if (s === 0 || s === 6 || s === 8 || s === 12) {
        const note = ROOTS[chordIndex] + (s === 6 ? 7 : 0);
        this.pluck(freq(note), t, STEP * 3.2, 0.072, false);
      }
      if (s === 0 || s === 8) this.drum(t, lv === 2 ? 0.18 : 0.13);
      if (s === 4 || s === 12) this.wood(t, lv === 2 ? 0.09 : 0.068);
      if (s === 2 || s === 6 || s === 10 || s === 14 || (lv === 2 && s % 2 === 1)) {
        this.brush(t, lv === 2 ? 0.036 : 0.023);
      }
      if (lv === 2 && s === 14) this.pluck(freq(chord[2] + 24), t, STEP * 1.3, 0.033);
    }
  }

  private pad(f: number, t: number, duration: number, volume: number) {
    const ctx = sfx.ctx!;
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, t);
    envelope.gain.linearRampToValueAtTime(volume, t + 0.23);
    envelope.gain.setValueAtTime(volume * 0.74, t + duration * 0.66);
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 980;
    let active = 2;
    for (const detune of [-4, 4]) {
      const oscillator = ctx.createOscillator();
      oscillator.type = 'triangle';
      oscillator.frequency.value = f;
      oscillator.detune.value = detune;
      oscillator.connect(filter);
      oscillator.onended = () => {
        oscillator.disconnect();
        if (--active === 0) { filter.disconnect(); envelope.disconnect(); }
      };
      oscillator.start(t);
      oscillator.stop(t + duration + 0.02);
    }
    filter.connect(envelope).connect(this.bus!);
  }

  private pluck(f: number, t: number, duration: number, volume: number, echo = true) {
    const ctx = sfx.ctx!;
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, t);
    envelope.gain.linearRampToValueAtTime(volume, t + 0.006);
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(3200, f * 5), t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(280, f * 1.5), t + duration);
    let active = 2;
    for (const [wave, ratio, gain] of [['triangle', 1, 1], ['sine', 2, 0.26]] as const) {
      const oscillator = ctx.createOscillator();
      const partial = ctx.createGain();
      oscillator.type = wave;
      oscillator.frequency.value = f * ratio;
      partial.gain.value = gain;
      oscillator.connect(partial).connect(filter);
      oscillator.onended = () => {
        oscillator.disconnect();
        partial.disconnect();
        if (--active === 0) { filter.disconnect(); envelope.disconnect(); }
      };
      oscillator.start(t);
      oscillator.stop(t + duration + 0.02);
    }
    filter.connect(envelope).connect(this.bus!);
    if (echo) envelope.connect(this.echo!);
  }

  private flute(f: number, t: number, duration: number, volume: number) {
    const ctx = sfx.ctx!;
    const oscillator = ctx.createOscillator();
    const overtone = ctx.createOscillator();
    const mix = ctx.createGain();
    const overtoneGain = ctx.createGain();
    const envelope = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = f;
    overtone.type = 'triangle';
    overtone.frequency.value = f * 2;
    overtoneGain.gain.value = 0.11;
    mix.gain.value = 1;
    oscillator.connect(mix);
    overtone.connect(overtoneGain).connect(mix);
    envelope.gain.setValueAtTime(0.0001, t);
    envelope.gain.linearRampToValueAtTime(volume, t + 0.065);
    envelope.gain.setValueAtTime(volume * 0.8, t + duration * 0.62);
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    mix.connect(envelope).connect(this.bus!);
    envelope.connect(this.echo!);
    let active = 2;
    oscillator.onended = () => {
      oscillator.disconnect();
      if (--active === 0) { overtoneGain.disconnect(); mix.disconnect(); envelope.disconnect(); }
    };
    overtone.onended = () => {
      overtone.disconnect();
      if (--active === 0) { overtoneGain.disconnect(); mix.disconnect(); envelope.disconnect(); }
    };
    oscillator.start(t);
    overtone.start(t);
    oscillator.stop(t + duration + 0.02);
    overtone.stop(t + duration + 0.02);
  }

  private drum(t: number, volume: number) {
    const ctx = sfx.ctx!;
    const oscillator = ctx.createOscillator();
    const envelope = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(118, t);
    oscillator.frequency.exponentialRampToValueAtTime(53, t + 0.19);
    envelope.gain.setValueAtTime(volume, t);
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    oscillator.connect(envelope).connect(this.bus!);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
    oscillator.start(t);
    oscillator.stop(t + 0.26);
  }

  private wood(t: number, volume: number) {
    const ctx = sfx.ctx!;
    const oscillator = ctx.createOscillator();
    const envelope = ctx.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(380, t);
    oscillator.frequency.exponentialRampToValueAtTime(240, t + 0.09);
    envelope.gain.setValueAtTime(volume, t);
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + 0.105);
    oscillator.connect(envelope).connect(this.bus!);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
    oscillator.start(t);
    oscillator.stop(t + 0.12);
  }

  private brush(t: number, volume: number) {
    const ctx = sfx.ctx!;
    if (!sfx.noiseBuf) return;
    const source = ctx.createBufferSource();
    source.buffer = sfx.noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 4300;
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(volume, t);
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + 0.065);
    source.connect(filter).connect(envelope).connect(this.bus!);
    source.onended = () => { source.disconnect(); filter.disconnect(); envelope.disconnect(); };
    source.start(t, Math.random() * 1.5);
    source.stop(t + 0.075);
  }
}

export const music = new Music();
