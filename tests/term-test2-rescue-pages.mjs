import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { existsSync, readFileSync } from 'node:fs';

const oldEntry = new URL('../term-tests/term-test-2-rescue/', import.meta.url);
const html = readFileSync(new URL('index.html', oldEntry), 'utf8');
const script = readFileSync(new URL('redirect.js', oldEntry), 'utf8');

function openOldLink(query) {
  const current = new URL('/term-tests/term-test-2-rescue/' + query, 'https://exam.invalid');
  const link = {};
  const notice = {};
  const redirects = [];
  const location = { href: current.href, search: current.search, replace: url => redirects.push(url) };
  const document = { getElementById: id => id === 'exam-link' ? link : notice };
  vm.runInNewContext(script, { URL, URLSearchParams, location, document });
  return { redirects, link };
}

test('old Term 2 links open the main test with the correct class and order', () => {
  for (const code of ['IC2213', 'IC2207']) {
    for (const mode of ['lis_first', 'read_first']) {
      const { redirects, link } = openOldLink('?class=' + code + '&mode=' + mode + '&unused=1');
      const expected = 'https://exam.invalid/term-tests/term-test-2-computer-based/?class=' + code + '&mode=' + mode;
      assert.deepEqual(redirects, [expected]);
      assert.equal(link.href, expected);
    }
  }
});

test('the old route preserves its class restriction and leaves invalid order to the main test', () => {
  for (const query of ['', '?class=OTHER&mode=lis_first']) {
    const { redirects, link } = openOldLink(query);
    assert.deepEqual(redirects, []);
    assert.equal(link.hidden, true);
  }
  assert.deepEqual(openOldLink('?class=ic2213&mode=bogus').redirects, [
    'https://exam.invalid/term-tests/term-test-2-computer-based/?class=IC2213'
  ]);
});

test('old entry serves only a redirect and its worker has no cache or fetch handler', () => {
  assert.deepEqual([...html.matchAll(/<script src="([^"]+)"/g)].map(match => match[1]), ['./redirect.js']);
  assert.ok(existsSync(new URL('../term-test-2-computer-based/index.html', oldEntry)));
  assert.equal(existsSync(new URL('rescue-audio.js', oldEntry)), false);
  assert.equal(existsSync(new URL('offline-assets.mjs', oldEntry)), false);
  const worker = readFileSync(new URL('offline-worker.js', oldEntry), 'utf8');
  assert.match(worker, /self\.skipWaiting\(\)/);
  assert.doesNotMatch(worker, /registerExamShell|respondWith|caches\.delete/);
});
