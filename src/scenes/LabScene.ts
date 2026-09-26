import Phaser from 'phaser';
import { setupCamera } from '../config';
import { LAB } from '../data/lab';
import { potLevel } from '../data/stages';
import { save, persist } from '../save';
import { sfx } from '../audio';
import { L } from '../i18n';
import { music } from '../music';
import { asset, bind, bindNav, coin, mountScreen, nav } from '../ui/dom';

const paintedIcon = (id: string) => `<img src="${asset(`ui/icons/${id}.png`)}" alt="" draggable="false">`;
export const RECIPE_ICONS: Record<string, string> = {
  dmg: paintedIcon('dmg'), rate: paintedIcon('rate'), hp: paintedIcon('hp'),
  regen: paintedIcon('regen'), range: paintedIcon('range'), start: paintedIcon('start'),
  crit: '✦', armor: '◉', reroll: '↻', gem: '◈',
};

export class LabScene extends Phaser.Scene {
  constructor() { super('Lab'); }
  create() {
    setupCamera(this);
    const { root } = mountScreen(this, `<img class="screen-bg" src="${asset('ui/lab.webp')}" alt=""><div class="lab-shade"></div><header class="screen-header"><button class="round-button" data-action="back" aria-label="${L('뒤로', 'Back')}">←</button><span class="wallet">${coin(save.gems)}</span></header><div class="page-heading light"><p class="overline">${L('한 그릇에 담긴 노하우', 'A LITTLE BETTER, EVERY NIGHT')}</p><h1>${L('비밀 레시피', 'Secret recipes')}</h1></div><div class="lab-hero"><div><p>${L('수호 냄비', 'GUARDIAN POT')}</p><h2>Lv. ${potLevel(save.xp)}</h2><div class="xp-track"><span style="width:${save.xp % 200 / 2}%"></span></div><small>${save.xp % 200} / 200 XP</small></div></div><section class="recipe-ledger paper"><div class="ledger-header"><h2>${L('냄비 성장', 'Pot upgrades')}</h2><span>${L('영구 적용', 'PERMANENT')}</span></div><p class="ledger-note">${L('영업이 끝나도, 실력은 남아요.', 'Your recipes stay with you after every run.')}</p><div class="upgrade-list"></div><p class="purchase-status" role="status" aria-live="polite"></p><button class="primary" data-action="play">${L('영업하러 가기', 'Back to business')} <span>→</span></button></section>${nav('Lab')}`, 'lab-screen');
    bind(root, 'back', () => this.scene.start('Menu')); bind(root, 'play', () => this.scene.start('Stages')); bindNav(this, root);
    const refresh = () => {
      root.querySelector('.wallet')!.innerHTML = coin(save.gems);
      root.querySelector('.upgrade-list')!.innerHTML = LAB.map(u => { const lv = save.lab[u.id] ?? 0, maxed = lv >= u.max, cost = u.cost(lv); return `<article class="upgrade-row"><span class="recipe-icon" aria-hidden="true">${RECIPE_ICONS[u.id]}</span><div class="upgrade-copy"><h3>${u.name} <small>Lv.${lv}/${u.max}</small></h3><p>${u.desc(lv)}${maxed ? '' : `<br><span class="next-stat">→ ${u.desc(lv + 1)}</span>`}</p></div><button class="upgrade-buy" data-upgrade="${u.id}" ${maxed || save.gems < cost ? 'disabled' : ''} aria-label="${u.name} ${L('강화', 'upgrade')} ${cost} ${L('엽전', 'coins')}">${maxed ? 'MAX' : `${coin(cost)}<span>↑</span>`}</button></article>`; }).join('');
      root.querySelectorAll<HTMLButtonElement>('[data-upgrade]').forEach(b => b.addEventListener('click', () => {
        const u = LAB.find(u => u.id === b.dataset.upgrade)!; const lv = save.lab[u.id] ?? 0; const cost = u.cost(lv);
        if (lv >= u.max || save.gems < cost) return;
        save.gems -= cost; save.lab[u.id] = lv + 1; persist(); sfx.buy(); refresh();
        root.querySelector('.purchase-status')!.textContent = `${u.name} Lv.${lv + 1} · ${L('더 맛있어졌어요!', 'Recipe improved!')}`;
      }));
    };
    refresh(); music.play(0);
  }
}
