import { registerWritingRevisionContract } from './fixtures/d08-writing-revision-vm.mjs';

// Dùng fixture chung chạy helper/state thật của đúng client; không giả lập logic lưu bài.
registerWritingRevisionContract({
  name: 'k56-test2-writing-revision',
  sourcePath: 'term-tests/k56-test2-shared/app.js',
  cachePaths: ['term-tests/term-test-2-k56-computer-based/bootstrap.js',
    'term-tests/term-test-2-k56-computer-based/index.html',
    'term-tests/term-test-2-k56/index.html']
});
