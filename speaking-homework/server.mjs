import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkSubmission } from './checker.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mimeTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.png': 'image/png' };
const staticFiles = new Map([
  ['/speaking-homework/', 'speaking-homework/index.html'],
  ['/speaking-homework/index.html', 'speaking-homework/index.html'],
  ['/speaking-homework/lesson-3.html', 'speaking-homework/lesson-3.html'],
  ['/speaking-homework/lesson-3.js', 'speaking-homework/lesson-3.js'],
  ['/speaking-homework/lesson-3.css', 'speaking-homework/lesson-3.css'],
  ['/speaking-homework/styles.css', 'speaking-homework/styles.css'],
  ['/speaking-homework/guide.css', 'speaking-homework/guide.css'],
  ['/speaking-homework/app.js', 'speaking-homework/app.js'],
  ['/speaking-homework/logic.mjs', 'speaking-homework/logic.mjs'],
  ['/shared/student-memory.js', 'shared/student-memory.js'],
]);
const imageNames = new Set(['voice-input.png', 'iphone-menu.png', 'iphone-select-chat.png', 'iphone-share-chat.png', 'iphone-share-link.png', 'android-menu.png', 'android-share.png', 'android-share-link.png', 'link-format.png']);

function sendJson(response, status, value) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  response.end(JSON.stringify(value));
}

async function readBody(request) {
  let text = '';
  for await (const chunk of request) {
    text += chunk;
    if (text.length > 4_096) throw new Error('REQUEST_TOO_LARGE');
  }
  return JSON.parse(text);
}

export function createPreviewServer({ check = checkSubmission } = {}) {
  const pending = new Map();
  return createServer(async (request, response) => {
    if (!/^127\.0\.0\.1(?::\d{1,5})?$/.test(request.headers.host || '')) {
      response.writeHead(403);
      response.end();
      return;
    }
    const path = new URL(request.url || '/', 'http://127.0.0.1').pathname;
    if (request.method === 'GET' && path === '/health') {
      sendJson(response, 200, { ok: true, preview: true });
      return;
    }
    if (request.method === 'GET' && path === '/api/speaking/roster') {
      // Máy thử lấy danh sách lớp thật qua máy chủ cục bộ vì API chỉ cho miền Pages đọc trực tiếp.
      try {
        const upstream = await fetch('https://ducizone.ddns.net/mapping-api/api/term-tests/roster?class=IC2304&test=term-test-2', {
          signal: AbortSignal.timeout(10_000),
        });
        if (!upstream.ok) throw new Error('ROSTER_UPSTREAM_FAILED');
        const data = await upstream.json();
        if (data?.ok !== true || data.class?.name !== 'IC2304' || !Array.isArray(data.students)) throw new Error('ROSTER_INVALID');
        sendJson(response, 200, data);
      } catch {
        sendJson(response, 502, { ok: false, error: 'ROSTER_UNAVAILABLE' });
      }
      return;
    }
    if (request.method === 'POST' && path === '/api/speaking/check') {
      const origin = request.headers.origin;
      if ((origin && origin !== `http://${request.headers.host}`)
        || request.headers['content-type']?.split(';')[0] !== 'application/json') {
        sendJson(response, 403, { kind: 'error', title: 'Yêu cầu bị từ chối', message: 'Hãy mở bản thử từ địa chỉ trên máy này.' });
        return;
      }
      let input;
      try { input = await readBody(request); }
      catch { sendJson(response, 400, { kind: 'blocked', title: 'Dữ liệu chưa đúng', message: 'Hãy dán lại link và thử tiếp.' }); return; }
      if (!input || typeof input.url !== 'string' || input.url.length > 2_048 || typeof input.section !== 'string') {
        sendJson(response, 400, { kind: 'blocked', title: 'Dữ liệu chưa đúng', message: 'Hãy dán lại link và thử tiếp.' });
        return;
      }
      const key = `${input.section}\u0000${input.url.trim()}`;
      let job = pending.get(key);
      if (!job && pending.size >= 2) {
        sendJson(response, 429, { kind: 'error', title: 'Đang kiểm tra các link khác', message: 'Hãy đợi ít phút rồi bấm Xác nhận lại.' });
        return;
      }
      if (!job) {
        const started = Date.now();
        job = Promise.resolve().then(() => check(input)).finally(() => {
          pending.delete(key);
          console.info(JSON.stringify({ event: 'share_check_finished', durationMs: Date.now() - started }));
        });
        pending.set(key, job);
      }
      try { sendJson(response, 200, await job); }
      catch { sendJson(response, 502, { kind: 'error', title: 'Chưa kiểm tra được', message: 'Hệ thống đang gặp lỗi. Bài chưa được nhận; hãy thử lại.' }); }
      return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405); response.end(); return; }
    let relative = staticFiles.get(path);
    if (!relative && path.startsWith('/speaking-homework/assets/')) {
      const name = path.slice('/speaking-homework/assets/'.length);
      if (imageNames.has(name)) relative = `speaking-homework/assets/${name}`;
    }
    if (!relative) { response.writeHead(404); response.end(); return; }
    const target = resolve(root, relative);
    if (!target.startsWith(`${root}${sep}`)) { response.writeHead(404); response.end(); return; }
    try {
      const bytes = await readFile(target);
      const extension = target.slice(target.lastIndexOf('.'));
      response.writeHead(200, { 'content-type': mimeTypes[extension] || 'application/octet-stream', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
      response.end(request.method === 'HEAD' ? undefined : bytes);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.SPEAKING_PREVIEW_PORT || 8765);
  createPreviewServer().listen(port, '127.0.0.1', () => {
    console.info(`Bản xem trước Speaking: http://127.0.0.1:${port}/speaking-homework/`);
  });
}
