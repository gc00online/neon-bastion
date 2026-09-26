import './style.css';
import '@fontsource/gaegu/korean-700.css';
import '@fontsource/gaegu/latin-700.css';
import '@fontsource/nanum-brush-script/korean-400.css';
import '@fontsource/nanum-brush-script/latin-400.css';
import './style-polish.css';
import './style-menu-bitmap.css';
import Phaser from 'phaser';
import { W, H, RES, COLOR } from './config';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { StageScene } from './scenes/StageScene';
import { LabScene } from './scenes/LabScene';
import { setupNative } from './native';
import { sfx } from './audio';
import { lang } from './i18n';

document.documentElement.lang = lang;

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
  scene: [BootScene, MenuScene, GameScene, LabScene, StageScene],
});

setupNative(game);

// 첫 터치 때 오디오 깨우기 (모바일 브라우저 정책)
window.addEventListener('pointerdown', () => sfx.unlock());

if (import.meta.env.DEV) import('./dev').then(m => m.installDevTools(game));
