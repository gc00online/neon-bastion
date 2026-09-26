import { defineConfig, type Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

// 개발 서버 전용: 브라우저에서 만든 이미지(아이콘, 스토어 스크린샷)를 프로젝트 폴더에 저장하는 엔드포인트
function saveEndpoint(): Plugin {
  return {
    name: 'dev-save-endpoint',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        const url = new URL(req.url ?? '', 'http://x');
        const name = (url.searchParams.get('name') ?? '').replace(/[^a-zA-Z0-9_\-./]/g, '');
        if (!name || name.includes('..')) { res.statusCode = 400; res.end('bad name'); return; }
        const chunks: Buffer[] = [];
        req.on('data', c => chunks.push(c));
        req.on('end', () => {
          const body = Buffer.concat(chunks).toString();
          const b64 = body.replace(/^data:[^,]+,/, '');
          const out = path.resolve(__dirname, name);
          fs.mkdirSync(path.dirname(out), { recursive: true });
          fs.writeFileSync(out, Buffer.from(b64, 'base64'));
          res.end('ok');
        });
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [saveEndpoint()],
  build: {
    chunkSizeWarningLimit: 2000,
  },
});
