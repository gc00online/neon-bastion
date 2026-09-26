import Phaser from 'phaser';
import { L } from '../i18n';
import { sfx } from '../audio';

export const asset = (name: string) => `${import.meta.env.BASE_URL}art/${name}`;
export const escapeHtml = (s: string | number) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export const coin = (n: number) => `<span class="coin" aria-hidden="true">◉</span> ${n.toLocaleString()}`;
export const artIcon = (name: string, cls = '') => `<img class="art-icon ${cls}" src="${asset(`${name}.png`)}" alt="" draggable="false">`;

export function mountScreen(scene: Phaser.Scene, html: string, className = '') {
  const root = document.createElement('section');
  root.className = `game-screen ${className}`;
  root.innerHTML = html;
  document.getElementById('interface')!.append(root);
  const dispose = () => { root.querySelectorAll('video').forEach(v => { v.pause(); v.removeAttribute('src'); v.load(); }); root.remove(); };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, dispose);
  root.addEventListener('click', e => { if ((e.target as Element).closest('button:not(:disabled)')) { sfx.unlock(); sfx.click(); } });
  return { root, dispose: () => { scene.events.off(Phaser.Scenes.Events.SHUTDOWN, dispose); dispose(); } };
}

export function bind(root: HTMLElement, action: string, fn: () => void) {
  root.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)?.addEventListener('click', fn);
}

export function nav(active: string) {
  return `<nav class="bottom-nav" aria-label="${L('주 메뉴', 'Main navigation')}">${[
    ['Menu', '⌂', L('가게', 'Shop')], ['Stages', '♧', L('지도', 'Map')], ['Lab', '▤', L('레시피', 'Recipes')],
  ].map(([key, icon, label]) => `<button data-action="nav-${key}" ${key === active ? 'aria-current="page"' : ''}><span aria-hidden="true">${icon}</span>${label}</button>`).join('')}</nav>`;
}

export function bindNav(scene: Phaser.Scene, root: HTMLElement) {
  ['Menu', 'Stages', 'Lab'].forEach(key => bind(root, `nav-${key}`, () => scene.scene.start(key)));
}
