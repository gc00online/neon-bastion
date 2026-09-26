import Phaser from 'phaser';
import { L } from '../i18n';
import { sfx } from '../audio';

export const asset = (name: string) => `${import.meta.env.BASE_URL}art/${name}`;
export const escapeHtml = (s: string | number) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export const coin = (n: number) => `<span class="coin" aria-hidden="true">₩</span> ${n.toLocaleString()}`;
export const artIcon = (name: string, cls = '') => `<img class="art-icon ${cls}" src="${asset(`${name}.png`)}" alt="" draggable="false">`;
const navPaths: Record<string, string> = {
  Menu: '<path d="M6 19 9 9h30l3 10-5 5-7-5-6 5-6-5-7 5-5-5Z"/><path d="M10 24v16h28V24M22 40V29h9v11M6 19h36"/>',
  Stages: '<path d="m6 10 12-4 12 4 12-4v32l-12 4-12-4-12 4V10Z"/><path d="M18 6v32M30 10v32M12 28c4-8 10-1 15-10 2-4 7-3 10-1"/>',
  Lab: '<path d="M24 11c-6-5-12-5-18-3v31c6-2 13-2 18 3 5-5 12-5 18-3V8c-6-2-12-2-18 3Z"/><path d="M24 11v31M11 16c3-1 6-1 9 1M11 23c3-1 6-1 9 1M28 17c3-2 6-2 9-1M28 24c3-2 6-2 9-1"/>',
  Daily: '<path d="M32 6A18 18 0 1 0 42 31 17 17 0 0 1 32 6Z"/><path d="m31 16 2 4 4 2-4 2-2 4-2-4-4-2 4-2 2-4ZM40 8v6M37 11h6"/>',
};
export const navGlyph = (key: string) => `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${navPaths[key] ?? navPaths.Menu}</svg>`;

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
    ['Menu', L('가게', 'Shop')], ['Stages', L('지도', 'Map')], ['Lab', L('레시피', 'Recipes')], ['Daily', L('오늘', 'Daily')],
  ].map(([key, label]) => `<button data-action="nav-${key}" ${key === active ? 'aria-current="page"' : ''}><span class="nav-glyph">${navGlyph(key)}</span>${label}</button>`).join('')}</nav>`;
}

export function bindNav(scene: Phaser.Scene, root: HTMLElement) {
  ['Menu', 'Stages', 'Lab'].forEach(key => bind(root, `nav-${key}`, () => scene.scene.start(key)));
  bind(root, 'nav-Daily', () => scene.scene.start('Menu', { openDaily: true }));
}
