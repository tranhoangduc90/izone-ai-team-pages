// Dữ liệu vào: tham số lớp ở ba trang Term 1, Term 2 và Mini K56.
// Việc chính: chạy config trong ngữ cảnh trình duyệt giả, không gọi API thật.
// Kết quả: lớp thật đi API K56, demo đi API demo; K67 không đổi.
// Khi lỗi: test RED trước phát hành để tránh học viên gặp CLASS_NOT_FOUND.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const paths = [
  'term-tests/k56-shared/config.js',
  'term-tests/k56-test2-shared/config.js',
  'term-tests/k56-mini-shared/config.js'
];
const realApi = 'https://ducizone.ddns.net/mapping-api-k56';
const demoApi = 'https://ducizone.ddns.net/mapping-api-demo';

async function configFor(relative, search) {
  const source = await readFile(path.join(root, relative), 'utf8');
  const window = { location: { search, hostname: 'tranhoangduc90.github.io' } };
  vm.runInNewContext(source, { window, URLSearchParams },
    { filename: relative, timeout: 5_000 });
  return window.TERM_TEST_APP_CONFIG;
}

for (const relative of paths) {
  test(`${relative}: lớp K56 thật đi API đã mở, demo giữ riêng`, async () => {
    for (const classCode of ['IC2264', 'IC2322', 'IC2326']) {
      const config = await configFor(relative, `?class=${classCode}`);
      assert.equal(config.API_BASE_URL, realApi);
    }
    const demo = await configFor(relative, '?class=CODEXDEMO56');
    assert.equal(demo.API_BASE_URL, demoApi);
    const noClass = await configFor(relative, '');
    assert.equal(noClass.API_BASE_URL, realApi);
  });
}

test('mọi trang K56 nạp revision mới để không giữ API demo trong cache', async () => {
  const pages = [
    'k56-demo', 'teacher-k56', 'term-test-1-k56',
    'term-test-2-k56', 'mini-test-k56',
    'term-test-1-k56-computer-based',
    'term-test-2-k56-computer-based',
    'mini-test-k56-computer-based'
  ];
  for (const page of pages) {
    const html = await readFile(path.join(root, 'term-tests', page, 'index.html'), 'utf8');
    assert.match(html, /k56-(?:test2-|mini-)?shared\/config\.js\?rev=20260924-k56-all-classes/,
      `${page} phải tải cấu hình định tuyến mới`);
  }
});
