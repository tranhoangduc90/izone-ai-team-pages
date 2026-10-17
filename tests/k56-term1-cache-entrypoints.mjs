import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

// Cùng phiên bản công khai cho đường CBT chính/dự phòng và bản giấy.
// RED trên bản441: trang giấy vẫn dùng URL cũ, có thể giữ app cũ trong cache.
test('Term1: bản giấy và hai đường bootstrap cùng nạp phiên bản cache đang phát hành', () => {
  const revision = '20261018-stream-backoff-r67';
  const read = path => fs.readFileSync(path, 'utf8');
  const version = url => new URL(url, 'https://fixture.invalid').searchParams.get('v');
  const bootstrap = read('term-tests/term-test-1-k56-computer-based/bootstrap.js');
  const appUrls = [...bootstrap.matchAll(/\.\.\/k56-shared\/app\.js\?[^'"\s)]+/g)].map(match => match[0]);
  assert.equal(appUrls.length, 2, 'Phải kiểm cả đường chính và dự phòng');
  for (const url of appUrls) assert.equal(version(url), revision);
  const paper = read('term-tests/term-test-1-k56/index.html');
  const paperUrl = paper.match(/\.\.\/k56-shared\/app\.js\?[^'"\s>]+/)?.[0];
  assert.ok(paperUrl, 'Trang giấy phải tải đúng app dùng chung');
  assert.equal(version(paperUrl), revision, 'Trang giấy không được giữ URL app cũ');
  const cbt = read('term-tests/term-test-1-k56-computer-based/index.html');
  const bootstrapUrl = cbt.match(/bootstrap\.js\?[^'"\s>]+/)?.[0];
  assert.ok(bootstrapUrl);
  const bootstrapQuery = new URL(bootstrapUrl, 'https://fixture.invalid').searchParams;
  assert.equal(bootstrapQuery.get('rev') || bootstrapQuery.get('v'), revision);
});
