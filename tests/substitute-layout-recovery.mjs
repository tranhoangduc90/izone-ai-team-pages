import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
test('K56 Sub 2 roster reaches the POST gateway with query payload', async () => {
  const src = read('term-tests/substitute-test-2-k56-computer-based/bootstrap.js');
  const fn = src.slice(src.indexOf('  async function apiRequest('), src.indexOf('  function formatBytes('));
  let request;
  const context = { URL, AbortController, appConfig: { API_BASE_URL: 'https://example.test/webhook' }, window: { location: { origin: 'https://example.test' }, setTimeout, clearTimeout }, fetch: async (...args) => { request = args; return { ok: true, json: async () => ({ students: [{ ref: 'demo' }] }) }; } };
  vm.createContext(context);
  await vm.runInContext(fn + ';apiRequest("/api/test/roster?class=DEMO")', context);
  assert.equal(request[0], 'https://example.test/webhook');
  assert.equal(request[1].method, 'POST');
  assert.deepEqual(JSON.parse(request[1].body), { route: '/api/test/roster', payload: { class: 'DEMO' } });
});
for (const t of [1, 2]) test(`K67 Sub ${t}: every answer is located within its question, with real choice controls`, () => {
  const context = { window: {} }; vm.runInNewContext(read(`term-tests/substitute-test-${t}-k67-computer-based/content.js`), context);
  const content = context.window[`K67_SUBSTITUTE_TEST_${t}_CONTENT`];
  for (const skill of ['listening', 'reading']) {
    const html = content[skill].sections.map(s => s.questionsHtml || s.html).join('');
    const slots = [...html.matchAll(/data-answer-slot="(\d+)"/g)].map(m => Number(m[1]));
    assert.equal(slots.length, 40); assert.equal(new Set(slots).size, 40);
    assert.doesNotMatch(html, /k67-answer-grid|>Question \d+</);
    assert.match(html, /data-control="radio"/);
    assert.doesNotMatch(html, /\d\s*[.\u2026_]{3,}/);
  }
});
