import { registerWritingRevisionContract } from './fixtures/d08-writing-revision-vm.mjs';

// Dùng fixture chung chạy helper/state thật của đúng client; không giả lập logic lưu bài.
registerWritingRevisionContract({
  name: 'k56-mini-writing-revision',
  sourcePath: 'term-tests/k56-mini-shared/app.js',
  cachePaths: ['term-tests/mini-test-k56-computer-based/bootstrap.js',
    'term-tests/mini-test-k56-computer-based/index.html',
    'term-tests/mini-test-k56/index.html']
});
