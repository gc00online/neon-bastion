import Phaser from 'phaser';
import { W, H, COLOR, px } from '../config';
import { save, persist, applySettings } from '../save';
import { txt, label, panel, button, toggle, slider } from './widgets';
import { music } from '../music';
import { L, lang, setLang } from '../i18n';

type Key = 'sound' | 'music' | 'vibrate' | 'reducedFx';

const ITEMS: { key: Key; label: string; note?: string }[] = [
  { key: 'sound', label: L('효과음', 'Sound FX') },
  { key: 'music', label: L('배경음악', 'Music') },
  { key: 'vibrate', label: L('진동', 'Vibration') },
  { key: 'reducedFx', label: L('화면 흔들림 · 플래시 끄기', 'Reduce shake & flash'), note: L('멀미나 눈부심이 있으면 켜세요', 'Turn on if effects cause discomfort') },
];

// 메뉴와 일시정지 화면에서 같이 쓰는 설정 시트
// showLang: 언어를 바꾸면 화면을 새로 불러오므로 메뉴에서만 보여준다
export function openSettings(scene: Phaser.Scene, showLang = false, depth = 200, onClose?: () => void) {
  const MX = px(24);
  const o = scene.add.container(0, 0).setDepth(depth);
  const dim = scene.add.rectangle(W / 2, H / 2, W, H, COLOR.bg, 0.72).setInteractive();
  o.add(dim);
  const rowH = px(48);
  const sheetH = px(60) + rowH * ITEMS.length + (showLang ? rowH : 0) + px(110);
  const sy = H - sheetH;
  const sg = scene.add.graphics();
  panel(sg, W / 2, sy + sheetH / 2 + 2, W + 4, sheetH + 4, { fill: COLOR.surf1, stroke: COLOR.lineP, cut: { tl: px(24), tr: px(24) } });
  sg.fillStyle(COLOR.lineP, 1).fillRect(W / 2 - px(18), sy + px(14), px(36), 3);
  o.add(sg);
  o.add(label(scene, MX, sy + px(38), 'SETTINGS', px(10), COLOR.cyan));
  o.add(txt(scene, W - MX, sy + px(38), L('설정', 'Settings'), px(14), { align: 'right', weight: 600 }));

  let y = sy + px(56);
  ITEMS.forEach(it => {
    const ry = y + rowH / 2;
    o.add(txt(scene, MX, ry - (it.note ? px(7) : 0), it.label, px(13), { align: 'left', weight: 500 }));
    if (it.note) o.add(txt(scene, MX, ry + px(10), it.note, px(10), { align: 'left', color: COLOR.dim, weight: 500 }));
    o.add(toggle(scene, W - MX - px(22), ry, !!save[it.key], v => { (save as any)[it.key] = v; persist(); applySettings(); }));
    if (it.key === 'music') o.add(musicSlider(scene, W - MX - px(56) - px(70), ry));
    const ln = scene.add.graphics(); ln.lineStyle(2, COLOR.line, 1).lineBetween(MX, y + rowH, W - MX, y + rowH); o.add(ln);
    y += rowH;
  });
  if (showLang) {
    const ry = y + rowH / 2;
    o.add(txt(scene, MX, ry, 'Language', px(13), { align: 'left', weight: 500 }));
    o.add(button(scene, W - MX - px(60), ry, px(120), px(36), lang === 'ko' ? '한국어 ▸ EN' : 'English ▸ KO', () => setLang(lang === 'ko' ? 'en' : 'ko'), { kind: 'secondary', size: px(12), cut: {} }));
    y += rowH;
  }
  o.add(button(scene, W / 2, H - px(26) - px(28), W - MX * 2, px(56), L('닫기', 'Close'), () => { o.destroy(); onClose?.(); }, { kind: 'primary', size: px(16) }));
  return o;
}

/** 배경음악 줄 안에 넣는 음량 슬라이더 (설정 시트·일시정지 시트 공용) */
export function musicSlider(scene: Phaser.Scene, x: number, y: number) {
  return slider(scene, x, y, px(120), save.musicVol, (v, done) => {
    save.musicVol = v;
    music.setVolume(v);
    if (done) persist();
  });
}
