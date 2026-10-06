import { sfx } from './audio';

// 배경음악: CC0(퍼블릭 도메인) 우주 앰비언트 음원. 출처는 public/music/CREDITS.txt
// level 0: 메뉴·연구소 / 1: 전투 / 2: 보스(전투 곡 그대로)
export type MusicLevel = 0 | 1 | 2;

const TRACKS = ['music/menu.m4a', 'music/battle.m4a'];
const FADE = 1.2;

class Music {
  enabled = true;
  /** 0~1, 설정 슬라이더 값 */
  volume = 0.5;
  private level: MusicLevel = 0;
  private wanted = false;
  private els: HTMLAudioElement[] = [];
  private gains: GainNode[] = [];
  private cur = -1;

  play(level: MusicLevel) {
    this.level = level;
    this.wanted = true;
    if (this.enabled) sfx.onUnlock(() => this.switchTo(level === 0 ? 0 : 1));
  }

  stop() {
    this.wanted = false;
    this.switchTo(-1);
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) this.switchTo(-1);
    else if (this.wanted) this.play(this.level);
  }

  setVolume(v: number) {
    this.volume = v;
    const ctx = sfx.ctx;
    if (ctx && this.cur >= 0) this.ramp(this.gains[this.cur], this.gain(), 0.05);
  }

  // 귀로 듣는 크기는 로그에 가까워서 제곱으로 깎아 준다
  private gain() { return this.volume * this.volume * 0.9; }

  private ramp(g: GainNode, to: number, dur: number) {
    const t = sfx.ctx!.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(to, t + dur);
  }

  // 오디오 컨텍스트가 처음 깨어날 때(사용자 터치 안) 한 번 만든다.
  // iOS 는 터치 안에서 한 번 재생해 둔 요소만 나중에 자유롭게 재생할 수 있어서 여기서 미리 깨워 둔다.
  private init() {
    const ctx = sfx.ctx;
    if (!ctx || this.els.length) return;
    for (const src of TRACKS) {
      const el = new Audio(src);
      el.loop = true;
      el.preload = 'auto';
      const g = ctx.createGain();
      g.gain.value = 0;
      ctx.createMediaElementSource(el).connect(g).connect(ctx.destination);
      el.play().then(() => { if (this.els[this.cur] !== el) el.pause(); }).catch(() => { /* 다음 터치에서 다시 시도 */ });
      this.els.push(el);
      this.gains.push(g);
    }
    document.addEventListener('visibilitychange', () => {
      const el = this.els[this.cur];
      if (!el) return;
      if (document.hidden) el.pause(); else el.play().catch(() => { /* 무시 */ });
    });
  }

  private switchTo(i: number) {
    if (!sfx.ctx) return;
    this.init();
    if (i === this.cur) return;
    const prev = this.cur;
    this.cur = i;
    if (prev >= 0) {
      const el = this.els[prev];
      this.ramp(this.gains[prev], 0, FADE);
      setTimeout(() => { if (this.cur !== prev) el.pause(); }, FADE * 1000 + 50);
    }
    if (i >= 0) {
      this.els[i].play().catch(() => { /* 다음 터치에서 다시 시도 */ });
      this.ramp(this.gains[i], this.gain(), FADE);
    }
  }
}

export const music = new Music();
