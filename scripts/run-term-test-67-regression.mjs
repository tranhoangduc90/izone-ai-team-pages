// Input: --quick chỉ chạy test tĩnh; --all hoặc không truyền gì chạy cả test tĩnh và trình duyệt; --list chỉ in danh sách.
// Xử lý: đọc manifest, chặn đường dẫn trùng/thiếu rồi gọi Node test runner đúng một lần trên dữ liệu giả và server local.
// Output: giữ nguyên báo cáo từng test; khi lỗi, tiến trình trả mã khác 0 để Git/CI hoặc người chạy nhìn thấy ngay.
import { spawnSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDirectory, '..');
const manifestPath = path.join(repoRoot, 'tests', 'term-test-67-regression-manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const requestedMode = process.argv[2] || '--all';

if (!['--all', '--quick', '--list'].includes(requestedMode)) {
  console.error('Cách dùng: node scripts/run-term-test-67-regression.mjs [--all|--quick|--list]');
  process.exit(2);
}

const staticTests = manifest.groups?.static || [];
const browserTests = manifest.groups?.browser || [];
const selectedTests = requestedMode === '--quick'
  ? staticTests
  : [...staticTests, ...browserTests];
const uniqueTests = new Set(selectedTests);

if (!selectedTests.length || uniqueTests.size !== selectedTests.length) {
  console.error('Manifest Term Test 67 đang trống hoặc có đường dẫn test bị lặp.');
  process.exit(2);
}

for (const relativePath of selectedTests) {
  if (!relativePath.startsWith('tests/') || path.isAbsolute(relativePath)) {
    console.error(`Đường dẫn test không an toàn: ${relativePath}`);
    process.exit(2);
  }
  await access(path.join(repoRoot, relativePath));
}

if (requestedMode === '--list') {
  console.log(JSON.stringify({
    suite: manifest.suite_id,
    static: staticTests,
    browser: browserTests
  }, null, 2));
  process.exit(0);
}

console.log(`Chạy ${selectedTests.length} file regression Term Test 67 (${requestedMode === '--quick' ? 'tĩnh' : 'đầy đủ'}).`);
const result = spawnSync(process.execPath, ['--test', ...selectedTests], {
  cwd: repoRoot,
  stdio: 'inherit',
  env: process.env
});

if (result.error) {
  console.error(`Không khởi động được bộ test: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
