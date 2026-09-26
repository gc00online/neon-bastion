import Phaser from 'phaser';
import { asset } from '../ui/dom';
import { applySettings, loadSave } from '../save';

// 모든 그래픽을 코드로 생성한다(네온 글로우 포함). 흰색으로 그려두고 게임에서 색을 입힌다.
export const SHAPE_R = 46; // 적 도형 텍스처의 반지름(px)
export const RING_R = 120;
export const CORE_TEX_R = 70;

type Ctx = CanvasRenderingContext2D;

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    this.load.image('arena', asset('arena.webp'));
    for (const key of ['pot', 'rice', 'dumpling', 'spirit']) this.load.image(key, asset(`${key}.png`));
  }

  create() {
    document.getElementById('loading')?.remove();
    const poly = (sides: number, rot = -Math.PI / 2) => (ctx: Ctx, s: number) => {
      ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        const a = rot + (i / sides) * Math.PI * 2;
        const x = s / 2 + Math.cos(a) * SHAPE_R;
        const y = s / 2 + Math.sin(a) * SHAPE_R;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
    };
    const shape = (key: string, path: (ctx: Ctx, s: number) => void) => this.tex(key, 128, 128, (ctx, s) => {
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 14;
      path(ctx, s);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fill();
      ctx.lineWidth = 7;
      ctx.strokeStyle = '#fff';
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.shadowBlur = 0;
      // 가운데 작은 눈
      ctx.beginPath();
      ctx.arc(s / 2, s / 2, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    });

    shape('e_circle', (ctx, s) => { ctx.beginPath(); ctx.arc(s / 2, s / 2, SHAPE_R, 0, Math.PI * 2); });
    shape('e_tri', poly(3));
    shape('e_square', poly(4, Math.PI / 4));
    shape('e_diamond', (ctx, s) => {
      const c = s / 2;
      ctx.beginPath();
      ctx.moveTo(c, c - SHAPE_R); ctx.lineTo(c + SHAPE_R * 0.7, c); ctx.lineTo(c, c + SHAPE_R); ctx.lineTo(c - SHAPE_R * 0.7, c);
      ctx.closePath();
    });
    shape('e_penta', poly(5));
    shape('e_hex', poly(6, 0));
    shape('e_octa', poly(8, Math.PI / 8));
    shape('e_plus', (ctx, s) => {
      const c = s / 2, a = SHAPE_R, b = SHAPE_R * 0.36;
      ctx.beginPath();
      ctx.moveTo(c - b, c - a); ctx.lineTo(c + b, c - a); ctx.lineTo(c + b, c - b); ctx.lineTo(c + a, c - b);
      ctx.lineTo(c + a, c + b); ctx.lineTo(c + b, c + b); ctx.lineTo(c + b, c + a); ctx.lineTo(c - b, c + a);
      ctx.lineTo(c - b, c + b); ctx.lineTo(c - a, c + b); ctx.lineTo(c - a, c - b); ctx.lineTo(c - b, c - b);
      ctx.closePath();
    });
    shape('e_star', (ctx, s) => {
      const c = s / 2;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const r = i % 2 === 0 ? SHAPE_R : SHAPE_R * 0.42;
        const a = -Math.PI / 2 + (i / 8) * Math.PI * 2;
        if (i === 0) ctx.moveTo(c + Math.cos(a) * r, c + Math.sin(a) * r); else ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
      }
      ctx.closePath();
    });

    this.tex('dot', 32, 32, (ctx, s) => {
      const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.8)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    });

    this.tex('glow', 256, 256, (ctx, s) => {
      const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(0.25, 'rgba(255,255,255,0.35)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    });

    this.tex('bullet', 48, 48, (ctx, s) => {
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(s / 2, s / 2, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    });

    this.tex('ring', 256, 256, (ctx, s) => {
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(s / 2, s / 2, RING_R, 0, Math.PI * 2);
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
    });

    this.tex('core', 192, 192, (ctx, s) => {
      const c = s / 2;
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 16;
      ctx.lineWidth = 7;
      ctx.strokeStyle = '#fff';
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const x = c + Math.cos(a) * CORE_TEX_R, y = c + Math.sin(a) * CORE_TEX_R;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(c, c, 38, 0, Math.PI * 2);
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(c, c, 18, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    });

    this.tex('barrel', 192, 192, (ctx, s) => {
      const c = s / 2;
      ctx.strokeStyle = '#754824'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(c, c + 12); ctx.lineTo(c, 4); ctx.stroke();
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i % 2 ? '#e9b759' : '#f6cc79';
        ctx.beginPath(); ctx.roundRect(c - 15, 14 + i * 19, 30, 15, 5); ctx.fill();
        ctx.fillStyle = '#af7136'; ctx.fillRect(c - 8, 19 + i * 19, 3, 3);
      }
    });

    this.tex('blade', 96, 96, (ctx, s) => {
      const c = s / 2;
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(c, 6); ctx.lineTo(c + 14, c); ctx.lineTo(c, s - 6); ctx.lineTo(c - 14, c);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
    });

    this.tex('missile', 64, 64, (ctx) => {
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(58, 32); ctx.lineTo(10, 16); ctx.lineTo(20, 32); ctx.lineTo(10, 48);
      ctx.closePath();
      ctx.fillStyle = '#fff';
      ctx.fill();
    });

    loadSave().then(() => {
      applySettings();
      this.scene.start(new URLSearchParams(location.search).has('bot') ? 'Game' : 'Menu');
    });
  }

  private tex(key: string, w: number, h: number, draw: (ctx: Ctx, s: number) => void) {
    const tex = this.textures.createCanvas(key, w, h)!;
    draw(tex.getContext(), w);
    tex.refresh();
  }
}
