import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { sfx, haptics } from './audio';
import { music } from './music';

import { fresh, parseSave } from './game/saveSchema';
export type { SaveData, DailyRecord } from './game/saveSchema';

// Keep the original key so existing web and native players retain progress.
const KEY = 'neon-bastion-save-v1';

export let save = parseSave(safeLocal());

function safeLocal() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

// 앱에서는 OS가 지우지 않는 네이티브 저장소(Preferences)를 기준으로 삼는다.
// (iOS 웹뷰의 localStorage 는 저장 공간이 부족하면 지워질 수 있음)
export async function loadSave() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { value } = await Preferences.get({ key: KEY });
    if (value) save = parseSave(value);
    else persist();
  } catch { /* 무시 */ }
}

export function persist() {
  const raw = JSON.stringify(save);
  try { localStorage.setItem(KEY, raw); } catch { /* 무시 */ }
  if (Capacitor.isNativePlatform()) Preferences.set({ key: KEY, value: raw }).catch(() => { /* 무시 */ });
}

export function applySettings() {
  sfx.enabled = save.sound;
  haptics.enabled = save.vibrate;
  music.setEnabled(save.music);
}

export function resetSave() {
  save = fresh();
  persist();
}
