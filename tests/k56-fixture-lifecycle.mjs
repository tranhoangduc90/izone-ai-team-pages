// Tạo bài giả trong RAM và một tải HTTP localhost còn mở khi dọn fixture.
// Kiểm kho không đổi, không ghi Portal và đóng hết kết nối; lỗi trả assertion.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createCompletedResultFixture } from './fixtures/k56-completed-result-e03-server.mjs';

const fixture = JSON.parse(await readFile(new URL('./fixtures/k56-completed-result-e03.json', import.meta.url), 'utf8'));
test('fixture đóng được khi kết nối tải vẫn mở, không phát sinh ghi ngoài', { timeout: 30_000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'd08-fixture-close-'));
  let server, socket, closed, timer;
  try {
    await writeFile(join(root, 'large-fixture.bin'), Buffer.alloc(16 * 1024 * 1024));
    server = await createCompletedResultFixture({ backendRoot: process.env.K56_EDGE_BACKEND_ROOT || 'E:/wt/k56-e03-backend-20261002',
      pagesRoot: root, fixture, item: fixture.cases[0] });
    const before = await server.audit();
    const url = new URL(server.url);
    socket = net.connect(Number(url.port), url.hostname);
    await new Promise((done, fail) => { socket.once('connect', done); socket.once('error', fail); });
    socket.pause();
    socket.write('GET /large-fixture.bin HTTP/1.1\r\nHost: localhost\r\n\r\n');
    await new Promise(done => setTimeout(done, 500));
    assert.deepEqual(await server.audit(), before);
    assert.deepEqual(server.counters, { resultReads: 0, portalWrites: 0, blockedApiWrites: 0 });
    closed = server.close();
    const finished = await Promise.race([closed.then(() => true),
      new Promise(done => { timer = setTimeout(() => done(false), 5000); })]);
    assert.equal(finished, true, 'Fixture còn giữ tải HTTP sau khi đóng');
  } finally {
    clearTimeout(timer);
    socket?.destroy();
    if (closed) await closed;
    else if (server) await server.close();
    await rm(root, { recursive: true, force: true });
  }
});
