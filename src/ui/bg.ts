import Phaser from 'phaser';
import { H, W } from '../config';

export function drawBackground(scene: Phaser.Scene) {
  if (scene.textures.exists('arena')) {
    const bg = scene.add.image(W / 2, H / 2, 'arena').setDepth(0);
    bg.setDisplaySize(W, H);
    scene.add.rectangle(W / 2, H / 2, W, H, 0x10131c, 0.035).setDepth(1);
  }
}
