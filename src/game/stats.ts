export type Ability = 'splash' | 'frost' | 'poison' | 'chain' | 'blades' | 'missiles' | 'nova' | 'execute';

export const ABILITIES: Ability[] = ['splash', 'frost', 'poison', 'chain', 'blades', 'missiles', 'nova', 'execute'];

// 타워의 모든 능력치. 퍼센트 보너스는 합연산이라 후반으로 갈수록 효율이 떨어져 자연스러운 벽이 생긴다.
export class Stats {
  baseDamage = 14;
  dmgPct = 0;
  baseRate = 1.6;
  ratePct = 0;
  baseRange = 270;
  rangePct = 0;
  projSpeed = 760;
  multishot = 1;
  pierce = 0;
  critChance = 0.05;
  critMult = 2;
  maxHp = 100;
  regen = 0;
  dmgReduce = 0;
  lifesteal = 0;
  gemMul = 1;
  rerolls = 1;
  lv: Record<Ability, number> = { splash: 0, frost: 0, poison: 0, chain: 0, blades: 0, missiles: 0, nova: 0, execute: 0 };

  get damage() { return this.baseDamage * (1 + this.dmgPct); }
  get fireRate() { return this.baseRate * (1 + this.ratePct); }
  get range() { return Math.min(this.baseRange * (1 + this.rangePct), 520); }

  // 능력별 수치
  get splashRadius() { return 50 + 12 * this.lv.splash; }
  get splashPct() { return 0.35 + 0.1 * this.lv.splash; }
  get frostRadius() { return 140 + 25 * this.lv.frost; }
  get frostSlow() { return Math.min(0.5, 0.15 + 0.07 * this.lv.frost); }
  get poisonDps() { return this.damage * 0.3 * this.lv.poison; }
  get chainJumps() { return 1 + this.lv.chain; }
  get chainChance() { return 0.2 + 0.05 * this.lv.chain; }
  get bladeCount() { return this.lv.blades + 1; }
  get bladeDamage() { return this.damage * 0.5 * (1 + 0.2 * this.lv.blades); }
  get missileCount() { return this.lv.missiles; }
  get missileDamage() { return this.damage * 1.6; }
  get novaCooldown() { return 7 - 0.8 * this.lv.nova; }
  get novaRadius() { return 220 + 20 * this.lv.nova; }
  get novaDamage() { return this.damage * (1 + 0.6 * this.lv.nova); }
  get executePct() { return 0.07 * this.lv.execute; }
}
