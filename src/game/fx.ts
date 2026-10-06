import Phaser from 'phaser';
import { COLOR, W, H } from '../config';
import { save } from '../save';

// 전투 이펙트 모음. 전부 도형·파티클·글로우로 그린다(비트맵 없음).
// 레이어: 10 필드 < 20 적 < 30 탄환 < 40 피격·처치 < 50 숫자 < 60 화면 연출 < 70 HUD
type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;

interface Ring { x: number; y: number; r0: number; r1: number; color: number; t: number; max: number; w: number; alpha: number; }
interface Bolt { pts: number[]; t: number; max: number; color: number; }
interface Line { x1: number; y1: number; x2: number; y2: number; color: number; t: number; max: number; w: number; }
interface Flash { x: number; y: number; r: number; color: number; t: number; max: number; }

export class FX {
  private scene: Phaser.Scene;
  private g: Phaser.GameObjects.Graphics;      // 피격·처치 레이어 (ADD)
  private emitters = new Map<string, Emitter>();
  private rings: Ring[] = [];
  private bolts: Bolt[] = [];
  private lines: Line[] = [];
  private flashes: Flash[] = [];
  private frostEm?: Emitter;
  private vignette: Phaser.GameObjects.Image;
  private bursts = 0; // 동시 버스트 수 (상한 넘으면 축소형)
  reduced = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.reduced = !!save.reducedFx;
    this.g = scene.add.graphics().setDepth(40).setBlendMode(Phaser.BlendModes.ADD);
    this.vignette = scene.add.image(W / 2, H / 2, 'vignette').setTint(COLOR.red).setAlpha(0).setDepth(60);
    this.vignette.setDisplaySize(W * 1.02, H * 1.02);
  }

  // ───────── 파티클 ─────────

  private em(kind: string, color: number, tex: string, cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig, depth = 40): Emitter {
    const key = `${kind}:${color}`;
    let e = this.emitters.get(key);
    if (!e) {
      e = this.scene.add.particles(0, 0, tex, { ...cfg, tint: color, blendMode: 'ADD', emitting: false }).setDepth(depth);
      this.emitters.set(key, e);
    }
    return e;
  }

  /** 피격 스파크: 짧은 선 파편 */
  spark(x: number, y: number, color: number, n = 4, angle?: number) {
    const e = this.em('spark', color, 'shard', {
      speed: { min: 90, max: 260 }, lifespan: { min: 120, max: 300 },
      scale: { start: 0.55, end: 0.1 }, alpha: { start: 1, end: 0 }, rotate: { onEmit: (p: any) => Phaser.Math.RadToDeg(Math.atan2(p.velocityY, p.velocityX)) },
    });
    if (angle !== undefined) { e.setParticleSpeed(0); }
    e.explode(this.reduced ? Math.ceil(n / 2) : n, x, y);
  }

  /** 점 파티클 (연기·독·냉기 모트) */
  dots(x: number, y: number, color: number, n: number, speed = 60, life = 400, scale = 0.35, gravityY = 0) {
    const e = this.em(`dots${speed}:${life}:${gravityY}`, color, 'dot', {
      speed: { min: speed * 0.3, max: speed }, lifespan: { min: life * 0.6, max: life },
      scale: { start: scale, end: 0 }, alpha: { start: 0.9, end: 0 }, gravityY,
    });
    e.explode(n, x, y);
  }

  /** 처치 폭발: 중심 섬광 + 파편 + 점 + 확장 링. 동시 3개 이상이면 축소형 */
  kill(x: number, y: number, color: number, r: number) {
    const big = this.bursts < 3 && !this.reduced;
    this.bursts++;
    this.scene.time.delayedCall(260, () => { this.bursts = Math.max(0, this.bursts - 1); });
    const shards = this.em('shards', color, 'shard', {
      speed: { min: 120, max: 320 }, lifespan: { min: 300, max: 450 },
      scale: { start: 0.8, end: 0.2 }, alpha: { start: 1, end: 0 },
      rotate: { onEmit: (p: any) => Phaser.Math.RadToDeg(Math.atan2(p.velocityY, p.velocityX)) },
    });
    shards.explode(big ? 8 : 4, x, y);
    this.dots(x, y, color, big ? 10 : 6, 220, 420, 0.5);
    this.flashes.push({ x, y, r: r * 0.9, color: COLOR.text, t: 0, max: 0.06 });
    if (big) this.ring(x, y, r * 0.6, r * 2.2, color, 0.28, 2, 0.9);
  }

  /** 보스 격파: 큰 폭발 (상한 예외) */
  bossKill(x: number, y: number, color: number) {
    const shards = this.em('shards', color, 'shard', {
      speed: { min: 150, max: 560 }, lifespan: { min: 500, max: 1000 },
      scale: { start: 1.1, end: 0.2 }, alpha: { start: 1, end: 0 },
      rotate: { onEmit: (p: any) => Phaser.Math.RadToDeg(Math.atan2(p.velocityY, p.velocityX)) },
    });
    shards.explode(this.reduced ? 12 : 28, x, y);
    this.dots(x, y, color, this.reduced ? 20 : 48, 520, 1000, 1);
    this.dots(x, y, COLOR.text, this.reduced ? 10 : 24, 400, 700, 0.8);
    this.flashes.push({ x, y, r: 90, color: COLOR.text, t: 0, max: 0.09 });
    this.ring(x, y, 40, 300, color, 0.6, 3, 1);
    this.ring(x, y, 20, 220, COLOR.text, 0.5, 2, 0.6);
    this.shake(400, 0.012);
    this.flash(200, color);
  }

  /** 치명타 임팩트: 4점 플레어 + 이중 링 (주황) */
  crit(x: number, y: number) {
    const f = this.scene.add.image(x, y, 'flare').setTint(COLOR.amber).setBlendMode(Phaser.BlendModes.ADD).setDepth(41).setScale(0.3).setAlpha(1);
    this.scene.tweens.add({ targets: f, scale: 1.1, alpha: 0, duration: 180, ease: 'Cubic.Out', onComplete: () => f.destroy() });
    this.ring(x, y, 6, 30, COLOR.amber, 0.22, 2, 0.9);
    this.ring(x, y, 10, 44, COLOR.amber, 0.3, 1, 0.5);
    this.spark(x, y, COLOR.amber, 5);
  }

  /** 확장 링 */
  ring(x: number, y: number, r0: number, r1: number, color: number, sec: number, w = 2, alpha = 0.9) {
    this.rings.push({ x, y, r0, r1, color, t: 0, max: sec, w, alpha });
  }

  /** 충격파: 동심 3겹 */
  shock(x: number, y: number, r: number, color: number) {
    this.ring(x, y, r * 0.2, r, color, 0.38, 3, 1);
    this.ring(x, y, r * 0.1, r * 0.85, color, 0.46, 2, 0.5);
    if (!this.reduced) this.ring(x, y, r * 0.05, r * 0.7, color, 0.54, 1, 0.25);
    this.dots(x, y, color, this.reduced ? 8 : 18, r * 2.2, 500, 0.5);
    this.shake(150, 0.004);
  }

  /** 폭발 (스플래시·미사일) */
  explosion(x: number, y: number, r: number, color: number, big: boolean) {
    this.ring(x, y, r * 0.3, r, color, big ? 0.35 : 0.22, big ? 3 : 2, 0.9);
    if (big) {
      this.flashes.push({ x, y, r: r * 0.5, color: COLOR.text, t: 0, max: 0.07 });
      this.dots(x, y, color, this.reduced ? 8 : 16, r * 3, 520, 0.7);
      this.spark(x, y, color, 6);
    } else this.dots(x, y, color, 5, r * 2, 260, 0.4);
  }

  /** 연쇄 번개: 지그재그 + 글로우 */
  bolt(pts: number[], color = COLOR.epic) {
    this.bolts.push({ pts, t: 0, max: 0.16, color });
    if (!this.reduced) this.spark(pts[pts.length - 2], pts[pts.length - 1], color, 2);
  }

  /** 총구 섬광 */
  muzzle(x: number, y: number, a: number, color: number) {
    if (this.reduced) return;
    this.flashes.push({ x, y, r: 7, color, t: 0, max: 0.05 });
    const len = 14;
    for (let i = -1; i <= 1; i++) {
      const b = a + i * 0.5;
      this.lines.push({ x1: x, y1: y, x2: x + Math.cos(b) * len, y2: y + Math.sin(b) * len, color, t: 0, max: 0.06, w: 2 });
    }
  }

  /** 짧은 수명 선 (잔상·궤적) */
  line(x1: number, y1: number, x2: number, y2: number, color: number, sec: number, w = 2) {
    this.lines.push({ x1, y1, x2, y2, color, t: 0, max: sec, w });
  }

  /** 기지 피격: 흰 섬광 + 파편 */
  baseHit(x: number, y: number, dmg: number) {
    this.flashes.push({ x, y, r: 46, color: COLOR.text, t: 0, max: 0.06 });
    const shards = this.em('shards', COLOR.cyan, 'shard', {
      speed: { min: 80, max: 240 }, lifespan: { min: 250, max: 400 }, scale: { start: 0.7, end: 0.2 }, alpha: { start: 1, end: 0 },
      rotate: { onEmit: (p: any) => Phaser.Math.RadToDeg(Math.atan2(p.velocityY, p.velocityX)) },
    });
    shards.explode(this.reduced ? 3 : 6, x, y);
    this.ring(x, y, 40, 70, COLOR.red, 0.18, 2, 0.8);
    this.shake(120, 0.004 + Math.min(0.008, dmg / 500));
  }

  /** 적 등장: 수평 스캔 선 */
  materialize(x: number, y: number, r: number, color: number) {
    if (this.reduced) return;
    this.line(x - r * 1.6, y - r * 0.4, x + r * 1.6, y - r * 0.4, color, 0.2, 1);
    this.line(x - r * 1.3, y + r * 0.3, x + r * 1.3, y + r * 0.3, color, 0.26, 1);
  }

  /** 냉기장 안 떠다니는 결정 */
  frostField(x: number, y: number, r: number) {
    if (this.frostEm) this.frostEm.destroy();
    if (this.reduced) return;
    this.frostEm = this.scene.add.particles(x, y, 'crystal', {
      emitZone: { type: 'random', source: new Phaser.Geom.Circle(0, 0, r * 0.9) } as any,
      lifespan: { min: 1800, max: 3200 }, speedY: { min: -14, max: -4 }, speedX: { min: -5, max: 5 },
      scale: { min: 0.25, max: 0.55 }, alpha: { start: 0.5, end: 0 },
      rotate: { min: 0, max: 360 }, tint: COLOR.frost, blendMode: 'ADD', frequency: 260, maxParticles: 12,
    }).setDepth(11);
  }

  /** 미사일 연기 궤적 */
  smoke(x: number, y: number, color: number) {
    this.dots(x, y, color, 1, 10, 300, 0.45);
  }

  /** 붉은 비네팅 (보스·위험). alpha 0~0.45 */
  setVignette(alpha: number, color = COLOR.red) {
    this.vignette.setTint(color).setAlpha(Phaser.Math.Clamp(alpha, 0, 0.45));
  }

  shake(ms: number, intensity: number) {
    if (this.reduced) return;
    this.scene.cameras.main.shake(ms, intensity);
  }

  flash(ms: number, color: number) {
    if (this.reduced) return;
    const c = Phaser.Display.Color.IntegerToColor(color);
    this.scene.cameras.main.flash(ms, c.red, c.green, c.blue);
  }

  // ───────── 매 프레임 ─────────

  update(dt: number) {
    const g = this.g;
    g.clear();

    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter(r => r.t < r.max);
    for (const r of this.rings) {
      const k = r.t / r.max, e = 1 - Math.pow(1 - k, 3);
      const rad = r.r0 + (r.r1 - r.r0) * e;
      g.lineStyle(r.w, r.color, r.alpha * (1 - k));
      g.strokeCircle(r.x, r.y, rad);
    }

    for (const f of this.flashes) f.t += dt;
    this.flashes = this.flashes.filter(f => f.t < f.max);
    for (const f of this.flashes) {
      const k = 1 - f.t / f.max;
      g.fillStyle(f.color, 0.9 * k);
      g.fillCircle(f.x, f.y, f.r * (0.6 + 0.4 * k));
    }

    for (const l of this.lines) l.t += dt;
    this.lines = this.lines.filter(l => l.t < l.max);
    for (const l of this.lines) {
      const k = 1 - l.t / l.max;
      g.lineStyle(l.w, l.color, 0.9 * k);
      g.lineBetween(l.x1, l.y1, l.x2, l.y2);
    }

    for (const b of this.bolts) b.t += dt;
    this.bolts = this.bolts.filter(b => b.t < b.max);
    for (const b of this.bolts) {
      const a = 1 - b.t / b.max;
      const pts = toPoints(b.pts);
      g.lineStyle(9, b.color, 0.18 * a); g.strokePoints(pts);
      g.lineStyle(4, b.color, 0.55 * a); g.strokePoints(pts);
      g.lineStyle(1.5, 0xddf8ff, a); g.strokePoints(pts);
    }
  }

  destroy() {
    this.frostEm?.destroy();
  }
}

export function toPoints(pts: number[]) {
  const out: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < pts.length; i += 2) out.push(new Phaser.Math.Vector2(pts[i], pts[i + 1]));
  return out;
}
