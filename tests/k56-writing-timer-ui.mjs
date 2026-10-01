import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

for (const exam of [
  'term-test-1-k56-computer-based',
  'term-test-2-k56-computer-based',
  'mini-test-k56-computer-based'
]) {
  test(`${exam}: ẩn nhãn giai đoạn nhưng giữ đồng hồ tổng và tự nộp`, () => {
    const source = readFileSync(`term-tests/${exam}/enhance.js`, 'utf8');
    const start = source.indexOf('  function setupWritingTimer()');
    const end = source.indexOf('\n  function ', start + 3);
    assert.ok(start >= 0);
    const timer = source.slice(start, end < 0 ? undefined : end);
    assert.doesNotMatch(timer, /cbt-writing-phase|Lập dàn ý · còn|Viết bài (Task|Paragraph) · còn/);
    assert.match(timer, /cbt-writing-clock/);
    assert.match(timer, /writingTimer\.deadline/);
    assert.match(timer, /requestSubmit\(autoSubmitButton\)/);
  });
}
