// Nhận manifest kiểm thử K56/Substitute và bộ K67 hiện hành.
// Ghép không trùng, chặn đường dẫn ngoài repo và chạy trên dữ liệu giả; lỗi trả exit code khác 0.
import { spawnSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = async relative => JSON.parse(await readFile(path.join(root, relative), 'utf8'));
const manifest = await load('tests/k56-product-audit-manifest.json');
const k67 = await load(manifest.groups.k67_no_impact_guard);
const mode = process.argv[2] || '--all';
if (!['--all', '--k56', '--substitute', '--k67', '--list'].includes(mode)) {
  console.error('Cách dùng: node scripts/run-k56-product-audit.mjs [--all|--k56|--substitute|--k67|--list]');
  process.exit(2);
}
const groups = {
  term_mini_56: manifest.groups.term_mini_56,
  substitute_56_and_shared_67: manifest.groups.substitute_56_and_shared_67,
  k67_no_impact_guard: [...k67.groups.static, ...k67.groups.browser]
};
const names = mode === '--k56' ? ['term_mini_56']
  : mode === '--substitute' ? ['substitute_56_and_shared_67']
    : mode === '--k67' ? ['k67_no_impact_guard'] : Object.keys(groups);
const selected = [...new Set(names.flatMap(name => groups[name]))];
for (const relative of selected) {
  const absolute = path.resolve(root, relative);
  if (!relative.startsWith('tests/') || !absolute.startsWith(root + path.sep) || path.extname(absolute) !== '.mjs' && path.extname(absolute) !== '.cjs') {
    console.error(`Đường dẫn test không hợp lệ: ${relative}`);
    process.exit(2);
  }
  await access(absolute);
}
if (mode === '--list') {
  console.log(JSON.stringify({ suite: manifest.suite_id, groups, selected: selected.length, excluded_nonhermetic: manifest.excluded_nonhermetic }, null, 2));
  process.exit(0);
}
console.log(`Kiểm ${selected.length} file K56/Substitute/K67 (${mode}); các ca phụ thuộc source riêng tư được báo trong manifest.`);
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...selected], {
  cwd: root, stdio: 'inherit', env: process.env
});
if (result.error) {
  console.error(`Không chạy được bộ kiểm thử: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
