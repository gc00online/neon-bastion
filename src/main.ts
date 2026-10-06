import Phaser from 'phaser';
import { W, H, RES, COLOR, measureLayout } from './config';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { LabScene } from './scenes/LabScene';
import { setupNative } from './native';
import { sfx } from './audio';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: COLOR.bg,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: W * RES,
    height: H * RES,
  },
  render: { antialias: true, powerPreference: 'high-performance' },
  input: { activePointers: 2 },
  scene: [BootScene, MenuScene, GameScene, LabScene],
});

setupNative(game);

// 안전 영역이 늦게 적용되거나 화면이 회전·리사이즈되면 논리 높이를 다시 재고 메뉴 계열 화면을 다시 그린다
const appEl = document.getElementById('app')!;
let resizePending = false;
const onResize = () => {
  if (resizePending) return;
  resizePending = true;
  requestAnimationFrame(() => {
    resizePending = false;
    if (!measureLayout()) return;
    // FIT 모드는 표시 크기의 가로세로비를 따로 기억하므로 함께 갱신해야 한다
    game.scale.displaySize.setAspectRatio(W / H);
    game.scale.resize(W * RES, H * RES);
    game.scale.refresh();
    const active = game.scene.getScenes(true)[0];
    if (active && (active.scene.key === 'Menu' || active.scene.key === 'Lab')) active.scene.restart();
  });
};
new ResizeObserver(onResize).observe(appEl);
window.addEventListener('resize', onResize);

// 첫 터치 때 오디오 깨우기 (모바일 브라우저 정책)
window.addEventListener('pointerdown', () => sfx.unlock());

if (import.meta.env.DEV) import('./dev').then(m => m.installDevTools(game));
