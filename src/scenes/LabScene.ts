import Phaser from 'phaser';
import { W, OY, COLOR, setupCamera } from '../config';
import { LAB, LabUpgrade } from '../data/lab';
import { save, persist } from '../save';
import { sfx } from '../audio';
import { L } from '../i18n';
import { music } from '../music';
import { txt, panel, button, Button } from '../ui/widgets';
import { drawBackground } from '../ui/bg';

export class LabScene extends Phaser.Scene {
  constructor() { super('Lab'); }

  private gemText!: Phaser.GameObjects.Text;
  private rows: { u: LabUpgrade; lvText: Phaser.GameObjects.Text; desc: Phaser.GameObjects.Text; btn: Button }[] = [];

  create() {
    setupCamera(this);
    drawBackground(this);
    this.rows = [];

    txt(this, W / 2, 80 + OY, L('연구소', 'LAB'), 52, { color: COLOR.purple, glow: true });
    this.add.image(W / 2 - 80, 145 + OY, 'e_diamond').setTint(COLOR.cyan).setScale(0.3);
    this.gemText = txt(this, W / 2 - 55, 145 + OY, '', 28, { color: COLOR.cyan, align: 'left' });

    const g = this.add.graphics();
    LAB.forEach((u, i) => {
      const y = 232 + OY + i * 92;
      panel(g, W / 2, y, 670, 82, 0x2a3350, 0x0d1224, 0.9, 14, 2);
      const name = txt(this, 44, y - 16, u.name, 26, { align: 'left' });
      const lvText = txt(this, 44 + name.width + 14, y - 15, '', 18, { align: 'left', color: COLOR.gray });
      const desc = txt(this, 44, y + 18, '', 19, { align: 'left', color: 0xa9b1c8, bold: false });
      const btn = button(this, 594, y, 170, 62, '', COLOR.cyan, () => this.buy(u), 24);
      this.rows.push({ u, lvText, desc, btn });
    });

    button(this, 190, 1200 + OY, 280, 86, L('돌아가기', 'Back'), COLOR.white, () => this.scene.start('Menu'), 28);
    button(this, 530, 1200 + OY, 280, 86, L('게임 시작', 'Play'), COLOR.cyan, () => { sfx.unlock(); this.scene.start('Game'); }, 28);

    this.refresh();
    music.play(0);
    this.cameras.main.fadeIn(250, 7, 9, 18);
  }

  private buy(u: LabUpgrade) {
    const lv = save.lab[u.id] ?? 0;
    if (lv >= u.max) return;
    const cost = u.cost(lv);
    if (save.gems < cost) { sfx.deny(); this.cameras.main.shake(100, 0.004); return; }
    save.gems -= cost;
    save.lab[u.id] = lv + 1;
    persist();
    sfx.buy();
    this.refresh();
  }

  private refresh() {
    this.gemText.setText(`${save.gems}`);
    for (const r of this.rows) {
      const lv = save.lab[r.u.id] ?? 0;
      const maxed = lv >= r.u.max;
      r.lvText.setText(`Lv ${lv}/${r.u.max}`);
      r.desc.setText(maxed ? r.u.desc(lv) : `${r.u.desc(lv)}  →  ${r.u.desc(lv + 1)}`);
      if (maxed) {
        r.btn.setLabel('MAX');
        r.btn.setEnabled(false);
      } else {
        const cost = r.u.cost(lv);
        r.btn.setLabel(`◆ ${cost}`);
        r.btn.setEnabled(save.gems >= cost);
      }
    }
  }
}
