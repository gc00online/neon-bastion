import { sfx } from './audio';

// 배경음악도 파일 없이 실시간 합성하는 신스웨이브 루프.
// level 0: 메뉴(패드+잔잔한 아르페지오) / 1: 전투(베이스+드럼 추가) / 2: 보스(스네어, 하이햇 강화)
export type MusicLevel = 0 | 1 | 2;

const BPM = 104;
const STEP = 60 / BPM / 4;
// A단조 진행: Am - F - C - G
const CHORDS = [
  [57, 60, 64],
  [53, 57, 60],
  [55, 60, 64],
  [55, 59, 62],
];
const ARP = [0, 1, 2, 3, 2, 1, 0, 2, 0, 1, 2, 3, 2, 3, 1, 2];
const freq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

class Music {
  enabled = true;
  private level: MusicLevel = 0;
  private timer?: number;
  private bus?: GainNode;
  private fx?: GainNode;
  private step = 0;
  private next = 0;
  private wanted = false;

  play(level: MusicLevel) {
    this.level = level;
    this.wanted = true;
    if (!this.enabled || this.timer !== undefined) return;
    sfx.onUnlock(() => this.start());
  }

  stop() {
    this.wanted = false;
    if (this.timer !== undefined) { clearInterval(this.timer); this.timer = undefined; }
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) { const w = this.wanted; this.stop(); this.wanted = w; }
    else if (this.wanted) this.play(this.level);
  }

  private start() {
    const ctx = sfx.ctx;
    if (!ctx || this.timer !== undefined || !this.enabled || !this.wanted) return;
    if (!this.bus) {
      this.bus = ctx.createGain();
      this.bus.gain.value = 0.55;
      this.bus.connect(ctx.destination);
      // 아르페지오용 에코
      const delay = ctx.createDelay(1);
      delay.delayTime.value = STEP * 3;
      const fb = ctx.createGain();
      fb.gain.value = 0.3;
      const wet = ctx.createGain();
      wet.gain.value = 0.35;
      this.fx = ctx.createGain();
      this.fx.connect(delay);
      delay.connect(fb).connect(delay);
      delay.connect(wet).connect(this.bus);
    }
    this.next = ctx.currentTime + 0.08;
    this.timer = window.setInterval(() => this.tick(), 25);
  }

  private tick() {
    const ctx = sfx.ctx!;
    if (ctx.state !== 'running') return;
    if (this.next < ctx.currentTime - 0.2) this.next = ctx.currentTime + 0.05; // 멈췄다 돌아온 경우
    while (this.next < ctx.currentTime + 0.15) {
      this.schedule(this.step, this.next);
      this.next += STEP;
      this.step = (this.step + 1) % 64;
    }
  }

  private schedule(i: number, t: number) {
    const lv = this.level;
    const bar = Math.floor(i / 16) % 4, s = i % 16;
    const chord = CHORDS[bar];
    const notes = [chord[0], chord[1], chord[2], chord[0] + 12];

    // 아르페지오
    if (lv > 0 || s % 2 === 0) {
      const n = notes[ARP[s]] + 12;
      this.voice('square', freq(n), t, STEP * 0.8, lv === 0 ? 0.022 : 0.028, lv === 2 ? 2600 : 1700, true);
    }
    // 패드
    if (s === 0 && lv < 2) {
      for (const n of chord) this.voice('triangle', freq(n), t, STEP * 16, 0.02, 1200, false, 0.6);
    }
    if (lv >= 1) {
      // 베이스
      if (s % 2 === 0) this.voice('sawtooth', freq(chord[0] - 24 + (s % 4 === 2 ? 12 : 0)), t, STEP * 1.6, 0.07, 480);
      // 킥
      if (s % 4 === 0) this.kick(t);
      // 하이햇
      if (s % 4 === 2 || (lv === 2 && s % 2 === 1)) this.noise(t, 0.035, lv === 2 ? 0.045 : 0.035, 'highpass', 7000);
      // 스네어
      if (lv === 2 && (s === 4 || s === 12)) this.noise(t, 0.16, 0.1, 'bandpass', 1800);
    }
  }

  private voice(type: OscillatorType, f: number, t: number, dur: number, vol: number, cutoff: number, echo = false, attack = 0.005) {
    const ctx = sfx.ctx!;
    const o = ctx.createOscillator();
    const flt = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = f;
    flt.type = 'lowpass';
    flt.frequency.value = cutoff;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(flt).connect(g).connect(this.bus!);
    if (echo) g.connect(this.fx!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private kick(t: number) {
    const ctx = sfx.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.16);
    g.gain.setValueAtTime(0.28, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g).connect(this.bus!);
    o.start(t);
    o.stop(t + 0.22);
  }

  private noise(t: number, dur: number, vol: number, type: BiquadFilterType, f: number) {
    const ctx = sfx.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = sfx.noiseBuf!;
    const flt = ctx.createBiquadFilter();
    flt.type = type;
    flt.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt).connect(g).connect(this.bus!);
    src.start(t, Math.random() * 0.3);
    src.stop(t + dur + 0.02);
  }
}

export const music = new Music();
