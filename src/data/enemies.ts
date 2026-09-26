import { COLOR } from '../config';
import { L } from '../i18n';

export type EnemyKind =
  | 'grunt' | 'runner' | 'brute' | 'swarm' | 'shooter' | 'splitter' | 'mini' | 'healer' | 'blinker'
  | 'boss' | 'queen' | 'artillery';

export interface EnemyDef {
  tex: string;
  color: number;
  hp: number;
  speed: number;
  r: number;
  dmg: number;
  spin: number;
  boss?: string; // 보스 이름
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  grunt: { tex: 'e_circle', color: COLOR.red, hp: 18, speed: 70, r: 16, dmg: 6, spin: 0 },
  runner: { tex: 'e_tri', color: COLOR.yellow, hp: 9, speed: 140, r: 14, dmg: 4, spin: 0 },
  brute: { tex: 'e_square', color: COLOR.purple, hp: 80, speed: 40, r: 24, dmg: 15, spin: 0.6 },
  swarm: { tex: 'e_circle', color: COLOR.green, hp: 5, speed: 105, r: 9, dmg: 2, spin: 0 },
  shooter: { tex: 'e_diamond', color: COLOR.blue, hp: 28, speed: 62, r: 17, dmg: 5, spin: 0 },
  splitter: { tex: 'e_penta', color: COLOR.orange, hp: 48, speed: 55, r: 21, dmg: 8, spin: 1.2 },
  mini: { tex: 'e_penta', color: COLOR.orange, hp: 10, speed: 98, r: 10, dmg: 3, spin: 2.5 },
  healer: { tex: 'e_plus', color: 0x7cffcb, hp: 36, speed: 52, r: 18, dmg: 5, spin: 0.8 },
  blinker: { tex: 'e_star', color: 0xf15bb5, hp: 24, speed: 60, r: 16, dmg: 7, spin: 3 },
  boss: { tex: 'e_hex', color: COLOR.pink, hp: 250, speed: 24, r: 48, dmg: 10, spin: 0.4, boss: L('헥스 타이탄', 'Hex Titan') },
  queen: { tex: 'e_octa', color: 0xb5ff3b, hp: 210, speed: 20, r: 46, dmg: 8, spin: -0.3, boss: L('하이브 퀸', 'Hive Queen') },
  artillery: { tex: 'e_diamond', color: 0x7b8cff, hp: 190, speed: 26, r: 44, dmg: 5, spin: 0, boss: L('아틸러리', 'Artillery') },
};

export const BOSS_ORDER: EnemyKind[] = ['boss', 'queen', 'artillery'];
export const bossForWave = (w: number) => BOSS_ORDER[(Math.floor(w / 5) - 1) % BOSS_ORDER.length];

export interface SpawnEntry { t: number; kind: EnemyKind; }

// 웨이브별 난이도 배율
export const hpMul = (w: number) => Math.pow(1.12, w - 1);
export const speedMul = (w: number) => 1 + Math.min(0.5, 0.012 * (w - 1));
export const dmgMul = (w: number) => 1 + 0.08 * (w - 1);

interface PoolItem { kind: EnemyKind; cost: number; from: number; weight: number; group?: number; }

const POOL: PoolItem[] = [
  { kind: 'grunt', cost: 1, from: 1, weight: 10 },
  { kind: 'runner', cost: 1, from: 3, weight: 6 },
  { kind: 'swarm', cost: 2, from: 4, weight: 4, group: 5 },
  { kind: 'brute', cost: 4, from: 6, weight: 3 },
  { kind: 'shooter', cost: 3, from: 8, weight: 3 },
  { kind: 'splitter', cost: 4, from: 11, weight: 3 },
  { kind: 'healer', cost: 4, from: 13, weight: 2 },
  { kind: 'blinker', cost: 3, from: 16, weight: 3 },
];

export function isBossWave(w: number) { return w % 5 === 0; }

export function buildWave(w: number, rng: () => number = Math.random, countMul = 1): { entries: SpawnEntry[]; duration: number } {
  let budget = (6 + w * 2.2 + Math.pow(w, 1.35) * 0.8) * countMul;
  const duration = Math.min(9 + w * 0.9, 26);
  const entries: SpawnEntry[] = [];
  if (isBossWave(w)) {
    budget *= 0.5;
    entries.push({ t: 1.5, kind: bossForWave(w) });
  }
  const avail = POOL.filter(p => w >= p.from);
  const total = avail.reduce((s, p) => s + p.weight, 0);
  while (budget > 0) {
    let roll = rng() * total;
    let pick = avail[0];
    for (const p of avail) { roll -= p.weight; if (roll <= 0) { pick = p; break; } }
    budget -= pick.cost;
    const t = rng() * duration;
    const n = pick.group ?? 1;
    for (let i = 0; i < n; i++) entries.push({ t: t + i * 0.12, kind: pick.kind });
  }
  entries.sort((a, b) => a.t - b.t);
  return { entries, duration };
}
