import { Stats } from '../game/stats';
import { L } from '../i18n';

// 연구소: 판이 끝날 때 얻은 보석으로 영구 강화
export interface LabUpgrade {
  id: string;
  name: string;
  max: number;
  desc(lv: number): string;
  cost(lv: number): number;
  apply(s: Stats, lv: number): void;
}

const curve = (base: number, grow: number) => (lv: number) => Math.round(base * Math.pow(grow, lv));

export const LAB: LabUpgrade[] = [
  { id: 'dmg', name: L('공격력', 'Damage'), max: 20, desc: lv => L(`공격력 +${lv * 6}%`, `Damage +${lv * 6}%`), cost: curve(8, 1.28), apply: (s, lv) => { s.dmgPct += lv * 0.06; } },
  { id: 'rate', name: L('공격 속도', 'Attack Speed'), max: 15, desc: lv => L(`공격 속도 +${lv * 4}%`, `Attack speed +${lv * 4}%`), cost: curve(10, 1.3), apply: (s, lv) => { s.ratePct += lv * 0.04; } },
  { id: 'hp', name: L('최대 체력', 'Max HP'), max: 20, desc: lv => L(`최대 체력 +${lv * 10}`, `Max HP +${lv * 10}`), cost: curve(8, 1.25), apply: (s, lv) => { s.maxHp += lv * 10; } },
  { id: 'regen', name: L('체력 재생', 'Regeneration'), max: 10, desc: lv => L(`초당 재생 +${(lv * 0.3).toFixed(1)}`, `Regen +${(lv * 0.3).toFixed(1)}/s`), cost: curve(12, 1.32), apply: (s, lv) => { s.regen += lv * 0.3; } },
  { id: 'range', name: L('사거리', 'Range'), max: 10, desc: lv => L(`사거리 +${lv * 3}%`, `Range +${lv * 3}%`), cost: curve(10, 1.3), apply: (s, lv) => { s.rangePct += lv * 0.03; } },
  { id: 'crit', name: L('치명타', 'Critical'), max: 10, desc: lv => L(`치명타 확률 +${lv}%`, `Crit chance +${lv}%`), cost: curve(12, 1.3), apply: (s, lv) => { s.critChance += lv * 0.01; } },
  { id: 'armor', name: L('장갑', 'Armor'), max: 10, desc: lv => L(`받는 피해 -${lv * 2}%`, `Damage taken -${lv * 2}%`), cost: curve(15, 1.33), apply: (s, lv) => { s.dmgReduce += lv * 0.02; } },
  { id: 'reroll', name: L('새로고침', 'Rerolls'), max: 3, desc: lv => L(`판마다 새로고침 +${lv}회`, `+${lv} reroll(s) per run`), cost: curve(40, 2.2), apply: (s, lv) => { s.rerolls += lv; } },
  { id: 'gem', name: L('보석 탐지기', 'Gem Finder'), max: 10, desc: lv => L(`보석 획득 +${lv * 10}%`, `Gems +${lv * 10}%`), cost: curve(20, 1.35), apply: (s, lv) => { s.gemMul += lv * 0.1; } },
  { id: 'start', name: L('선행 연구', 'Head Start'), max: 1, desc: lv => lv ? L('시작 시 희귀 이상 카드 1장 선택', 'Pick a rare+ card at start') : L('없음', 'None'), cost: () => 120, apply: () => { /* GameScene 에서 처리 */ } },
];

export function buildStats(lab: Record<string, number>): Stats {
  const s = new Stats();
  for (const u of LAB) {
    const lv = lab[u.id] ?? 0;
    if (lv) u.apply(s, lv);
  }
  return s;
}
