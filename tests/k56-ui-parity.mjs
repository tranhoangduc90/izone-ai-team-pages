import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const landingHtml = await readFile('term-tests/k56-demo/index.html', 'utf8');
const landingCss = await readFile('term-tests/k56-demo/landing.css', 'utf8');
const landingJs = await readFile('term-tests/k56-demo/landing.js', 'utf8');
assert.equal((landingHtml.match(/class="button button-primary"/g) || []).length, 0);
assert.equal((landingHtml.match(/aria-pressed="false"/g) || []).length, 9);
assert.match(landingCss, /\.landing-choice\.is-selected/);
assert.match(landingJs, /selectLandingButton\(button\)/);

for (const path of [
  'term-tests/term-test-1-k56-computer-based/bootstrap.js',
  'term-tests/term-test-2-k56-computer-based/bootstrap.js',
  'term-tests/mini-test-k56-computer-based/bootstrap.js'
]) {
  const bootstrap = await readFile(path, 'utf8');
  assert.match(bootstrap, /function recoverFromServerReset\(error\)/);
  assert.match(bootstrap, /'ATTEMPT_NOT_FOUND', 'EXAM_SESSION_NOT_FOUND'/);
  assert.match(bootstrap, /storage\.removeItem\(storageKey\)/);
}

console.log('K56 Landing selection checks passed.');
