import Phaser from 'phaser';
import { W, H, OY, CORE_X, CORE_Y, CORE_R, COLOR, setupCamera, hex } from '../config';
import { SHAPE_R, RING_R, CORE_TEX_R } from './BootScene';
import { ENEMIES, EnemyKind, SpawnEntry, buildWave, hpMul, speedMul, dmgMul, isBossWave, bossForWave } from '../data/enemies';
import { Card, CardCtx, Rarity, RARITY, drawCards, CARDS } from '../data/cards';
import { LAB, buildStats } from '../data/lab';
import { ABILITIES, Stats } from '../game/stats';
import { sfx, vibrate } from '../audio';
import { music } from '../music';
import { openSettings } from '../ui/settings';
import { L } from '../i18n';
import { Modifier, MODIFIERS, todayKey, todayModifier, daySeed, seededRng } from '../data/daily';
import { save, persist } from '../save';
import { txt, panel, button, Button } from '../ui/widgets';
import { drawBackground } from '../ui/bg';

type Img = Phaser.GameObjects.Image;
type State = 'play' | 'between' | 'cards' | 'paused' | 'over';

interface Enemy {
  s: Img;
  kind: EnemyKind;
  x: number; y: number;
  vx: number; vy: number;
  kx: number; ky: number;
  hp: number; maxHp: number;
  speed: number; r: number; dmg: number; color: number;
  boss: boolean;
  dead: boolean;
  flash: number; flashing: boolean;
  poisonDps: number; poisonT: number; poisonFx: number;
  bladeCd: number;
  shootT: number;
  attackT: number;
  spin: number;
}

interface Bullet { s: Img; x: number; y: number; vx: number; vy: number; dmg: number; crit: boolean; pierce: number; hit: Enemy[]; life: number; dead: boolean; }
interface Missile { s: Img; x: number; y: number; vx: number; vy: number; target: Enemy | null; life: number; trail: number; dead: boolean; }
interface EBullet { s: Img; x: number; y: number; vx: number; vy: number; dmg: number; dead: boolean; }
interface Bolt { pts: number[]; life: number; }
interface Num { t: Phaser.GameObjects.Text; busy: boolean; }

const BLADE_R = 108;
const STEP = 1 / 60;

// 아이콘 텍스처별 실제 그림 지름(px) → 원하는 크기로 맞추기 위한 배율
const ICON_D: Record<string, number> = { ring: 240, core: 140, blade: 84, missile: 48 };
const iconScale = (key: string, size: number) => size / (ICON_D[key] ?? 92);

function compact<T extends { dead: boolean }>(arr: T[]) {
  let j = 0;
  for (let i = 0; i < arr.length; i++) if (!arr[i].dead) arr[j++] = arr[i];
  arr.length = j;
}

export class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  private state: State = 'play';
  private stats!: Stats;
  private hp = 0;
  private wave = 0;
  private wavesCleared = 0;
  private kills = 0;
  private bossKills = 0;
  private rerollsLeft = 0;
  private speedMode = 1;

  private enemies: Enemy[] = [];
  private bullets: Bullet[] = [];
  private missiles: Missile[] = [];
  private ebullets: EBullet[] = [];
  private bolts: Bolt[] = [];
  private blades: Img[] = [];

  private queue: SpawnEntry[] = [];
  private waveTime = 0;
  private waveTotal = 0;
  private spawned = 0;
  private fireCd = 0;
  private missileCd = 0;
  private novaCd = 0;
  private bladeAngle = 0;
  private hurtFlash = 0;

  private pool = new Map<string, Img[]>();
  private emitters = new Map<string, Phaser.GameObjects.Particles.ParticleEmitter>();
  private nums: Num[] = [];

  private core!: Img;
  private barrel!: Img;
  private coreGlow!: Img;
  private frostRing!: Img;
  private frostFill!: Img;
  private rangeG!: Phaser.GameObjects.Graphics;
  private fxG!: Phaser.GameObjects.Graphics;
  private barG!: Phaser.GameObjects.Graphics;

  private hudWave!: Phaser.GameObjects.Text;
  private hudSub!: Phaser.GameObjects.Text;
  private hudHp!: Phaser.GameObjects.Text;
  private hudG!: Phaser.GameObjects.Graphics;
  private hudStats!: Phaser.GameObjects.Text;
  private hudBoss!: Phaser.GameObjects.Text;
  private abilityRow!: Phaser.GameObjects.Container;
  private speedBtn!: Button;
  private overlay?: Phaser.GameObjects.Container;
  private shownHp = 0;

  private bot = false;
  private botSpeed = 6;
  private daily = false;
  private mod: Modifier | null = null;
  private rng: () => number = Math.random;
  private dayKey = '';

  init(data: { daily?: boolean }) {
    this.daily = !!data?.daily;
  }

  create() {
    setupCamera(this);
    drawBackground(this);

    const params = new URLSearchParams(location.search);
    this.bot = params.has('bot');
    this.botSpeed = Number(params.get('speed') ?? 6);
    let lab = save.lab;
    if (this.bot && params.has('lab')) {
      const n = Number(params.get('lab'));
      lab = Object.fromEntries(LAB.map(u => [u.id, Math.min(u.max, n)]));
    }

    this.dayKey = todayKey();
    this.mod = this.daily ? todayModifier(this.dayKey) : null;
    if (this.bot && params.has('mod')) { this.daily = true; this.mod = MODIFIERS.find(m => m.id === params.get('mod')) ?? null; }
    this.rng = this.daily ? seededRng(daySeed(this.dayKey)) : Math.random;

    this.state = 'play';
    this.stats = buildStats(lab);
    this.mod?.apply?.(this.stats);
    this.hp = this.shownHp = this.stats.maxHp;
    this.wave = this.wavesCleared = this.kills = this.bossKills = 0;
    this.rerollsLeft = this.stats.rerolls;
    this.speedMode = 1;
    this.enemies = []; this.bullets = []; this.missiles = []; this.ebullets = []; this.bolts = []; this.blades = [];
    this.queue = [];
    this.fireCd = this.missileCd = this.bladeAngle = this.hurtFlash = 0;
    this.novaCd = 2;
    this.pool = new Map();
    this.emitters = new Map();
    this.nums = [];
    this.overlay = undefined;

    // 기지
    this.coreGlow = this.add.image(CORE_X, CORE_Y, 'glow').setTint(COLOR.cyan).setAlpha(0.35).setScale(1.3).setBlendMode(Phaser.BlendModes.ADD).setDepth(4);
    this.frostFill = this.add.image(CORE_X, CORE_Y, 'glow').setTint(0x7fdbff).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(5);
    this.frostRing = this.add.image(CORE_X, CORE_Y, 'ring').setTint(0x7fdbff).setAlpha(0).setDepth(5);
    this.rangeG = this.add.graphics().setDepth(6);
    this.barG = this.add.graphics().setDepth(11);
    this.core = this.add.image(CORE_X, CORE_Y, 'core').setTint(COLOR.cyan).setScale(CORE_R / CORE_TEX_R).setDepth(20);
    this.barrel = this.add.image(CORE_X, CORE_Y, 'barrel').setTint(0xbffcff).setScale(CORE_R / CORE_TEX_R).setDepth(21);
    this.fxG = this.add.graphics().setDepth(26).setBlendMode(Phaser.BlendModes.ADD);

    for (let i = 0; i < 48; i++) {
      const t = txt(this, 0, 0, '', 22).setDepth(30).setVisible(false);
      this.nums.push({ t, busy: false });
    }

    this.buildHud();
    this.onStatsChanged();

    this.game.events.on(Phaser.Core.Events.HIDDEN, this.onHidden, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.HIDDEN, this.onHidden, this);
      this.tweens.killAll();
    });

    this.cameras.main.fadeIn(300, 7, 9, 18);
    if (this.mod?.startCard) {
      this.time.delayedCall(400, () => this.showCards('epic', this.mod!.name, L('오늘의 도전: 영웅 카드 하나를 고르세요', "Today's rule: pick an epic card")));
    } else if ((lab.start ?? 0) > 0) {
      this.time.delayedCall(400, () => this.showCards('rare', L('선행 연구', 'Head Start'), L('출발 전에 하나를 고르세요', 'Pick one before you start')));
    } else {
      this.time.delayedCall(400, () => this.startWave());
    }
    if (this.daily) this.banner(L(`일일 도전 · ${this.mod!.name}`, `Daily · ${this.mod!.name}`), COLOR.yellow, 0.6, 1600, 120);
    this.time.delayedCall(1800, () => this.tip('intro', L('기지는 가까운 적을 자동으로 공격해요.\n웨이브를 버틸 때마다 카드를 골라 강해지세요!', 'Your base shoots the nearest enemy automatically.\nSurvive each wave and pick a card to grow stronger!')));
  }

  // ───────────────────────── 웨이브 흐름 ─────────────────────────

  private startWave() {
    this.wave++;
    const { entries } = buildWave(this.wave, this.rng, this.mod?.count ?? 1);
    this.queue = entries;
    this.waveTime = 0;
    this.waveTotal = entries.length;
    this.spawned = 0;
    this.state = 'play';
    const boss = isBossWave(this.wave);
    this.banner(boss ? `BOSS WAVE ${this.wave}` : `WAVE ${this.wave}`, boss ? COLOR.pink : COLOR.cyan);
    if (boss) { const b = ENEMIES[bossForWave(this.wave)]; this.banner(b.boss!, b.color, 0.5, 900, 70); }
    if (boss) { sfx.boss(); this.cameras.main.flash(250, 120, 0, 40); } else sfx.waveStart();
    if (!this.bot) music.play(boss ? 2 : 1);
    if (this.wave === 3) this.time.delayedCall(1500, () => this.tip('speed', L('너무 느긋하다면 오른쪽 위 x2 버튼으로\n게임 속도를 올릴 수 있어요.', 'Too slow? Tap the x2 button at the top right\nto speed up the game.')));
    if (boss) this.time.delayedCall(2200, () => this.tip('boss', L('보스는 기지에 붙어서 계속 공격해요.\n처치하면 영웅 카드 확정 + 체력 회복!', 'Bosses keep attacking once they reach you.\nDefeat one for a guaranteed epic card + heal!')));
  }

  private waveCleared() {
    this.state = 'between';
    this.wavesCleared = this.wave;
    sfx.waveClear();
    this.heal(this.stats.maxHp * 0.25);
    this.banner('CLEAR', COLOR.green, 0.8, 300);
    const boss = isBossWave(this.wave);
    if (this.bot) { this.showCards(boss ? 'epic' : undefined, '', ''); return; }
    this.time.delayedCall(800, () => {
      if (this.state === 'between') this.showCards(boss ? 'epic' : undefined, L(`웨이브 ${this.wave} 클리어!`, `Wave ${this.wave} cleared!`), boss ? L('보스 보상: 영웅 등급 이상 확정', 'Boss reward: epic or better guaranteed') : L('업그레이드를 하나 고르세요', 'Choose an upgrade'));
    });
  }

  private banner(str: string, color: number, scale = 1, hold = 900, dy = 0) {
    const y = CORE_Y - 390 + dy;
    const t = txt(this, W / 2, y, str, 64 * scale, { color, glow: true }).setDepth(60).setScale(0.4).setAlpha(0);
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 260, ease: 'Back.Out' });
    this.tweens.add({ targets: t, alpha: 0, y: y - 40, delay: hold, duration: 400, onComplete: () => t.destroy() });
  }

  // ───────────────────────── 메인 루프 ─────────────────────────

  update(_time: number, delta: number) {
    const real = Math.min(delta / 1000, 0.05);
    if (this.state === 'play' || this.state === 'between') {
      const dt = real * (this.bot ? this.botSpeed : this.speedMode);
      const steps = Math.max(1, Math.ceil(dt / STEP - 0.001));
      const h = dt / steps;
      for (let i = 0; i < steps && (this.state === 'play' || this.state === 'between'); i++) this.step(h);
    }
    this.renderFrame(real);
  }

  private step(dt: number) {
    const st = this.stats;
    if (this.state === 'play') {
      this.waveTime += dt;
      while (this.queue.length && this.queue[0].t <= this.waveTime) {
        this.spawnEnemy(this.queue.shift()!.kind);
        this.spawned++;
      }
    }

    if (st.regen > 0) this.hp = Math.min(st.maxHp, this.hp + st.regen * dt);

    // 주포
    this.fireCd -= dt;
    if (this.fireCd <= 0) {
      const targets = this.findTargets(st.multishot, st.range);
      if (targets.length) {
        this.fire(targets);
        this.fireCd += 1 / st.fireRate;
      } else this.fireCd = 0;
    }

    // 미사일
    if (st.lv.missiles) {
      this.missileCd -= dt;
      if (this.missileCd <= 0 && this.enemies.length) {
        for (let i = 0; i < st.missileCount; i++) this.launchMissile(i, st.missileCount);
        this.missileCd = 2.5;
      }
    }

    // 충격파
    if (st.lv.nova) {
      this.novaCd -= dt;
      if (this.novaCd <= 0) {
        const r2 = (st.novaRadius * 0.8) ** 2;
        if (this.enemies.some(e => !e.dead && (e.x - CORE_X) ** 2 + (e.y - CORE_Y) ** 2 < r2)) {
          this.nova();
          this.novaCd = st.novaCooldown;
        } else this.novaCd = 0;
      }
    }

    this.updateBlades(dt);
    this.updateBullets(dt);
    this.updateMissiles(dt);
    this.updateEnemies(dt);
    this.updateEBullets(dt);

    compact(this.enemies);
    compact(this.bullets);
    compact(this.missiles);
    compact(this.ebullets);

    if (this.state === 'play' && !this.queue.length && !this.enemies.length) this.waveCleared();
  }

  // ───────────────────────── 적 ─────────────────────────

  private spawnEnemy(kind: EnemyKind, x?: number, y?: number) {
    const d = ENEMIES[kind];
    if (x === undefined || y === undefined) {
      // 화면 바깥 테두리 어딘가에서 등장
      const m = 50, pw = W + m * 2, ph = H + m * 2;
      let p = Math.random() * (pw + ph) * 2;
      if (p < pw) { x = p - m; y = -m; }
      else if ((p -= pw) < ph) { x = W + m; y = p - m; }
      else if ((p -= ph) < pw) { x = p - m; y = H + m; }
      else { p -= pw; x = -m; y = p - m; }
    }
    const boss = !!d.boss;
    const hp = d.hp * hpMul(this.wave) * (boss ? 1 + 0.15 * (this.wave / 5 - 1) : 1) * (this.mod?.enemyHp ?? 1);
    const s = this.img(d.tex, boss ? 9 : 10).setTint(d.color).setScale(d.r / SHAPE_R).setPosition(x, y);
    const e: Enemy = {
      s, kind, x, y, vx: 0, vy: 0, kx: 0, ky: 0,
      hp, maxHp: hp,
      speed: d.speed * speedMul(this.wave) * (0.9 + Math.random() * 0.2) * (this.mod?.enemySpeed ?? 1),
      r: d.r, dmg: d.dmg, color: d.color, boss, dead: false,
      flash: 0, flashing: false, poisonDps: 0, poisonT: 0, poisonFx: 0,
      bladeCd: 0, shootT: 1 + Math.random() * 1.5, attackT: 0,
      spin: d.spin * (Math.random() < 0.5 ? -1 : 1),
    };
    if (kind === 'blinker') s.setAlpha(0.8);
    this.enemies.push(e);
    return e;
  }

  private updateEnemies(dt: number) {
    const st = this.stats;
    const frostR2 = st.lv.frost ? st.frostRadius ** 2 : 0;
    const damp = Math.max(0, 1 - 5 * dt);
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.dead) continue;

      if (e.poisonT > 0) {
        e.poisonT -= dt;
        e.hp -= e.poisonDps * dt;
        e.poisonFx -= dt;
        if (e.poisonFx <= 0) { e.poisonFx = 0.25; this.burst(e.x, e.y, COLOR.green, 2, 'drip'); }
        if (e.hp <= 0) { this.kill(e); continue; }
      }

      const dx = CORE_X - e.x, dy = CORE_Y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      let sp = e.speed;
      if (frostR2 && d * d < frostR2) sp *= 1 - st.frostSlow;
      const contact = CORE_R + e.r;

      // 특수 능력
      e.shootT -= dt;
      if (e.shootT <= 0) {
        if (e.kind === 'healer') { e.shootT = 2.2; this.healPulse(e); }
        else if (e.kind === 'queen') { e.shootT = 3.5; this.summon(e); }
        else if (e.kind === 'blinker' && d > contact + 150) { e.shootT = 3; this.blink(e, dx / d, dy / d); }
      }

      const hold = e.kind === 'shooter' ? 250 : e.kind === 'artillery' ? 235 : 0;
      if (hold && d < hold) {
        // 사거리 안에서 천천히 돌면서 사격
        e.vx = (-dy / d) * sp * 0.35;
        e.vy = (dx / d) * sp * 0.35;
        if (e.shootT <= 0) {
          if (e.kind === 'shooter') { e.shootT = 2.2; this.enemyShoot(e); }
          else { e.shootT = 2.6; for (let k = -2; k <= 2; k++) this.enemyShoot(e, k * 0.16, 220); }
        }
      } else if (d > contact) {
        e.vx = (dx / d) * sp;
        e.vy = (dy / d) * sp;
      } else {
        e.vx = e.vy = 0;
        if (e.boss) {
          e.attackT -= dt;
          if (e.attackT <= 0) {
            e.attackT = 1;
            this.hurt(e.dmg);
            e.kx = -(dx / d) * 160; e.ky = -(dy / d) * 160;
          }
        } else {
          this.hurt(e.dmg);
          this.burst(e.x, e.y, e.color, 14, 'burst');
          e.dead = true;
          this.free(e.s);
          continue;
        }
      }

      e.x += (e.vx + e.kx) * dt;
      e.y += (e.vy + e.ky) * dt;
      e.kx *= damp; e.ky *= damp;
      e.bladeCd -= dt;

      e.s.setPosition(e.x, e.y);
      if (e.spin) e.s.rotation += e.spin * dt;
      // 피격 번쩍임 (보스는 색이 사라지지 않게 살짝만)
      if (e.flash > 0) {
        e.flash -= dt;
        if (!e.flashing) { if (e.boss) e.s.setAlpha(0.65); else e.s.setTintFill(0xffffff); e.flashing = true; }
      } else if (e.flashing) {
        if (e.boss) e.s.setAlpha(1); else e.s.setTint(e.color);
        e.flashing = false;
      }
    }
  }

  private enemyShoot(e: Enemy, spread = 0, speed = 260) {
    const a = Math.atan2(CORE_Y - e.y, CORE_X - e.x) + spread;
    const s = this.img('bullet', 14).setTint(e.color).setScale(0.8).setPosition(e.x, e.y);
    this.ebullets.push({ s, x: e.x, y: e.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, dmg: e.dmg, dead: false });
  }

  private healPulse(e: Enemy) {
    const R = 150;
    let any = false;
    for (const o of this.enemies) {
      if (o === e || o.dead || o.hp >= o.maxHp) continue;
      if ((o.x - e.x) ** 2 + (o.y - e.y) ** 2 > R * R) continue;
      o.hp = Math.min(o.maxHp, o.hp + o.maxHp * (o.boss ? 0.02 : 0.1));
      this.burst(o.x, o.y, e.color, 3, 'drip');
      any = true;
    }
    if (any || e.x > 0 && e.x < W && e.y > 0 && e.y < H) this.ringFx(e.x, e.y, R, e.color, 450, 0.15);
  }

  private blink(e: Enemy, ux: number, uy: number) {
    this.burst(e.x, e.y, e.color, 8, 'spark');
    e.x += ux * 100; e.y += uy * 100;
    this.burst(e.x, e.y, e.color, 8, 'spark');
  }

  private summon(e: Enemy) {
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * Math.PI * 2;
      const m = this.spawnEnemy('swarm', e.x + Math.cos(a) * 40, e.y + Math.sin(a) * 40);
      m.kx = Math.cos(a) * 160; m.ky = Math.sin(a) * 160;
    }
    this.ringFx(e.x, e.y, 90, e.color, 400, 0.3);
  }

  private updateEBullets(dt: number) {
    for (const b of this.ebullets) {
      if (b.dead) continue;
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.s.setPosition(b.x, b.y);
      if ((b.x - CORE_X) ** 2 + (b.y - CORE_Y) ** 2 < CORE_R * CORE_R) {
        this.hurt(b.dmg);
        this.burst(b.x, b.y, COLOR.blue, 6, 'spark');
        b.dead = true; this.free(b.s);
      }
    }
  }

  private damageEnemy(e: Enemy, dmg: number, crit = false, color?: number) {
    if (e.dead) return;
    e.hp -= dmg;
    e.flash = 0.06;
    if (crit) this.num(e.x, e.y - e.r, `${Math.round(dmg)}!`, COLOR.yellow, 30);
    else this.num(e.x, e.y - e.r, `${Math.round(dmg)}`, color ?? 0xffffff, 20);
    if (e.hp <= 0) this.kill(e);
    else if (!e.boss && this.stats.lv.execute && e.hp < e.maxHp * this.stats.executePct) {
      this.num(e.x, e.y - e.r - 20, L('처형', 'EXECUTE'), COLOR.pink, 24);
      this.kill(e);
    }
  }

  private kill(e: Enemy) {
    if (e.dead) return;
    e.dead = true;
    this.free(e.s);
    this.kills++;
    if (this.stats.lifesteal) this.heal(this.stats.lifesteal);
    if (e.boss) {
      this.bossKills++;
      this.burst(e.x, e.y, e.color, 60, 'big');
      this.burst(e.x, e.y, 0xffffff, 30, 'big');
      this.ringFx(e.x, e.y, 260, e.color, 600);
      this.cameras.main.shake(400, 0.012);
      this.cameras.main.flash(200, 255, 60, 140);
      sfx.boom();
      vibrate(80);
      this.heal(this.stats.maxHp * 0.25);
    } else {
      this.burst(e.x, e.y, e.color, e.r > 18 ? 18 : 10, 'burst');
      sfx.kill();
    }
    if (e.kind === 'splitter') {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + Math.random();
        const m = this.spawnEnemy('mini', e.x + Math.cos(a) * 14, e.y + Math.sin(a) * 14);
        m.kx = Math.cos(a) * 140; m.ky = Math.sin(a) * 140;
      }
    }
  }

  // ───────────────────────── 공격 ─────────────────────────

  private findTargets(n: number, range: number): Enemy[] {
    const r2 = range * range;
    const cands: { e: Enemy; d: number }[] = [];
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = (e.x - CORE_X) ** 2 + (e.y - CORE_Y) ** 2;
      if (d < r2) cands.push({ e, d });
    }
    cands.sort((a, b) => a.d - b.d);
    return cands.slice(0, n).map(c => c.e);
  }

  private fire(targets: Enemy[]) {
    const st = this.stats;
    const n = st.multishot;
    for (let i = 0; i < n; i++) {
      const t = targets[i % targets.length];
      const dist = Math.hypot(t.x - CORE_X, t.y - CORE_Y);
      const lead = dist / st.projSpeed;
      let a = Math.atan2(t.y + t.vy * lead - CORE_Y, t.x + t.vx * lead - CORE_X);
      if (i >= targets.length) a += (Math.floor(i / targets.length) % 2 ? 1 : -1) * 0.09 * Math.ceil(i / targets.length);
      const crit = Math.random() < st.critChance;
      const x = CORE_X + Math.cos(a) * (CORE_R + 6), y = CORE_Y + Math.sin(a) * (CORE_R + 6);
      const s = this.img('bullet', 15).setTint(crit ? COLOR.yellow : 0xbffcff).setScale(crit ? 0.9 : 0.65).setPosition(x, y).setBlendMode(Phaser.BlendModes.ADD);
      this.bullets.push({
        s, x, y, vx: Math.cos(a) * st.projSpeed, vy: Math.sin(a) * st.projSpeed,
        dmg: st.damage * (crit ? st.critMult : 1), crit, pierce: st.pierce, hit: [], life: 1.2, dead: false,
      });
      if (i === 0) this.barrel.rotation = a + Math.PI / 2;
    }
    this.barrel.setScale((CORE_R / CORE_TEX_R) * 0.9);
    sfx.shoot();
  }

  private updateBullets(dt: number) {
    const st = this.stats;
    for (const b of this.bullets) {
      if (b.dead) continue;
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -40 || b.x > W + 40 || b.y < -40 || b.y > H + 40) { b.dead = true; this.free(b.s); continue; }
      b.s.setPosition(b.x, b.y);
      for (const e of this.enemies) {
        if (e.dead || b.hit.includes(e)) continue;
        const rr = e.r + 6;
        if ((e.x - b.x) ** 2 + (e.y - b.y) ** 2 < rr * rr) {
          b.hit.push(e);
          this.onBulletHit(b, e, st);
          if (b.pierce > 0) b.pierce--;
          else { b.dead = true; this.free(b.s); break; }
        }
      }
    }
  }

  private onBulletHit(b: Bullet, e: Enemy, st: Stats) {
    const x = e.x, y = e.y;
    this.burst(b.x, b.y, b.crit ? COLOR.yellow : 0xbffcff, 4, 'spark');
    sfx.hit();
    this.damageEnemy(e, b.dmg, b.crit);
    if (st.lv.splash) {
      this.explode(x, y, st.splashRadius, b.dmg * st.splashPct, e, COLOR.orange, false);
    }
    if (st.lv.poison && !e.dead) {
      e.poisonDps = Math.max(e.poisonDps, st.poisonDps);
      e.poisonT = 3;
    }
    if (st.lv.chain && Math.random() < st.chainChance) this.chain(x, y, e, b.dmg * 0.6, st.chainJumps);
  }

  private explode(x: number, y: number, radius: number, dmg: number, exclude: Enemy | null, color: number, big: boolean) {
    for (const e of this.enemies) {
      if (e.dead || e === exclude) continue;
      const rr = radius + e.r;
      if ((e.x - x) ** 2 + (e.y - y) ** 2 < rr * rr) this.damageEnemy(e, dmg, false, color);
    }
    this.ringFx(x, y, radius, color, big ? 350 : 220);
    this.burst(x, y, color, big ? 16 : 6, big ? 'burst' : 'spark');
    if (big) sfx.boom();
  }

  private chain(x: number, y: number, first: Enemy, dmg: number, jumps: number) {
    const hit = [first];
    let cx = x, cy = y;
    for (let j = 0; j < jumps; j++) {
      let best: Enemy | null = null, bd = 180 * 180;
      for (const e of this.enemies) {
        if (e.dead || hit.includes(e)) continue;
        const d = (e.x - cx) ** 2 + (e.y - cy) ** 2;
        if (d < bd) { bd = d; best = e; }
      }
      if (!best) break;
      this.addBolt(cx, cy, best.x, best.y);
      hit.push(best);
      cx = best.x; cy = best.y;
      this.damageEnemy(best, dmg, false, 0xaee8ff);
    }
    if (hit.length > 1) sfx.zap();
  }

  private addBolt(x1: number, y1: number, x2: number, y2: number) {
    const pts = [x1, y1];
    const segs = 6;
    const nx = -(y2 - y1), ny = x2 - x1;
    const len = Math.hypot(nx, ny) || 1;
    for (let i = 1; i < segs; i++) {
      const t = i / segs, off = (Math.random() - 0.5) * 26;
      pts.push(x1 + (x2 - x1) * t + (nx / len) * off, y1 + (y2 - y1) * t + (ny / len) * off);
    }
    pts.push(x2, y2);
    this.bolts.push({ pts, life: 0.16 });
  }

  private launchMissile(i: number, n: number) {
    const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.6 + (Math.random() - 0.5) * 0.3;
    const s = this.img('missile', 15).setTint(COLOR.orange).setScale(0.5).setBlendMode(Phaser.BlendModes.ADD);
    const m: Missile = { s, x: CORE_X, y: CORE_Y, vx: Math.cos(a) * 320, vy: Math.sin(a) * 320, target: null, life: 3.5, trail: 0, dead: false };
    m.target = this.pickMissileTarget(i);
    this.missiles.push(m);
  }

  private pickMissileTarget(i: number): Enemy | null {
    // 가장 체력이 많은 적 위주로 노린다
    const alive = this.enemies.filter(e => !e.dead);
    if (!alive.length) return null;
    alive.sort((a, b) => b.hp - a.hp);
    return alive[Math.min(i, alive.length - 1)];
  }

  private updateMissiles(dt: number) {
    const st = this.stats;
    for (const m of this.missiles) {
      if (m.dead) continue;
      m.life -= dt;
      if (!m.target || m.target.dead) m.target = this.findTargets(1, 2000)[0] ?? null;
      if (m.target) {
        const dx = m.target.x - m.x, dy = m.target.y - m.y;
        const d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, 5 * dt);
        m.vx += ((dx / d) * 560 - m.vx) * k;
        m.vy += ((dy / d) * 560 - m.vy) * k;
        if (d < m.target.r + 10) {
          this.explode(m.x, m.y, 85, st.missileDamage, null, COLOR.orange, true);
          m.dead = true; this.free(m.s); continue;
        }
      }
      m.x += m.vx * dt; m.y += m.vy * dt;
      m.s.setPosition(m.x, m.y).setRotation(Math.atan2(m.vy, m.vx));
      m.trail -= dt;
      if (m.trail <= 0) { m.trail = 0.03; this.burst(m.x, m.y, COLOR.orange, 1, 'trail'); }
      if (m.life <= 0) { this.explode(m.x, m.y, 85, st.missileDamage, null, COLOR.orange, true); m.dead = true; this.free(m.s); }
    }
  }

  private updateBlades(dt: number) {
    const n = this.blades.length;
    if (!n) return;
    this.bladeAngle += 2.8 * dt;
    const dmg = this.stats.bladeDamage;
    for (let i = 0; i < n; i++) {
      const a = this.bladeAngle + (i / n) * Math.PI * 2;
      const x = CORE_X + Math.cos(a) * BLADE_R, y = CORE_Y + Math.sin(a) * BLADE_R;
      this.blades[i].setPosition(x, y).setRotation(a);
      for (const e of this.enemies) {
        if (e.dead || e.bladeCd > 0) continue;
        const rr = e.r + 16;
        if ((e.x - x) ** 2 + (e.y - y) ** 2 < rr * rr) {
          e.bladeCd = 0.35;
          this.burst(x, y, COLOR.purple, 3, 'spark');
          this.damageEnemy(e, dmg, false, COLOR.purple);
        }
      }
      for (const b of this.ebullets) {
        if (!b.dead && (b.x - x) ** 2 + (b.y - y) ** 2 < 24 * 24) { b.dead = true; this.free(b.s); }
      }
    }
  }

  private nova() {
    const st = this.stats;
    const r = st.novaRadius;
    sfx.nova();
    this.ringFx(CORE_X, CORE_Y, r, COLOR.cyan, 380, 0.2);
    this.cameras.main.shake(150, 0.004);
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = e.x - CORE_X, dy = e.y - CORE_Y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < r + e.r) {
        this.damageEnemy(e, st.novaDamage, false, COLOR.cyan);
        const push = e.boss ? 60 : 420;
        e.kx = (dx / d) * push; e.ky = (dy / d) * push;
      }
    }
    for (const b of this.ebullets) {
      if (!b.dead && (b.x - CORE_X) ** 2 + (b.y - CORE_Y) ** 2 < r * r) { b.dead = true; this.free(b.s); }
    }
  }

  // ───────────────────────── 기지 체력 ─────────────────────────

  private hurt(amount: number) {
    if (this.state === 'over') return;
    const dmg = amount * dmgMul(this.wave) * (1 - Math.min(0.75, this.stats.dmgReduce)) * (this.mod?.dmgTaken ?? 1);
    this.hp -= dmg;
    this.hurtFlash = 0.18;
    this.num(CORE_X, CORE_Y - CORE_R - 10, `-${Math.round(dmg)}`, COLOR.red, 28);
    this.cameras.main.shake(140, 0.005 + Math.min(0.01, dmg / 400));
    sfx.hurt();
    vibrate(25);
    if (this.hp <= 0) { this.hp = 0; this.gameOver(); }
  }

  private heal(n: number) {
    this.hp = Math.min(this.stats.maxHp, this.hp + n);
  }

  // ───────────────────────── 이펙트 ─────────────────────────

  private img(key: string, depth: number): Img {
    const arr = this.pool.get(key);
    const im = arr?.pop() ?? this.add.image(0, 0, key);
    return im.setVisible(true).setActive(true).setDepth(depth).setAlpha(1).setRotation(0).setBlendMode(Phaser.BlendModes.NORMAL);
  }

  private free(im: Img) {
    im.setVisible(false).setActive(false);
    let arr = this.pool.get(im.texture.key);
    if (!arr) this.pool.set(im.texture.key, arr = []);
    arr.push(im);
  }

  private burst(x: number, y: number, color: number, n: number, kind: 'spark' | 'burst' | 'big' | 'drip' | 'trail') {
    const key = `${kind}:${color}`;
    let em = this.emitters.get(key);
    if (!em) {
      const cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig = {
        spark: { speed: { min: 60, max: 220 }, lifespan: { min: 120, max: 260 }, scale: { start: 0.35, end: 0 } },
        burst: { speed: { min: 60, max: 300 }, lifespan: { min: 250, max: 550 }, scale: { start: 0.6, end: 0 } },
        big: { speed: { min: 100, max: 520 }, lifespan: { min: 400, max: 1000 }, scale: { start: 1, end: 0 } },
        drip: { speed: { min: 10, max: 40 }, lifespan: 400, scale: { start: 0.35, end: 0 }, gravityY: 60 },
        trail: { speed: { min: 0, max: 20 }, lifespan: 260, scale: { start: 0.4, end: 0 } },
      }[kind];
      em = this.add.particles(0, 0, 'dot', { ...cfg, alpha: { start: 1, end: 0 }, tint: color, blendMode: 'ADD', emitting: false }).setDepth(25);
      this.emitters.set(key, em);
    }
    em.explode(n, x, y);
  }

  private ringFx(x: number, y: number, radius: number, color: number, ms: number, from = 0.3) {
    const r = this.img('ring', 24).setTint(color).setPosition(x, y).setBlendMode(Phaser.BlendModes.ADD).setScale((radius / RING_R) * from).setAlpha(0.9);
    this.tweens.add({ targets: r, scale: radius / RING_R, alpha: 0, duration: ms, ease: 'Cubic.Out', onComplete: () => this.free(r) });
  }

  private num(x: number, y: number, str: string, color: number, size: number) {
    if (this.bot) return;
    const n = this.nums.find(n => !n.busy);
    if (!n) return;
    n.busy = true;
    n.t.setText(str).setColor(hex(color)).setFontSize(size).setPosition(x + (Math.random() - 0.5) * 16, y).setAlpha(1).setVisible(true).setScale(1.3);
    this.tweens.add({ targets: n.t, scale: 1, duration: 120 });
    this.tweens.add({
      targets: n.t, y: y - 40, alpha: 0, delay: 200, duration: 450,
      onComplete: () => { n.t.setVisible(false); n.busy = false; },
    });
  }

  private renderFrame(dt: number) {
    const st = this.stats;
    // 기지
    this.core.rotation += dt * 0.4;
    this.barrel.setScale(Phaser.Math.Linear(this.barrel.scale, CORE_R / CORE_TEX_R, Math.min(1, dt * 12)));
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    const tint = this.hurtFlash > 0 ? COLOR.red : COLOR.cyan;
    this.core.setTint(tint);
    this.coreGlow.setTint(tint).setAlpha(0.3 + Math.sin(this.time.now / 400) * 0.06);
    if (st.lv.frost) this.frostRing.setAlpha(0.3 + Math.sin(this.time.now / 300) * 0.08);

    // 번개
    this.fxG.clear();
    for (const b of this.bolts) b.life -= dt;
    this.bolts = this.bolts.filter(b => b.life > 0);
    for (const b of this.bolts) {
      const a = b.life / 0.16;
      this.fxG.lineStyle(8, 0x7fdbff, 0.25 * a);
      this.fxG.strokePoints(this.toPoints(b.pts));
      this.fxG.lineStyle(3, 0xeaffff, a);
      this.fxG.strokePoints(this.toPoints(b.pts));
    }

    // 적 체력바
    this.barG.clear();
    let boss: Enemy | null = null;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.boss) { boss = e; continue; }
      if (e.hp >= e.maxHp) continue;
      const w = e.r * 2, x = e.x - e.r, y = e.y - e.r - 10;
      this.barG.fillStyle(0x000000, 0.6).fillRect(x, y, w, 5);
      this.barG.fillStyle(e.poisonT > 0 ? COLOR.green : e.color, 1).fillRect(x, y, w * Math.max(0, e.hp / e.maxHp), 5);
    }
    if (boss) {
      this.barG.fillStyle(0x000000, 0.7).fillRoundedRect(60, 128, W - 120, 16, 8);
      this.barG.fillStyle(boss.color, 1).fillRoundedRect(60, 128, (W - 120) * Math.max(0.02, boss.hp / boss.maxHp), 16, 8);
      this.barG.lineStyle(2, boss.color, 0.8).strokeRoundedRect(60, 128, W - 120, 16, 8);
      this.hudBoss.setText(ENEMIES[boss.kind].boss!).setColor(hex(boss.color)).setVisible(true);
    } else this.hudBoss.setVisible(false);

    this.updateHud(dt);
  }

  private toPoints(pts: number[]) {
    const out: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < pts.length; i += 2) out.push(new Phaser.Math.Vector2(pts[i], pts[i + 1]));
    return out;
  }

  // ───────────────────────── HUD ─────────────────────────

  private buildHud() {
    const top = this.add.graphics().setDepth(49);
    top.fillStyle(COLOR.bg, 0.85).fillRect(0, 0, W, 110);
    top.lineStyle(2, COLOR.cyan, 0.25).lineBetween(0, 110, W, 110);
    top.fillStyle(COLOR.bg, 0.85).fillRect(0, H - 120, W, 120);
    top.lineStyle(2, COLOR.cyan, 0.25).lineBetween(0, H - 120, W, H - 120);

    this.hudWave = txt(this, 28, 40, 'WAVE 1', 32, { color: COLOR.cyan, align: 'left', glow: true }).setDepth(50);
    this.hudSub = txt(this, 28, 80, '', 20, { color: COLOR.gray, align: 'left', bold: false }).setDepth(50);
    this.hudG = this.add.graphics().setDepth(50);
    this.hudHp = txt(this, 370, 44, '', 20).setDepth(51);
    this.hudBoss = txt(this, W / 2, 162, '', 20, { glow: true }).setDepth(50).setVisible(false);
    this.hudStats = txt(this, W / 2, H - 35, '', 20, { color: COLOR.gray, bold: false }).setDepth(50);
    this.abilityRow = this.add.container(0, H - 80).setDepth(50);

    this.speedBtn = button(this, 588, 55, 76, 62, 'x1', COLOR.yellow, () => {
      this.speedMode = this.speedMode === 1 ? 2 : 1;
      this.speedBtn.setLabel(`x${this.speedMode}`);
    }, 26).setDepth(52) as Button;
    button(this, 674, 55, 76, 62, 'II', COLOR.white, () => this.pause(), 26).setDepth(52);
  }

  private updateHud(dt: number) {
    const st = this.stats;
    this.shownHp = Phaser.Math.Linear(this.shownHp, this.hp, Math.min(1, dt * 10));
    this.hudWave.setText(`WAVE ${Math.max(1, this.wave)}`);
    const left = this.queue.length + this.enemies.length;
    this.hudSub.setText((this.daily ? `${L('일일', 'Daily')} · ` : '') + (this.state === 'play' ? L(`남은 적 ${left}`, `Enemies ${left}`) : ''));

    const g = this.hudG;
    g.clear();
    const bx = 240, bw = 260, by = 32, bh = 26;
    const ratio = Math.max(0, this.shownHp / st.maxHp);
    const col = ratio > 0.5 ? COLOR.green : ratio > 0.25 ? COLOR.yellow : COLOR.red;
    g.fillStyle(0x000000, 0.6).fillRoundedRect(bx, by, bw, bh, 8);
    g.fillStyle(col, 0.9).fillRoundedRect(bx, by, Math.max(8, bw * ratio), bh, 8);
    g.lineStyle(2, col, 1).strokeRoundedRect(bx, by, bw, bh, 8);
    this.hudHp.setText(`${Math.ceil(this.hp)} / ${Math.round(st.maxHp)}`);
    // 웨이브 진행도
    const prog = this.waveTotal ? this.spawned / this.waveTotal : 0;
    g.fillStyle(0xffffff, 0.1).fillRect(bx, 72, bw, 6);
    g.fillStyle(COLOR.cyan, 0.8).fillRect(bx, 72, bw * prog, 6);
  }

  private onStatsChanged() {
    const st = this.stats;
    // 사거리 표시
    this.rangeG.clear();
    this.rangeG.lineStyle(2, COLOR.cyan, 0.12).strokeCircle(CORE_X, CORE_Y, st.range);
    // 냉기장
    if (st.lv.frost) {
      this.frostRing.setScale(st.frostRadius / RING_R).setAlpha(0.35);
      this.frostFill.setScale((st.frostRadius * 2) / 256 * 1.1).setAlpha(0.12);
    }
    // 칼날 개수 맞추기
    const want = st.lv.blades ? st.bladeCount : 0;
    while (this.blades.length < want) this.blades.push(this.add.image(CORE_X, CORE_Y, 'blade').setTint(COLOR.purple).setScale(0.55).setDepth(12).setBlendMode(Phaser.BlendModes.ADD));
    this.hp = Math.min(this.hp, st.maxHp);

    this.hudStats.setText(L(`공격 ${Math.round(st.damage)}  ·  속도 ${st.fireRate.toFixed(1)}/s  ·  사거리 ${Math.round(st.range)}  ·  치명 ${Math.round(st.critChance * 100)}%`, `DMG ${Math.round(st.damage)}  ·  SPD ${st.fireRate.toFixed(1)}/s  ·  RNG ${Math.round(st.range)}  ·  CRIT ${Math.round(st.critChance * 100)}%`));

    // 획득한 능력 아이콘
    this.abilityRow.removeAll(true);
    const owned = ABILITIES.filter(a => st.lv[a] > 0);
    const gap = 84;
    owned.forEach((a, i) => {
      const card = CARDS.find(c => c.ability === a)!;
      const x = W / 2 + (i - (owned.length - 1) / 2) * gap;
      const color = RARITY[card.rarity].color;
      const icon = this.add.image(x - 14, 0, card.icon).setTint(color).setScale(iconScale(card.icon, 30));
      const lv = txt(this, x + 16, 0, `${st.lv[a]}`, 20, { color });
      this.abilityRow.add([icon, lv]);
    });
    if (st.multishot > 1) {
      const t = txt(this, 30, 0, `x${st.multishot}`, 20, { color: COLOR.blue, align: 'left' });
      this.abilityRow.add(t);
    }
  }

  // ───────────────────────── 카드 선택 ─────────────────────────

  private cardCtx(): CardCtx {
    const self = this;
    return {
      stats: this.stats,
      get hp() { return self.hp; },
      heal: n => this.heal(n),
      onStatsChanged: () => this.onStatsChanged(),
    };
  }

  private showCards(minRarity: Rarity | undefined, title: string, subtitle: string) {
    this.state = 'cards';
    const cards = drawCards(this.cardCtx(), Math.max(1, this.wave), 3, minRarity, this.rng, this.mod?.rarityBoost ?? 1);
    if (!this.bot && !save.tips.cards && this.wave >= 1) {
      save.tips.cards = true; persist();
      subtitle = L('같은 능력 카드를 또 고르면 레벨이 올라가요!', 'Pick the same ability again to level it up!');
    }
    if (this.bot) {
      // 밸런스 측정용: smart 는 높은 등급 우선, 기본은 무작위
      const order: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
      const smart = new URLSearchParams(location.search).get('pick') === 'smart';
      const pick = smart ? [...cards].sort((x, y) => order.indexOf(y.rarity) - order.indexOf(x.rarity))[0] : cards[Math.floor(Math.random() * cards.length)];
      this.choose(pick);
      return;
    }

    const o = this.add.container(0, 0).setDepth(100);
    this.overlay = o;
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x03040a, 0.78).setInteractive();
    const t1 = txt(this, W / 2, 250 + OY, title, 46, { color: COLOR.cyan, glow: true });
    const t2 = txt(this, W / 2, 310 + OY, subtitle, 22, { color: COLOR.gray, bold: false });
    o.add([dim, t1, t2]);

    let accept = false;
    this.time.delayedCall(350, () => { accept = true; });

    cards.forEach((card, i) => {
      const y = 480 + OY + i * 215;
      const c = this.cardView(card, y, () => {
        if (!accept) return;
        accept = false;
        this.tweens.add({ targets: c, scale: 1.06, duration: 120, yoyo: true });
        o.each((ch: Phaser.GameObjects.GameObject) => {
          if (ch !== c && ch !== dim) this.tweens.add({ targets: ch, alpha: 0, duration: 200 });
        });
        this.time.delayedCall(260, () => this.choose(card));
      });
      o.add(c);
      c.setAlpha(0).setScale(0.85);
      this.tweens.add({ targets: c, alpha: 1, scale: 1, duration: 260, delay: 80 + i * 90, ease: 'Back.Out' });
    });

    if (this.rerollsLeft > 0) {
      const rb = button(this, W / 2, 1150 + OY, 320, 76, L(`새로고침 (${this.rerollsLeft})`, `Reroll (${this.rerollsLeft})`), COLOR.gray, () => {
        if (!accept) return;
        this.rerollsLeft--;
        this.closeOverlay();
        this.showCards(minRarity, title, subtitle);
      }, 26);
      o.add(rb);
    }
    sfx.pick();
  }

  private cardView(card: Card, y: number, onPick: () => void) {
    const st = this.stats;
    const col = RARITY[card.rarity].color;
    const w = 640, h = 190;
    const c = this.add.container(W / 2, y);
    if (card.rarity === 'epic' || card.rarity === 'legendary') {
      const glow = this.add.image(0, 0, 'glow').setTint(col).setBlendMode(Phaser.BlendModes.ADD).setScale(3.2, 1.2).setAlpha(0.18);
      c.add(glow);
      this.tweens.add({ targets: glow, alpha: 0.32, duration: 700, yoyo: true, repeat: -1 });
    }
    const g = this.add.graphics();
    panel(g, 0, 0, w, h, col, 0x0d1224, 0.97, 20, card.rarity === 'common' ? 2 : 3);
    const iconBg = this.add.image(-236, 0, 'glow').setTint(col).setAlpha(0.35).setScale(0.8).setBlendMode(Phaser.BlendModes.ADD);
    const icon = this.add.image(-236, 0, card.icon).setTint(col).setScale(iconScale(card.icon, 72));
    const name = txt(this, -150, -44, card.name, 34, { align: 'left', color: 0xffffff });
    const tag = txt(this, w / 2 - 24, -62, RARITY[card.rarity].name, 20, { align: 'right', color: col });
    const desc = txt(this, -150, 30, card.desc(st), 23, { align: 'left', color: 0xc7cde0, bold: false, lineSpacing: 6 });
    c.add([g, iconBg, icon, name, tag, desc]);
    if (card.ability) {
      const cur = st.lv[card.ability];
      const lvText = cur ? `Lv.${cur} → ${cur + 1}` : 'NEW';
      c.add(txt(this, w / 2 - 24, 62, lvText, 20, { align: 'right', color: cur ? COLOR.gray : COLOR.green }));
    }
    const zone = this.add.zone(0, 0, w, h).setInteractive({ useHandCursor: true });
    zone.on('pointerup', onPick);
    c.add(zone);
    return c;
  }

  private choose(card: Card) {
    card.apply(this.cardCtx());
    this.onStatsChanged();
    this.closeOverlay();
    if (!this.bot) sfx.pick();
    this.startWave();
  }

  private closeOverlay() {
    this.overlay?.destroy();
    this.overlay = undefined;
  }

  // ───────────────────────── 일시정지 / 게임오버 ─────────────────────────

  private onHidden() {
    if (this.bot) return;
    if (this.state === 'play' || this.state === 'between') this.pause();
  }

  private pause() {
    if (this.state !== 'play' && this.state !== 'between') return;
    const prev = this.state;
    this.state = 'paused';
    const o = this.add.container(0, 0).setDepth(100);
    this.overlay = o;
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x03040a, 0.8).setInteractive();
    const g = this.add.graphics();
    panel(g, W / 2, 600 + OY, 560, 700, COLOR.cyan);
    const st = this.stats;
    const lines = [
      `${L('공격력', 'Damage')}  ${Math.round(st.damage)}`,
      `${L('공격 속도', 'Attack speed')}  ${st.fireRate.toFixed(2)}/s`,
      `${L('사거리', 'Range')}  ${Math.round(st.range)}`,
      `${L('발사체', 'Projectiles')}  ${st.multishot}   ${L('관통', 'Pierce')}  ${st.pierce}`,
      `${L('치명타', 'Crit')}  ${Math.round(st.critChance * 100)}% × ${st.critMult.toFixed(1)}`,
      `${L('재생', 'Regen')}  ${st.regen.toFixed(1)}/s   ${L('피해 감소', 'Armor')}  ${Math.round(Math.min(0.75, st.dmgReduce) * 100)}%`,
    ].join('\n');
    o.add([
      dim, g,
      txt(this, W / 2, 320 + OY, L('일시정지', 'PAUSED'), 48, { color: COLOR.cyan, glow: true }),
      txt(this, W / 2, 500 + OY, lines, 24, { color: 0xc7cde0, bold: false, lineSpacing: 12 }),
      button(this, W / 2, 710 + OY, 400, 86, L('계속하기', 'Resume'), COLOR.cyan, () => { this.closeOverlay(); this.state = prev; }),
      button(this, W / 2, 810 + OY, 400, 72, L('설정', 'Settings'), COLOR.white, () => openSettings(this), 26),
      button(this, W / 2, 900 + OY, 400, 72, L('포기하기', 'Give up'), COLOR.pink, () => { this.closeOverlay(); this.state = prev; this.hp = 0; this.gameOver(); }, 26),
    ]);
  }

  // 처음 한 번만 보여주는 도움말
  private tip(key: string, text: string) {
    if (this.bot || save.tips[key] || this.state === 'over') return;
    save.tips[key] = true;
    persist();
    const y = H - 240;
    const c = this.add.container(W / 2, y).setDepth(70).setAlpha(0);
    const g = this.add.graphics();
    panel(g, 0, 0, 620, 110, COLOR.yellow, 0x0d1224, 0.92, 16, 2);
    c.add([g, txt(this, 0, 0, text, 23, { color: 0xffffff, bold: false, lineSpacing: 8 })]);
    this.tweens.add({ targets: c, alpha: 1, y: y - 10, duration: 300 });
    this.tweens.add({ targets: c, alpha: 0, delay: 5200, duration: 400, onComplete: () => c.destroy() });
  }

  private gameOver() {
    if (this.state === 'over') return;
    this.state = 'over';
    this.closeOverlay();
    if (!this.bot) music.play(0);
    sfx.lose();
    vibrate(250);
    this.burst(CORE_X, CORE_Y, COLOR.cyan, 80, 'big');
    this.burst(CORE_X, CORE_Y, 0xffffff, 40, 'big');
    this.ringFx(CORE_X, CORE_Y, 420, COLOR.cyan, 900);
    this.cameras.main.shake(600, 0.02);
    this.cameras.main.flash(300, 255, 255, 255);
    this.core.setVisible(false); this.barrel.setVisible(false); this.coreGlow.setVisible(false);
    for (const b of this.blades) b.setVisible(false);

    let gems = 0;
    for (let i = 1; i <= this.wavesCleared; i++) gems += 2 + i * 0.4;
    // 일일 도전은 그날 첫 판만 보석 2배 (반복 파밍 방지)
    const firstDaily = this.daily && !(save.daily.day === this.dayKey && save.daily.runs > 0);
    gems = Math.round((gems + this.bossKills * 5) * this.stats.gemMul * (this.daily ? (this.mod?.gem ?? 1) * (firstDaily ? 2 : 1) : 1));
    const reached = this.wave;

    if (this.bot) {
      const w = window as any;
      (w.__runs ??= []).push({ wave: reached, kills: this.kills, gems, stats: { dmg: Math.round(this.stats.damage), rate: +this.stats.fireRate.toFixed(2), multi: this.stats.multishot, hp: this.stats.maxHp, lv: { ...this.stats.lv } } });
      return;
    }

    let newBest = false;
    if (this.daily) {
      if (save.daily.day !== this.dayKey) save.daily = { day: this.dayKey, best: 0, runs: 0 };
      save.daily.runs++;
      newBest = reached > save.daily.best;
      if (newBest) save.daily.best = reached;
    } else {
      newBest = reached > save.best;
      if (newBest) save.best = reached;
    }
    save.gems += gems;
    save.runs++;
    persist();

    this.time.delayedCall(1300, () => this.showResults(reached, gems, newBest));
  }

  private showResults(reached: number, gems: number, newBest: boolean) {
    const o = this.add.container(0, 0).setDepth(100);
    this.overlay = o;
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x03040a, 0.82).setInteractive();
    const g = this.add.graphics();
    panel(g, W / 2, 610 + OY, 580, 760, COLOR.pink);
    const gem = this.add.image(W / 2 - 90, 610 + OY, 'e_diamond').setTint(COLOR.cyan).setScale(0.45);
    const items: Phaser.GameObjects.GameObject[] = [
      dim, g,
      txt(this, W / 2, 310 + OY, this.daily ? L(`일일 도전 · ${this.mod!.name}`, `Daily · ${this.mod!.name}`) : L('기지 파괴', 'BASE DESTROYED'), this.daily ? 40 : 56, { color: this.daily ? COLOR.yellow : COLOR.pink, glow: true }),
      txt(this, W / 2, 420 + OY, L(`웨이브 ${reached}`, `Wave ${reached}`), 64, { color: 0xffffff }),
      txt(this, W / 2, 490 + OY, L(`처치 ${this.kills}`, `Kills ${this.kills}`), 26, { color: COLOR.gray, bold: false }),
      gem,
      txt(this, W / 2 - 60, 610 + OY, `+${gems}`, 44, { color: COLOR.cyan, align: 'left', glow: true }),
      button(this, W / 2, 760 + OY, 440, 96, L('다시 도전', 'Retry'), COLOR.cyan, () => this.scene.restart({ daily: this.daily }), 34),
      button(this, W / 2 - 115, 880 + OY, 210, 80, L('연구소', 'Lab'), COLOR.purple, () => this.scene.start('Lab'), 26),
      button(this, W / 2 + 115, 880 + OY, 210, 80, L('메인', 'Menu'), COLOR.white, () => this.scene.start('Menu'), 26),
    ];
    if (!save.tips.lab) {
      save.tips.lab = true; persist();
      items.push(txt(this, W / 2, 680 + OY, L('보석으로 연구소에서 영구 강화할 수 있어요!', 'Spend gems in the Lab for permanent upgrades!'), 21, { color: COLOR.purple, bold: false }));
    }
    if (newBest) {
      const nb = txt(this, W / 2, 545 + OY, this.daily ? L('오늘의 최고 기록!', "Today's best!") : L('최고 기록 갱신!', 'New record!'), 26, { color: COLOR.yellow, glow: true });
      this.tweens.add({ targets: nb, scale: 1.1, duration: 500, yoyo: true, repeat: -1 });
      items.push(nb);
    }
    o.add(items);
    o.setAlpha(0);
    this.tweens.add({ targets: o, alpha: 1, duration: 300 });
  }
}
