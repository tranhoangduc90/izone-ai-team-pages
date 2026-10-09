import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

for (const number of [1, 2]) {
  const bootstrap = fs.readFileSync(path.join(root, `term-tests/substitute-test-${number}-k67-computer-based/bootstrap.js`), 'utf8');
  test(`K67 Sub ${number}: danh sách lớp từ backend, giữ IC2063 khi metadata cũ và lấy roster riêng`, () => {
    assert.match(bootstrap, /code: 'IC2063'/u);
    assert.match(bootstrap, /SUBSTITUTE_STATE\.meta\.classes/u);
    assert.match(bootstrap, /route: '\/api\/test\/roster'/u);
    assert.doesNotMatch(bootstrap, /IC2139|mapping-api\/api\/term-tests\/roster/u);
  });
}

test('Giao diện K67 hướng dẫn đúng mã lớp IC2063', () => {
  const app = fs.readFileSync(path.join(root, 'term-tests/substitute-k67-shared/app.js'), 'utf8');
  assert.match(app, /\?class=IC2063/u);
  assert.doesNotMatch(app, /IC2139/u);
});

test('Trang tổng hợp không còn hướng người học K67 đến IC2139', () => {
  for (const name of ['app.js', 'index.html']) {
    const text = fs.readFileSync(path.join(root, 'term-tests/substitute-test-1-k56-dashboard', name), 'utf8');
    assert.doesNotMatch(text, /IC2139/u);
    if(name==='index.html')assert.match(text,/Danh sách lớp được tải từ hệ thống Substitute/u);
  }
});
