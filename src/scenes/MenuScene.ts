import Phaser from 'phaser';
import { W, H, COLOR, px, setupCamera, hex } from '../config';
import { CORE_TEX_R } from './BootScene';
import { LAB } from '../data/lab';
import { save } from '../save';
import { sfx } from '../audio';
import { music } from '../music';
import { openSettings } from '../ui/settings';
import { L } from '../i18n';
import { todayKey, todayModifier } from '../data/daily';
import { txt, label, num, panel, button, arrowIcon, CUT_MAIN } from '../ui/widgets';
import { drawBackground } from '../ui/bg';

interface Blip { x: number; y: number; kind: 'hostile' | 'unknown'; phase: number; }

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  private radarG!: Phaser.GameObjects.Graphics;
  private rcx = 0; private rcy = 0; private rr = 0;
  private blips: Blip[] = [];
  private ticker!: Phaser.GameObjects.Text;
  private tickerX0 = 0;
  private tickerW = 0;
  private dailyTimer!: Phaser.GameObjects.Text;

  create() {
    setupCamera(this);
    drawBackground(this, { brackets: true, dust: true });
    const k = Math.min(1, (H - px(20)) / px(844));
    const Y = (n: number) => Math.round(px(n) * k);
    const MX = px(24);

    // 헤더 상태줄
    label(this, MX, Y(30), 'NB-07 · DEFENSE GRID', px(10), COLOR.dim);
    const sg = this.add.graphics();
    sg.fillStyle(COLOR.green, 1).fillRect(W - MX - px(100), Y(30) - 3, 6, 6);
    label(this, W - MX, Y(30), 'SYSTEM READY', px(10), COLOR.dim, 'right');
    // 라이브 티커
    const lr = save.lastRun;
    const parts = [
      lr ? `LAST RUN #${save.runs} · W${lr.wave} · ${lr.kills} KILLS · ${Math.floor(lr.time / 60)}:${String(lr.time % 60).padStart(2, '0')}` : L('첫 출격을 기다리는 중', 'AWAITING FIRST SORTIE'),
      `BEST W${save.best}`,
      `${L('연구 가능', 'RESEARCH READY')} ${this.affordable()}`,
      'NO ADS · OFFLINE',
    ];
    this.ticker = label(this, MX, Y(50), parts.join('   //   ') + '   //   ', px(9), COLOR.mute);
    this.tickerX0 = MX; this.tickerW = W - MX * 2;
    const mask = this.add.graphics().setVisible(false);
    mask.fillStyle(0xffffff).fillRect(MX, Y(40), W - MX * 2, px(20));
    this.ticker.setMask(mask.createGeometryMask());
    const tg = this.add.graphics();
    tg.lineStyle(1, COLOR.line, 1).lineBetween(MX, Y(62), W - MX, Y(62));

    // 아래에서 위로 쌓아 어떤 화면 높이에서도 겹치지 않게
    const lr2 = save.lastRun;
    const footerY = H - px(22);
    const rowY = footerY - px(16) - px(28);
    const dailyH = px(64), dailyTop = rowY - px(28) - px(12) - dailyH;
    const playH = px(68), playTop = dailyTop - px(12) - playH;
    const gh = px(50), gy = playTop - (lr2 ? px(44) : px(30)) - gh;
    const ty = gy - px(62);
    const radarTop = Y(70);
    this.rcx = W / 2; this.rcy = Math.round((radarTop + ty - px(44)) / 2);
    this.rr = Math.min(px(128), Math.round((ty - px(44) - radarTop) / 2) - px(16));

    // 레이더
    const halo = this.add.image(this.rcx, this.rcy, 'glow').setTint(COLOR.cyan).setAlpha(0.14).setScale(this.rr / 128 * 2.2).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: halo, alpha: 0.2, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.radarG = this.add.graphics();
    const core = this.add.image(this.rcx, this.rcy, 'core').setTint(COLOR.cyan).setScale(px(28) * (this.rr / px(128)) / CORE_TEX_R).setDepth(3);
    this.tweens.add({ targets: core, rotation: Math.PI * 2, duration: 14000, repeat: -1 });
    label(this, this.rcx, this.rcy - this.rr - px(10), '000', px(9), COLOR.dim, 'center');
    label(this, this.rcx + this.rr + px(14), this.rcy, '090', px(9), COLOR.dim);
    label(this, this.rcx, this.rcy + this.rr + px(10), '180', px(9), COLOR.dim, 'center');
    label(this, this.rcx - this.rr - px(14), this.rcy, '270', px(9), COLOR.dim, 'right');
    this.blips = [
      { x: 0.62, y: -0.42, kind: 'hostile', phase: 0 },
      { x: -0.68, y: 0.55, kind: 'hostile', phase: 0.4 },
      { x: 0.7, y: 0.5, kind: 'hostile', phase: 0.8 },
      { x: -0.48, y: -0.58, kind: 'unknown', phase: 1.2 },
    ];
    // 접촉 집계
    const cg = this.add.graphics();
    const cpx = W - MX - px(90), cpy = this.rcy + this.rr * 0.55;
    cg.lineStyle(2, COLOR.line, 1).lineBetween(cpx - px(10), cpy - px(16), cpx - px(10), cpy + px(16));
    label(this, cpx, cpy - px(12), 'CONTACTS', px(9), COLOR.dim);
    const h = this.blips.filter(b => b.kind === 'hostile').length;
    cg.fillStyle(COLOR.red, 1).fillPoints([{ x: cpx + 4, y: cpy + px(2) - 4 }, { x: cpx + 8, y: cpy + px(2) }, { x: cpx + 4, y: cpy + px(2) + 4 }, { x: cpx, y: cpy + px(2) }], true);
    label(this, cpx + px(14), cpy + px(2), `${h} HOSTILE`, px(9), COLOR.body);
    cg.fillStyle(COLOR.amber, 1).fillCircle(cpx + 4, cpy + px(14), 3);
    label(this, cpx + px(14), cpy + px(14), '1 UNKNOWN', px(9), COLOR.body);

    // 타이틀
    txt(this, W / 2, ty, 'NEON BASTION', px(34), { font: 'num', weight: 700, spacing: px(5), glow: 22 });
    const lg = this.add.graphics();
    const sub = txt(this, W / 2, ty + px(34), L('로그라이크 디펜스', 'ROGUELIKE DEFENSE'), px(12), { color: COLOR.cyan, weight: 500, spacing: px(3) });
    const lw = (W - MX * 2 - sub.width - px(20)) / 2;
    for (let i = 0; i < 20; i++) {
      const a = (i + 1) / 20;
      lg.lineStyle(1, COLOR.cyan, a * 0.9);
      lg.lineBetween(MX + lw * i / 20, ty + px(34), MX + lw * (i + 1) / 20, ty + px(34));
      lg.lineBetween(W - MX - lw * i / 20, ty + px(34), W - MX - lw * (i + 1) / 20, ty + px(34));
    }

    // 통계 그리드
    const gw = (W - MX * 2) / 3;
    const gg = this.add.graphics();
    panel(gg, W / 2, gy + gh / 2, W - MX * 2, gh);
    gg.lineStyle(2, COLOR.line, 1).lineBetween(MX + gw, gy, MX + gw, gy + gh).lineBetween(MX + gw * 2, gy, MX + gw * 2, gy + gh);
    const cell = (i: number, name: string, value: string, color = COLOR.text) => {
      txt(this, MX + gw * i + px(12), gy + px(14), name, px(11), { align: 'left', color: COLOR.dim, weight: 500 });
      return num(this, MX + gw * i + px(12), gy + px(34), value, px(20), color, 'left');
    };
    cell(0, L('최고 기록', 'Best'), `W${save.best}`);
    cell(1, L('보석', 'Gems'), `◇ ${save.gems.toLocaleString()}`, COLOR.cyan);
    cell(2, L('출격 횟수', 'Sorties'), `${save.runs}`);

    // 최근 출격 줄
    if (lr2) {
      const ly = gy + gh + px(16);
      const dg = this.add.graphics(); dg.fillStyle(COLOR.red, 0.6).fillRect(MX, ly - 3, 6, 6);
      label(this, MX + px(12), ly, `LAST SORTIE · RUN ${save.runs} · WAVE ${lr2.wave} · ${Math.floor(lr2.time / 60)}:${String(lr2.time % 60).padStart(2, '0')} · +${lr2.gems} ◇`, px(9), COLOR.dim);
    }

    // 버튼들
    const bw = W - MX * 2;
    const headStart = (save.lab.start ?? 0) > 0;
    const play = button(this, W / 2, playTop + playH / 2, bw, playH, L('출격', 'Sortie'), () => this.go('Game'), {
      kind: 'primary', left: true, size: px(22), icon: arrowIcon,
      sub: headStart ? L('웨이브 1부터 · 선행 연구 적용', 'From wave 1 · head start applied') : L('웨이브 1부터 · 끝까지 버티세요', 'From wave 1 · survive as long as you can'),
    });
    this.tweens.add({ targets: play, scale: 1.01, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    // 일일 작전
    const day = todayKey();
    const mod = todayModifier(day);
    const rec = save.daily.day === day ? save.daily : null;
    const by = dailyTop;
    const dh = dailyH;
    const dp = this.add.graphics();
    panel(dp, W / 2, by + dh / 2, bw, dh, { fill: 0x120d05, stroke: COLOR.amber, cut: CUT_MAIN(px(10)) });
    label(this, MX + px(16), by + px(18), 'DAILY OP', px(10), COLOR.amber);
    txt(this, MX + px(16) + px(66), by + px(18), L(`일일 작전 · ${mod.name}`, `Daily op · ${mod.name}`), px(15), { align: 'left', color: 0xffe2a8, weight: 600 });
    txt(this, MX + px(16), by + px(44), rec?.best ? L(`오늘 최고 W${rec.best} · ${mod.desc.replace('\n', ' · ')}`, `Today's best W${rec.best} · ${mod.desc.replace('\n', ' · ')}`) : mod.desc.replace('\n', ' · '), px(11), { align: 'left', color: 0xc9a766, weight: 500 });
    const badge = this.add.graphics();
    const bx = W - MX - px(16);
    if (!rec || rec.runs === 0) {
      badge.fillStyle(COLOR.amber, 1).fillRect(bx - px(58), by + px(10), px(58), px(16));
      label(this, bx - px(29), by + px(18), L('첫 판 x2', 'FIRST x2'), px(9), 0x120d05, 'center');
    }
    this.dailyTimer = label(this, bx, by + px(44), '', px(10), 0xc9a766, 'right');
    const dz = this.add.zone(W / 2, by + dh / 2, bw, dh).setInteractive({ useHandCursor: true });
    dz.on('pointerdown', () => dp.setAlpha(0.7));
    dz.on('pointerout', () => dp.setAlpha(1));
    dz.on('pointerup', () => { dp.setAlpha(1); sfx.click(); this.go('Game', { daily: true }); });

    const half = (bw - px(12)) / 2;
    const aff = this.affordable();
    button(this, MX + half / 2, rowY, half, px(56), L('연구소', 'Lab'), () => this.go('Lab'), { kind: 'secondary', size: px(15), left: true, icon: aff ? (g, x, y) => { g.fillStyle(COLOR.green, 1).fillRect(x - 3, y - 3, 6, 6); } : undefined });
    if (aff) num(this, MX + half - px(36), rowY, `${aff}`, px(13), COLOR.green, 'right');
    button(this, W - MX - half / 2, rowY, half, px(56), L('설정', 'Settings'), () => openSettings(this, true), { kind: 'secondary', size: px(15), left: true });

    // 푸터
    label(this, MX, footerY, 'V1.0.0', px(10), COLOR.mute);
    label(this, W - MX, footerY, L('광고 없음 · 오프라인', 'NO ADS · OFFLINE'), px(10), COLOR.mute, 'right');

    music.play(0);
    this.cameras.main.fadeIn(300, 4, 7, 11);
  }

  private affordable() {
    return LAB.filter(u => (save.lab[u.id] ?? 0) < u.max && save.gems >= u.cost(save.lab[u.id] ?? 0)).length;
  }

  update(t: number, dt: number) {
    // 티커 흐르기
    this.ticker.x -= dt * 0.03;
    if (this.ticker.x + this.ticker.width < this.tickerX0) this.ticker.x = this.tickerX0 + this.tickerW;

    // 일일 작전 남은 시간
    const now = new Date();
    const end = new Date(now); end.setHours(24, 0, 0, 0);
    const s = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));
    this.dailyTimer.setText(`${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`);

    // 레이더
    const g = this.radarG;
    const { rcx, rcy, rr } = this;
    g.clear();
    g.lineStyle(px(6), COLOR.lineP, 0.8);
    for (let i = 0; i < 72; i++) { const a = (i / 72) * Math.PI * 2; g.beginPath(); g.arc(rcx, rcy, rr, a, a + 0.012, false); g.strokePath(); }
    g.lineStyle(px(8), COLOR.cyan, 0.8);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.beginPath(); g.arc(rcx, rcy, rr, a - 0.006, a + 0.006, false); g.strokePath(); }
    g.lineStyle(1, COLOR.line, 1).strokeCircle(rcx, rcy, rr * 0.92).strokeCircle(rcx, rcy, rr * 0.66);
    g.lineStyle(1, COLOR.lineP, 1);
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; g.beginPath(); g.arc(rcx, rcy, rr * 0.39, a, a + 0.12, false); g.strokePath(); }
    g.lineStyle(1, COLOR.line, 1).lineBetween(rcx - rr * 0.92, rcy, rcx + rr * 0.92, rcy).lineBetween(rcx, rcy - rr * 0.92, rcx, rcy + rr * 0.92);
    // 스윕 (잔상 3겹)
    const sweep = (t / 4000) * Math.PI * 2;
    const trails: [number, number][] = [[1.4, 0.04], [0.95, 0.1], [0.5, 0.22]];
    for (const [span, a] of trails) {
      g.fillStyle(COLOR.cyan, a);
      g.slice(rcx, rcy, rr * 0.92, sweep - span, sweep, false);
      g.fillPath();
    }
    g.lineStyle(1.5, COLOR.cyan, 0.9).lineBetween(rcx, rcy, rcx + Math.cos(sweep) * rr * 0.92, rcy + Math.sin(sweep) * rr * 0.92);
    g.fillStyle(COLOR.text, 1).fillCircle(rcx + Math.cos(sweep) * rr * 0.92, rcy + Math.sin(sweep) * rr * 0.92, 2.5);
    // 블립 (스윕이 지나가면 핑)
    for (const b of this.blips) {
      const bx = rcx + b.x * rr * 0.92, by = rcy + b.y * rr * 0.92;
      const ba = Math.atan2(by - rcy, bx - rcx);
      let d = (sweep - ba) % (Math.PI * 2); if (d < 0) d += Math.PI * 2;
      const ping = Math.max(0, 1 - d / 1.6);
      const col = b.kind === 'hostile' ? COLOR.red : COLOR.amber;
      if (b.kind === 'hostile') { g.fillStyle(col, 0.5 + ping * 0.5); g.fillPoints([{ x: bx, y: by - 5 }, { x: bx + 5, y: by }, { x: bx, y: by + 5 }, { x: bx - 5, y: by }], true); }
      else { g.fillStyle(col, 0.5 + ping * 0.5); g.fillCircle(bx, by, 4); }
      if (ping > 0.01) { g.lineStyle(1.5, col, ping * 0.8).strokeCircle(bx, by, 6 + (1 - ping) * 14); }
    }
    // 데이터 먼지
    for (let i = 0; i < 10; i++) {
      const a = i * 2.39996 + t / 9000, r = rr * (0.3 + ((i * 37) % 60) / 100);
      g.fillStyle(COLOR.cyan, 0.12 + 0.12 * Math.sin(t / 700 + i));
      g.fillCircle(rcx + Math.cos(a) * r, rcy + Math.sin(a) * r, 1.5);
    }
  }

  private go(key: string, data?: object) {
    sfx.unlock();
    this.cameras.main.fadeOut(200, 4, 7, 11);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(key, data));
  }
}

export const _hex = hex;
