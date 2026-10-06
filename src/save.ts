import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { sfx, haptics } from './audio';
import { music } from './music';

export interface DailyRecord {
  day: string;
  best: number;
  runs: number;
}

export interface SaveData {
  gems: number;
  best: number;
  runs: number;
  lab: Record<string, number>;
  sound: boolean;
  music: boolean;
  vibrate: boolean;
  tips: Record<string, boolean>;
  daily: DailyRecord;
  /** 화면 흔들림·플래시·스캔라인 끄기 (멀미·눈부심 대응) */
  reducedFx: boolean;
  /** 마지막 출격 요약 (메뉴 티커용) */
  lastRun: { wave: number; kills: number; time: number; gems: number } | null;
}

const KEY = 'neon-bastion-save-v1';

const fresh = (): SaveData => ({
  gems: 0, best: 0, runs: 0, lab: {},
  sound: true, music: true, vibrate: true,
  tips: {},
  daily: { day: '', best: 0, runs: 0 },
  reducedFx: false,
  lastRun: null,
});

export let save: SaveData = parse(safeLocal());

function safeLocal() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

function parse(raw: string | null): SaveData {
  try {
    if (raw) return { ...fresh(), ...JSON.parse(raw) };
  } catch { /* 깨진 데이터면 새로 시작 */ }
  return fresh();
}

// 앱에서는 OS가 지우지 않는 네이티브 저장소(Preferences)를 기준으로 삼는다.
// (iOS 웹뷰의 localStorage 는 저장 공간이 부족하면 지워질 수 있음)
export async function loadSave() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { value } = await Preferences.get({ key: KEY });
    if (value) save = parse(value);
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

export const reducedFx = () => !!save.reducedFx;

export function resetSave() {
  save = fresh();
  persist();
}
