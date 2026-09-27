import Phaser from 'phaser';
import { W, OY, COLOR, setupCamera } from '../config';
import { CORE_TEX_R, SHAPE_R } from './BootScene';
import { ENEMIES, EnemyKind } from '../data/enemies';
import { save } from '../save';
import { music } from '../music';
import { openSettings } from '../ui/settings';
import { L } from '../i18n';
import { todayKey, todayModifier } from '../data/daily';
import { sfx } from '../audio';
import { txt, button } from '../ui/widgets';
import { drawBackground } from '../ui/bg';

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  private orbit: { img: Phaser.GameObjects.Image; a: number; r: number }[] = [];

  create() {
    setupCamera(this);
    drawBackground(this);

    txt(this, W / 2, 230 + OY, 'NEON', 104, { color: COLOR.cyan, glow: true });
    txt(this, W / 2, 330 + OY, 'BASTION', 88, { color: COLOR.pink, glow: true });
    txt(this, W / 2, 420 + OY, L('로그라이크 디펜스', 'ROGUELIKE DEFENSE'), 26, { color: COLOR.gray, bold: false });

    // 가운데 장식: 회전하는 기지와 주위를 도는 적들
    const cy = 640 + OY;
    this.add.image(W / 2, cy, 'glow').setTint(COLOR.cyan).setAlpha(0.35).setScale(1.4).setBlendMode(Phaser.BlendModes.ADD);
    const core = this.add.image(W / 2, cy, 'core').setTint(COLOR.cyan).setScale(52 / CORE_TEX_R);
    this.tweens.add({ targets: core, rotation: Math.PI * 2, duration: 12000, repeat: -1 });
    const kinds: EnemyKind[] = ['grunt', 'runner', 'brute', 'shooter', 'splitter', 'swarm'];
    this.orbit = kinds.map((k, i) => {
      const d = ENEMIES[k];
      return { img: this.add.image(0, 0, d.tex).setTint(d.color).setScale(d.r / SHAPE_R), a: (i / kinds.length) * Math.PI * 2, r: 150 + (i % 2) * 40 };
    });

    if (save.best > 0) txt(this, W / 2, 815 + OY, L(`최고 기록  웨이브 ${save.best}`, `Best  Wave ${save.best}`), 26, { color: COLOR.yellow });
    const gem = this.add.image(W / 2 - 70, 858 + OY, 'e_diamond').setTint(COLOR.cyan).setScale(0.3);
    const gt = txt(this, W / 2 - 45, 858 + OY, L(`보석 ${save.gems}`, `Gems ${save.gems}`), 24, { color: COLOR.cyan, align: 'left' });
    gem.x = W / 2 - (gt.width + 36) / 2 + 10;
    gt.x = gem.x + 25;

    const play = button(this, W / 2, 950 + OY, 460, 104, L('게임 시작', 'PLAY'), COLOR.cyan, () => this.go('Game'), 40);
    this.tweens.add({ targets: play, scale: 1.04, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    // 일일 도전
    const day = todayKey();
    const mod = todayModifier(day);
    const rec = save.daily.day === day ? save.daily : null;
    button(this, W / 2, 1063 + OY, 460, 90, L(`일일 도전 · ${mod.name}`, `Daily · ${mod.name}`), COLOR.yellow, () => this.go('Game', { daily: true }), 28);
    txt(this, W / 2, 1122 + OY, rec?.best ? L(`오늘 최고 웨이브 ${rec.best}`, `Today's best: wave ${rec.best}`) : `${mod.desc.replace('\n', ' · ')}  ·  ${L('첫 판 보석 2배', 'first run 2× gems')}`, 18, { color: COLOR.gray, bold: false });

    button(this, W / 2 - 118, 1200 + OY, 224, 76, L('연구소', 'Lab'), COLOR.purple, () => this.go('Lab'), 28);
    button(this, W / 2 + 118, 1200 + OY, 224, 76, L('설정', 'Settings'), COLOR.white, () => openSettings(this, true), 28);
    music.play(0);

    this.cameras.main.fadeIn(300, 7, 9, 18);
  }

  update(_t: number, dt: number) {
    for (const o of this.orbit) {
      o.a += (dt / 1000) * 0.35;
      o.img.setPosition(W / 2 + Math.cos(o.a) * o.r, 640 + OY + Math.sin(o.a) * o.r * 0.72);
      o.img.rotation += dt / 1000;
    }
  }

  private go(key: string, data?: object) {
    sfx.unlock();
    this.cameras.main.fadeOut(200, 7, 9, 18);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(key, data));
  }
}
