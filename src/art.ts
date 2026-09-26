// 개발용: 앱 아이콘 / 스플래시 / 스토어 그래픽을 코드로 그려서 프로젝트 폴더에 저장한다.
// 개발 서버에서 브라우저 콘솔로 makeStoreArt() 실행 → assets/, store/ 폴더에 PNG 생성
type Ctx = CanvasRenderingContext2D;

const C = { bg: '#070912', cyan: '#00f5ff', pink: '#ff2e88', yellow: '#ffd166', purple: '#b388ff', green: '#06d6a0', red: '#ff4d6d' };

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function bg(ctx: Ctx, w: number, h: number, grid = true) {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
  g.addColorStop(0, '#15204a');
  g.addColorStop(0.55, '#0a0e22');
  g.addColorStop(1, C.bg);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  if (!grid) return;
  const step = Math.round(Math.min(w, h) / 12);
  ctx.strokeStyle = 'rgba(40,52,110,0.35)';
  ctx.lineWidth = Math.max(1, step / 40);
  for (let x = (w / 2) % step; x < w; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = (h / 2) % step; y < h; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
}

function poly(ctx: Ctx, x: number, y: number, r: number, sides: number, rot: number) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    if (i === 0) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

function glowStroke(ctx: Ctx, color: string, width: number, blur: number) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.shadowBlur = blur;
  ctx.stroke();
  ctx.shadowBlur = blur * 0.4;
  ctx.stroke();
  ctx.restore();
}

// 기지(육각형 코어) 로고. r = 육각형 반지름
function core(ctx: Ctx, x: number, y: number, r: number) {
  const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 2.2);
  halo.addColorStop(0, 'rgba(0,245,255,0.35)');
  halo.addColorStop(1, 'rgba(0,245,255,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);

  poly(ctx, x, y, r, 6, 0);
  ctx.fillStyle = 'rgba(0,245,255,0.10)';
  ctx.fill();
  glowStroke(ctx, C.cyan, r * 0.11, r * 0.35);

  ctx.beginPath();
  ctx.arc(x, y, r * 0.54, 0, Math.PI * 2);
  glowStroke(ctx, C.cyan, r * 0.075, r * 0.25);

  // 포신
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#bffcff';
  ctx.shadowColor = C.cyan;
  ctx.shadowBlur = r * 0.3;
  ctx.fillRect(-r * 0.12, -r * 1.25, r * 0.24, r * 0.9);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(x, y, r * 0.26, 0, Math.PI * 2);
  ctx.fillStyle = '#e8feff';
  ctx.shadowColor = C.cyan;
  ctx.shadowBlur = r * 0.4;
  ctx.fill();
  ctx.shadowBlur = 0;
}

function enemy(ctx: Ctx, x: number, y: number, r: number, color: string, sides: number, rot = -Math.PI / 2) {
  if (sides === 0) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); } else poly(ctx, x, y, r, sides, rot);
  ctx.fillStyle = color + '33';
  ctx.fill();
  glowStroke(ctx, color, r * 0.16, r * 0.6);
}

function bolt(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, w: number) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.save();
  ctx.lineCap = 'round';
  glowStroke(ctx, '#bffcff', w, w * 4);
  ctx.restore();
}

export function drawIcon(size = 1024, opts: { transparent?: boolean; scale?: number } = {}) {
  const c = canvas(size, size);
  const ctx = c.getContext('2d')!;
  if (!opts.transparent) bg(ctx, size, size);
  const k = (opts.scale ?? 1) * size / 1024;
  const cx = size / 2, cy = size / 2;
  core(ctx, cx, cy, 250 * k);
  // 포신 방향(오른쪽 위)으로 날아가는 탄환과 적들
  bolt(ctx, cx + 250 * k, cy - 250 * k, cx + 300 * k, cy - 300 * k, 16 * k);
  enemy(ctx, cx + 360 * k, cy - 360 * k, 50 * k, C.pink, 0);
  enemy(ctx, cx - 350 * k, cy - 320 * k, 44 * k, C.yellow, 3);
  enemy(ctx, cx - 330 * k, cy + 330 * k, 48 * k, C.purple, 4, Math.PI / 4);
  enemy(ctx, cx + 340 * k, cy + 320 * k, 40 * k, C.green, 0);
  return c;
}

function title(ctx: Ctx, x: number, y: number, size: number) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${size}px "Pretendard", "Apple SD Gothic Neo", system-ui, sans-serif`;
  ctx.shadowBlur = size * 0.3;
  ctx.shadowColor = C.cyan;
  ctx.fillStyle = C.cyan;
  ctx.fillText('NEON', x, y - size * 0.55);
  ctx.shadowColor = C.pink;
  ctx.fillStyle = C.pink;
  ctx.fillText('BASTION', x, y + size * 0.45);
  ctx.restore();
}

export function drawSplash(size = 2732) {
  const c = canvas(size, size);
  const ctx = c.getContext('2d')!;
  bg(ctx, size, size, false);
  core(ctx, size / 2, size / 2 - size * 0.06, size * 0.07);
  title(ctx, size / 2, size / 2 + size * 0.12, size * 0.045);
  return c;
}

export function drawFeature() {
  const w = 1024, h = 500;
  const c = canvas(w, h);
  const ctx = c.getContext('2d')!;
  bg(ctx, w, h);
  core(ctx, 760, 250, 110);
  bolt(ctx, 872, 138, 900, 110, 8);
  enemy(ctx, 930, 80, 24, C.pink, 0);
  enemy(ctx, 600, 90, 22, C.yellow, 3);
  enemy(ctx, 620, 420, 26, C.purple, 4, Math.PI / 4);
  enemy(ctx, 960, 400, 20, C.green, 0);
  title(ctx, 300, 215, 96);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = `600 30px "Pretendard", "Apple SD Gothic Neo", system-ui, sans-serif`;
  ctx.fillStyle = '#c7cde0';
  ctx.fillText('로그라이크 디펜스 · 광고 없음', 300, 380);
  ctx.restore();
  return c;
}

export async function saveCanvas(c: HTMLCanvasElement, name: string) {
  const res = await fetch(`/__save?name=${encodeURIComponent(name)}`, { method: 'POST', body: c.toDataURL('image/png') });
  return res.ok;
}

export async function makeStoreArt() {
  const bgOnly = canvas(1024, 1024);
  bg(bgOnly.getContext('2d')!, 1024, 1024);
  return Promise.all([
    saveCanvas(drawIcon(1024), 'assets/icon-only.png'),
    // 안드로이드 적응형 아이콘: 전경은 안쪽 안전 영역에 들어가도록 축소
    saveCanvas(drawIcon(1024, { transparent: true, scale: 0.62 }), 'assets/icon-foreground.png'),
    saveCanvas(bgOnly, 'assets/icon-background.png'),
    saveCanvas(drawSplash(), 'assets/splash.png'),
    saveCanvas(drawSplash(), 'assets/splash-dark.png'),
    saveCanvas(drawFeature(), 'store/google-feature-graphic-1024x500.png'),
    saveCanvas(drawIcon(512), 'store/google-icon-512.png'),
  ]);
}

// ───────── 스토어 스크린샷: 실제 게임 화면 + 상단 문구 합성 ─────────

export function snapshot(game: any): Promise<HTMLImageElement> {
  return new Promise(resolve => {
    game.renderer.snapshot((img: HTMLImageElement) => resolve(img));
    (window as any).pump(1);
  });
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function compose(img: HTMLImageElement, caption: string, tw: number, th: number, accent = C.cyan) {
  const c = canvas(tw, th);
  const ctx = c.getContext('2d')!;
  bg(ctx, tw, th);
  const capH = th * 0.155;
  const lines = caption.split('\n');
  const fs = tw * 0.068;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${fs}px "Pretendard", "Apple SD Gothic Neo", system-ui, sans-serif`;
  lines.forEach((ln, i) => {
    const y = capH * 0.55 + (i - (lines.length - 1) / 2) * fs * 1.25;
    ctx.shadowColor = accent;
    ctx.shadowBlur = fs * 0.35;
    ctx.fillStyle = i === 0 ? '#ffffff' : accent;
    ctx.fillText(ln, tw / 2, y);
  });
  ctx.restore();

  const margin = th * 0.03;
  const sh = th - capH - margin;
  const sw = sh * (img.width / img.height);
  const x = (tw - sw) / 2, y = capH;
  const r = sw * 0.06;
  ctx.save();
  roundRect(ctx, x, y, sw, sh, r);
  ctx.shadowColor = accent;
  ctx.shadowBlur = tw * 0.03;
  ctx.fillStyle = C.bg;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.clip();
  ctx.drawImage(img, x, y, sw, sh);
  ctx.restore();
  roundRect(ctx, x, y, sw, sh, r);
  ctx.lineWidth = tw * 0.005;
  ctx.strokeStyle = accent;
  ctx.stroke();
  return c;
}

// iOS 6.9" (1320x2868) + Google Play 폰 (1080x1920) 두 벌 저장
export async function storeShot(game: any, name: string, caption: string, accent?: string) {
  const img = await snapshot(game);
  await saveCanvas(compose(img, caption, 1320, 2868, accent), `store/ios/${name}.png`);
  await saveCanvas(compose(img, caption, 1080, 1920, accent), `store/google/${name}.png`);
  return true;
}
