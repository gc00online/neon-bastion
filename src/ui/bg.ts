import Phaser from 'phaser';
import { COLOR, H, W, px } from '../config';
import { brackets } from './widgets';
import { save } from '../save';

export interface BgOpts {
  /** 네 모서리 브래킷 */
  brackets?: boolean;
  /** 비네팅 색 (기본 없음) */
  vignette?: number;
  vignetteAlpha?: number;
  /** 떠다니는 데이터 입자 */
  dust?: boolean;
  /** 스캔라인 (설정에서 끌 수 있음) */
  scanlines?: boolean;
}

// 24pt 격자 배경 + 선택 요소. 격자는 디자인 시스템과 같은 rgba(59,227,255,0.035)
export function drawBackground(scene: Phaser.Scene, o: BgOpts = {}) {
  const g = scene.add.graphics().setDepth(0);
  g.fillStyle(COLOR.bg, 1).fillRect(0, 0, W, H);
  const step = px(24);
  g.lineStyle(1, COLOR.grid, 0.035);
  for (let x = 0; x <= W; x += step) g.lineBetween(x, 0, x, H);
  for (let y = 0; y <= H; y += step) g.lineBetween(0, y, W, y);

  if (o.vignette !== undefined) {
    const v = scene.add.image(W / 2, H / 2, 'vignette').setTint(o.vignette).setAlpha(o.vignetteAlpha ?? 0.3).setDepth(1);
    v.setDisplaySize(W, H);
  }

  if (o.scanlines !== false && !save.reducedFx) {
    const sl = scene.add.graphics().setDepth(1);
    sl.fillStyle(0x000000, 0.08);
    for (let y = 0; y < H; y += 4) sl.fillRect(0, y, W, 1);
  }

  if (o.brackets) {
    const b = scene.add.graphics().setDepth(2);
    brackets(b, W / 2, H / 2, W - px(28), H - px(28), px(26), COLOR.cyan, 0.9, 2);
  }

  if (o.dust && !save.reducedFx) {
    scene.add.particles(0, 0, 'dot', {
      x: { min: 0, max: W },
      y: { min: 0, max: H },
      lifespan: 7000,
      speedY: { min: -10, max: -3 },
      speedX: { min: -3, max: 3 },
      scale: { min: 0.08, max: 0.2 },
      alpha: { start: 0.3, end: 0 },
      tint: [COLOR.cyan, COLOR.frost],
      frequency: 300,
      maxParticles: 16,
      blendMode: 'ADD',
    }).setDepth(1);
  }
}
