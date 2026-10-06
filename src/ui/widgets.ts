import Phaser from 'phaser';
import { FONT_KR, FONT_NUM, RES, COLOR, hex, px } from '../config';
import { sfx } from '../audio';

type G = Phaser.GameObjects.Graphics;

export interface TextOpts {
  color?: number;
  /** 400 / 500 / 600 / 700 */
  weight?: number;
  /** num: Chakra Petch(숫자·영문 라벨) / kr: IBM Plex Sans KR(한글 본문) */
  font?: 'num' | 'kr';
  glow?: boolean | number;
  align?: 'left' | 'center' | 'right';
  wrap?: number;
  lineSpacing?: number;
  /** 자간(px). 영문 라벨은 글자 크기의 0.14~0.2배 */
  spacing?: number;
  /** 세로 기준점 0~1 (기본 0.5) */
  oy?: number;
}

export function txt(scene: Phaser.Scene, x: number, y: number, str: string, size: number, opts: TextOpts = {}) {
  const color = opts.color ?? COLOR.text;
  const t = scene.add.text(x, y, str, {
    fontFamily: opts.font === 'num' ? FONT_NUM : FONT_KR,
    fontSize: `${size}px`,
    fontStyle: `${opts.weight ?? (opts.font === 'num' ? 700 : 600)}`,
    color: hex(color),
    align: opts.align ?? 'center',
    resolution: RES,
    lineSpacing: opts.lineSpacing ?? 4,
    wordWrap: opts.wrap ? { width: opts.wrap, useAdvancedWrap: true } : undefined,
  });
  if (opts.spacing) t.setLetterSpacing(opts.spacing);
  if (opts.glow) t.setShadow(0, 0, hex(color), typeof opts.glow === 'number' ? opts.glow : 14, false, true);
  return t.setOrigin(opts.align === 'left' ? 0 : opts.align === 'right' ? 1 : 0.5, opts.oy ?? 0.5);
}

/** 영문 데이터 라벨: Chakra Petch 600, 대문자, 넓은 자간 */
export function label(scene: Phaser.Scene, x: number, y: number, str: string, size: number, color = COLOR.dim, align: TextOpts['align'] = 'left') {
  return txt(scene, x, y, str.toUpperCase(), size, { font: 'num', weight: 600, color, align, spacing: Math.round(size * 0.16) });
}

/** 숫자 표시: Chakra Petch 700 */
export function num(scene: Phaser.Scene, x: number, y: number, str: string, size: number, color = COLOR.text, align: TextOpts['align'] = 'center') {
  return txt(scene, x, y, str, size, { font: 'num', weight: 700, color, align });
}

export interface Cut { tl?: number; tr?: number; br?: number; bl?: number; }
/** 주 버튼 모양: 좌상·우하 깎기 */
export const CUT_MAIN = (c: number): Cut => ({ tl: c, br: c });
/** 패널 모양: 우상·좌하 깎기 */
export const CUT_PANEL = (c: number): Cut => ({ tr: c, bl: c });

/** 모서리를 깎은 사각형의 꼭짓점 (중심 기준) */
export function chamferPoints(x: number, y: number, w: number, h: number, cut: Cut): Phaser.Types.Math.Vector2Like[] {
  const l = x - w / 2, r = x + w / 2, t = y - h / 2, b = y + h / 2;
  const tl = cut.tl ?? 0, tr = cut.tr ?? 0, br = cut.br ?? 0, bl = cut.bl ?? 0;
  const pts: Phaser.Types.Math.Vector2Like[] = [];
  pts.push({ x: l + tl, y: t });
  pts.push({ x: r - tr, y: t });
  if (tr) pts.push({ x: r, y: t + tr });
  pts.push({ x: r, y: b - br });
  if (br) pts.push({ x: r - br, y: b });
  pts.push({ x: l + bl, y: b });
  if (bl) pts.push({ x: l, y: b - bl });
  pts.push({ x: l, y: t + tl });
  return pts;
}

export interface PanelOpts {
  fill?: number;
  fillAlpha?: number;
  stroke?: number;
  strokeAlpha?: number;
  lineW?: number;
  cut?: Cut;
  /** 바깥 글로우 반경(px). 0 이면 없음 */
  glow?: number;
}

/** 표면 패널 (중심 좌표 기준). 기본: 표면1 + 1px 선 */
export function panel(g: G, x: number, y: number, w: number, h: number, o: PanelOpts = {}) {
  const pts = chamferPoints(x, y, w, h, o.cut ?? {});
  const stroke = o.stroke ?? COLOR.line;
  if (o.glow) {
    g.lineStyle(o.glow, stroke, 0.10);
    g.strokePoints(pts, true, true);
    g.lineStyle(o.glow / 2, stroke, 0.14);
    g.strokePoints(pts, true, true);
  }
  g.fillStyle(o.fill ?? COLOR.surf1, o.fillAlpha ?? 1);
  g.fillPoints(pts, true, true);
  if (o.lineW !== 0) {
    g.lineStyle(o.lineW ?? 2, stroke, o.strokeAlpha ?? 1);
    g.strokePoints(pts, true, true);
  }
}

/** 눈금 있는 게이지. 비율 0~1. 25% 이하면 적색. */
export function gauge(g: G, x: number, y: number, w: number, h: number, ratio: number, color: number, o: { bg?: number; tick?: number; danger?: boolean; lead?: { ratio: number; color: number } } = {}) {
  const r = Phaser.Math.Clamp(ratio, 0, 1);
  g.fillStyle(o.bg ?? COLOR.surf2, 1).fillRect(x, y, w, h);
  const col = (o.danger ?? r <= 0.25) ? COLOR.red : color;
  if (o.lead && o.lead.ratio > r) {
    g.fillStyle(o.lead.color, 0.45).fillRect(x, y, w * Phaser.Math.Clamp(o.lead.ratio, 0, 1), h);
  }
  g.fillStyle(col, 1).fillRect(x, y, Math.max(r > 0 ? 3 : 0, w * r), h);
  const tick = o.tick ?? px(16);
  g.fillStyle(COLOR.surf1, 1);
  for (let tx = x + tick; tx < x + w; tx += tick) g.fillRect(tx - 1, y, 2, h);
  // 25% 위험선
  g.fillStyle(COLOR.red, 0.7).fillRect(x + w * 0.25 - 1, y - 3, 2, h + 6);
}

export interface Button extends Phaser.GameObjects.Container {
  setLabel(s: string): void;
  setEnabled(on: boolean): void;
  setActiveLook(on: boolean): void;
}

export type ButtonKind = 'primary' | 'secondary' | 'warning' | 'danger' | 'ghost' | 'legend';

export interface ButtonOpts {
  kind?: ButtonKind;
  size?: number;
  /** 라벨 왼쪽 정렬 + 오른쪽 아이콘 자리 */
  left?: boolean;
  sub?: string;
  font?: 'num' | 'kr';
  cut?: Cut;
  /** 오른쪽에 그릴 꾸밈 (화살표 등) */
  icon?: (g: G, x: number, y: number, color: number) => void;
}

export function button(scene: Phaser.Scene, x: number, y: number, w: number, h: number, text: string, onClick: () => void, o: ButtonOpts = {}): Button {
  const kind = o.kind ?? 'secondary';
  const c = scene.add.container(x, y) as Button;
  const g = scene.add.graphics();
  const size = o.size ?? px(15);
  const lx = o.left ? -w / 2 + px(20) : 0;
  const align = o.left ? 'left' : 'center';
  const t = txt(scene, lx, o.sub ? -px(8) : 0, text, size, { align, font: o.font ?? 'kr', weight: 600 });
  const sub = o.sub ? txt(scene, lx, px(10), o.sub, px(11), { align, weight: 500 }) : null;
  const zone = scene.add.zone(0, 0, w, h).setInteractive({ useHandCursor: true });
  let enabled = true;
  let activeLook = false;

  const palette = () => {
    switch (kind) {
      case 'primary': return { fill: COLOR.cyan, fillA: 1, stroke: COLOR.cyan, text: COLOR.onPrimary, sub: 0x1f4a52, glow: px(14), cut: o.cut ?? CUT_MAIN(px(16)), lineW: 0 };
      case 'legend': return { fill: 0x120f07, fillA: 1, stroke: COLOR.legend, text: COLOR.legend, sub: 0x9c8a5e, glow: px(10), cut: o.cut ?? CUT_MAIN(px(10)), lineW: 2 };
      case 'warning': return { fill: 0x120d05, fillA: 1, stroke: COLOR.amber, text: 0xffe2a8, sub: 0xc9a766, glow: 0, cut: o.cut ?? CUT_MAIN(px(10)), lineW: 2 };
      case 'danger': return { fill: COLOR.bg, fillA: 0, stroke: 0x5a2027, text: COLOR.bossText2, sub: 0xc98a92, glow: 0, cut: o.cut ?? {}, lineW: 2 };
      case 'ghost': return { fill: COLOR.bg, fillA: 0, stroke: COLOR.line, text: COLOR.body, sub: COLOR.dim, glow: 0, cut: o.cut ?? {}, lineW: 0 };
      default: return { fill: COLOR.surf1, fillA: 1, stroke: COLOR.lineP, text: COLOR.text, sub: COLOR.dim, glow: 0, cut: o.cut ?? CUT_MAIN(px(10)), lineW: 2 };
    }
  };

  const draw = (pressed: boolean) => {
    g.clear();
    const p = palette();
    if (!enabled) {
      // 비활성: 점선 느낌의 흐린 테두리
      panel(g, 0, 0, w, h, { fill: COLOR.bg, fillAlpha: 0, stroke: COLOR.line, lineW: 2, cut: {} });
      t.setColor(hex(COLOR.mute)); sub?.setColor(hex(COLOR.mute));
      return;
    }
    const fill = pressed ? (kind === 'primary' ? 0x7fecff : COLOR.surf2) : (activeLook && kind !== 'primary' ? COLOR.surf2 : p.fill);
    panel(g, 0, 0, w, h, { fill, fillAlpha: p.fillA, stroke: activeLook ? COLOR.cyan : p.stroke, lineW: p.lineW, cut: p.cut, glow: p.glow });
    t.setColor(hex(p.text)); sub?.setColor(hex(p.sub));
    if (o.icon) o.icon(g, w / 2 - px(22), 0, p.text);
  };
  draw(false);
  c.add([g, t]);
  if (sub) c.add(sub);
  c.add(zone);
  zone.on('pointerdown', () => {
    if (!enabled) { sfx.deny(); return; }
    draw(true);
    scene.tweens.add({ targets: c, scale: 0.97, duration: 60 });
  });
  const release = () => { draw(false); scene.tweens.add({ targets: c, scale: 1, duration: 90 }); };
  zone.on('pointerout', release);
  zone.on('pointerup', () => {
    release();
    if (!enabled) return;
    sfx.unlock();
    sfx.click();
    onClick();
  });
  c.setLabel = (s: string) => { t.setText(s); };
  c.setEnabled = (on: boolean) => { enabled = on; draw(false); };
  c.setActiveLook = (on: boolean) => { activeLook = on; draw(false); };
  return c;
}

/** 오른쪽 화살표 아이콘 (주 버튼용) */
export function arrowIcon(g: G, x: number, y: number, color: number) {
  g.lineStyle(px(2.25), color, 1);
  g.lineBetween(x - px(8), y, x + px(7), y);
  g.lineBetween(x + px(1), y - px(6), x + px(7), y);
  g.lineBetween(x + px(1), y + px(6), x + px(7), y);
}

/** 체크 아이콘 */
export function checkIcon(g: G, x: number, y: number, color: number) {
  g.lineStyle(px(2.25), color, 1);
  g.lineBetween(x - px(8), y, x - px(2), y + px(6));
  g.lineBetween(x - px(2), y + px(6), x + px(8), y - px(6));
}

/** 재시작(원형 화살표) 아이콘 */
export function refreshIcon(g: G, x: number, y: number, color: number) {
  g.lineStyle(px(2), color, 1);
  g.beginPath();
  g.arc(x, y, px(7), Phaser.Math.DegToRad(-50), Phaser.Math.DegToRad(250), false);
  g.strokePath();
  g.lineBetween(x + px(4), y - px(8), x + px(7), y - px(2));
  g.lineBetween(x + px(7), y - px(2), x + px(1), y - px(2));
}

/** 작은 칩: 1px 테두리 + 영문/숫자 라벨 */
export function chip(scene: Phaser.Scene, x: number, y: number, text: string, color: number, o: { fill?: boolean; size?: number; font?: 'num' | 'kr' } = {}) {
  const c = scene.add.container(x, y);
  const size = o.size ?? px(10);
  const t = txt(scene, 0, 0, text, size, { font: o.font ?? 'num', weight: 600, color: o.fill ? COLOR.onPrimary : color, spacing: 1 });
  const w = t.width + px(14), h = size + px(10);
  const g = scene.add.graphics();
  if (o.fill) g.fillStyle(color, 1).fillRect(-w / 2, -h / 2, w, h);
  else { g.fillStyle(COLOR.surf1, 0.85).fillRect(-w / 2, -h / 2, w, h); g.lineStyle(2, color, 1).strokeRect(-w / 2, -h / 2, w, h); }
  c.add([g, t]);
  (c as any).chipWidth = w;
  return c as Phaser.GameObjects.Container & { chipWidth: number };
}

/** 켜짐/꺼짐 스위치 (깎인 모서리) */
export function toggle(scene: Phaser.Scene, x: number, y: number, on: boolean, onChange: (v: boolean) => void) {
  const w = px(44), h = px(24), knob = px(18);
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  let state = on;
  const draw = () => {
    g.clear();
    panel(g, 0, 0, w, h, { fill: state ? COLOR.cyan : COLOR.line, lineW: 0, cut: CUT_MAIN(px(6)) });
    g.fillStyle(state ? COLOR.onPrimary : COLOR.dim, 1);
    const kx = state ? w / 2 - px(3) - knob : -w / 2 + px(3);
    g.fillRect(kx, -knob / 2, knob, knob);
  };
  draw();
  const zone = scene.add.zone(0, 0, px(60), px(44)).setInteractive({ useHandCursor: true });
  zone.on('pointerup', () => { state = !state; draw(); sfx.click(); onChange(state); });
  c.add([g, zone]);
  return c;
}

/** 가로 슬라이더 (0~1). 끄는 동안 onChange(v, false), 손을 떼면 onChange(v, true) */
export function slider(scene: Phaser.Scene, x: number, y: number, w: number, value: number, onChange: (v: number, done: boolean) => void) {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const knob = px(14);
  let v = Phaser.Math.Clamp(value, 0, 1);
  const draw = () => {
    g.clear();
    g.fillStyle(COLOR.line, 1).fillRect(-w / 2, -2, w, 4);
    g.fillStyle(COLOR.cyan, 1).fillRect(-w / 2, -2, w * v, 4);
    g.fillStyle(COLOR.text, 1).fillRect(-w / 2 + w * v - knob / 2, -knob / 2, knob, knob);
  };
  draw();
  const zone = scene.add.zone(0, 0, w + px(24), px(44)).setInteractive({ useHandCursor: true });
  let dragging = false;
  const set = (p: Phaser.Input.Pointer, done: boolean) => {
    const wx = scene.cameras.main.getWorldPoint(p.x, p.y).x;
    v = Phaser.Math.Clamp((wx - c.getWorldTransformMatrix().tx + w / 2) / w, 0, 1);
    draw();
    onChange(v, done);
  };
  const move = (p: Phaser.Input.Pointer) => { if (dragging) set(p, false); };
  const up = (p: Phaser.Input.Pointer) => { if (dragging) { dragging = false; set(p, true); } };
  zone.on('pointerdown', (p: Phaser.Input.Pointer) => { dragging = true; set(p, false); });
  scene.input.on('pointermove', move);
  scene.input.on('pointerup', up);
  c.once('destroy', () => { scene.input?.off('pointermove', move); scene.input?.off('pointerup', up); });
  c.add([g, zone]);
  return c;
}

/** 분할 버튼 (x1 / x2 등) */
export function segmented(scene: Phaser.Scene, x: number, y: number, items: string[], active: number, cellW: number, cellH: number, onChange: (i: number) => void) {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const texts: Phaser.GameObjects.Text[] = [];
  const total = cellW * items.length;
  let cur = active;
  const draw = () => {
    g.clear();
    g.lineStyle(2, COLOR.lineP, 1).strokeRect(-total / 2, -cellH / 2, total, cellH);
    items.forEach((_, i) => {
      const cx = -total / 2 + cellW * i;
      g.fillStyle(i === cur ? COLOR.cyan : COLOR.surf1, 1).fillRect(cx, -cellH / 2, cellW, cellH);
      texts[i]?.setColor(hex(i === cur ? COLOR.onPrimary : COLOR.dim));
    });
  };
  c.add(g);
  items.forEach((s, i) => {
    const cx = -total / 2 + cellW * (i + 0.5);
    const t = txt(scene, cx, 0, s, px(14), { font: 'num', weight: 700 });
    texts.push(t);
    c.add(t);
    const z = scene.add.zone(cx, 0, cellW, Math.max(cellH, px(44))).setInteractive({ useHandCursor: true });
    z.on('pointerup', () => { if (cur === i) return; cur = i; draw(); sfx.click(); onChange(i); });
    c.add(z);
  });
  draw();
  (c as any).setActive = (i: number) => { cur = i; draw(); };
  return c as Phaser.GameObjects.Container & { setActive(i: number): void };
}

/** 등급 글리프: 일반 · / 희귀 ● / 영웅 ◆ / 전설 ★ */
export const RARITY_GLYPH: Record<string, string> = { common: '·', rare: '●', epic: '◆', legendary: '★' };

/** 코너 브래킷 (프레임 네 모서리) */
export function brackets(g: G, x: number, y: number, w: number, h: number, len: number, color: number, alpha = 1, lineW = 2) {
  const l = x - w / 2, r = x + w / 2, t = y - h / 2, b = y + h / 2;
  g.lineStyle(lineW, color, alpha);
  g.lineBetween(l, t + len, l, t); g.lineBetween(l, t, l + len, t);
  g.lineBetween(r - len, t, r, t); g.lineBetween(r, t, r, t + len);
  g.lineBetween(l, b - len, l, b); g.lineBetween(l, b, l + len, b);
  g.lineBetween(r - len, b, r, b); g.lineBetween(r, b, r, b - len);
}
