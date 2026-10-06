import Phaser from 'phaser';
import { W, H, CORE_X, CORE_Y, CORE_R, COLOR, px, setupCamera, hex } from '../config';
import { SHAPE_R, RING_R, CORE_TEX_R } from './BootScene';
import { ENEMIES, EnemyKind, SpawnEntry, buildWave, hpMul, speedMul, dmgMul, isBossWave, bossForWave } from '../data/enemies';
import { Card, CardCtx, Rarity, RARITY, drawCards, CARDS } from '../data/cards';
import { LAB, buildStats } from '../data/lab';
import { ABILITIES, Ability, Stats } from '../game/stats';
import { FX } from '../game/fx';
import { sfx, vibrate, haptics } from '../audio';
import { music, TRACKS } from '../music';
import { L } from '../i18n';
import { Modifier, MODIFIERS, todayKey, todayModifier, daySeed, seededRng } from '../data/daily';
import { save, persist } from '../save';
import { txt, label, num, panel, gauge, button, chip, toggle, segmented, arrowIcon, checkIcon, refreshIcon, CUT_MAIN, CUT_PANEL, RARITY_GLYPH, brackets } from '../ui/widgets';
import { drawBackground } from '../ui/bg';
import { musicSlider } from '../ui/settings';

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
  age: number;
}

interface Bullet { s: Img; x: number; y: number; vx: number; vy: number; dmg: number; crit: boolean; pierce: number; hit: Enemy[]; life: number; dead: boolean; }
interface Missile { s: Img; x: number; y: number; vx: number; vy: number; target: Enemy | null; life: number; trail: number; dead: boolean; }
interface EBullet { s: Img; x: number; y: number; vx: number; vy: number; dmg: number; dead: boolean; color: number; }
interface Num { t: Phaser.GameObjects.Text; busy: boolean; }
interface Feed { text: string; color: number; t: number; }

const BLADE_R = 108;
const STEP = 1 / 60;
const COMBO_WINDOW = 1.4;

// 아이콘 텍스처별 실제 그림 지름(px) → 원하는 크기로 맞추기 위한 배율
const ICON_D: Record<string, number> = { ring: 240, core: 140, blade: 84, missile: 48 };
const iconScale = (key: string, size: number) => size / (ICON_D[key] ?? 92);

const KIND_NAME: Record<EnemyKind, string> = {
  grunt: L('기본형', 'Grunt'), runner: L('돌격형', 'Runner'), brute: L('중장형', 'Brute'), swarm: L('군체', 'Swarm'),
  shooter: L('사수', 'Shooter'), splitter: L('분열체', 'Splitter'), mini: L('파편', 'Shard'), healer: L('치유기', 'Healer'), blinker: L('점멸체', 'Blinker'),
  boss: L('헥스 타이탄', 'Hex Titan'), queen: L('하이브 퀸', 'Hive Queen'), artillery: L('아틸러리', 'Artillery'),
};
const KIND_GLYPH: Record<string, string> = { e_circle: '●', e_tri: '▲', e_square: '■', e_diamond: '◆', e_penta: '⬟', e_hex: '⬢', e_octa: '⯃', e_plus: '✚', e_star: '✦' };

// HUD 배치 (디자인 390pt 기준을 px() 로 변환)
const MX = px(12);
const TOP = px(10);
const BAR_H = px(64);
const TL_Y = TOP + BAR_H + px(8); // 웨이브 타임라인
const PANEL_Y = TL_Y + px(24);    // 상황 HUD 시작

function compact<T extends { dead: boolean }>(arr: T[]) {
  let j = 0;
  for (let i = 0; i < arr.length; i++) if (!arr[i].dead) arr[j++] = arr[i];
  arr.length = j;
}

// 표시상 x1 의 실제 속도. x2 는 이것의 두 배
const GAME_SPEED = 1.5;

export class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  private state: State = 'play';
  private stats!: Stats;
  private fx!: FX;
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
  private blades: Img[] = [];

  private queue: SpawnEntry[] = [];
  private nextEntries: SpawnEntry[] | null = null;
  private waveTime = 0;
  private waveTotal = 0;
  private fireCd = 0;
  private missileCd = 0;
  private novaCd = 0;
  private bladeAngle = 0;
  private hurtFlash = 0;

  // 전투 기록 (HUD · 결과 화면)
  private runTime = 0;
  private maxHit = 0;
  private dmgByWave: number[] = [];
  private feed: Feed[] = [];
  private combo = 0;
  private comboT = 0;
  private comboBest = 0;
  private dmgLog: { t: number; v: number }[] = [];
  private gemsLive = 0;
  private lockTarget: Enemy | null = null;
  private abilityPulse: Partial<Record<Ability, number>> = {};
  private bossPhase2 = false;

  private pool = new Map<string, Img[]>();
  private nums: Num[] = [];

  private core!: Img;
  private barrel!: Img;
  private coreGlow!: Img;
  private frostRing!: Img;
  private frostFill!: Img;
  private rangeG!: Phaser.GameObjects.Graphics;
  private trailG!: Phaser.GameObjects.Graphics;
  private barG!: Phaser.GameObjects.Graphics;
  private vigDanger!: Img;

  // HUD
  private hudG!: Phaser.GameObjects.Graphics;
  private hudDyn!: Phaser.GameObjects.Graphics;
  private hudWave!: Phaser.GameObjects.Text;
  private hudHp!: Phaser.GameObjects.Text;
  private hudLeft!: Phaser.GameObjects.Text;
  private hudTimeline!: Phaser.GameObjects.Text;
  private hudBossNext!: Phaser.GameObjects.Text;
  private hudKills!: Phaser.GameObjects.Text;
  private hudGems!: Phaser.GameObjects.Text;
  private hudFeed: Phaser.GameObjects.Text[] = [];
  private hudCombo!: Phaser.GameObjects.Text;
  private hudComboLbl!: Phaser.GameObjects.Text;
  private hudLock!: Phaser.GameObjects.Text;
  private hudStats!: Phaser.GameObjects.Text;
  private hudDps!: Phaser.GameObjects.Text;
  private bossPanel!: Phaser.GameObjects.Container;
  private bossName!: Phaser.GameObjects.Text;
  private bossPct!: Phaser.GameObjects.Text;
  private bossNote!: Phaser.GameObjects.Text;
  private bossCount!: Phaser.GameObjects.Text;
  private slots: { c: Phaser.GameObjects.Container; a: Ability; icon: Img; cdT: Phaser.GameObjects.Text; g: Phaser.GameObjects.Graphics; }[] = [];
  private slotRow!: Phaser.GameObjects.Container;
  private speedSeg!: Phaser.GameObjects.Container & { setActive(i: number): void };
  private overlay?: Phaser.GameObjects.Container;
  /** 마지막으로 제시된 카드 (테스트 하네스용) */
  lastCards: Card[] = [];
  private hudObjs: Phaser.GameObjects.GameObject[] = [];
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
    drawBackground(this, { brackets: true });

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
    this.enemies = []; this.bullets = []; this.missiles = []; this.ebullets = []; this.blades = [];
    this.queue = []; this.nextEntries = null;
    this.fireCd = this.missileCd = this.bladeAngle = this.hurtFlash = 0;
    this.novaCd = 2;
    this.runTime = 0; this.maxHit = 0; this.dmgByWave = []; this.feed = []; this.combo = 0; this.comboT = 0; this.comboBest = 0; this.dmgLog = []; this.gemsLive = 0;
    this.lockTarget = null; this.abilityPulse = {}; this.bossPhase2 = false;
    this.pool = new Map();
    this.nums = [];
    this.overlay = undefined;
    this.fx = new FX(this);

    // 기지
    this.coreGlow = this.add.image(CORE_X, CORE_Y, 'glow').setTint(COLOR.cyan).setAlpha(0.3).setScale(1.3).setBlendMode(Phaser.BlendModes.ADD).setDepth(4);
    this.frostFill = this.add.image(CORE_X, CORE_Y, 'glow').setTint(COLOR.frost).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(5);
    this.frostRing = this.add.image(CORE_X, CORE_Y, 'ringthin').setTint(COLOR.frost).setAlpha(0).setDepth(5);
    this.rangeG = this.add.graphics().setDepth(6);
    this.barG = this.add.graphics().setDepth(21);
    this.core = this.add.image(CORE_X, CORE_Y, 'core').setTint(COLOR.cyan).setScale(CORE_R / CORE_TEX_R).setDepth(22);
    this.barrel = this.add.image(CORE_X, CORE_Y, 'barrel').setTint(COLOR.text).setScale(CORE_R / CORE_TEX_R).setDepth(23);
    this.trailG = this.add.graphics().setDepth(30).setBlendMode(Phaser.BlendModes.ADD);
    this.vigDanger = this.add.image(W / 2, H / 2, 'vignette').setTint(COLOR.red).setAlpha(0).setDepth(61);
    this.vigDanger.setDisplaySize(W * 1.02, H * 1.02);

    for (let i = 0; i < 48; i++) {
      const t = txt(this, 0, 0, '', 26, { font: 'num', weight: 700 }).setDepth(50).setVisible(false);
      t.setShadow(0, 1, hex(COLOR.bg), 2, true, true);
      this.nums.push({ t, busy: false });
    }

    this.buildHud();
    this.onStatsChanged();

    this.game.events.on(Phaser.Core.Events.HIDDEN, this.onHidden, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.HIDDEN, this.onHidden, this);
      this.tweens.killAll();
      this.fx.destroy();
    });

    this.cameras.main.fadeIn(300, 4, 7, 11);
    if (this.mod?.startCard) {
      this.time.delayedCall(400, () => this.showCards('epic', this.mod!.name, L('오늘의 도전: 영웅 모듈 하나를 고르세요', "Today's rule: pick an epic module")));
    } else if ((lab.start ?? 0) > 0) {
      this.time.delayedCall(400, () => this.showCards('rare', L('선행 연구', 'Head Start'), L('출격 전에 모듈 하나를 장착하세요', 'Equip one module before launch')));
    } else {
      this.time.delayedCall(400, () => this.startWave());
    }
    if (this.daily) this.banner(L(`일일 작전 · ${this.mod!.name}`, `Daily op · ${this.mod!.name}`), COLOR.amber, 0.6, 1600, 120);
    this.time.delayedCall(1800, () => this.tip('intro', L('기지는 가까운 적을 자동으로 공격합니다.\n웨이브를 버틸 때마다 강화 모듈을 골라 강해지세요.', 'Your base shoots the nearest enemy automatically.\nSurvive each wave and pick a module to grow stronger.')));
  }

  // ───────────────────────── 웨이브 흐름 ─────────────────────────

  private nextWaveEntries(w: number) {
    return buildWave(w, this.rng, this.mod?.count ?? 1).entries;
  }

  private startWave() {
    this.wave++;
    const entries = this.nextEntries ?? this.nextWaveEntries(this.wave);
    this.nextEntries = null;
    this.queue = entries;
    this.waveTime = 0;
    this.waveTotal = entries.length;
    this.dmgByWave[this.wave] = 0;
    this.bossPhase2 = false;
    this.state = 'play';
    const boss = isBossWave(this.wave);
    this.banner(boss ? `BOSS WAVE ${this.wave}` : `WAVE ${this.wave}`, boss ? COLOR.red : COLOR.cyan);
    if (boss) { const b = ENEMIES[bossForWave(this.wave)]; this.banner(b.boss!, b.color, 0.5, 900, 70); }
    if (boss) { sfx.boss(); this.fx.flash(250, 0x3a0a10); } else sfx.waveStart();
    if (!this.bot) music.play(boss ? 2 : 1);
    if (this.wave === 3) this.time.delayedCall(1500, () => this.tip('speed', L('느긋하다면 오른쪽 아래 x2 로 게임 속도를 올릴 수 있습니다.', 'Too slow? Tap x2 at the bottom right to speed up.')));
    if (boss) this.time.delayedCall(2200, () => this.tip('boss', L('보스는 기지에 붙어서 계속 공격합니다.\n처치하면 영웅 모듈 확정 + 선체 회복.', 'Bosses keep attacking once they reach you.\nDefeat one for a guaranteed epic module + hull repair.')));
  }

  private waveCleared() {
    this.state = 'between';
    this.wavesCleared = this.wave;
    sfx.waveClear();
    this.heal(this.stats.maxHp * 0.25);
    this.banner('CLEAR', COLOR.green, 0.8, 300);
    this.fx.ring(CORE_X, CORE_Y, CORE_R, this.stats.range, COLOR.green, 0.6, 2, 0.5);
    // 다음 웨이브 구성을 미리 만들어 둔다 (강화 선택 화면의 '다음 웨이브' 예고용)
    this.nextEntries = this.nextWaveEntries(this.wave + 1);
    const boss = isBossWave(this.wave);
    if (this.bot) { this.showCards(boss ? 'epic' : undefined, '', ''); return; }
    this.time.delayedCall(800, () => {
      if (this.state === 'between') this.showCards(boss ? 'epic' : undefined, L('강화 모듈 선택', 'Upgrade protocol'), boss ? L('보스 보상: 영웅 등급 이상 확정', 'Boss reward: epic or better guaranteed') : L('하나를 골라 장착하세요. 같은 능력은 레벨이 오릅니다.', 'Pick one to equip. Same ability levels up.'));
    });
  }

  private banner(str: string, color: number, scale = 1, hold = 900, dy = 0) {
    const y = CORE_Y - 300 + dy;
    const t = txt(this, W / 2, y, str, 60 * scale, { color, glow: 20, font: 'num', weight: 700, spacing: Math.round(6 * scale) }).setDepth(62).setScale(0.4).setAlpha(0);
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 260, ease: 'Back.Out' });
    this.tweens.add({ targets: t, alpha: 0, y: y - 40, delay: hold, duration: 400, onComplete: () => t.destroy() });
  }

  // ───────────────────────── 메인 루프 ─────────────────────────

  update(_time: number, delta: number) {
    const real = Math.min(delta / 1000, 0.05);
    if (this.state === 'play' || this.state === 'between') {
      const dt = real * (this.bot ? this.botSpeed : this.speedMode * GAME_SPEED);
      const steps = Math.max(1, Math.ceil(dt / STEP - 0.001));
      const h = dt / steps;
      for (let i = 0; i < steps && (this.state === 'play' || this.state === 'between'); i++) this.step(h);
    }
    this.renderFrame(real);
  }

  private step(dt: number) {
    const st = this.stats;
    this.runTime += dt;
    if (this.state === 'play') {
      this.waveTime += dt;
      while (this.queue.length && this.queue[0].t <= this.waveTime) this.spawnEnemy(this.queue.shift()!.kind);
    }

    if (st.regen > 0) this.hp = Math.min(st.maxHp, this.hp + st.regen * dt);
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }
    for (const k of Object.keys(this.abilityPulse) as Ability[]) this.abilityPulse[k] = Math.max(0, (this.abilityPulse[k] ?? 0) - dt);

    // 주포
    this.fireCd -= dt;
    if (this.fireCd <= 0) {
      const targets = this.findTargets(st.multishot, st.range);
      if (targets.length) {
        this.fire(targets);
        this.fireCd += 1 / st.fireRate;
      } else { this.fireCd = 0; this.lockTarget = null; }
    }

    // 미사일
    if (st.lv.missiles) {
      this.missileCd -= dt;
      if (this.missileCd <= 0 && this.enemies.length) {
        for (let i = 0; i < st.missileCount; i++) this.launchMissile(i, st.missileCount);
        this.missileCd = 2.5;
        this.abilityPulse.missiles = 0.4;
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
          this.abilityPulse.nova = 0.5;
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
    const fromEdge = x === undefined || y === undefined;
    if (fromEdge) {
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
    const s = this.img(d.tex, boss ? 19 : 20).setTint(d.color).setScale(d.r / SHAPE_R).setPosition(x!, y!);
    const e: Enemy = {
      s, kind, x: x!, y: y!, vx: 0, vy: 0, kx: 0, ky: 0,
      hp, maxHp: hp,
      speed: d.speed * speedMul(this.wave) * (0.9 + Math.random() * 0.2) * (this.mod?.enemySpeed ?? 1),
      r: d.r, dmg: d.dmg, color: d.color, boss, dead: false,
      flash: 0, flashing: false, poisonDps: 0, poisonT: 0, poisonFx: 0,
      bladeCd: 0, shootT: 1 + Math.random() * 1.5, attackT: 0,
      spin: d.spin * (Math.random() < 0.5 ? -1 : 1),
      age: 0,
    };
    if (kind === 'blinker') s.setAlpha(0.8);
    if (!fromEdge) { s.setAlpha(0); this.fx.materialize(e.x, e.y, e.r, e.color); }
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
      e.age += dt;
      if (e.age < 0.25 && e.s.alpha < 1) e.s.setAlpha(Math.min(e.kind === 'blinker' ? 0.8 : 1, e.age / 0.25));

      if (e.poisonT > 0) {
        e.poisonT -= dt;
        const v = e.poisonDps * dt;
        e.hp -= v; this.logDamage(v);
        e.poisonFx -= dt;
        if (e.poisonFx <= 0) { e.poisonFx = 0.25; this.fx.dots(e.x, e.y, COLOR.rare, 2, 30, 400, 0.35, 60); }
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
        else if (e.kind === 'queen') {
          // 50% 이하 페이즈 2: 소환 속도 2배
          const p2 = e.hp < e.maxHp * 0.5;
          if (p2 && !this.bossPhase2) { this.bossPhase2 = true; this.banner(L('페이즈 2', 'PHASE 2'), COLOR.red, 0.5, 700, 60); this.fx.flash(160, 0x3a0a10); }
          e.shootT = p2 ? 1.75 : 3.5; this.summon(e);
        }
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
          this.fx.kill(e.x, e.y, e.color, e.r);
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
    const s = this.img('bullet', 30).setTint(e.color).setScale(0.8).setPosition(e.x, e.y);
    this.ebullets.push({ s, x: e.x, y: e.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, dmg: e.dmg, dead: false, color: e.color });
    if (e.kind === 'artillery' && spread === 0) this.fx.line(e.x, e.y, CORE_X, CORE_Y, e.color, 0.25, 1);
  }

  private healPulse(e: Enemy) {
    const R = 150;
    let any = false;
    for (const o of this.enemies) {
      if (o === e || o.dead || o.hp >= o.maxHp) continue;
      if ((o.x - e.x) ** 2 + (o.y - e.y) ** 2 > R * R) continue;
      o.hp = Math.min(o.maxHp, o.hp + o.maxHp * (o.boss ? 0.02 : 0.1));
      this.fx.dots(o.x, o.y, e.color, 3, 30, 400, 0.35, -40);
      any = true;
    }
    if (any || (e.x > 0 && e.x < W && e.y > 0 && e.y < H)) this.fx.ring(e.x, e.y, R * 0.2, R, e.color, 0.45, 1, 0.5);
  }

  private blink(e: Enemy, ux: number, uy: number) {
    this.fx.spark(e.x, e.y, e.color, 6);
    this.fx.line(e.x, e.y, e.x + ux * 100, e.y + uy * 100, e.color, 0.2, 2);
    e.x += ux * 100; e.y += uy * 100;
    this.fx.materialize(e.x, e.y, e.r, e.color);
  }

  private summon(e: Enemy) {
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * Math.PI * 2;
      const m = this.spawnEnemy('swarm', e.x + Math.cos(a) * 40, e.y + Math.sin(a) * 40);
      m.kx = Math.cos(a) * 160; m.ky = Math.sin(a) * 160;
    }
    this.fx.ring(e.x, e.y, 30, 90, e.color, 0.4, 2, 0.8);
  }

  private updateEBullets(dt: number) {
    for (const b of this.ebullets) {
      if (b.dead) continue;
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.s.setPosition(b.x, b.y);
      if ((b.x - CORE_X) ** 2 + (b.y - CORE_Y) ** 2 < CORE_R * CORE_R) {
        this.hurt(b.dmg);
        this.fx.spark(b.x, b.y, b.color, 5);
        b.dead = true; this.free(b.s);
      }
    }
  }

  private logDamage(v: number) {
    this.dmgLog.push({ t: this.runTime, v });
    if (v > this.maxHit) this.maxHit = v;
  }

  private damageEnemy(e: Enemy, dmg: number, crit = false, color?: number) {
    if (e.dead) return;
    e.hp -= dmg;
    e.flash = 0.06;
    this.logDamage(dmg);
    if (crit) { this.fx.crit(e.x, e.y); this.num(e.x, e.y - e.r - 6, `${Math.round(dmg)}`, COLOR.amber, px(24), 'CRIT'); }
    else this.num(e.x, e.y - e.r - 4, `${Math.round(dmg)}`, color ?? COLOR.text, px(14));
    if (e.hp <= 0) this.kill(e, crit);
    else if (!e.boss && this.stats.lv.execute && e.hp < e.maxHp * this.stats.executePct) {
      this.num(e.x, e.y - e.r - 24, L('처형', 'EXECUTE'), COLOR.red, px(13));
      this.abilityPulse.execute = 0.4;
      this.kill(e, false);
    }
  }

  private kill(e: Enemy, crit = false) {
    if (e.dead) return;
    e.dead = true;
    this.free(e.s);
    this.kills++;
    this.gemsLive = this.estimateGems();
    this.combo++; this.comboT = COMBO_WINDOW;
    if (this.combo > this.comboBest) this.comboBest = this.combo;
    this.pushFeed(`${KIND_GLYPH[ENEMIES[e.kind].tex] ?? '●'} ${KIND_NAME[e.kind]}${crit ? ' · CRIT' : ''}`, crit ? COLOR.amber : COLOR.body);
    if (this.stats.lifesteal) this.heal(this.stats.lifesteal);
    if (e.boss) {
      this.bossKills++;
      this.fx.bossKill(e.x, e.y, e.color);
      sfx.boom();
      vibrate(80);
      this.heal(this.stats.maxHp * 0.25);
      this.fx.setVignette(0);
    } else {
      this.fx.kill(e.x, e.y, e.color, e.r);
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

  private pushFeed(text: string, color: number) {
    this.feed.unshift({ text, color, t: 3.5 });
    if (this.feed.length > 3) this.feed.length = 3;
  }

  private estimateGems() {
    let gems = 0;
    for (let i = 1; i <= this.wavesCleared; i++) gems += 2 + i * 0.4;
    return Math.round((gems + this.bossKills * 5) * this.stats.gemMul);
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
    this.lockTarget = targets[0];
    for (let i = 0; i < n; i++) {
      const t = targets[i % targets.length];
      const dist = Math.hypot(t.x - CORE_X, t.y - CORE_Y);
      const lead = dist / st.projSpeed;
      let a = Math.atan2(t.y + t.vy * lead - CORE_Y, t.x + t.vx * lead - CORE_X);
      if (i >= targets.length) a += (Math.floor(i / targets.length) % 2 ? 1 : -1) * 0.09 * Math.ceil(i / targets.length);
      const crit = Math.random() < st.critChance;
      const x = CORE_X + Math.cos(a) * (CORE_R + 6), y = CORE_Y + Math.sin(a) * (CORE_R + 6);
      const s = this.img('bullet', 31).setTint(crit ? COLOR.amber : COLOR.cyan).setScale(crit ? 0.8 : 0.55).setPosition(x, y).setBlendMode(Phaser.BlendModes.ADD);
      this.bullets.push({
        s, x, y, vx: Math.cos(a) * st.projSpeed, vy: Math.sin(a) * st.projSpeed,
        dmg: st.damage * (crit ? st.critMult : 1), crit, pierce: st.pierce, hit: [], life: 1.2, dead: false,
      });
      if (i === 0) { this.barrel.rotation = a + Math.PI / 2; this.fx.muzzle(x, y, a, COLOR.cyan); }
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
    this.fx.spark(b.x, b.y, b.crit ? COLOR.amber : COLOR.cyan, 3);
    sfx.hit();
    this.damageEnemy(e, b.dmg, b.crit);
    if (st.lv.splash) {
      this.explode(x, y, st.splashRadius, b.dmg * st.splashPct, e, COLOR.rare, false);
      this.abilityPulse.splash = 0.2;
    }
    if (st.lv.poison && !e.dead) {
      e.poisonDps = Math.max(e.poisonDps, st.poisonDps);
      e.poisonT = 3;
      this.abilityPulse.poison = 0.2;
    }
    if (st.lv.chain && Math.random() < st.chainChance) { this.chain(x, y, e, b.dmg * 0.6, st.chainJumps); this.abilityPulse.chain = 0.35; }
  }

  private explode(x: number, y: number, radius: number, dmg: number, exclude: Enemy | null, color: number, big: boolean) {
    for (const e of this.enemies) {
      if (e.dead || e === exclude) continue;
      const rr = radius + e.r;
      if ((e.x - x) ** 2 + (e.y - y) ** 2 < rr * rr) this.damageEnemy(e, dmg, false, color);
    }
    this.fx.explosion(x, y, radius, color, big);
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
      this.fx.bolt(this.boltPts(cx, cy, best.x, best.y), COLOR.epic);
      hit.push(best);
      cx = best.x; cy = best.y;
      this.damageEnemy(best, dmg, false, 0xddf8ff);
    }
    if (hit.length > 1) sfx.zap();
  }

  private boltPts(x1: number, y1: number, x2: number, y2: number) {
    const pts = [x1, y1];
    const segs = 8;
    const nx = -(y2 - y1), ny = x2 - x1;
    const len = Math.hypot(nx, ny) || 1;
    for (let i = 1; i < segs; i++) {
      const t = i / segs, off = (Math.random() - 0.5) * 28;
      pts.push(x1 + (x2 - x1) * t + (nx / len) * off, y1 + (y2 - y1) * t + (ny / len) * off);
    }
    pts.push(x2, y2);
    return pts;
  }

  private launchMissile(i: number, n: number) {
    const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.6 + (Math.random() - 0.5) * 0.3;
    const s = this.img('missile', 31).setTint(COLOR.epic).setScale(0.5).setBlendMode(Phaser.BlendModes.ADD);
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
          this.explode(m.x, m.y, 85, st.missileDamage, null, COLOR.epic, true);
          m.dead = true; this.free(m.s); continue;
        }
      }
      m.x += m.vx * dt; m.y += m.vy * dt;
      m.s.setPosition(m.x, m.y).setRotation(Math.atan2(m.vy, m.vx));
      m.trail -= dt;
      if (m.trail <= 0) { m.trail = 0.03; this.fx.smoke(m.x, m.y, COLOR.epic); }
      if (m.life <= 0) { this.explode(m.x, m.y, 85, st.missileDamage, null, COLOR.epic, true); m.dead = true; this.free(m.s); }
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
          this.fx.spark(x, y, COLOR.epic, 3);
          this.abilityPulse.blades = 0.3;
          this.damageEnemy(e, dmg, false, COLOR.epic);
        }
      }
      for (const b of this.ebullets) {
        if (!b.dead && (b.x - x) ** 2 + (b.y - y) ** 2 < 24 * 24) { b.dead = true; this.free(b.s); this.fx.spark(b.x, b.y, COLOR.epic, 3); }
      }
    }
  }

  private nova() {
    const st = this.stats;
    const r = st.novaRadius;
    sfx.nova();
    this.fx.shock(CORE_X, CORE_Y, r, COLOR.cyan);
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
    this.dmgByWave[this.wave] = (this.dmgByWave[this.wave] ?? 0) + dmg;
    this.hurtFlash = 0.12;
    this.num(CORE_X, CORE_Y - CORE_R - 10, `-${Math.round(dmg)}`, COLOR.red, px(16));
    this.fx.baseHit(CORE_X, CORE_Y, dmg);
    sfx.hurt();
    vibrate(25);
    if (this.hp <= 0) { this.hp = 0; this.gameOver(); }
  }

  private heal(n: number) {
    this.hp = Math.min(this.stats.maxHp, this.hp + n);
  }

  // ───────────────────────── 풀 · 숫자 ─────────────────────────

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

  private num(x: number, y: number, str: string, color: number, size: number, tag?: string) {
    if (this.bot) return;
    const n = this.nums.find(n => !n.busy);
    if (!n) return;
    n.busy = true;
    n.t.setText(tag ? `${str} ${tag}` : str).setColor(hex(color)).setFontSize(size).setPosition(x + (Math.random() - 0.5) * 14, y).setAlpha(1).setVisible(true).setScale(1.25);
    this.tweens.add({ targets: n.t, scale: 1, duration: 100 });
    this.tweens.add({
      targets: n.t, y: y - 36, alpha: 0, delay: 180, duration: 420,
      onComplete: () => { n.t.setVisible(false); n.busy = false; },
    });
  }

  // ───────────────────────── 매 프레임 그리기 ─────────────────────────

  private renderFrame(dt: number) {
    const st = this.stats;
    const t = this.time.now;
    // 기지
    this.core.rotation += dt * 0.4;
    this.barrel.setScale(Phaser.Math.Linear(this.barrel.scale, CORE_R / CORE_TEX_R, Math.min(1, dt * 12)));
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    const tint = this.hurtFlash > 0 ? COLOR.red : COLOR.cyan;
    this.core.setTint(this.hurtFlash > 0.06 ? 0xffffff : tint);
    this.coreGlow.setTint(tint).setAlpha(0.28 + Math.sin(t / 400) * 0.05);
    if (st.lv.frost) this.frostRing.setAlpha(0.22 + Math.sin(t / 300) * 0.06);

    // 탄환 꼬리 · 칼날 궤적
    const g = this.trailG;
    g.clear();
    for (const b of this.bullets) {
      if (b.dead) continue;
      const col = b.crit ? COLOR.amber : COLOR.cyan;
      const k = 0.045;
      g.lineStyle(b.crit ? 3 : 2, col, 0.45).lineBetween(b.x, b.y, b.x - b.vx * k, b.y - b.vy * k);
      g.lineStyle(1, col, 0.15).lineBetween(b.x - b.vx * k, b.y - b.vy * k, b.x - b.vx * k * 2.2, b.y - b.vy * k * 2.2);
    }
    for (const b of this.ebullets) {
      if (b.dead) continue;
      g.lineStyle(2, b.color, 0.35).lineBetween(b.x, b.y, b.x - b.vx * 0.05, b.y - b.vy * 0.05);
    }
    const nb = this.blades.length;
    for (let i = 0; i < nb; i++) {
      const a = this.bladeAngle + (i / nb) * Math.PI * 2;
      g.lineStyle(3, COLOR.epic, 0.35);
      g.beginPath(); g.arc(CORE_X, CORE_Y, BLADE_R, a - 0.55, a - 0.05, false); g.strokePath();
      g.lineStyle(1, COLOR.epic, 0.12);
      g.beginPath(); g.arc(CORE_X, CORE_Y, BLADE_R, a - 1.1, a - 0.5, false); g.strokePath();
    }

    this.fx.update(dt);

    // 적 체력바 · 보스
    this.barG.clear();
    let boss: Enemy | null = null;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.boss) { boss = e; continue; }
      if (e.hp >= e.maxHp) continue;
      const w = e.r * 2, x = e.x - e.r, y = e.y - e.r - 10;
      this.barG.fillStyle(0x2a0c12, 0.9).fillRect(x, y, w, 4);
      this.barG.fillStyle(e.poisonT > 0 ? COLOR.rare : COLOR.red, 1).fillRect(x, y, w * Math.max(0, e.hp / e.maxHp), 4);
    }

    // 위험 비네팅: 보스 + 선체 25% 이하
    const danger = this.hp <= st.maxHp * 0.25 && this.state !== 'over';
    const vig = (boss ? 0.28 : 0) + (danger ? 0.12 + Math.sin(t / 250) * 0.05 : 0);
    this.fx.setVignette(vig);

    if (this.state === 'play' || this.state === 'between') this.updateHud(dt, boss);
  }

  // ───────────────────────── HUD ─────────────────────────

  private buildHud() {
    this.hudG = this.add.graphics().setDepth(70);
    this.hudDyn = this.add.graphics().setDepth(71);
    const g = this.hudG;

    // 상단 3분할: WAVE / HULL / 일시정지
    const waveW = px(74), pauseW = px(52), gap = px(8);
    const midX = MX + waveW + gap, midW = W - MX * 2 - waveW - pauseW - gap * 2;
    panel(g, MX + waveW / 2, TOP + BAR_H / 2, waveW, BAR_H);
    panel(g, midX + midW / 2, TOP + BAR_H / 2, midW, BAR_H);
    label(this, MX + px(12), TOP + px(16), 'WAVE', px(9), COLOR.dim).setDepth(72);
    this.hudWave = num(this, MX + px(12), TOP + px(42), '1', px(30), COLOR.text, 'left').setDepth(72);
    label(this, midX + px(12), TOP + px(14), 'HULL', px(9), COLOR.dim).setDepth(72);
    this.hudHp = num(this, midX + midW - px(12), TOP + px(14), '', px(14), COLOR.text, 'right').setDepth(72);
    this.hudLeft = txt(this, midX + px(12), TOP + px(52), '', px(11), { align: 'left', color: COLOR.body, weight: 500 }).setDepth(72);
    label(this, midX + midW - px(60), TOP + px(52), 'THREAT', px(9), COLOR.amber, 'right').setDepth(72);
    const pauseBtn = button(this, W - MX - pauseW / 2, TOP + BAR_H / 2, pauseW, BAR_H, '', () => this.pause(), { kind: 'secondary', cut: {} }).setDepth(72);
    const pg = this.add.graphics().setDepth(73);
    pg.fillStyle(COLOR.body, 1).fillRect(W - MX - pauseW / 2 - px(6), TOP + BAR_H / 2 - px(8), px(4), px(16)).fillRect(W - MX - pauseW / 2 + px(2), TOP + BAR_H / 2 - px(8), px(4), px(16));
    pauseBtn.setDepth(72);

    // 웨이브 타임라인 (아래 얇은 바)
    this.hudTimeline = label(this, MX, TL_Y + px(12), '', px(9), COLOR.dim).setDepth(72);
    this.hudBossNext = label(this, W - MX, TL_Y + px(12), '', px(9), COLOR.bossText2, 'right').setDepth(72);

    // 보스 경고 패널 (보스 웨이브에만)
    this.bossPanel = this.add.container(0, 0).setDepth(70.5).setVisible(false);
    const bpY = PANEL_Y + px(18), bpH = px(82);
    const bg = this.add.graphics();
    panel(bg, W / 2, bpY + bpH / 2, W - MX * 2, bpH, { fill: COLOR.bossPanel, stroke: COLOR.red });
    const warn = chip(this, MX + px(12) + px(30), bpY + px(16), 'WARNING', COLOR.red, { fill: true });
    this.bossName = txt(this, MX + px(78), bpY + px(16), '', px(15), { align: 'left', color: COLOR.bossText, weight: 600 });
    this.bossPct = num(this, W - MX - px(12), bpY + px(16), '', px(13), COLOR.bossText, 'right');
    this.bossNote = txt(this, MX + px(12), bpY + px(66), '', px(11), { align: 'left', color: 0xc98a92, weight: 500 });
    this.bossCount = label(this, W - MX - px(12), bpY + px(66), '', px(10), COLOR.bossText2, 'right');
    this.bossPanel.add([bg, warn, this.bossName, this.bossPct, this.bossNote, this.bossCount]);

    // 킬 티커 (좌상) · 콤보 (중앙) · 미니 레이더 (우상) — 배경은 hudDyn 에 매 프레임
    this.hudKills = num(this, MX + px(10), PANEL_Y + px(14), '', px(13), COLOR.text, 'left').setDepth(72);
    this.hudGems = num(this, MX + px(10), PANEL_Y + px(32), '', px(12), COLOR.cyan, 'left').setDepth(72);
    this.hudFeed = [];
    for (let i = 0; i < 2; i++) this.hudFeed.push(txt(this, MX + px(10), PANEL_Y + px(48) + i * px(13), '', px(10), { align: 'left', color: COLOR.dim, weight: 500 }).setDepth(72));
    this.hudCombo = num(this, W / 2, PANEL_Y + px(16), '', px(22), COLOR.text).setDepth(72).setVisible(false);
    this.hudComboLbl = label(this, W / 2, PANEL_Y + px(36), 'COMBO', px(9), COLOR.amber, 'center').setDepth(72).setVisible(false);
    this.hudLock = label(this, 0, 0, '', px(9), COLOR.amber).setDepth(72).setVisible(false);
    this.hudDps = label(this, W - MX - px(64) - px(8), PANEL_Y + px(8), '', px(9), COLOR.dim, 'right').setDepth(72);

    // 하단: 능력 슬롯 · 배속 · 스탯 행
    const statsY = H - px(26);
    const divY = statsY - px(18);
    this.slotRow = this.add.container(0, divY - px(8)).setDepth(72); // 슬롯 바닥 기준
    g.lineStyle(2, COLOR.line, 1).lineBetween(MX, divY, W - MX, divY);
    this.hudStats = label(this, W / 2, statsY, '', px(10), COLOR.dim, 'center').setDepth(72);
    const cell = px(44);
    this.speedSeg = segmented(this, W - MX - cell, divY - px(8) - px(7) - px(56) / 2, ['x1', 'x2'], 0, cell, cell, i => { this.speedMode = i + 1; });
    this.speedSeg.setDepth(72);
    this.hudObjs = this.children.list.filter(o => { const d = (o as any).depth; return d >= 70 && d <= 73; });
  }

  private setHud(v: boolean) {
    for (const o of this.hudObjs) (o as any).setVisible?.(v);
    if (v) { this.hudCombo.setVisible(false); this.hudComboLbl.setVisible(false); this.hudLock.setVisible(false); this.bossPanel.setVisible(false); }
  }

  private updateHud(dt: number, boss: Enemy | null) {
    const st = this.stats;
    this.shownHp = Phaser.Math.Linear(this.shownHp, this.hp, Math.min(1, dt * 10));
    this.hudWave.setText(`${Math.max(1, this.wave)}`);
    const left = this.queue.length + this.enemies.length;
    const total = Math.max(1, this.waveTotal + (this.enemies.length - Math.min(this.enemies.length, this.waveTotal - this.queue.length)) * 0);
    this.hudLeft.setText(this.state === 'play' ? L(`남은 적 ${left} / ${this.waveTotal}`, `Enemies ${left} / ${this.waveTotal}`) : (this.daily ? L('일일 작전', 'DAILY OP') : ''));
    void total;

    const waveW = px(74), pauseW = px(52), gap = px(8);
    const midX = MX + waveW + gap, midW = W - MX * 2 - waveW - pauseW - gap * 2;
    const d = this.hudDyn;
    d.clear();

    // 선체 게이지 (재생 선두 띠 · 눈금 · 25% 위험선)
    const ratio = Math.max(0, this.shownHp / st.maxHp);
    const regenLead = st.regen > 0 ? Math.min(1, ratio + st.regen * 2 / st.maxHp) : ratio;
    gauge(d, midX + px(12), TOP + px(26), midW - px(24), px(8), ratio, COLOR.cyan, { lead: { ratio: regenLead, color: COLOR.green } });
    this.hudHp.setText(`${Math.ceil(this.hp)} / ${Math.round(st.maxHp)}`);
    this.hudHp.setColor(hex(ratio <= 0.25 ? COLOR.red : COLOR.text));

    // 위협도 핍 (사거리 안 적 수 기준)
    let threat = 0;
    const tr2 = (st.range * 1.3) ** 2;
    for (const e of this.enemies) if (!e.dead && (e.x - CORE_X) ** 2 + (e.y - CORE_Y) ** 2 < tr2) threat += e.boss ? 3 : 1;
    const pips = Phaser.Math.Clamp(Math.ceil(threat / 3), 0, 5);
    for (let i = 0; i < 5; i++) {
      d.fillStyle(i < pips ? (pips >= 4 ? COLOR.red : COLOR.amber) : COLOR.line, 1);
      d.fillRect(midX + midW - px(12) - (5 - i) * px(10), TOP + px(49), px(8), px(6));
    }

    // 웨이브 타임라인
    const tlX = MX, tlW = W - MX * 2;
    const killed = this.waveTotal - left;
    const prog = this.waveTotal ? Phaser.Math.Clamp(killed / this.waveTotal, 0, 1) : 0;
    d.fillStyle(COLOR.line, 1).fillRect(tlX, TL_Y, tlW, 4);
    d.fillStyle(COLOR.cyan, 1).fillRect(tlX, TL_Y, tlW * prog, 4);
    for (const q of [0.25, 0.5, 0.75]) d.fillStyle(COLOR.bg, 1).fillRect(tlX + tlW * q - 1, TL_Y - 2, 2, 8);
    d.fillStyle(COLOR.text, 1).fillRect(tlX + tlW * prog - 1, TL_Y - 3, 2, 10);
    this.hudTimeline.setText(`W${Math.max(1, this.wave)} · ${Math.round(prog * 100)}%`);
    const nextBoss = Math.ceil((this.wave + 1) / 5) * 5;
    this.hudBossNext.setText(nextBoss - this.wave <= 1 ? `BOSS W${nextBoss} NEXT` : `BOSS W${nextBoss}`);

    // 상황 HUD 패널 배경
    const py = PANEL_Y + (boss ? px(82) + px(26) : 0);
    const dy = py - PANEL_Y;
    const ticW = px(120), ticH = px(64);
    panel(d, MX + ticW / 2, py + ticH / 2, ticW, ticH, { fill: COLOR.surf1, fillAlpha: 0.85, cut: CUT_MAIN(px(10)) });
    this.hudKills.setPosition(MX + px(10), py + px(14)).setText(`KILLS ${this.kills}`);
    this.hudGems.setPosition(MX + px(10), py + px(32)).setText(`◇ ${this.gemsLive}`);
    for (let i = 0; i < 2; i++) {
      const f = this.feed[i];
      this.hudFeed[i].setPosition(MX + px(10), py + px(48) + i * px(13));
      if (f) { f.t -= dt; this.hudFeed[i].setText(f.text).setColor(hex(f.color)).setAlpha(Phaser.Math.Clamp(f.t, 0, 1)); }
      else this.hudFeed[i].setText('');
    }
    this.feed = this.feed.filter(f => f.t > 0);

    // 콤보
    if (this.combo >= 3 && this.comboT > 0) {
      this.hudCombo.setVisible(true).setText(`x${this.combo}`).setPosition(W / 2, py + px(16)).setColor(hex(this.combo >= 10 ? COLOR.amber : COLOR.text));
      this.hudComboLbl.setVisible(true).setPosition(W / 2, py + px(36));
      d.fillStyle(COLOR.line, 1).fillRect(W / 2 - px(40), py + px(46), px(80), 3);
      d.fillStyle(COLOR.amber, 1).fillRect(W / 2 - px(40), py + px(46), px(80) * (this.comboT / COMBO_WINDOW), 3);
    } else { this.hudCombo.setVisible(false); this.hudComboLbl.setVisible(false); }

    // 미니 레이더 (64×64)
    const rs = px(64), rx = W - MX - rs, ry = py;
    panel(d, rx + rs / 2, ry + rs / 2, rs, rs, { fill: COLOR.surf1, fillAlpha: 0.85, cut: CUT_PANEL(px(10)) });
    const rcx = rx + rs / 2, rcy = ry + rs / 2;
    const scale = (rs / 2 - 4) / Math.max(W, H) * 1.6; // 화면 전체(+바깥)를 레이더 안에
    d.lineStyle(1, COLOR.lineP, 0.8);
    for (const r of [px(10), px(20), px(30)]) d.strokeCircle(rcx, rcy, r);
    d.lineStyle(1, COLOR.cyan, 0.35).strokeCircle(rcx, rcy, st.range * scale);
    d.fillStyle(COLOR.cyan, 1).fillCircle(rcx, rcy, 2);
    const sweep = (this.time.now / 3000) * Math.PI * 2;
    d.lineStyle(1.5, COLOR.cyan, 0.6).lineBetween(rcx, rcy, rcx + Math.cos(sweep) * (rs / 2 - 4), rcy + Math.sin(sweep) * (rs / 2 - 4));
    for (const e of this.enemies) {
      if (e.dead) continue;
      const ex = rcx + (e.x - CORE_X) * scale, ey = rcy + (e.y - CORE_Y) * scale;
      if (Math.hypot(ex - rcx, ey - rcy) > rs / 2 - 3) continue;
      d.fillStyle(COLOR.red, 1);
      if (e.boss) d.fillRect(ex - 3, ey - 3, 6, 6); else d.fillCircle(ex, ey, 1.6);
    }
    this.hudDps.setPosition(rx - px(8), py + px(8));
    const cutoff = this.runTime - 2;
    this.dmgLog = this.dmgLog.filter(l => l.t > cutoff);
    const dps = this.dmgLog.reduce((s, l) => s + l.v, 0) / 2;
    this.hudDps.setText(`DPS ${Math.round(dps)}`);

    // 화면 밖 적 방향 표식 (가장자리 12px 레인)
    const counts = { top: 0, bottom: 0, left: 0, right: 0 };
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.y < 0) counts.top++; else if (e.y > H) counts.bottom++; else if (e.x < 0) counts.left++; else if (e.x > W) counts.right++;
    }
    const tri = (x: number, y: number, dir: 'u' | 'd' | 'l' | 'r', n: number) => {
      if (!n) return;
      const s = px(6);
      d.fillStyle(COLOR.red, 0.9);
      if (dir === 'u') d.fillTriangle(x, y, x - s, y + s * 1.6, x + s, y + s * 1.6);
      if (dir === 'd') d.fillTriangle(x, y, x - s, y - s * 1.6, x + s, y - s * 1.6);
      if (dir === 'l') d.fillTriangle(x, y, x + s * 1.6, y - s, x + s * 1.6, y + s);
      if (dir === 'r') d.fillTriangle(x, y, x - s * 1.6, y - s, x - s * 1.6, y + s);
    };
    tri(W / 2, py + dy * 0 + px(6) + (boss ? 0 : 0) + PANEL_Y - PANEL_Y + TL_Y + px(22), 'u', counts.top);
    tri(W / 2, H - px(60) - px(56) - px(40), 'd', counts.bottom);
    tri(px(4), CORE_Y, 'l', counts.left);
    tri(W - px(4), CORE_Y, 'r', counts.right);

    // 락온 브래킷 + 라벨
    const lt = this.lockTarget;
    if (lt && !lt.dead && this.state === 'play') {
      const sz = lt.r * 2 + px(10);
      brackets(d, lt.x, lt.y, sz, sz, px(5), COLOR.amber, 0.9, 1.5);
      this.hudLock.setVisible(true).setPosition(lt.x + sz / 2 + px(4), lt.y - sz / 2).setText(`LOCK · HP ${Math.max(1, Math.round(lt.hp / lt.maxHp * 100))}%`);
      if (this.hudLock.x + this.hudLock.width > W - MX) this.hudLock.setX(lt.x - sz / 2 - px(4) - this.hudLock.width);
    } else this.hudLock.setVisible(false);

    // 보스 패널
    if (boss) {
      this.bossPanel.setVisible(true);
      const bpY = PANEL_Y + px(18);
      const ratioB = Math.max(0, boss.hp / boss.maxHp);
      this.bossName.setText(ENEMIES[boss.kind].boss!);
      this.bossPct.setText(`${Math.round(ratioB * 100)}%`);
      const bx = MX + px(12), bw = W - MX * 2 - px(24), by = bpY + px(32);
      d.fillStyle(0x2a0c12, 1).fillRect(bx, by, bw, px(10));
      d.fillStyle(COLOR.red, 1).fillRect(bx, by, bw * ratioB, px(10));
      d.fillStyle(COLOR.bossText, 0.6).fillRect(bx + bw * ratioB - 2, by, Math.min(4, bw * ratioB), px(10));
      for (const q of [0.25, 0.5, 0.75]) d.fillStyle(COLOR.bossPanel, 1).fillRect(bx + bw * q - 1, by - 3, 2, px(10) + 6);
      // 페이즈 핍 (체력 4등분)
      for (let i = 0; i < 4; i++) {
        d.fillStyle(ratioB > i * 0.25 ? COLOR.red : 0x3a1218, 1);
        d.fillRect(bx + bw - px(44) + i * px(11), bpY + px(52), px(8), px(5));
      }
      const q = boss.kind === 'queen';
      this.bossNote.setText(q
        ? (ratioB < 0.5 ? L('페이즈 2 · 소환 속도 2배', 'Phase 2 · summons 2x faster') : L('50% 이하에서 소환 속도 2배', 'Below 50%: summons 2x faster'))
        : boss.kind === 'artillery' ? L('사거리 밖에서 5갈래 탄막', 'Fires 5-way volleys from range') : L('기지에 붙어 1초마다 타격', 'Hits the hull every second once adjacent'));
      const minions = this.enemies.filter(e => !e.dead && !e.boss).length;
      this.bossCount.setText(q ? `${L('소환체', 'MINIONS')} ×${minions}  ·  ${L('소환', 'SUMMON')} ${Math.max(0, boss.shootT).toFixed(1)}s` : `${L('소환체', 'MINIONS')} ×${minions}`);
    } else this.bossPanel.setVisible(false);

    // 능력 슬롯 쿨다운
    for (const s of this.slots) {
      let frac = 1, label2 = '';
      if (s.a === 'missiles') { frac = 1 - Math.max(0, this.missileCd) / 2.5; label2 = this.missileCd > 0.05 ? `${this.missileCd.toFixed(1)}s` : 'READY'; }
      else if (s.a === 'nova') { frac = 1 - Math.max(0, this.novaCd) / st.novaCooldown; label2 = this.novaCd > 0.05 ? `${this.novaCd.toFixed(1)}s` : 'READY'; }
      const pulse = this.abilityPulse[s.a] ?? 0;
      const col = RARITY[CARDS.find(c => c.ability === s.a)!.rarity].color;
      s.g.clear();
      const sz = px(56);
      panel(s.g, 0, 0, sz, sz, { fill: COLOR.surf1, stroke: pulse > 0 ? col : COLOR.line, lineW: 2, glow: pulse > 0 ? px(8) : 0 });
      s.g.fillStyle(col, 1).fillRect(-sz / 2, sz / 2 - 3, sz * Phaser.Math.Clamp(frac, 0, 1), 3);
      if (frac < 1) { s.g.fillStyle(COLOR.bg, 0.55); s.g.slice(0, 0, sz / 2 - 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - frac), false); s.g.fillPath(); }
      s.icon.setAlpha(frac < 1 ? 0.5 : 1).setScale(iconScale(s.icon.texture.key, px(24)) * (1 + pulse * 0.4));
      s.cdT.setText(label2 && frac < 1 ? label2 : '');
    }
  }

  private onStatsChanged() {
    const st = this.stats;
    // 사거리 표시
    this.rangeG.clear();
    this.rangeG.lineStyle(6, COLOR.lineP, 0.6);
    const seg = 2 * Math.PI / 64;
    for (let i = 0; i < 64; i++) { this.rangeG.beginPath(); this.rangeG.arc(CORE_X, CORE_Y, st.range, i * seg, i * seg + seg * 0.08, false); this.rangeG.strokePath(); }
    this.rangeG.lineStyle(1, COLOR.cyan, 0.3).strokeCircle(CORE_X, CORE_Y, st.range);
    // 냉기장
    if (st.lv.frost) {
      this.frostRing.setScale(st.frostRadius / RING_R).setAlpha(0.22);
      this.frostFill.setScale((st.frostRadius * 2) / 256 * 1.1).setAlpha(0.05);
      this.fx.frostField(CORE_X, CORE_Y, st.frostRadius);
    }
    // 칼날 개수 맞추기
    const want = st.lv.blades ? st.bladeCount : 0;
    while (this.blades.length < want) this.blades.push(this.add.image(CORE_X, CORE_Y, 'blade').setTint(COLOR.epic).setScale(0.55).setDepth(24).setBlendMode(Phaser.BlendModes.ADD));
    this.hp = Math.min(this.hp, st.maxHp);

    this.hudStats.setText(`DMG ${Math.round(st.damage)}  ·  SPD ${st.fireRate.toFixed(1)}  ·  RNG ${Math.round(st.range)}  ·  CRIT ${Math.round(st.critChance * 100)}%  ·  SHOT x${st.multishot}`);

    // 능력 슬롯 다시 만들기
    this.slotRow.removeAll(true);
    this.slots = [];
    const owned = ABILITIES.filter(a => st.lv[a] > 0);
    const sz = px(56), gap = px(6);
    const cellW = px(44) * 2 + px(12);
    const maxW = W - MX * 2 - cellW;
    const n = owned.length;
    const slotW = Math.min(sz, n ? (maxW - gap * (n - 1)) / n : sz);
    owned.forEach((a, i) => {
      const card = CARDS.find(c => c.ability === a)!;
      const col = RARITY[card.rarity].color;
      const x = MX + slotW / 2 + i * (slotW + gap);
      // 모듈이 많으면 슬롯 전체를 줄여서 배속 버튼 앞까지만 쓰게 한다
      const c = this.add.container(x, -px(7) - slotW / 2).setScale(slotW / sz);
      const g = this.add.graphics();
      const icon = this.add.image(0, -px(4), card.icon).setTint(col).setScale(iconScale(card.icon, px(24)));
      const cdT = num(this, 0, px(16), '', px(9), COLOR.text);
      // 레벨 핍
      const pg = this.add.graphics();
      for (let k = 0; k < 5; k++) { pg.fillStyle(k < st.lv[a] ? col : COLOR.line, 1); pg.fillRect(-sz / 2 + k * px(10) + (sz - px(48)) / 2, sz / 2 + px(5), px(8), 3); }
      c.add([g, icon, cdT, pg]);
      this.slotRow.add(c);
      this.slots.push({ c, a, icon, cdT, g });
    });
  }

  // ───────────────────────── 강화 모듈 선택 ─────────────────────────

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
    this.lastCards = cards;
    if (this.bot) {
      // 밸런스 측정용: smart 는 높은 등급 우선, 기본은 무작위
      const order: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
      const smart = new URLSearchParams(location.search).get('pick') === 'smart';
      const pick = smart ? [...cards].sort((x, y) => order.indexOf(y.rarity) - order.indexOf(x.rarity))[0] : cards[Math.floor(Math.random() * cards.length)];
      this.choose(pick);
      return;
    }

    const st = this.stats;
    this.setHud(false);
    const o = this.add.container(0, 0).setDepth(100);
    this.overlay = o;
    const dim = this.add.rectangle(W / 2, H / 2, W, H, COLOR.bg, 0.93).setInteractive();
    o.add(dim);

    // 헤더
    const hy = px(40);
    o.add(label(this, MX * 2, hy, 'UPGRADE PROTOCOL', px(10), COLOR.cyan));
    o.add(label(this, W - MX * 2, hy, `WAVE ${Math.max(1, this.wave)} / ${this.wave ? 'CLEAR' : 'START'}`, px(10), COLOR.dim, 'right'));
    o.add(txt(this, MX * 2, hy + px(30), title, px(24), { align: 'left', weight: 600 }));
    o.add(txt(this, MX * 2, hy + px(58), subtitle, px(12), { align: 'left', color: COLOR.dim, weight: 500 }));

    // 현재 빌드 칩
    const by = hy + px(96);
    const bg = this.add.graphics();
    bg.lineStyle(2, COLOR.line, 1).lineBetween(MX * 2, by - px(20), W - MX * 2, by - px(20)).lineBetween(MX * 2, by + px(20), W - MX * 2, by + px(20));
    o.add(bg);
    o.add(label(this, MX * 2, by, 'BUILD', px(9), COLOR.dim));
    let cx = MX * 2 + px(44);
    const owned = ABILITIES.filter(a => st.lv[a] > 0);
    const limit = W - MX * 2 - (st.multishot > 1 ? px(40) : 0);
    let hidden = 0;
    owned.forEach(a => {
      const card = CARDS.find(c => c.ability === a)!;
      const ch = chip(this, 0, by, `${RARITY_GLYPH[card.rarity]} ${card.name} ${st.lv[a]}`, RARITY[card.rarity].color, { font: 'kr', size: px(10) });
      if (cx + ch.chipWidth > limit - px(30)) { ch.destroy(); hidden++; return; }
      ch.setX(cx + ch.chipWidth / 2);
      cx += ch.chipWidth + px(6);
      o.add(ch);
    });
    if (hidden) { const ch = chip(this, 0, by, `+${hidden}`, COLOR.dim); ch.setX(cx + ch.chipWidth / 2); cx += ch.chipWidth + px(6); o.add(ch); }
    if (st.multishot > 1) { const ch = chip(this, 0, by, `x${st.multishot}`, COLOR.body); ch.setX(cx + ch.chipWidth / 2); o.add(ch); }
    if (!owned.length && st.multishot <= 1) o.add(txt(this, cx, by, L('장착된 모듈 없음', 'No modules equipped'), px(11), { align: 'left', color: COLOR.mute, weight: 500 }));

    // 카드 3장
    let selected: Card | null = null;
    const views: { card: Card; c: Phaser.GameObjects.Container; g: Phaser.GameObjects.Graphics; tag: Phaser.GameObjects.Container }[] = [];
    const cardH = px(124), cardGap = px(12);
    const y0 = by + px(40) + cardH / 2;
    const equipBtn = button(this, W / 2 + px(63), H - px(26) - px(30), W - MX * 4 - px(116) - px(10), px(60), L('모듈을 선택하세요', 'Select a module'), () => { if (selected) this.confirm(selected, views.find(v => v.card === selected)!.c, o, dim); }, { kind: 'primary', left: true, size: px(17), icon: checkIcon });
    equipBtn.setEnabled(false);

    const redraw = () => {
      for (const v of views) {
        const col = RARITY[v.card.rarity].color;
        const sel = v.card === selected;
        v.g.clear();
        panel(v.g, 0, 0, W - MX * 4, cardH, { fill: v.card.rarity === 'legendary' ? 0x120f07 : v.card.rarity === 'epic' ? 0x120e1f : COLOR.surf1, stroke: col, lineW: sel ? 3 : 2, cut: CUT_PANEL(px(16)), glow: sel ? px(18) : (v.card.rarity === 'legendary' ? px(8) : 0) });
        v.tag.setVisible(sel);
      }
      equipBtn.setEnabled(!!selected);
      equipBtn.setLabel(selected ? L(`${selected.name} 장착`, `Equip ${selected.name}`) : L('모듈을 선택하세요', 'Select a module'));
    };

    cards.forEach((card, i) => {
      const y = y0 + i * (cardH + cardGap);
      const v = this.cardView(card, y, () => { if (!accept) return; selected = card; sfx.click(); redraw(); });
      views.push(v);
      o.add(v.c);
      v.c.setAlpha(0).setY(y + 12);
      this.tweens.add({ targets: v.c, alpha: 1, y, duration: 180, delay: 60 * i, ease: 'Cubic.Out' });
    });
    let accept = false;
    this.time.delayedCall(300, () => { accept = true; });

    // 다음 웨이브 예고
    const nw = this.wave + 1;
    const ny = by + px(40) + 3 * cardH + 2 * cardGap + px(12);
    const nextH = px(48);
    if (ny + nextH < H - px(26) - px(60) - px(10)) {
      const ng = this.add.graphics();
      panel(ng, W / 2, ny + nextH / 2, W - MX * 4, nextH, { fill: COLOR.surf1, cut: CUT_MAIN(px(10)) });
      o.add(ng);
      o.add(label(this, MX * 2 + px(12), ny + nextH / 2, 'NEXT', px(9), COLOR.dim));
      const bossNext = isBossWave(nw);
      o.add(num(this, MX * 2 + px(48), ny + nextH / 2, `WAVE ${nw}`, px(14), bossNext ? COLOR.bossText2 : COLOR.text, 'left'));
      const comp = this.composition(this.nextEntries ?? []);
      o.add(txt(this, W - MX * 2 - px(12), ny + nextH / 2, bossNext ? `${RARITY_GLYPH.epic} BOSS · ${ENEMIES[bossForWave(nw)].boss}  ·  ${comp}` : comp, px(11), { align: 'right', color: bossNext ? COLOR.bossText2 : COLOR.body, weight: 500 }));
    }

    // 하단: 재탐색 + 장착
    const rb = button(this, MX * 2 + px(58), H - px(26) - px(30), px(116), px(58), `${L('재탐색', 'Reroll')} ${this.rerollsLeft}`, () => {
      if (!accept || this.rerollsLeft <= 0) return;
      this.rerollsLeft--;
      this.closeOverlay();
      this.showCards(minRarity, title, subtitle);
    }, { kind: 'secondary', size: px(14), icon: refreshIcon });
    rb.setEnabled(this.rerollsLeft > 0);
    o.add([rb, equipBtn]);
    redraw();
    sfx.pick();
  }

  private composition(entries: SpawnEntry[]) {
    const counts = new Map<EnemyKind, number>();
    for (const e of entries) if (!ENEMIES[e.kind].boss) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${KIND_GLYPH[ENEMIES[k].tex]} ${n}`).join('  ');
  }

  private cardView(card: Card, y: number, onPick: () => void) {
    const st = this.stats;
    const col = RARITY[card.rarity].color;
    const w = W - MX * 4, h = px(124);
    const c = this.add.container(W / 2, y);
    const g = this.add.graphics();
    c.add(g);
    // 아이콘 박스
    const ix = -w / 2 + px(16) + px(26);
    const ib = this.add.graphics();
    ib.fillStyle(col, 0.1).fillRect(ix - px(26), -px(26), px(52), px(52));
    ib.lineStyle(2, col, 1).strokeRect(ix - px(26), -px(26), px(52), px(52));
    const icon = this.add.image(ix, 0, card.icon).setTint(col).setScale(iconScale(card.icon, px(26)));
    const tx = ix + px(26) + px(14);
    const name = txt(this, tx, -px(36), card.name, px(17), { align: 'left', weight: 600 });
    const tag = label(this, w / 2 - px(16), -px(36), `${RARITY_GLYPH[card.rarity]} ${RARITY[card.rarity].name}`, px(10), col, 'right');
    const desc = txt(this, tx, -px(10), card.desc(st).replace(/\n/g, ' · '), px(12), { align: 'left', color: card.rarity === 'legendary' ? 0xc9b27a : card.rarity === 'epic' ? 0xb3a6d6 : 0x8fa9b5, weight: 500, wrap: w / 2 + px(70) });
    c.add([ib, icon, name, tag, desc]);
    // 레벨 핍 또는 NEW
    if (card.ability) {
      const cur = st.lv[card.ability];
      const pg = this.add.graphics();
      for (let k = 0; k < 5; k++) { pg.fillStyle(k < cur ? col : k === cur ? COLOR.text : COLOR.line, 1); pg.fillRect(tx + k * px(22), px(34), px(18), 3); }
      c.add(pg);
      c.add(label(this, tx + px(116), px(34), cur ? `LV ${cur} ▸ ${cur + 1}` : 'NEW', px(10), cur ? col : COLOR.green));
    }
    // 선택 표시
    const selTag = chip(this, w / 2 - px(40), -h / 2, 'SELECTED', col, { fill: true });
    selTag.setVisible(false);
    c.add(selTag);
    const zone = this.add.zone(0, 0, w, h).setInteractive({ useHandCursor: true });
    zone.on('pointerup', onPick);
    c.add(zone);
    return { card, c, g, tag: selTag };
  }

  private confirm(card: Card, view: Phaser.GameObjects.Container, o: Phaser.GameObjects.Container, dim: Phaser.GameObjects.GameObject) {
    this.tweens.add({ targets: view, scale: 1.03, duration: 100, yoyo: true });
    o.each((ch: Phaser.GameObjects.GameObject) => { if (ch !== view && ch !== dim) this.tweens.add({ targets: ch, alpha: 0, duration: 160 }); });
    if (card.rarity === 'legendary') this.fx.flash(220, 0x3a2e10);
    this.time.delayedCall(220, () => this.choose(card));
  }

  private choose(card: Card) {
    card.apply(this.cardCtx());
    this.onStatsChanged();
    this.closeOverlay();
    if (!this.bot) {
      sfx.pick();
      this.toast(`${RARITY_GLYPH[card.rarity]} ${card.name}${card.ability ? ` LV ${this.stats.lv[card.ability]}` : ''}`, RARITY[card.rarity].color);
    }
    this.startWave();
  }

  private toast(text: string, color: number) {
    const y = PANEL_Y + px(90);
    const c = this.add.container(W / 2, y + 8).setDepth(80).setAlpha(0);
    const g = this.add.graphics();
    const t = txt(this, 0, 0, text, px(12), { weight: 600, color: COLOR.text });
    const w = t.width + px(32), h = px(34);
    panel(g, 0, 0, w, h, { fill: COLOR.surf1, fillAlpha: 0.92, stroke: color, cut: CUT_MAIN(px(10)), glow: px(6) });
    g.fillStyle(color, 1).fillRect(-w / 2, -h / 2, 3, h);
    c.add([g, t]);
    this.tweens.add({ targets: c, alpha: 1, y, duration: 180, ease: 'Cubic.Out' });
    this.tweens.add({ targets: c, alpha: 0, delay: 1800, duration: 120, onComplete: () => c.destroy() });
  }

  private closeOverlay() {
    this.overlay?.destroy();
    this.overlay = undefined;
    if (this.state !== 'over') this.setHud(true);
  }

  // ───────────────────────── 일시정지 ─────────────────────────

  private onHidden() {
    if (this.bot) return;
    if (this.state === 'play' || this.state === 'between') this.pause();
  }

  private pause() {
    if (this.state !== 'play' && this.state !== 'between') return;
    const prev = this.state;
    this.state = 'paused';
    const st = this.stats;
    this.setHud(false);
    const o = this.add.container(0, 0).setDepth(100);
    this.overlay = o;
    const dim = this.add.rectangle(W / 2, H / 2, W, H, COLOR.bg, 0.72).setInteractive();
    o.add(dim);
    // 멈춘 전장 위 정지 표식
    const fz = this.add.graphics();
    fz.lineStyle(1, COLOR.dim, 0.5);
    for (const e of this.enemies) if (!e.dead && e.x > 0 && e.x < W && e.y > 0 && e.y < H) fz.strokeCircle(e.x, e.y, e.r + 8);
    o.add(fz);
    const sheetH = Math.min(px(560), H - px(130));
    const sy = H - sheetH;
    const ty = sy - px(58);
    o.add(label(this, W / 2, ty, `PAUSED · RUN #${save.runs + 1} · WAVE ${Math.max(1, this.wave)}`, px(10), COLOR.cyan, 'center'));
    o.add(txt(this, W / 2, ty + px(26), L('일시정지', 'Paused'), px(24), { weight: 600 }));
    const sg = this.add.graphics();
    panel(sg, W / 2, sy + sheetH / 2 + 2, W + 4, sheetH + 4, { fill: COLOR.surf1, stroke: COLOR.lineP, cut: { tl: px(24), tr: px(24) } });
    sg.fillStyle(COLOR.lineP, 1).fillRect(W / 2 - px(18), sy + px(14), px(36), 3);
    o.add(sg);

    let y = sy + px(36);
    o.add(label(this, MX * 2, y, 'CURRENT LOADOUT', px(10), COLOR.dim));
    y += px(14);
    const cells: [string, string, number][] = [
      [L('공격력', 'Damage'), `${Math.round(st.damage)}`, COLOR.text],
      [L('공격 속도', 'Attack speed'), `${st.fireRate.toFixed(2)}/s`, COLOR.text],
      [L('사거리', 'Range'), `${Math.round(st.range)}`, COLOR.text],
      [L('치명타', 'Crit'), `${Math.round(st.critChance * 100)}% ×${st.critMult.toFixed(1)}`, COLOR.amber],
      [L('재생', 'Regen'), `${st.regen.toFixed(1)}/s`, COLOR.green],
      [L('피해 감소', 'Armor'), `${Math.round(Math.min(0.75, st.dmgReduce) * 100)}%`, COLOR.text],
    ];
    const gw = (W - MX * 4) / 3, gh = px(46);
    const grid = this.add.graphics();
    grid.lineStyle(2, COLOR.line, 1);
    cells.forEach(([k, v, col], i) => {
      const cx = MX * 2 + (i % 3) * gw, cy = y + Math.floor(i / 3) * gh;
      grid.strokeRect(cx, cy, gw, gh);
      o.add(txt(this, cx + px(10), cy + px(13), k, px(11), { align: 'left', color: COLOR.dim, weight: 500 }));
      o.add(num(this, cx + px(10), cy + px(32), v, px(15), col, 'left'));
    });
    o.add(grid);
    y += gh * 2 + px(16);

    // 모듈 칩
    const owned = ABILITIES.filter(a => st.lv[a] > 0);
    if (owned.length) {
      let cx = MX * 2;
      owned.forEach(a => {
        const card = CARDS.find(c => c.ability === a)!;
        const ch = chip(this, 0, y, `${RARITY_GLYPH[card.rarity]} ${card.name} ${st.lv[a]}`, RARITY[card.rarity].color, { font: 'kr' });
        ch.setX(cx + ch.chipWidth / 2); cx += ch.chipWidth + px(6);
        o.add(ch);
      });
      y += px(28);
    }

    // 설정
    o.add(label(this, MX * 2, y, 'SETTINGS', px(10), COLOR.dim));
    y += px(10);
    const rows: [string, keyof typeof save][] = [[L('효과음', 'Sound FX'), 'sound'], [L('배경음악', 'Music'), 'music'], [L('진동', 'Vibration'), 'vibrate'], [L('화면 흔들림 · 플래시 끄기', 'Reduce shake & flash'), 'reducedFx']];
    const rowH = px(40);
    rows.forEach(([name, key], i) => {
      const ry = y + rowH * (i + 0.5);
      o.add(txt(this, MX * 2, ry, name, px(13), { align: 'left', weight: 500 }));
      o.add(toggle(this, W - MX * 2 - px(22), ry, !!save[key], v => { (save as any)[key] = v; persist(); this.applySettingsLive(); }));
      if (key === 'music') o.add(musicSlider(this, W - MX * 2 - px(56) - px(70), ry));
      const ln = this.add.graphics(); ln.lineStyle(2, COLOR.line, 1).lineBetween(MX * 2, y + rowH * (i + 1), W - MX * 2, y + rowH * (i + 1)); o.add(ln);
    });
    y += rowH * rows.length + px(8);
    o.add(txt(this, MX * 2, y + px(10), L('배속', 'Speed'), px(13), { align: 'left', weight: 500 }));
    const seg = segmented(this, W - MX * 2 - px(44), y + px(10), ['x1', 'x2'], this.speedMode - 1, px(44), px(28), i => { this.speedMode = i + 1; this.speedSeg.setActive(i); });
    o.add(seg);

    // 전투 배경음악 고르기
    y += px(40);
    o.add(txt(this, MX * 2, y + px(10), L('배경음악 곡', 'Track'), px(13), { align: 'left', weight: 500 }));
    const bw = px(36), right = W - MX * 2, boxW = px(200), mid = right - boxW / 2;
    const trackT = txt(this, mid, y + px(10), '', px(12), { font: 'num', weight: 600, color: COLOR.cyan });
    const trackN = label(this, MX * 2 + px(78), y + px(10), '', px(9), COLOR.dim, 'left');
    const showTrack = () => { trackT.setText(TRACKS[music.track].name); trackN.setText(`${music.track + 1} / ${TRACKS.length}`); };
    const pick = (d: number) => { music.setTrack(music.track + d); save.musicTrack = music.track; persist(); showTrack(); };
    o.add(button(this, right - boxW + bw / 2, y + px(10), bw, px(32), '◀', () => pick(-1), { kind: 'secondary', size: px(11), cut: {} }));
    o.add(button(this, right - bw / 2, y + px(10), bw, px(32), '▶', () => pick(1), { kind: 'secondary', size: px(11), cut: {} }));
    o.add([trackT, trackN]);
    showTrack();

    // 버튼
    const by = H - px(26) - px(30);
    o.add(button(this, W / 2, by - px(66), W - MX * 4, px(56), L('계속하기', 'Resume'), () => { this.closeOverlay(); this.state = prev; }, { kind: 'primary', left: true, size: px(17), icon: arrowIcon }));
    o.add(button(this, W / 2, by, W - MX * 4, px(44), L('작전 포기 · 보석은 지급됩니다', 'Abort · gems are still awarded'), () => { this.closeOverlay(); this.state = prev; this.hp = 0; this.gameOver(); }, { kind: 'danger', size: px(13) }));
  }

  private applySettingsLive() {
    sfx.enabled = save.sound;
    music.setEnabled(save.music);
    this.fx.reduced = !!save.reducedFx;
    haptics.enabled = save.vibrate;
  }

  // 처음 한 번만 보여주는 도움말
  private tip(key: string, text: string) {
    if (this.bot || save.tips[key] || this.state === 'over') return;
    save.tips[key] = true;
    persist();
    const y = H - px(26) - px(18) - px(56) - px(60);
    const c = this.add.container(W / 2, y).setDepth(80).setAlpha(0);
    const g = this.add.graphics();
    const t = txt(this, 0, 0, text, px(12), { weight: 500, lineSpacing: 6 });
    panel(g, 0, 0, Math.max(t.width + px(40), px(280)), t.height + px(24), { fill: COLOR.surf1, fillAlpha: 0.94, stroke: COLOR.amber, cut: CUT_MAIN(px(10)) });
    c.add([g, t]);
    this.tweens.add({ targets: c, alpha: 1, y: y - 8, duration: 220 });
    this.tweens.add({ targets: c, alpha: 0, delay: 5200, duration: 300, onComplete: () => c.destroy() });
  }

  // ───────────────────────── 게임오버 · 작전 결과 ─────────────────────────

  private gameOver() {
    if (this.state === 'over') return;
    this.state = 'over';
    this.closeOverlay();
    if (!this.bot) music.play(0);
    sfx.lose();
    vibrate(250);
    this.fx.bossKill(CORE_X, CORE_Y, COLOR.cyan);
    this.fx.ring(CORE_X, CORE_Y, CORE_R, 420, COLOR.cyan, 0.9, 2, 0.6);
    this.fx.setVignette(0.4, COLOR.red);
    this.core.setVisible(false); this.barrel.setVisible(false); this.coreGlow.setVisible(false);
    for (const b of this.blades) b.setVisible(false);
    this.hudLock.setVisible(false);

    let base = 0;
    for (let i = 1; i <= this.wavesCleared; i++) base += 2 + i * 0.4;
    const bossG = this.bossKills * 5;
    // 일일 도전은 그날 첫 판만 보석 2배 (반복 파밍 방지)
    const firstDaily = this.daily && !(save.daily.day === this.dayKey && save.daily.runs > 0);
    const mul = this.stats.gemMul * (this.daily ? (this.mod?.gem ?? 1) * (firstDaily ? 2 : 1) : 1);
    const gems = Math.round((base + bossG) * mul);
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
    const before = save.gems;
    save.gems += gems;
    save.runs++;
    save.lastRun = { wave: reached, kills: this.kills, time: Math.round(this.runTime), gems };
    persist();

    this.time.delayedCall(1300, () => this.showResults(reached, gems, newBest, { base: Math.round(base * mul), boss: Math.round(bossG * mul), bonus: gems - Math.round(base * mul) - Math.round(bossG * mul), before }));
  }

  private showResults(reached: number, gems: number, newBest: boolean, br: { base: number; boss: number; bonus: number; before: number }) {
    this.setHud(false);
    const o = this.add.container(0, 0).setDepth(100);
    this.overlay = o;
    const dim = this.add.rectangle(W / 2, H / 2, W, H, COLOR.bg, 0.94).setInteractive();
    o.add(dim);
    const x0 = MX * 2, w = W - MX * 4;
    const gap = px(10);
    // 아래에서 위로: 버튼 → 빌드 칩 → (그래프) → 보상 → 통계 → 도달 웨이브 → 헤더
    const bb = H - px(26) - px(24);
    const btn2Top = bb - px(24), btn1Top = btn2Top - gap - px(56);
    const buildH = px(36);
    const rewardH = px(96), statH = px(50), waveH = px(100), headH = px(80);
    const top = px(36);
    const needed = headH + waveH + gap + statH * 2 + gap + rewardH + gap + buildH + gap;
    const graphH = px(14) + px(40) + px(8);
    const freeH = btn1Top - gap - top - needed;
    const showGraph = freeH >= graphH;
    const extra = Math.max(0, freeH - (showGraph ? graphH : 0));
    let y = top + Math.min(extra, px(30));

    o.add(label(this, x0, y, 'MISSION REPORT', px(10), COLOR.red));
    o.add(label(this, W - x0, y, `RUN #${save.runs}`, px(10), COLOR.dim, 'right'));
    o.add(txt(this, x0, y + px(28), this.daily ? L(`일일 작전 · ${this.mod!.name}`, `Daily op · ${this.mod!.name}`) : L('기지 파괴', 'Base destroyed'), px(26), { align: 'left', weight: 600 }));
    const mm = Math.floor(this.runTime / 60), ss = Math.floor(this.runTime % 60);
    o.add(txt(this, x0, y + px(56), `W${reached} · ${mm}:${String(ss).padStart(2, '0')} · ${L('처치', 'kills')} ${this.kills}`, px(12), { align: 'left', color: COLOR.dim, weight: 500 }));
    y += headH;

    // 도달 웨이브 패널
    const pg = this.add.graphics();
    panel(pg, W / 2, y + waveH / 2, w, waveH);
    o.add(pg);
    o.add(label(this, x0 + px(20), y + px(18), 'WAVE REACHED', px(10), COLOR.dim));
    o.add(num(this, x0 + px(20), y + waveH - px(34), `${reached}`, px(54), COLOR.text, 'left'));
    const best = this.daily ? save.daily.best : save.best;
    o.add(txt(this, W - x0 - px(20), y + px(22), `${L('최고 기록', 'Best')} ${best}`, px(12), { align: 'right', color: COLOR.dim, weight: 500 }));
    const bw = px(120), bx = W - x0 - px(20) - bw, byy = y + px(42);
    pg.fillStyle(COLOR.surf2, 1).fillRect(bx, byy, bw, 4);
    pg.fillStyle(COLOR.cyan, 1).fillRect(bx, byy, bw * Math.min(1, reached / Math.max(1, best)), 4);
    pg.fillStyle(COLOR.body, 1).fillRect(bx + bw - 2, byy - 3, 2, 10);
    o.add(label(this, W - x0 - px(20), y + px(62), newBest ? (this.daily ? L('오늘의 최고 기록', "TODAY'S BEST") : L('신기록', 'NEW RECORD')) : `${L('기록까지', 'TO RECORD')} ${Math.max(0, best - reached)} ${L('웨이브', 'WAVES')}`, px(10), newBest ? COLOR.legend : COLOR.dim, 'right'));
    if (newBest) {
      const nb = this.add.image(W - x0 - px(60), y + px(62), 'glow').setTint(COLOR.legend).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.25).setScale(0.6);
      o.add(nb);
      this.tweens.add({ targets: nb, alpha: 0.45, duration: 600, yoyo: true, repeat: -1 });
    }
    y += waveH + gap;

    // 2×2 통계
    const gw = w / 2;
    const gg = this.add.graphics();
    gg.lineStyle(2, COLOR.line, 1);
    const stats: [string, string, number][] = [
      [L('처치', 'Kills'), `${this.kills}`, COLOR.text],
      [L('생존 시간', 'Survived'), `${mm}:${String(ss).padStart(2, '0')}`, COLOR.text],
      [L('최대 단일 피해', 'Max hit'), `${Math.round(this.maxHit)}`, COLOR.amber],
      [L('보스 처치 · 최대 콤보', 'Bosses · best combo'), `${this.bossKills} · x${this.comboBest}`, COLOR.text],
    ];
    stats.forEach(([kk, v, col], i) => {
      const cx = x0 + (i % 2) * gw, cy = y + Math.floor(i / 2) * statH;
      gg.strokeRect(cx, cy, gw, statH);
      o.add(txt(this, cx + px(14), cy + px(14), kk, px(11), { align: 'left', color: COLOR.dim, weight: 500 }));
      o.add(num(this, cx + px(14), cy + statH - px(15), v, px(17), col, 'left'));
    });
    o.add(gg);
    y += statH * 2 + gap;

    // 보상
    const rg = this.add.graphics();
    panel(rg, W / 2, y + rewardH / 2, w, rewardH, { fill: 0x071419, stroke: 0x1e7f92 });
    o.add(rg);
    o.add(label(this, x0 + px(16), y + px(18), 'REWARD', px(10), COLOR.cyan));
    o.add(num(this, W - x0 - px(16), y + px(18), `◇ +${gems}`, px(24), COLOR.cyan, 'right'));
    const lines: [string, string, number][] = [[L('웨이브 보상', 'Wave reward'), `+${br.base}`, COLOR.text], [L('보스 처치', 'Boss kills'), `+${br.boss}`, COLOR.text]];
    if (br.bonus) lines.push([this.daily ? L('일일 작전 보너스', 'Daily op bonus') : L('보석 탐지기', 'Gem finder'), `+${br.bonus}`, COLOR.green]);
    lines.forEach(([kk, v, col], i) => {
      const ly = y + px(38) + i * px(14);
      o.add(txt(this, x0 + px(16), ly, kk, px(11), { align: 'left', color: COLOR.body, weight: 500 }));
      o.add(num(this, W - x0 - px(16), ly, v, px(11), col, 'right'));
    });
    o.add(txt(this, W - x0 - px(16), y + rewardH - px(14), `${L('보유', 'Balance')} ${br.before} ▸ ${save.gems}`, px(11), { align: 'right', color: COLOR.dim, weight: 500 }));
    y += rewardH + gap;

    // 웨이브별 받은 피해 그래프 (공간이 있을 때만)
    if (showGraph) {
      const gH = px(40);
      const waves = this.dmgByWave.slice(1, this.wave + 1);
      const maxD = Math.max(1, ...waves);
      o.add(label(this, x0, y, 'DAMAGE TAKEN / WAVE', px(9), COLOR.dim));
      const dg = this.add.graphics();
      const slot = w / Math.max(1, waves.length), barW = Math.max(2, Math.min(px(10), slot - 2));
      waves.forEach((v, i) => {
        const bh = Math.max(2, gH * (v / maxD));
        dg.fillStyle(isBossWave(i + 1) ? COLOR.bossText2 : COLOR.red, isBossWave(i + 1) ? 1 : 0.75).fillRect(x0 + i * slot, y + px(14) + gH - bh, barW, bh);
      });
      dg.fillStyle(COLOR.line, 1).fillRect(x0, y + px(14) + gH + 2, w, 2);
      o.add(dg);
      y += graphH + gap;
    }

    // 최종 빌드 칩
    o.add(label(this, x0, y, 'FINAL BUILD', px(9), COLOR.dim));
    let cx = x0;
    const cy2 = y + px(20);
    ABILITIES.filter(a => this.stats.lv[a] > 0).forEach(a => {
      const card = CARDS.find(c => c.ability === a)!;
      const ch = chip(this, 0, cy2, `${RARITY_GLYPH[card.rarity]} ${card.name} ${this.stats.lv[a]}`, RARITY[card.rarity].color, { font: 'kr' });
      if (cx + ch.chipWidth > W - x0) { ch.destroy(); return; }
      ch.setX(cx + ch.chipWidth / 2); cx += ch.chipWidth + px(6);
      o.add(ch);
    });

    // 버튼
    const affordable = LAB.filter(u => (save.lab[u.id] ?? 0) < u.max && save.gems >= u.cost(save.lab[u.id] ?? 0)).length;
    o.add(button(this, W / 2, btn1Top + px(28), w, px(56), L('재출격', 'Sortie again'), () => this.scene.restart({ daily: this.daily }), { kind: 'primary', left: true, size: px(17), icon: refreshIcon }));
    o.add(button(this, x0 + (w / 2 - px(5)) / 2, bb, w / 2 - px(5), px(48), `${L('연구소', 'Lab')}${affordable ? `  ·  ${affordable}` : ''}`, () => this.scene.start('Lab'), { kind: 'secondary', size: px(14) }));
    o.add(button(this, W - x0 - (w / 2 - px(5)) / 2, bb, w / 2 - px(5), px(48), L('메인으로', 'Main menu'), () => this.scene.start('Menu'), { kind: 'ghost', size: px(14) }));
    if (!save.tips.lab) { save.tips.lab = true; persist(); this.time.delayedCall(600, () => this.toast(L('보석으로 연구소에서 영구 강화할 수 있습니다', 'Spend gems in the Lab for permanent upgrades'), COLOR.green)); }
    o.setAlpha(0);
    this.tweens.add({ targets: o, alpha: 1, duration: 300 });
  }
}
