import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('dashboard exposes both K56 and K67 substitute tests', () => {
  const html = read('term-tests/substitute-test-1-k56-dashboard/index.html');
  assert.match(html, /value="k67"/u);
  assert.match(html, /substitute-test-1-k67-computer-based/u);
  assert.match(html, /substitute-test-2-k67-computer-based/u);
});

for (const number of [1, 2]) {
  test(`K67 Substitute Test ${number} has isolated online routes and 40-question configs`, () => {
    const examRoot = `term-tests/substitute-test-${number}-k67-computer-based`;
    const config = read(`term-tests/substitute-test-${number}-k67/test-config.js`);
    const content = read(`${examRoot}/content.js`);
    const html = read(`${examRoot}/index.html`);
    assert.match(config, new RegExp(`slug: 'substitute-test-${number}-k67'`, 'u'));
    assert.match(config, /totalQuestions: 40/gu);
    assert.match(content, /Questions 31[–-]40/u);
    assert.match(content, /Questions 27[–-]40/u);
    assert.match(html, /substitute-k67-shared/u);
    assert.ok(fs.existsSync(path.join(root, `term-tests/substitute-test-${number}-k67-results/index.html`)));
  });
}

test('frontend contains no answer-key or production secret artifacts', () => {
  for (const relative of [
    'term-tests/substitute-test-1-k67-computer-based/content.js',
    'term-tests/substitute-test-2-k67-computer-based/content.js',
    'term-tests/substitute-k67-shared/config.js'
  ]) {
    const source = read(relative);
    assert.doesNotMatch(source, /answer-key|sync_secret|client_secret|private_key/iu);
  }
});
