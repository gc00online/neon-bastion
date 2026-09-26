import type { Stats } from '../game/stats';
import { L } from '../i18n';

// 일일 도전: 날짜로 시드를 만들어 모든 플레이어가 같은 날 같은 웨이브 구성·카드 흐름·규칙으로 플레이한다.
export interface Modifier {
  id: string;
  name: string;
  desc: string;
  enemySpeed?: number;
  enemyHp?: number;
  count?: number;
  gem?: number;
  dmgTaken?: number;
  rarityBoost?: number;
  startCard?: boolean;
  apply?(s: Stats): void;
}

export const MODIFIERS: Modifier[] = [
  { id: 'swift', name: L('질주', 'Rush'), desc: L('적 이동 속도 +30%\n엽전 +20%', 'Enemy speed +30%\nCoins +20%'), enemySpeed: 1.3, gem: 1.2 },
  { id: 'horde', name: L('물량 공세', 'Horde'), desc: L('적 수 +50%\n엽전 +30%', 'Enemy count +50%\nCoins +30%'), count: 1.5, gem: 1.3 },
  { id: 'giants', name: L('대식가의 밤', 'Hungry guests'), desc: L('적 체력 +35%\n엽전 +40%', 'Enemy HP +35%\nCoins +40%'), enemyHp: 1.35, gem: 1.4 },
  { id: 'glass', name: L('유리 요새', 'Glass Fortress'), desc: L('최대 체력 60% 감소\n공격력 +30%', 'Max HP -60%\nDamage +30%'), apply: s => { s.maxHp = Math.round(s.maxHp * 0.4); s.dmgPct += 0.3; } },
  { id: 'lucky', name: L('행운의 날', 'Lucky Day'), desc: L('영웅·전설 카드 확률 3배', 'Epic & legendary cards ×3'), rarityBoost: 3 },
  { id: 'arsenal', name: L('무기고', 'Arsenal'), desc: L('시작할 때 영웅 카드 1장 선택', 'Pick an epic card at start'), startCard: true },
  { id: 'overclock', name: L('오버클럭', 'Overclock'), desc: L('공격 속도 +40%\n받는 피해 +40%', 'Attack speed +40%\nDamage taken +40%'), dmgTaken: 1.4, apply: s => { s.ratePct += 0.4; } },
];

export function todayKey(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function daySeed(key = todayKey()) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function todayModifier(key = todayKey()) {
  return MODIFIERS[daySeed(key) % MODIFIERS.length];
}

// 시드 고정 난수 (mulberry32)
export function seededRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
