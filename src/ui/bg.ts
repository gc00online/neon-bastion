import Phaser from 'phaser';
import { COLOR, H, W } from '../config';

// 네온 격자 배경 + 떠다니는 먼지 입자
export function drawBackground(scene: Phaser.Scene) {
  const g = scene.add.graphics().setDepth(0);
  const step = 60;
  g.lineStyle(1, COLOR.grid, 1);
  for (let x = 0; x <= W; x += step) g.lineBetween(x, 0, x, H);
  for (let y = 0; y <= H; y += step) g.lineBetween(0, y, W, y);
  g.fillStyle(COLOR.grid, 1);
  for (let x = 0; x <= W; x += step) for (let y = 0; y <= H; y += step) g.fillCircle(x, y, 2);

  scene.add.particles(0, 0, 'dot', {
    x: { min: 0, max: W },
    y: { min: 0, max: H },
    lifespan: 6000,
    speedY: { min: -12, max: -4 },
    speedX: { min: -4, max: 4 },
    scale: { min: 0.1, max: 0.25 },
    alpha: { start: 0.5, end: 0 },
    tint: [COLOR.cyan, COLOR.purple, COLOR.pink],
    frequency: 250,
    blendMode: 'ADD',
  }).setDepth(1);
}
