import Phaser from 'phaser';
import { W, H, COLOR, px, setupCamera } from '../config';
import { LAB, LabUpgrade } from '../data/lab';
import { save, persist } from '../save';
import { sfx } from '../audio';
import { music } from '../music';
import { L } from '../i18n';
import { txt, label, num, panel, button, segmented, arrowIcon, CUT_MAIN } from '../ui/widgets';
import { drawBackground } from '../ui/bg';

const TABS: { name: string; ids: string[] }[] = [
  { name: L('공격', 'Attack'), ids: ['dmg', 'rate', 'crit', 'range'] },
  { name: L('방어', 'Defense'), ids: ['hp', 'regen', 'armor'] },
  { name: L('유틸', 'Utility'), ids: ['reroll', 'gem', 'start'] },
];
const ICON: Record<string, string> = { dmg: 'e_diamond', rate: 'e_tri', crit: 'flare', range: 'ring', hp: 'e_hex', regen: 'e_plus', armor: 'e_square', reroll: 'ringthin', gem: 'e_diamond', start: 'e_star' };
const ICON_D: Record<string, number> = { ring: 240, ringthin: 240, flare: 90, core: 140 };
const iconScale = (key: string, size: number) => size / (ICON_D[key] ?? 92);

export class LabScene extends Phaser.Scene {
  constructor() { super('Lab'); }

  private tab = 0;
  private gemText!: Phaser.GameObjects.Text;
  private availText!: Phaser.GameObjects.Text;
  private totalText!: Phaser.GameObjects.Text;
  private rows!: Phaser.GameObjects.Container;
  private tabBadges: Phaser.GameObjects.Text[] = [];
  private emitter!: Phaser.GameObjects.Particles.ParticleEmitter;

  create() {
    setupCamera(this);
    drawBackground(this, { brackets: true });
    const MX = px(24);

    // 헤더
    const hy = px(40);
    const back = button(this, px(16) + px(22), hy, px(44), px(44), '', () => this.scene.start('Menu'), { kind: 'ghost' });
    const bg = this.add.graphics();
    bg.lineStyle(px(2), COLOR.text, 1).lineBetween(px(16) + px(26), hy - px(7), px(16) + px(19), hy).lineBetween(px(16) + px(19), hy, px(16) + px(26), hy + px(7));
    void back;
    label(this, px(70), hy - px(10), 'R&D LAB', px(9), COLOR.cyan);
    txt(this, px(70), hy + px(10), L('연구소', 'Laboratory'), px(20), { align: 'left', weight: 600 });
    const gp = this.add.graphics();
    panel(gp, W - MX - px(50), hy, px(100), px(34));
    this.gemText = num(this, W - MX - px(50), hy, '', px(16), COLOR.cyan);

    // 탭
    const ty = px(88);
    const seg = segmented(this, W / 2, ty + px(22), TABS.map(t => t.name), this.tab, (W - MX * 2) / 3, px(44), i => { this.tab = i; this.build(); });
    void seg;
    TABS.forEach((_, i) => {
      const cx = MX + (W - MX * 2) / 3 * (i + 1) - px(14);
      this.tabBadges.push(num(this, cx, ty + px(22), '', px(10), COLOR.green));
    });
    this.availText = label(this, W - MX, ty + px(56), '', px(10), COLOR.green, 'right');
    label(this, MX, ty + px(56), L('보석으로 영구 강화 · 다음 출격부터 적용', 'PERMANENT UPGRADES · APPLY NEXT SORTIE'), px(9), COLOR.dim);

    this.rows = this.add.container(0, ty + px(76));
    this.emitter = this.add.particles(0, 0, 'dot', { speed: { min: 60, max: 220 }, lifespan: { min: 200, max: 450 }, scale: { start: 0.5, end: 0 }, alpha: { start: 1, end: 0 }, tint: COLOR.green, blendMode: 'ADD', emitting: false }).setDepth(50);

    // 푸터
    const fy = H - px(26) - px(30);
    this.totalText = label(this, W - MX, fy - px(46), '', px(10), COLOR.body, 'right');
    txt(this, MX, fy - px(46), L('연구 효과는 다음 출격부터 적용됩니다', 'Research applies from the next sortie'), px(11), { align: 'left', color: COLOR.dim, weight: 500 });
    button(this, W / 2, fy, W - MX * 2, px(60), L('출격', 'Sortie'), () => { sfx.unlock(); this.scene.start('Game'); }, { kind: 'primary', left: true, size: px(18), icon: arrowIcon });

    this.build();
    music.play(0);
    this.cameras.main.fadeIn(250, 4, 7, 11);
  }

  private lv(u: LabUpgrade) { return save.lab[u.id] ?? 0; }
  private canBuy(u: LabUpgrade) { return this.lv(u) < u.max && save.gems >= u.cost(this.lv(u)); }

  private buy(u: LabUpgrade, x: number, y: number) {
    const lv = this.lv(u);
    if (lv >= u.max) return;
    const cost = u.cost(lv);
    if (save.gems < cost) { sfx.deny(); this.cameras.main.shake(100, 0.004); return; }
    save.gems -= cost;
    save.lab[u.id] = lv + 1;
    persist();
    sfx.buy();
    this.emitter.explode(save.reducedFx ? 6 : 14, x, y);
    this.build();
  }

  private build() {
    const MX = px(24);
    this.rows.removeAll(true);
    this.gemText.setText(`◇ ${save.gems.toLocaleString()}`);
    const affordAll = LAB.filter(u => this.canBuy(u)).length;
    this.availText.setText(affordAll ? `${affordAll} AVAILABLE` : '');
    TABS.forEach((t, i) => {
      const n = t.ids.filter(id => this.canBuy(LAB.find(u => u.id === id)!)).length;
      this.tabBadges[i].setText(n ? `${n}` : '').setColor(i === this.tab ? '#03141a' : '#3dff9a');
    });
    this.totalText.setText(`${L('총', 'TOTAL')} ${LAB.reduce((s, u) => s + this.lv(u), 0)} LV`);

    const rowH = px(72);
    TABS[this.tab].ids.forEach((id, i) => {
      const u = LAB.find(x => x.id === id)!;
      const lv = this.lv(u);
      const maxed = lv >= u.max;
      const can = this.canBuy(u);
      const y = i * rowH + rowH / 2;
      const g = this.add.graphics();
      g.lineStyle(2, COLOR.line, 1).lineBetween(MX, y + rowH / 2, W - MX, y + rowH / 2);
      // 아이콘 박스
      const ibx = MX + px(22);
      g.fillStyle(maxed ? COLOR.legend : COLOR.cyan, maxed ? 0.08 : 0.06).fillRect(ibx - px(22), y - px(22), px(44), px(44));
      g.lineStyle(2, maxed ? COLOR.legend : can ? COLOR.lineP : COLOR.line, 1).strokeRect(ibx - px(22), y - px(22), px(44), px(44));
      const icon = this.add.image(ibx, y, ICON[id]).setTint(maxed ? COLOR.legend : can ? COLOR.cyan : COLOR.dim).setScale(iconScale(ICON[id], px(22)));
      // 이름 · 레벨
      const tx = ibx + px(22) + px(12);
      const name = txt(this, tx, y - px(18), u.name, px(15), { align: 'left', weight: 600, color: can || maxed ? COLOR.text : COLOR.body });
      const lvT = maxed ? label(this, W - MX - px(90), y - px(18), 'MAX', px(10), COLOR.legend, 'right') : label(this, W - MX - px(90), y - px(18), `LV ${lv} / ${u.max}`, px(10), COLOR.dim, 'right');
      // 진행 바 (레벨 눈금)
      const bw = W - MX - px(90) - tx;
      g.fillStyle(COLOR.surf2, 1).fillRect(tx, y - px(2), bw, 4);
      g.fillStyle(maxed ? COLOR.legend : can ? COLOR.cyan : COLOR.dim, 1).fillRect(tx, y - px(2), bw * (lv / u.max), 4);
      const ticks = u.max >= 15 ? 4 : u.max >= 10 ? 2 : u.max;
      for (let k = 1; k < ticks; k++) g.fillStyle(COLOR.surf1, 1).fillRect(tx + bw * k / ticks - 1, y - px(3), 2, 6);
      // 설명 (현재 ▸ 다음)
      let descStr: string;
      let descCol = COLOR.body;
      if (maxed) descStr = u.desc(lv);
      else if (can) descStr = `${u.desc(lv)}  ▸  ${u.desc(lv + 1)}`;
      else { descStr = `◇ ${(u.cost(lv) - save.gems).toLocaleString()} ${L('더 필요', 'more needed')}`; descCol = COLOR.bossText2; }
      const desc = txt(this, tx, y + px(16), descStr, px(11), { align: 'left', color: descCol, weight: 500 });
      // 비용 버튼
      let btn: Phaser.GameObjects.GameObject;
      const bxx = W - MX - px(39);
      if (maxed) {
        btn = label(this, bxx, y, L('완료', 'DONE'), px(10), COLOR.legend, 'center');
      } else {
        const b = button(this, bxx, y, px(78), px(44), `◇ ${u.cost(lv).toLocaleString()}`, () => this.buy(u, bxx, y + this.rows.y), { kind: 'primary', size: px(14), font: 'num', cut: CUT_MAIN(px(8)) });
        b.setEnabled(can);
        if (can) {
          const glow = this.add.image(bxx, y, 'glow').setTint(COLOR.cyan).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.18).setScale(0.5, 0.3);
          this.tweens.add({ targets: glow, alpha: 0.3, duration: 700 + i * 120, yoyo: true, repeat: -1 });
          this.rows.add(glow);
        }
        btn = b;
      }
      this.rows.add([g, icon, name, lvT, desc, btn]);
    });
  }
}
