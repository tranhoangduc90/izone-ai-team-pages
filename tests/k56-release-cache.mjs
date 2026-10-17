import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';

// F01: một cache HTTP còn fresh của bản trước không được che bản vá sau khi
// tải HTML mới. Dùng URL/tệp thật; không giả lập browser hay Service Worker.
const root = process.env.K56_CACHE_SOURCE_ROOT || process.cwd();
const base = 'd4b3670ae220b011f7a60cde5dead4ac5103043c';
const origin = 'https://pages.invalid/';
// Git và checkout Windows có thể khác LF/CRLF; cache test so nội dung JS.
const digest = value => createHash('sha256').update(value.toString().replace(/\r\n/g, '\n')).digest('hex');
const oldFile = name => execFileSync('git', ['-C', root, 'show', `${base}:${name}`]);
const newFile = name => readFileSync(path.join(root, name));
const sources = text => [...text.toString().matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(x => x[1]);
const dynamic = text => [...text.toString().matchAll(/loadScript\('([^']+)'\)/g)].map(x => x[1]);
function graph(route, read) {
  const document = new URL(`term-tests/${route}/`, origin);
  const scripts = sources(read(`term-tests/${route}/index.html`)).map(s => new URL(s, document));
  const rows = [];
  for (const url of scripts) {
    const body = read(url.pathname.slice(1));
    rows.push({ url: url.href, body });
    if (url.pathname.endsWith('/bootstrap.js')) {
      for (const s of dynamic(body)) {
        const child = new URL(s, document);
        rows.push({ url: child.href, body: read(child.pathname.slice(1)) });
      }
    }
  }
  return rows;
}
for (const [slug, shared] of [
  ['term-test-1-k56', 'k56-shared'],
  ['term-test-2-k56', 'k56-test2-shared'],
  ['mini-test-k56', 'k56-mini-shared'],
]) for (const suffix of ['', '-computer-based']) {
  const route = slug + suffix;
  test(`${route}: HTML mới vượt cache JS fresh của bản trước và tải app đã vá`, () => {
    const cache = new Map(graph(route, oldFile).map(row => [row.url, row.body]));
    const document = new URL(`term-tests/${route}/`, origin);
    const requests = sources(newFile(`term-tests/${route}/index.html`)).map(s => new URL(s, document));
    const loaded = [];
    while (requests.length) {
      const url = requests.shift();
      // Cache-Control max-age=600 đã quan sát ở Pages. Trong cửa sổ fresh,
      // cùng URL có quyền trả byte cũ dù origin đã đổi.
      const body = cache.get(url.href) || newFile(url.pathname.slice(1));
      loaded.push({ url, body });
      if (url.pathname.endsWith('/bootstrap.js'))
        requests.push(...dynamic(body).map(s => new URL(s, document)));
    }
    const appPath = `/term-tests/${shared}/app.js`;
    const apps = loaded.filter(row => row.url.pathname === appPath);
    assert.ok(apps.length > 0, 'Đường tải ứng dụng phải thực sự được duyệt');
    assert.notEqual(digest(oldFile(appPath.slice(1))), digest(newFile(appPath.slice(1))), 'Bản chuẩn phải chứa bản vá app mới hơn baseline');
    for (const app of apps) assert.equal(digest(app.body), digest(newFile(appPath.slice(1))), `Cache cũ che bản vá: ${app.url.href}`);
  });
}
