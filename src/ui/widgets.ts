import Phaser from 'phaser';
import { FONT, RES, hex } from '../config';
import { sfx } from '../audio';

export interface TextOpts {
  color?: number;
  bold?: boolean;
  glow?: boolean;
  align?: 'left' | 'center' | 'right';
  wrap?: number;
  lineSpacing?: number;
}

export function txt(scene: Phaser.Scene, x: number, y: number, str: string, size: number, opts: TextOpts = {}) {
  const color = opts.color ?? 0xf6e7ca;
  const t = scene.add.text(x, y, str, {
    fontFamily: FONT,
    fontSize: `${size}px`,
    fontStyle: opts.bold === false ? 'normal' : 'bold',
    color: hex(color),
    align: opts.align ?? 'center',
    resolution: RES,
    lineSpacing: opts.lineSpacing ?? 4,
    wordWrap: opts.wrap ? { width: opts.wrap, useAdvancedWrap: true } : undefined,
  });
  if (opts.glow) t.setShadow(0, 2, "#130f14", 5, false, true);
  return t.setOrigin(opts.align === 'left' ? 0 : opts.align === 'right' ? 1 : 0.5, 0.5);
}

export function panel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, stroke: number, fill = 0x382820, fillAlpha = 0.95, radius = 18, lineW = 3) {
  g.fillStyle(fill, fillAlpha);
  g.fillRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  // 바깥쪽 은은한 글로우
  g.lineStyle(lineW + 8, stroke, 0.08);
  g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, radius);
  g.lineStyle(lineW, stroke, 1);
  g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, radius);
}

export interface Button extends Phaser.GameObjects.Container {
  setLabel(s: string): void;
  setEnabled(on: boolean): void;
}

export function button(scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string, color: number, onClick: () => void, size = 30): Button {
  const c = scene.add.container(x, y) as Button;
  const g = scene.add.graphics();
  const t = txt(scene, 0, 0, label, size, { color });
  const zone = scene.add.zone(0, 0, w, h).setInteractive({ useHandCursor: true });
  let enabled = true;
  const draw = (pressed: boolean) => {
    g.clear();
    const col = enabled ? color : 0x6e6054;
    panel(g, 0, 0, w, h, col, pressed ? 0x694230 : 0x382820, 0.95, 16, 3);
    t.setColor(hex(enabled ? color : 0x9b8973));
  };
  draw(false);
  c.add([g, t, zone]);
  zone.on('pointerdown', () => {
    if (!enabled) { sfx.deny(); return; }
    draw(true);
    scene.tweens.add({ targets: c, scale: 0.95, duration: 60 });
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
  return c;
}
