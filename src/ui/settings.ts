import Phaser from 'phaser';
import { W, H, COLOR } from '../config';
import { save, persist, applySettings } from '../save';
import { txt, panel, button } from './widgets';
import { L, lang, setLang } from '../i18n';

type Key = 'sound' | 'music' | 'vibrate';

const ITEMS: { key: Key; label: string }[] = [
  { key: 'sound', label: L('효과음', 'Sound FX') },
  { key: 'music', label: L('배경음악', 'Music') },
  { key: 'vibrate', label: L('진동', 'Vibration') },
];

// 메뉴와 일시정지 화면에서 같이 쓰는 설정 창
// showLang: 언어를 바꾸면 화면을 새로 불러오므로 메뉴에서만 보여준다
export function openSettings(scene: Phaser.Scene, showLang = false, depth = 200, onClose?: () => void) {
  const o = scene.add.container(0, 0).setDepth(depth);
  const cy = H / 2;
  const dim = scene.add.rectangle(W / 2, H / 2, W, H, 0x03040a, 0.85).setInteractive();
  const g = scene.add.graphics();
  panel(g, W / 2, cy, 540, 660, COLOR.cyan);
  o.add([dim, g, txt(scene, W / 2, cy - 260, L('설정', 'SETTINGS'), 44, { color: COLOR.cyan, glow: true })]);

  const label = (k: Key, name: string) => `${name}   ${save[k] ? 'ON' : 'OFF'}`;
  ITEMS.forEach((it, i) => {
    const b = button(scene, W / 2, cy - 150 + i * 100, 420, 80, label(it.key, it.label), COLOR.white, () => {
      save[it.key] = !save[it.key];
      persist();
      applySettings();
      b.setLabel(label(it.key, it.label));
    }, 28);
    o.add(b);
  });

  if (showLang) o.add(button(scene, W / 2, cy + 150, 420, 80, lang === 'ko' ? 'Language: 한국어' : 'Language: English', COLOR.white, () => {
    setLang(lang === 'ko' ? 'en' : 'ko');
  }, 26));

  o.add(button(scene, W / 2, cy + 260, 300, 80, L('닫기', 'Close'), COLOR.cyan, () => {
    o.destroy();
    onClose?.();
  }, 28));
  return o;
}
