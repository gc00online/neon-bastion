import Phaser from 'phaser';
import { setupCamera } from '../config';
import { CHAPTERS, STAGES, Stage, stageUnlocked } from '../data/stages';
import { save } from '../save';
import { L } from '../i18n';
import { asset, artIcon, bind, bindNav, coin, escapeHtml, mountScreen, nav } from '../ui/dom';

// Each illustrated road bends differently, so markers sit on the cobblestones.
const ROAD_SPOTS = [
  [[44, 76], [55, 62], [48, 47], [68, 32], [79, 17]],
  [[63, 76], [54, 62], [44, 48], [36, 33], [53, 18]],
  [[45, 77], [52, 62], [61, 47], [71, 32], [81, 17]],
  [[33, 77], [45, 62], [54, 47], [65, 32], [77, 17]],
  [[41, 77], [48, 62], [57, 47], [68, 32], [80, 17]],
] as const;

export class StageScene extends Phaser.Scene {
  constructor() { super('Stages'); }
  private selected = 1;
  private chapter = 1;
  private selectedByChapter: Record<number, number> = {};

  create() {
    setupCamera(this);
    const next = STAGES.find(s => !save.stages[s.id] && stageUnlocked(s.id, save.stages));
    this.selected = next?.id ?? STAGES[STAGES.length - 1].id;
    this.chapter = STAGES[this.selected - 1].chapter;
    this.selectedByChapter = { [this.chapter]: this.selected };

    const { root } = mountScreen(this, `<img class="screen-bg chapter-bg" src="${asset(CHAPTERS[this.chapter - 1].mapArt)}" alt="" draggable="false"><div class="map-shade"></div>
      <header class="screen-header"><button class="round-button" data-action="back" aria-label="${L('가게로 돌아가기', 'Back to shop')}">‹</button><span class="wallet">${coin(save.gems)}</span></header>
      <div class="page-heading light" aria-live="polite"><p class="overline chapter-overline"></p><h1>${L('밤마실 지도', 'The night map')}</h1><p class="chapter-tagline"></p></div>
      <nav class="chapter-carousel" aria-label="${L('지도 장 선택', 'Choose map chapter')}"><button class="chapter-arrow" data-action="prev-chapter" aria-label="${L('이전 장', 'Previous chapter')}">‹</button><span class="chapter-count" aria-live="polite"></span><button class="chapter-arrow" data-action="next-chapter" aria-label="${L('다음 장', 'Next chapter')}">›</button></nav>
      <div class="stage-map" role="group" aria-label="${L('스테이지 지도', 'Stage map')}"></div>
      <div class="chapter-pages" role="group" aria-label="${L('장 바로가기', 'Jump to chapter')}">${CHAPTERS.map(chapter => `<button class="chapter-page" type="button" data-chapter="${chapter.id}" aria-label="${L(`제${chapter.id}장`, `Chapter ${chapter.id}`)} · ${escapeHtml(chapter.name)}"><img src="${asset(chapter.mapArt)}" alt="" draggable="false"></button>`).join('')}</div>
      <section class="stage-detail paper" aria-live="polite"></section>${nav('Stages')}`, 'stage-screen');

    const map = root.querySelector<HTMLElement>('.stage-map')!;
    const detail = root.querySelector<HTMLElement>('.stage-detail')!;
    const chapterBg = root.querySelector<HTMLImageElement>('.chapter-bg')!;

    const select = (stage: Stage) => {
      this.selected = stage.id;
      this.selectedByChapter[this.chapter] = stage.id;
      map.querySelectorAll<HTMLButtonElement>('[data-stage]').forEach(button => {
        const active = Number(button.dataset.stage) === stage.id;
        button.classList.toggle('selected', active);
        button.setAttribute('aria-pressed', String(active));
      });
      const open = stageUnlocked(stage.id, save.stages);
      const stageNumber = `${String(stage.chapter).padStart(2, '0')}–${String(stage.chapterStage).padStart(2, '0')}`;
      detail.classList.toggle('locked-detail', !open);
      detail.innerHTML = `<div class="detail-heading"><span class="stage-number">${stageNumber}</span><span class="small-tag">${stage.waves} ${L('웨이브', 'WAVES')}</span></div><h2>${escapeHtml(stage.name)}</h2><p>${escapeHtml(stage.subtitle)}</p>
        ${open ? `<div class="stage-guests"><div class="guest-line">${artIcon('rice')}${artIcon('dumpling')}${artIcon('spirit')}<span>${L('오늘의 손님', 'TONIGHT’S GUESTS')}</span></div><div class="first-reward"><small>${save.stages[stage.id] ? L('첫 보상 수령 완료', 'FIRST REWARD CLAIMED') : L('첫 영업 보상', 'FIRST CLEAR REWARD')}</small><b>${coin(stage.reward)}</b></div></div>` : `<p class="stage-lock-message">${L('이전 스테이지를 완료하면 열려요.', 'Clear the previous stage to unlock.')}</p>`}
        <button class="primary" data-action="start" ${open ? '' : 'disabled'}>${open ? L('영업 준비', 'Open for business') : L('아직 잠겨 있어요', 'Locked for now')} <span aria-hidden="true">${open ? '→' : '✦'}</span></button>`;
      if (open) bind(detail, 'start', () => this.scene.start('Game', { stage: this.selected }));
    };

    const showChapter = (chapterNumber: number) => {
      this.chapter = chapterNumber;
      const chapter = CHAPTERS[chapterNumber - 1];
      const stages = STAGES.filter(stage => stage.chapter === chapterNumber);
      chapterBg.src = asset(chapter.mapArt);
      root.querySelector<HTMLElement>('.chapter-overline')!.textContent = L(`제${chapterNumber}장 · ${chapter.name}`, `CHAPTER ${String(chapterNumber).padStart(2, '0')} · ${chapter.name}`);
      root.querySelector<HTMLElement>('.chapter-tagline')!.textContent = chapter.tagline;
      root.querySelector<HTMLElement>('.chapter-count')!.textContent = `${String(chapterNumber).padStart(2, '0')} / ${String(CHAPTERS.length).padStart(2, '0')}`;
      root.querySelector<HTMLButtonElement>('[data-action="prev-chapter"]')!.disabled = chapterNumber === 1;
      root.querySelector<HTMLButtonElement>('[data-action="next-chapter"]')!.disabled = chapterNumber === CHAPTERS.length;
      root.querySelectorAll<HTMLButtonElement>('[data-chapter]').forEach(button => {
        const active = Number(button.dataset.chapter) === chapterNumber;
        button.classList.toggle('active', active);
        if (active) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
      });
      map.setAttribute('aria-label', `${L(`제${chapterNumber}장`, `Chapter ${chapterNumber}`)} · ${chapter.name}`);
      map.innerHTML = stages.map(stage => {
        const open = stageUnlocked(stage.id, save.stages);
        const [x, y] = ROAD_SPOTS[chapterNumber - 1]?.[stage.chapterStage - 1] ?? [stage.x, stage.y];
        const stars = save.stages[stage.id] ?? 0;
        const status = stars > 0 ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : open ? L('도전', 'PLAY') : L('잠김', 'LOCKED');
        return `<button class="stage-node ${open ? 'open' : 'locked'}" type="button" style="left:${x}%;top:${y}%" data-stage="${stage.id}" aria-label="${stage.chapterStage}. ${escapeHtml(stage.name)} · ${status}" aria-pressed="false"><img class="node-art" src="${asset(`ui/map-node-${open ? 'open' : 'locked'}.png`)}" alt="" draggable="false"><span class="node-number">${stage.chapterStage}</span><span class="node-status" aria-hidden="true">${status}</span></button>`;
      }).join('');
      map.querySelectorAll<HTMLButtonElement>('[data-stage]').forEach(button => button.addEventListener('click', () => select(STAGES[Number(button.dataset.stage) - 1])));
      const remembered = stages.find(stage => stage.id === this.selectedByChapter[chapterNumber]);
      const playable = stages.find(stage => stageUnlocked(stage.id, save.stages) && !save.stages[stage.id])
        ?? [...stages].reverse().find(stage => stageUnlocked(stage.id, save.stages));
      select(remembered ?? playable ?? stages[0]);
    };

    const changeChapter = (step: number) => {
      const nextChapter = Math.max(1, Math.min(CHAPTERS.length, this.chapter + step));
      if (nextChapter !== this.chapter) showChapter(nextChapter);
    };

    bind(root, 'back', () => this.scene.start('Menu'));
    bind(root, 'prev-chapter', () => changeChapter(-1));
    bind(root, 'next-chapter', () => changeChapter(1));
    bindNav(this, root);
    root.querySelectorAll<HTMLButtonElement>('[data-chapter]').forEach(button => button.addEventListener('click', () => showChapter(Number(button.dataset.chapter))));

    let pointerStart: { x: number; y: number } | null = null;
    root.addEventListener('pointerdown', event => {
      if ((event.target as Element).closest('.stage-detail,.screen-header,.bottom-nav,.chapter-carousel,.chapter-pages')) return;
      pointerStart = { x: event.clientX, y: event.clientY };
    });
    root.addEventListener('pointerup', event => {
      if (!pointerStart) return;
      const dx = event.clientX - pointerStart.x;
      const dy = event.clientY - pointerStart.y;
      pointerStart = null;
      if (Math.abs(dx) >= 55 && Math.abs(dx) > Math.abs(dy) * 1.5) changeChapter(dx < 0 ? 1 : -1);
    });
    root.addEventListener('pointercancel', () => { pointerStart = null; });

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') changeChapter(-1);
      if (event.key === 'ArrowRight') changeChapter(1);
    };
    document.addEventListener('keydown', onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => document.removeEventListener('keydown', onKey));
    showChapter(this.chapter);
  }
}
