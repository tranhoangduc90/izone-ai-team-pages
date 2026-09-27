import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { createPreviewServer } from '../speaking-homework/server.mjs';

// Kiểm tuyến HTTP thật bằng link giả, tránh gọi ChatGPT/AI cho hồi quy thường ngày.
const calls = [];
const server = createPreviewServer({ check: async (input) => {
  calls.push(input);
  return { kind: 'pass', title: 'Đã kiểm tra', message: 'Đủ bài.', count: 5 };
} });
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const address = `http://127.0.0.1:${server.address().port}`;
try {
  const response = await fetch(`${address}/api/speaking/check`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: address },
    body: JSON.stringify({ section: 'paraphrase', url: 'https://chatgpt.com/share/test-id' }),
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).kind, 'pass');
  assert.deepEqual(calls, [{ section: 'paraphrase', url: 'https://chatgpt.com/share/test-id' }]);

  const denied = await fetch(`${address}/api/speaking/check`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://other.example' },
    body: JSON.stringify({ section: 'paraphrase', url: 'https://chatgpt.com/share/test-id' }),
  });
  assert.equal(denied.status, 403);
  assert.equal(calls.length, 1, 'Nguồn khác không được gọi bộ đọc');

  const spoofedStatus = await new Promise((resolve, reject) => {
    const request = httpRequest({ hostname: '127.0.0.1', port: server.address().port, path: '/health', headers: { host: 'other.example' } }, (reply) => {
      reply.resume();
      reply.on('end', () => resolve(reply.statusCode));
    });
    request.on('error', reject);
    request.end();
  });
  assert.equal(spoofedStatus, 403);

  const images = ['voice-input', 'iphone-menu', 'iphone-select-chat', 'iphone-share-chat', 'iphone-share-link', 'android-menu', 'android-share', 'android-share-link', 'link-format'];
  for (const image of images) {
    const asset = await fetch(`${address}/speaking-homework/assets/${image}.png`);
    assert.equal(asset.status, 200, `Thiếu ảnh ${image}`);
    assert.equal(asset.headers.get('content-type'), 'image/png');
    assert.ok((await asset.arrayBuffer()).byteLength > 10_000);
  }
  const page = await (await fetch(`${address}/speaking-homework/`)).text();
  assert.equal((page.match(/\.\/assets\/[a-z-]+\.png/g) || []).length, 9);
  assert.match(page, /<section class="guide-card illustrated-guide"/);
  assert.doesNotMatch(page, /<details class="guide-card"/);
  assert.doesNotMatch(page, /Tình huống mô phỏng/);
  assert.equal((await fetch(`${address}/speaking-homework/server.mjs`)).status, 404);
  assert.equal((await fetch(`${address}/speaking-homework/quality-gate.json`)).status, 404);
} finally {
  server.close();
  await once(server, 'close');
}

// Hai lần bấm cùng link trong lúc đang đọc chỉ dùng một lượt kiểm ngoài.
let concurrentCalls = 0;
const slowServer = createPreviewServer({ check: async () => {
  concurrentCalls += 1;
  await new Promise((resolve) => setTimeout(resolve, 150));
  return { kind: 'pass', title: 'Đã kiểm tra', message: 'Đủ bài.', count: 5 };
} });
slowServer.listen(0, '127.0.0.1');
await once(slowServer, 'listening');
const slowAddress = `http://127.0.0.1:${slowServer.address().port}`;
try {
  const send = () => fetch(`${slowAddress}/api/speaking/check`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: slowAddress },
    body: JSON.stringify({ section: 'paraphrase', url: 'https://chatgpt.com/share/same-id' }),
  });
  const results = await Promise.all([send(), send()]);
  assert.deepEqual(results.map((response) => response.status), [200, 200]);
  assert.equal(concurrentCalls, 1);
  const retried = await send();
  assert.equal(retried.status, 200);
  assert.equal(concurrentCalls, 2, 'Sau khi kết thúc, học viên có thể kiểm lại link');
} finally {
  slowServer.close();
  await once(slowServer, 'close');
}

console.log('Speaking Homework: HTTP, chín ảnh, ranh giới local và chống gọi trùng đạt.');
