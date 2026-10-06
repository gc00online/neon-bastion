import { COLOR } from '../config';
import { L } from '../i18n';
import type { Ability, Stats } from '../game/stats';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export const RARITY: Record<Rarity, { name: string; color: number }> = {
  common: { name: L('일반', 'COMMON'), color: COLOR.body },
  rare: { name: L('희귀', 'RARE'), color: COLOR.rare },
  epic: { name: L('영웅', 'EPIC'), color: COLOR.epic },
  legendary: { name: L('전설', 'LEGENDARY'), color: COLOR.legend },
};

export interface CardCtx {
  stats: Stats;
  hp: number;
  heal(n: number): void;
  onStatsChanged(): void;
}

export interface Card {
  id: string;
  name: string;
  rarity: Rarity;
  icon: string;
  desc(s: Stats): string;
  apply(c: CardCtx): void;
  ability?: Ability;
  max?: number;
  can?(c: CardCtx): boolean;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

const ability = (id: Ability, name: string, rarity: Rarity, icon: string, desc: (lv: number, s: Stats) => string, max = 5): Card => ({
  id, name, rarity, icon, ability: id, max,
  desc: s => desc(s.lv[id] + 1, s),
  apply: c => { c.stats.lv[id]++; },
});

export const CARDS: Card[] = [
  // 일반
  { id: 'dmg', name: L('화력 강화', 'Firepower'), rarity: 'common', icon: 'e_circle', desc: () => L('공격력 +20%', 'Damage +20%'), apply: c => { c.stats.dmgPct += 0.2; } },
  { id: 'rate', name: L('속사', 'Rapid Fire'), rarity: 'common', icon: 'e_tri', desc: () => L('공격 속도 +15%', 'Attack speed +15%'), apply: c => { c.stats.ratePct += 0.15; } },
  { id: 'range', name: L('망원 조준경', 'Long Scope'), rarity: 'common', icon: 'ring', desc: () => L('사거리 +10%', 'Range +10%'), apply: c => { c.stats.rangePct += 0.1; } },
  { id: 'hp', name: L('장갑 보강', 'Plating'), rarity: 'common', icon: 'e_square', desc: () => L('최대 체력 +20\n체력 20 회복', 'Max HP +20\nHeal 20 HP'), apply: c => { c.stats.maxHp += 20; c.heal(20); } },
  { id: 'regen', name: L('나노 수리', 'Nano Repair'), rarity: 'common', icon: 'e_hex', desc: () => L('초당 체력 재생 +1', 'HP regen +1/s'), apply: c => { c.stats.regen += 1; } },
  { id: 'crit', name: L('약점 분석', 'Weak Spot'), rarity: 'common', icon: 'e_diamond', desc: () => L('치명타 확률 +6%', 'Crit chance +6%'), apply: c => { c.stats.critChance += 0.06; }, can: c => c.stats.critChance < 0.7 },
  { id: 'armor', name: L('방어막 코팅', 'Shield Coating'), rarity: 'common', icon: 'e_hex', desc: () => L('받는 피해 -6%', 'Damage taken -6%'), apply: c => { c.stats.dmgReduce += 0.06; }, can: c => c.stats.dmgReduce < 0.6 },
  { id: 'repair', name: L('긴급 수리', 'Emergency Fix'), rarity: 'common', icon: 'core', desc: () => L('체력 50% 회복', 'Heal 50% HP'), apply: c => { c.heal(c.stats.maxHp * 0.5); }, can: c => c.hp < c.stats.maxHp * 0.8 },

  // 희귀
  { id: 'multi', name: L('분열 사격', 'Split Shot'), rarity: 'rare', icon: 'e_tri', desc: s => L(`발사체 +1 (${s.multishot} → ${s.multishot + 1})`, `Projectiles +1 (${s.multishot} → ${s.multishot + 1})`), apply: c => { c.stats.multishot += 1; }, can: c => c.stats.multishot < 7 },
  { id: 'pierce', name: L('관통탄', 'Piercing Rounds'), rarity: 'rare', icon: 'missile', desc: s => L(`탄환이 적 ${s.pierce + 1}명 더 관통`, `Bullets pierce ${s.pierce + 1} more`), apply: c => { c.stats.pierce += 1; }, can: c => c.stats.pierce < 5 },
  { id: 'critdmg', name: L('치명적 일격', 'Lethal Strike'), rarity: 'rare', icon: 'e_diamond', desc: s => L(`치명타 피해 ${pct(s.critMult)} → ${pct(s.critMult + 0.5)}`, `Crit damage ${pct(s.critMult)} → ${pct(s.critMult + 0.5)}`), apply: c => { c.stats.critMult += 0.5; } },
  { id: 'lifesteal', name: L('흡수 회로', 'Siphon Circuit'), rarity: 'rare', icon: 'e_circle', desc: s => L(`적 처치 시 체력 +${s.lifesteal + 1}`, `+${s.lifesteal + 1} HP per kill`), apply: c => { c.stats.lifesteal += 1; }, can: c => c.stats.lifesteal < 5 },
  ability('splash', L('폭발탄', 'Explosive Rounds'), 'rare', 'ring', lv => L(`명중 시 주변 폭발\n범위 ${50 + 12 * lv}, 피해 ${pct(0.35 + 0.1 * lv)}`, `Hits explode\nRadius ${50 + 12 * lv}, ${pct(0.35 + 0.1 * lv)} damage`)),
  ability('frost', L('냉기장', 'Frost Field'), 'rare', 'e_hex', lv => L(`주변 적 감속 ${pct(Math.min(0.5, 0.15 + 0.07 * lv))}\n범위 ${140 + 25 * lv}`, `Slows nearby enemies ${pct(Math.min(0.5, 0.15 + 0.07 * lv))}\nRadius ${140 + 25 * lv}`)),
  ability('poison', L('부식탄', 'Corrosive Rounds'), 'rare', 'e_penta', lv => L(`명중한 적에게 독\n초당 공격력의 ${pct(0.3 * lv)} (3초)`, `Hits poison enemies\n${pct(0.3 * lv)} of damage per sec (3s)`)),

  // 영웅
  ability('chain', L('연쇄 번개', 'Chain Lightning'), 'epic', 'e_tri', lv => L(`${pct(0.2 + 0.05 * lv)} 확률로 번개 발동\n적 ${1 + lv}명에게 연쇄`, `${pct(0.2 + 0.05 * lv)} chance on hit\nChains to ${1 + lv} enemies`)),
  ability('blades', L('궤도 칼날', 'Orbit Blades'), 'epic', 'blade', lv => L(`칼날 ${lv + 1}개가 기지 주위를 회전`, `${lv + 1} blades orbit your base`)),
  ability('missiles', L('추적 미사일', 'Homing Missiles'), 'epic', 'missile', lv => L(`2.5초마다 미사일 ${lv}발\n폭발 피해 공격력의 160%`, `${lv} missile(s) every 2.5s\nExplosion: 160% damage`)),
  ability('nova', L('충격파', 'Shockwave'), 'epic', 'ring', lv => L(`${(7 - 0.8 * lv).toFixed(1)}초마다 충격파\n피해 + 적 밀쳐내기`, `Shockwave every ${(7 - 0.8 * lv).toFixed(1)}s\nDamages and knocks back`)),
  ability('execute', L('처형', 'Execute'), 'epic', 'e_diamond', lv => L(`체력 ${pct(0.07 * lv)} 이하 적 즉사\n(보스 제외)`, `Instantly kill enemies\nbelow ${pct(0.07 * lv)} HP (not bosses)`), 3),

  // 전설
  { id: 'overdrive', name: L('오버드라이브', 'Overdrive'), rarity: 'legendary', icon: 'core', desc: () => L('공격 속도 +50%\n공격력 +25%', 'Attack speed +50%\nDamage +25%'), apply: c => { c.stats.ratePct += 0.5; c.stats.dmgPct += 0.25; } },
  { id: 'barrage', name: L('탄막', 'Barrage'), rarity: 'legendary', icon: 'e_tri', desc: () => L('발사체 +2', 'Projectiles +2'), apply: c => { c.stats.multishot += 2; }, can: c => c.stats.multishot < 7 },
  { id: 'fortress', name: L('요새화', 'Fortify'), rarity: 'legendary', icon: 'e_square', desc: () => L('최대 체력 +60, 재생 +2\n받는 피해 -10%', 'Max HP +60, regen +2\nDamage taken -10%'), apply: c => { c.stats.maxHp += 60; c.heal(60); c.stats.regen += 2; c.stats.dmgReduce = Math.min(0.7, c.stats.dmgReduce + 0.1); } },
  { id: 'glass', name: L('유리 대포', 'Glass Cannon'), rarity: 'legendary', icon: 'e_diamond', desc: () => L('공격력 +80%\n최대 체력 -30%', 'Damage +80%\nMax HP -30%'), apply: c => { c.stats.dmgPct += 0.8; c.stats.maxHp = Math.round(c.stats.maxHp * 0.7); c.heal(0); }, can: c => c.stats.maxHp > 70 },
];

export function rarityWeights(wave: number): Record<Rarity, number> {
  return {
    common: Math.max(30, 62 - wave * 1.2),
    rare: 28,
    epic: 8 + wave * 0.5,
    legendary: 1.5 + wave * 0.15,
  };
}

function available(ctx: CardCtx, taken: Set<string>) {
  return CARDS.filter(card =>
    !taken.has(card.id) &&
    (!card.ability || ctx.stats.lv[card.ability] < (card.max ?? 5)) &&
    (!card.can || card.can(ctx)));
}

// 카드 3장 뽑기. minRarity 가 있으면 첫 장은 그 이상 등급을 보장한다.
export function drawCards(ctx: CardCtx, wave: number, n = 3, minRarity?: Rarity, rng: () => number = Math.random, boost = 1): Card[] {
  const order: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
  const out: Card[] = [];
  const taken = new Set<string>();
  const weights = rarityWeights(wave);
  weights.epic *= boost;
  weights.legendary *= boost;
  for (let i = 0; i < n; i++) {
    let pool = available(ctx, taken);
    if (i === 0 && minRarity) {
      const floor = order.indexOf(minRarity);
      const better = pool.filter(c => order.indexOf(c.rarity) >= floor);
      if (better.length) pool = better;
    }
    if (!pool.length) break;
    const total = pool.reduce((s, c) => s + weights[c.rarity], 0);
    let roll = rng() * total;
    let pick = pool[0];
    for (const c of pool) { roll -= weights[c.rarity]; if (roll <= 0) { pick = c; break; } }
    out.push(pick);
    taken.add(pick.id);
  }
  return out;
}
