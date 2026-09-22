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
  await api.writingSourceIssues({ classCode: 'IC2172', status: 'skipped', limit: 100 });
  await api.skipWritingSourceIssue('a'.repeat(64), 'Không phải bài Writing',
    '11111111-1111-4111-8111-111111111111');
  await api.restoreWritingSourceIssue('a'.repeat(64), 'Bỏ qua nhầm',
    '22222222-2222-4222-8222-222222222222');
  assert.equal(calls[0].pathname, '/writing-api/api/v1/admin/writing-flow/pairs');
  assert.equal(calls[0].searchParams.get('dateFrom'), '2026-09-19');
  assert.equal(calls[0].searchParams.get('dateTo'), '2026-09-19');
  assert.equal(calls[0].searchParams.get('search'), 'docs-id-demo');
  assert.equal(calls[0].searchParams.get('view'), 'delivered');
  assert.equal(calls[0].searchParams.get('stageStatus'), 'running');
  assert.equal(calls[1].pathname, '/writing-api/api/v1/admin/writing-flow/operator-events');
  assert.equal(calls[1].searchParams.get('classCode'), 'IC2200');
  assert.equal(calls[1].searchParams.get('eventType'), 'class_mapping_changed');
  assert.equal(calls[2].searchParams.get('status'), 'skipped');
  assert.match(calls[3].pathname, /source-issues\/[a-f0-9]{64}\/skip$/u);
  assert.match(calls[4].pathname, /source-issues\/[a-f0-9]{64}\/restore$/u);
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
  assert.match(script, /openDailyDetails\(day\)/u);
  assert.match(script, /state\.activeView = isTestView\(\) \? 'test_delivered' : 'delivered'/u);
  assert.match(script, /writingOperatorEvents/u);
  assert.match(script, /pinned-classes:v1/u);
  assert.match(script, /recent-classes:v1/u);
  assert.match(script, /flow-stage-breakdown/u);
  assert.match(script, /attempts: \['Số lần thử'/u);
  assert.match(script, /error: \['Lỗi gần nhất'/u);
  assert.match(script, /flow-mapping-coverage/u);
  assert.match(script, /review: \['flow-pairs-section'\]/u);
  assert.match(script, /source: \['flow-pairs-section'\]/u);
  assert.match(script, /legacy: \['flow-pairs-section'\]/u);
  assert.match(script, /sourceIssueRow/u);
  assert.match(script, /legacyRow/u);
  assert.match(script, /skipWritingSourceIssue/u);
  assert.match(script, /restoreWritingSourceIssue/u);
  assert.match(script, /status: 'skipped'/u);
  assert.match(script, /Thiếu hoặc xung đột trạng thái nguồn/u);
  assert.match(script, /item\.operational_state === 'active'/u);
  assert.doesNotMatch(script, /\['on_going', 'completed'\]\.includes\(item\.class_status\)/u);
});
