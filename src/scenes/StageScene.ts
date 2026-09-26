import Phaser from 'phaser';
import { setupCamera } from '../config';
import { STAGES, Stage, stageUnlocked } from '../data/stages';
import { save } from '../save';
import { L } from '../i18n';
import { asset, artIcon, bind, bindNav, coin, mountScreen, nav } from '../ui/dom';

export class StageScene extends Phaser.Scene {
  constructor() { super('Stages'); }
  private selected = 1;
  create() {
    setupCamera(this);
    this.selected = STAGES.find(s => !save.stages[s.id])?.id ?? 5;
    const { root } = mountScreen(this, `<img class="screen-bg" src="${asset('map.webp')}" alt=""><div class="map-shade"></div>
      <header class="screen-header"><button class="round-button" data-action="back" aria-label="${L('가게로 돌아가기', 'Back to shop')}">‹</button><span class="wallet">${coin(save.gems)}</span></header>
      <div class="page-heading light"><p class="overline">${L('제1장 · 달빛 골목', 'CHAPTER 01 · MOONLIT ALLEYS')}</p><h1>${L('밤마실 지도', 'The night map')}</h1><p>${L('오늘은 어느 골목을 지킬까요?', 'Which little alley needs you tonight?')}</p></div>
      <div class="stage-map"><svg class="map-path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M25 73 C95 75 90 60 67 57 S0 50 30 40 S96 34 68 25 S14 22 38 10"/></svg>${STAGES.map(s => { const open = stageUnlocked(s.id, save.stages); return `<button class="stage-node ${open ? '' : 'locked'}" style="left:${s.x}%;top:${s.y}%" data-stage="${s.id}" ${open ? '' : 'disabled'} aria-label="${s.id}. ${s.name}${open ? '' : L(' · 이전 골목 클리어 필요', ' · Complete the previous alley')}" aria-pressed="false"><span class="node-circle">${open ? s.id : '🔒'}</span><span class="node-stars">${save.stages[s.id] ? '★'.repeat(save.stages[s.id]) + '☆'.repeat(3 - save.stages[s.id]) : open ? L('도전', 'PLAY') : L('잠김', 'LOCKED')}</span></button>`; }).join('')}</div>
      <section class="stage-detail paper" aria-live="polite"></section>${nav('Stages')}`, 'stage-screen');
    bind(root, 'back', () => this.scene.start('Menu')); bindNav(this, root);
    const select = (s: Stage) => {
      this.selected = s.id;
      root.querySelectorAll<HTMLButtonElement>('[data-stage]').forEach(b => { const active = Number(b.dataset.stage) === s.id; b.classList.toggle('selected', active); b.setAttribute('aria-pressed', String(active)); });
      const detail = root.querySelector<HTMLElement>('.stage-detail')!;
      detail.innerHTML = `<div class="detail-heading"><span class="stage-number">01–0${s.id}</span><span class="small-tag">${s.waves} ${L('웨이브', 'WAVES')}</span></div><h2>${s.name}</h2><p>${s.subtitle}</p><div class="stage-guests"><div class="guest-line">${artIcon('rice')}${artIcon('dumpling')}${artIcon('spirit')}<span>${L('오늘의 손님', 'TONIGHT’S GUESTS')}</span></div><div class="first-reward"><small>${save.stages[s.id] ? L('첫 보상 수령 완료', 'FIRST REWARD CLAIMED') : L('첫 영업 보상', 'FIRST CLEAR REWARD')}</small><b>${coin(s.reward)}</b></div></div><button class="primary" data-action="start">${L('영업 준비', 'Open for business')} <span>→</span></button>`;
      bind(detail, 'start', () => this.scene.start('Game', { stage: this.selected }));
    };
    root.querySelectorAll<HTMLButtonElement>('[data-stage]').forEach(b => b.addEventListener('click', () => select(STAGES[Number(b.dataset.stage) - 1])));
    select(STAGES[this.selected - 1]);
  }
}
