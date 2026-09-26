import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

// 효과음은 파일 없이 WebAudio로 즉석 합성한다. (용량 0, 저작권 걱정 없음)
class Sfx {
  ctx?: AudioContext;
  private master?: GainNode;
  noiseBuf?: AudioBuffer;
  private unlockCbs: (() => void)[] = [];
  private last: Record<string, number> = {};
  enabled = true;

  // iOS/Android는 사용자 터치 안에서 오디오를 깨워야 한다.
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.6;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 0.5;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      // 앱이 백그라운드로 가면 소리도 멈춤
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) this.ctx?.suspend(); else this.ctx?.resume();
      });
      this.unlockCbs.forEach(cb => cb());
    }
    if (this.ctx.state === 'suspended' && !document.hidden) this.ctx.resume();
  }

  onUnlock(cb: () => void) {
    if (this.ctx) cb(); else this.unlockCbs.push(cb);
  }

  private throttle(key: string, ms: number) {
    const now = performance.now();
    if (now - (this.last[key] ?? 0) < ms) return true;
    this.last[key] = now;
    return false;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0) {
    if (!this.enabled || !this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, freq: number, delay = 0) {
    if (!this.enabled || !this.ctx || !this.master || !this.noiseBuf) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.2), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
    s.stop(t + dur + 0.02);
  }

  shoot() { if (!this.throttle('shoot', 70)) this.tone(900 + Math.random() * 120, 0.06, 'square', 0.025, 420); }
  hit() { if (!this.throttle('hit', 45)) this.tone(260, 0.04, 'triangle', 0.05, 180); }
  kill() { if (!this.throttle('kill', 40)) this.noise(0.12, 0.09, 2400); }
  boom() { if (!this.throttle('boom', 80)) { this.noise(0.35, 0.18, 900); this.tone(110, 0.3, 'sine', 0.15, 40); } }
  zap() { if (!this.throttle('zap', 60)) this.tone(1400, 0.08, 'sawtooth', 0.03, 300); }
  nova() { this.tone(200, 0.4, 'sine', 0.18, 60); this.noise(0.3, 0.08, 1500); }
  hurt() { if (!this.throttle('hurt', 120)) { this.tone(180, 0.22, 'sawtooth', 0.1, 70); this.noise(0.15, 0.08, 700); } }
  click() { this.tone(660, 0.05, 'triangle', 0.08, 880); }
  pick() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.14, 'triangle', 0.09, undefined, i * 0.05)); }
  waveStart() { this.tone(330, 0.12, 'square', 0.05, undefined); this.tone(495, 0.18, 'square', 0.05, undefined, 0.1); }
  waveClear() { [392, 523, 659].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.1, undefined, i * 0.07)); }
  boss() { for (let i = 0; i < 3; i++) this.tone(110, 0.28, 'sawtooth', 0.12, 80, i * 0.35); }
  lose() { this.noise(0.9, 0.25, 1200); this.tone(220, 1.1, 'sawtooth', 0.12, 40); }
  buy() { this.tone(784, 0.08, 'triangle', 0.1); this.tone(1175, 0.14, 'triangle', 0.1, undefined, 0.07); }
  deny() { this.tone(140, 0.12, 'square', 0.06); }
}

export const sfx = new Sfx();

// 앱에서는 기기 진동(햅틱), 웹에서는 지원하는 브라우저만 진동
export const haptics = { enabled: true };

export function vibrate(ms: number) {
  if (!haptics.enabled) return;
  if (Capacitor.isNativePlatform()) {
    Haptics.impact({ style: ms >= 150 ? ImpactStyle.Heavy : ms >= 60 ? ImpactStyle.Medium : ImpactStyle.Light }).catch(() => { /* 무시 */ });
    return;
  }
  try { navigator.vibrate?.(ms); } catch { /* 지원 안 하는 기기 */ }
}
