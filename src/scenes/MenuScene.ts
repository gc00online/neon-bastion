import Phaser from 'phaser';
import { setupCamera } from '../config';
import { save, persist, applySettings } from '../save';
import { music } from '../music';
import { L, lang, setLang } from '../i18n';
import { todayModifier, todayKey } from '../data/daily';
import { asset, bind, coin, mountScreen, navGlyph } from '../ui/dom';

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }
  private openDaily = false;
  init(data?: { openDaily?: boolean }) { this.openDaily = !!data?.openDaily; }
  create() {
    setupCamera(this);
    const { root } = mountScreen(this, `
      <img class="screen-bg" src="${asset('title.webp')}" alt="">
      <video class="screen-bg title-video" muted loop playsinline preload="none" poster="${asset('title.webp')}" aria-hidden="true"></video>
      <div class="title-shade"></div>
      <header class="menu-top"><button class="round-button" data-action="settings" aria-label="${L('설정', 'Settings')}">⚙</button><span class="wallet">${coin(save.gems)}</span></header>
      <div class="title-block"><p class="overline">${L('달이 뜨면, 영업 시작', 'WHEN THE MOON RISES')}</p><h1>${L('심야분식', 'Midnight<br>Snack Stall')}</h1><p class="title-sub">${L('마지막 떡볶이를 지켜라', 'Defend the last bowl of tteokbokki')}</p><div class="title-rule"><span>✦</span></div></div>
      <div class="menu-actions">
      <button class="primary large" data-action="play">${L('영업 시작', 'Open the shop')} <span>↗</span></button>
      <div class="button-pair"><button class="paper-button" data-action="lab">${navGlyph('Lab')} ${L('비밀 레시피', 'Secret recipes')}</button><button class="paper-button" data-action="daily">${navGlyph('Daily')} ${L('오늘의 도전', 'Daily special')}</button></div>
      <p class="menu-foot">${L('작은 냄비 하나, 끝없는 맛있는 밤.', 'One little pot. Endless delicious nights.')}</p></div>`, 'menu-screen');
    const video = root.querySelector('video')!;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let stopped = false;
    const startVideo = () => {
      if (reduced || stopped || document.hidden) return;
      if (!video.getAttribute('src')) video.src = asset('background.mp4');
      void video.play().catch(() => { /* Keep the poster when autoplay is blocked. */ });
    };
    video.addEventListener('playing', () => video.classList.add('playing'));
    video.addEventListener('error', () => video.classList.remove('playing'));
    const visibility = () => { if (document.hidden) video.pause(); else startVideo(); };
    document.addEventListener('visibilitychange', visibility);
    root.addEventListener('pointerdown', startVideo, { once: true });
    startVideo();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { stopped = true; document.removeEventListener('visibilitychange', visibility); });
    bind(root, 'play', () => this.scene.start('Stages'));
    bind(root, 'lab', () => this.scene.start('Lab'));
    const openChallenge = () => {
      const mod = todayModifier(todayKey());
      const dialog = document.createElement('dialog');
      dialog.className = 'paper-dialog';
      dialog.innerHTML = `<p class="overline">${L('오늘의 특별 영업', 'DAILY SPECIAL')}</p><h2>${mod.name}</h2><p>${mod.desc}</p><p>${L('첫 영업은 엽전 보상 2배', 'Double coins on your first run today')}</p><button class="primary" data-action="begin">${L('도전하기', 'Start challenge')}</button><button class="text-button" data-action="close">${L('돌아가기', 'Back')}</button>`;
      root.append(dialog); dialog.showModal();
      bind(dialog, 'begin', () => this.scene.start('Game', { daily: true }));
      bind(dialog, 'close', () => dialog.remove());
    };
    bind(root, 'daily', openChallenge);
    if (this.openDaily) openChallenge();
    bind(root, 'settings', () => this.settings(root));
    music.play(0);
  }
  private settings(root: HTMLElement) {
    const dialog = document.createElement('dialog');
    dialog.className = 'paper-dialog';
    dialog.innerHTML = `<p class="overline">${L('가게 설정', 'SHOP SETTINGS')}</p><h2>${L('나만의 밤', 'Your kind of night')}</h2>${(['sound', 'music', 'vibrate'] as const).map((key, i) => `<label class="setting-row">${[L('효과음', 'Sound effects'), L('배경음악', 'Music'), L('진동', 'Haptics')][i]}<input type="checkbox" data-setting="${key}" ${save[key] ? 'checked' : ''}></label>`).join('')}<button class="paper-button" data-action="language">${lang === 'ko' ? '언어 · 한국어 → English' : 'Language · English → 한국어'}</button><button class="primary" data-action="close">${L('닫기', 'Close')}</button>`;
    root.append(dialog); dialog.showModal();
    dialog.querySelectorAll<HTMLInputElement>('[data-setting]').forEach(input => input.addEventListener('change', () => { save[input.dataset.setting as 'sound' | 'music' | 'vibrate'] = input.checked; persist(); applySettings(); }));
    bind(dialog, 'language', () => setLang(lang === 'ko' ? 'en' : 'ko'));
    bind(dialog, 'close', () => dialog.remove());
  }
}
