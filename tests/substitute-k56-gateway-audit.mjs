import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// Nhận lời gọi API giả của hai trang Substitute; chuyển route + payload qua webhook.
// Kiểm query/JSON không bị mất, phản hồi lỗi không bị coi là đã lưu bài.
function requestFunction(number) {
  const source = readFileSync(new URL(`../term-tests/substitute-test-${number}-k56-computer-based/bootstrap.js`, import.meta.url), 'utf8');
  const start = source.indexOf('  async function apiRequest(');
  const end = source.indexOf('  function formatBytes(', start);
  assert.ok(start >= 0 && end > start);
  return source.slice(start, end);
}
function harness(number, response = { ok: true, status: 200, json: async () => ({ ok: true }) }) {
  let sent;
  let cleared = 0;
  const context = {
    URL, AbortController,
    appConfig: { API_BASE_URL: `https://example.test/webhook/substitute-${number}` },
    window: { location: { origin: 'https://example.test' }, setTimeout: () => 1, clearTimeout: () => { cleared += 1; } },
    fetch: async (...args) => { sent = args; return response; }
  };
  vm.createContext(context);
  vm.runInContext(`${requestFunction(number)}\nthis.invoke = apiRequest;`, context);
  return { invoke: context.invoke, sent: () => sent, cleared: () => cleared };
}

for (const number of [1, 2]) {
  test(`Substitute K56 ${number}: roster và bài nộp đều giữ route, query và body`, async () => {
    const h = harness(number);
    await h.invoke('/api/test/roster?class=K56A');
    assert.equal(h.sent()[0], `https://example.test/webhook/substitute-${number}`);
    assert.equal(h.sent()[1].method, 'POST');
    assert.deepEqual(JSON.parse(h.sent()[1].body), { route: '/api/test/roster', payload: { class: 'K56A' } });
    await h.invoke(`/api/term-tests/substitute-test-${number}-k56/writing?class=K56A`, {
      body: JSON.stringify({ class: 'K56B', attemptToken: 'synthetic-attempt', taskNumber: number === 1 ? 2 : 1 })
    });
    assert.deepEqual(JSON.parse(h.sent()[1].body), {
      route: `/api/term-tests/substitute-test-${number}-k56/writing`,
      payload: { class: 'K56B', attemptToken: 'synthetic-attempt', taskNumber: number === 1 ? 2 : 1 }
    });
    assert.equal(h.cleared(), 2);
  });
  test(`Substitute K56 ${number}: HTTP lỗi không báo nộp thành công`, async () => {
    const h = harness(number, { ok: false, status: 503, json: async () => ({ message: 'Tạm thời chưa lưu được' }) });
    await assert.rejects(h.invoke('/api/term-tests/writing'), /Tạm thời chưa lưu được/);
    assert.equal(h.cleared(), 1);
  });
}
