import Phaser from 'phaser';
import { asset } from '../ui/dom';
import { applySettings, loadSave } from '../save';

// 작은 이펙트는 고정된 캔버스 텍스처로 만들어 모바일에서도 재사용한다.
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

    this.tex('sauce', 48, 48, (ctx, s) => {
      const c = s / 2;
      ctx.shadowColor = '#ff9a36'; ctx.shadowBlur = 9;
      ctx.beginPath(); ctx.ellipse(c, c, 12, 9, -Math.PI / 5, 0, Math.PI * 2);
      ctx.fillStyle = '#9e2c1c'; ctx.fill();
      ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.ellipse(c - 3, c - 3, 6, 3, -Math.PI / 5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffba62'; ctx.fill();
      ctx.beginPath(); ctx.arc(c + 5, c + 1, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#f27835'; ctx.fill();
    });

    this.tex('sauce-stain', 96, 64, (ctx) => {
      ctx.fillStyle = 'rgba(86,24,17,.34)';
      ctx.beginPath(); ctx.ellipse(48, 37, 35, 14, -.18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(198,58,29,.76)';
      ctx.beginPath(); ctx.ellipse(46, 31, 29, 12, -.18, 0, Math.PI * 2); ctx.fill();
      for (const [x, y, r] of [[13, 32, 4], [76, 20, 3], [69, 47, 2], [31, 16, 3]]) {
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,169,77,.65)';
      ctx.beginPath(); ctx.ellipse(37, 26, 12, 3, -.18, 0, Math.PI * 2); ctx.fill();
    });

    this.tex('steam', 96, 96, (ctx, s) => {
      const g = ctx.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(255,247,222,.72)');
      g.addColorStop(.5, 'rgba(255,241,214,.3)');
      g.addColorStop(1, 'rgba(255,241,214,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    });

    this.tex('steam-wisp', 96, 160, (ctx) => {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.shadowColor = '#ffe7bd'; ctx.shadowBlur = 13;
      ctx.strokeStyle = 'rgba(255,246,225,.74)'; ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(48, 150);
      ctx.bezierCurveTo(23, 129, 68, 119, 48, 96);
      ctx.bezierCurveTo(27, 73, 66, 57, 51, 35);
      ctx.bezierCurveTo(41, 20, 48, 14, 58, 8);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,241,.42)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(51, 146); ctx.bezierCurveTo(33, 126, 60, 116, 47, 98); ctx.stroke();
    });

    this.tex('sparkle', 32, 32, (ctx) => {
      ctx.shadowColor = '#ffd27a'; ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(16, 1); ctx.quadraticCurveTo(19, 12, 31, 16);
      ctx.quadraticCurveTo(19, 19, 16, 31);
      ctx.quadraticCurveTo(13, 19, 1, 16);
      ctx.quadraticCurveTo(13, 13, 16, 1);
      ctx.fillStyle = '#fff1bd'; ctx.fill();
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
      ctx.shadowColor = '#ffae47'; ctx.shadowBlur = 9;
      ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.strokeStyle = '#6b371e';
      ctx.beginPath(); ctx.moveTo(c, 7); ctx.lineTo(c, s - 5); ctx.stroke();
      ctx.shadowBlur = 0;
      for (const y of [24, 43, 62]) {
        ctx.fillStyle = '#f4c76f'; ctx.strokeStyle = '#9c572e'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(c - 16, y, 32, 16, 6); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#bd5530'; ctx.beginPath(); ctx.ellipse(c + 4, y + 6, 7, 2, .2, 0, Math.PI * 2); ctx.fill();
      }
    });

    this.tex('missile', 64, 64, (ctx) => {
      ctx.shadowColor = '#ffb14d'; ctx.shadowBlur = 7;
      ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.strokeStyle = '#75411d';
      ctx.beginPath(); ctx.moveTo(8, 32); ctx.lineTo(59, 32); ctx.stroke();
      ctx.shadowBlur = 0;
      for (const x of [21, 38]) {
        ctx.fillStyle = '#eeb769'; ctx.strokeStyle = '#92502c'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(x - 8, 19, 16, 26, 5); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#c34e2b'; ctx.beginPath(); ctx.ellipse(x, 31, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
      }
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
