#!/usr/bin/env node
// OpenAI 이미지 생성 도구
//
// 사용법:
//   npm run img -- "귀여운 슬라임 몬스터, 정면" [옵션]
//
// 옵션:
//   --out <경로>        저장 위치 (파일 또는 폴더). 기본: art/generated/
//   --n <개수>          한 번에 여러 장 (기본 1)
//   --size <WxH>        1024x1024(기본), 1536x1024, 1024x1536 등 (16의 배수)
//   --quality <값>      low | medium | high | xhigh | max | auto (기본 medium)
//   --bg <값>           transparent(기본) | opaque | auto
//   --model <이름>      기본: .env 의 OPENAI_IMAGE_MODEL 또는 gpt-image-2.5-flare
//   --ref <이미지>      참고 이미지 (여러 번 가능). 그림체 맞추기/수정할 때 사용
//   --no-style          art/style.txt 의 공통 스타일 문구를 붙이지 않음
//   --trim              투명 여백 잘라내기
//   --resize <px>       긴 변을 이 크기로 줄이기 (게임용 스프라이트)
//   --dry               요청 내용만 출력하고 실제로 보내지 않음
//
// 생성 기록은 art/generated/log.jsonl 에 남는다 (같은 그림을 다시 뽑을 때 참고).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GEN_DIR = path.join(ROOT, 'art', 'generated');
const STYLE_FILE = path.join(ROOT, 'art', 'style.txt');

function parseArgs(argv) {
  const opts = { refs: [], n: 1, size: '1024x1024', quality: 'medium', bg: 'transparent', style: true };
  const words = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--out': opts.out = next(); break;
      case '--n': opts.n = Number(next()); break;
      case '--size': opts.size = next(); break;
      case '--quality': opts.quality = next(); break;
      case '--bg': opts.bg = next(); break;
      case '--model': opts.model = next(); break;
      case '--ref': opts.refs.push(next()); break;
      case '--no-style': opts.style = false; break;
      case '--trim': opts.trim = true; break;
      case '--resize': opts.resize = Number(next()); break;
      case '--dry': opts.dry = true; break;
      default:
        if (a.startsWith('--')) throw new Error(`알 수 없는 옵션: ${a}`);
        words.push(a);
    }
  }
  opts.prompt = words.join(' ').trim();
  return opts;
}

const slug = s => s.toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'image';
const stamp = () => new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);

function outPaths(opts, count) {
  const out = opts.out ? path.resolve(ROOT, opts.out) : GEN_DIR;
  const isFile = /\.(png|jpe?g|webp)$/i.test(out);
  const dir = isFile ? path.dirname(out) : out;
  fs.mkdirSync(dir, { recursive: true });
  const base = isFile ? path.basename(out).replace(/\.[^.]+$/, '') : `${stamp()}-${slug(opts.prompt)}`;
  return Array.from({ length: count }, (_, i) => path.join(dir, count > 1 ? `${base}-${i + 1}.png` : `${base}.png`));
}

async function request(opts, prompt, model, key) {
  const common = { model, prompt, n: opts.n, size: opts.size, quality: opts.quality, background: opts.bg };
  if (!opts.refs.length) {
    return fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(common),
    });
  }
  // 참고 이미지가 있으면 edits 엔드포인트 사용
  const form = new FormData();
  for (const [k, v] of Object.entries(common)) form.append(k, String(v));
  for (const ref of opts.refs) {
    const file = path.resolve(ROOT, ref);
    const type = /\.jpe?g$/i.test(file) ? 'image/jpeg' : /\.webp$/i.test(file) ? 'image/webp' : 'image/png';
    form.append('image[]', new Blob([fs.readFileSync(file)], { type }), path.basename(file));
  }
  return fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
}

async function postProcess(file, opts) {
  if (!opts.trim && !opts.resize) return;
  const sharp = (await import('sharp')).default;
  let img = sharp(file);
  if (opts.trim) img = img.trim();
  if (opts.resize) img = img.resize(opts.resize, opts.resize, { fit: 'inside' });
  const buf = await img.png().toBuffer();
  fs.writeFileSync(file, buf);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.prompt) {
    console.log('사용법: npm run img -- "만들 그림 설명" [--n 4] [--size 1024x1024] [--ref 참고.png] [--trim --resize 256]');
    process.exit(1);
  }

  const style = opts.style && fs.existsSync(STYLE_FILE) ? fs.readFileSync(STYLE_FILE, 'utf8').trim() : '';
  const prompt = style ? `${opts.prompt}\n\nStyle: ${style}` : opts.prompt;
  const model = opts.model || process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2.5-flare';

  if (opts.dry) {
    console.log(JSON.stringify({ endpoint: opts.refs.length ? 'edits' : 'generations', model, prompt, n: opts.n, size: opts.size, quality: opts.quality, background: opts.bg, refs: opts.refs }, null, 2));
    return;
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    console.error('OPENAI_API_KEY 가 없습니다. 프로젝트 폴더의 .env.example 을 .env 로 복사하고 키를 넣어주세요.');
    process.exit(1);
  }

  const t0 = Date.now();
  console.log(`생성 중... (${model}, ${opts.n}장, ${opts.size}, ${opts.quality})`);
  const res = await request(opts, prompt, model, key);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message ?? res.statusText;
    console.error(`실패 (${res.status}): ${msg}`);
    if (res.status === 401) console.error('→ API 키가 올바른지 확인하세요.');
    if (res.status === 429) console.error('→ 사용 한도 초과이거나 결제 수단이 등록되지 않았습니다. platform.openai.com 의 Billing 을 확인하세요.');
    if (res.status === 404 || /model/i.test(msg)) console.error('→ 모델 이름을 확인하세요. (--model 또는 .env 의 OPENAI_IMAGE_MODEL)');
    process.exit(1);
  }

  const files = outPaths(opts, json.data.length);
  for (let i = 0; i < json.data.length; i++) {
    fs.writeFileSync(files[i], Buffer.from(json.data[i].b64_json, 'base64'));
    await postProcess(files[i], opts);
    console.log(`저장: ${path.relative(ROOT, files[i])}`);
  }

  fs.mkdirSync(GEN_DIR, { recursive: true });
  fs.appendFileSync(path.join(GEN_DIR, 'log.jsonl'), JSON.stringify({
    time: new Date().toISOString(), model, prompt: opts.prompt, style: !!style, size: opts.size,
    quality: opts.quality, background: opts.bg, refs: opts.refs, files: files.map(f => path.relative(ROOT, f)),
    usage: json.usage,
  }) + '\n');
  console.log(`완료 (${((Date.now() - t0) / 1000).toFixed(1)}초)`);
}

main().catch(e => { console.error(e.message ?? e); process.exit(1); });
