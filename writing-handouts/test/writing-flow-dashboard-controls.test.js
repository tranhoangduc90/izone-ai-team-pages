// Dữ liệu giả: chỉ kiểm URL và hành vi giao diện bằng source tĩnh; không gọi production.
// Mục tiêu: khóa các chức năng đã từng thiếu để lần sửa sau không làm mất chúng.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTeacherApi } from '../js/api.js';

test('API dashboard truyền đủ bộ lọc ngày và nhật ký thao tác', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async url => {
    calls.push(new URL(url));
    return new Response(JSON.stringify({ ok: true, pairs: [], events: [] }), { status: 200 });
  });
  const api = createTeacherApi('https://example.invalid/writing-api/');
  await api.writingPairsPage({ classCode: 'IC2200', search: 'docs-id-demo',
    dateFrom: '2026-09-19', dateTo: '2026-09-19', stageKey: 'precheck',
    stageStatus: 'running', view: 'delivered' });
  await api.writingOperatorEvents({ classCode: 'IC2200', eventType: 'class_mapping_changed', limit: 25 });
  assert.equal(calls[0].pathname, '/writing-api/api/v1/admin/writing-flow/pairs');
  assert.equal(calls[0].searchParams.get('dateFrom'), '2026-09-19');
  assert.equal(calls[0].searchParams.get('dateTo'), '2026-09-19');
  assert.equal(calls[0].searchParams.get('search'), 'docs-id-demo');
  assert.equal(calls[0].searchParams.get('view'), 'delivered');
  assert.equal(calls[0].searchParams.get('stageStatus'), 'running');
  assert.equal(calls[1].pathname, '/writing-api/api/v1/admin/writing-flow/operator-events');
  assert.equal(calls[1].searchParams.get('classCode'), 'IC2200');
  assert.equal(calls[1].searchParams.get('eventType'), 'class_mapping_changed');
  assert.equal(calls.every(call => call.origin === 'https://example.invalid'), true);
});

test('dashboard giữ đủ điều khiển xóa lọc, đổi thứ tự cột và drill-down biểu đồ', async () => {
  const [html, script] = await Promise.all([
    readFile(new URL('../writing-flow.html', import.meta.url), 'utf8'),
    readFile(new URL('../js/writing-flow.js', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /id="flow-clear-filters"/u);
  assert.match(html, /data-view="audit"/u);
  assert.match(html, /data-view="mapping"/u);
  assert.match(html, /id="flow-stage-status"/u);
  assert.match(html, /id="flow-class-stage-summary"/u);
  assert.match(html, /id="flow-class-daily-chart"/u);
  assert.match(script, /line\.draggable = state\.visibleColumns\.includes\(key\)/u);
  assert.match(script, /addEventListener\('drop'/u);
  assert.match(script, /openDailyDetails\(item\.day\)/u);
  assert.match(script, /state\.activeView = 'delivered'/u);
  assert.match(script, /writingOperatorEvents/u);
  assert.match(script, /pinned-classes:v1/u);
  assert.match(script, /recent-classes:v1/u);
  assert.match(script, /flow-stage-breakdown/u);
  assert.match(script, /attempts: \['Số lần thử'/u);
  assert.match(script, /error: \['Lỗi gần nhất'/u);
  assert.match(script, /flow-mapping-coverage/u);
});
