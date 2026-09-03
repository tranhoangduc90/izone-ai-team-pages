// Dữ liệu giả: hai UUID khác nhau dù cùng tên; không gọi mạng hoặc dùng phiên Google thật.
// Kiểm tìm toàn database, ghép/xóa đúng UUID và không biến lỗi API thành thành công.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTeacherApi } from '../js/api.js';

test('mọi đề dùng chung API đối soát và giữ đúng nguồn/đích', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    calls.push({ url: new URL(url), ...options });
    return new Response(JSON.stringify({ students: [], ok: true }), { status: 200 });
  });
  const api = createTeacherApi('https://example.invalid/writing-api/', () => 'fixture-only');
  const source = '11111111-1111-4111-8111-111111111111';
  const target = '22222222-2222-4222-8222-222222222222';
  await api.searchOfficialStudents('Học viên giả', source);
  assert.equal(calls[0].url.pathname, '/writing-api/api/v1/admin/official-students/search');
  assert.equal(calls[0].url.searchParams.get('q'), 'Học viên giả');
  assert.equal(calls[0].url.searchParams.get('excludeStudentRef'), source);
  assert.equal(calls[0].url.searchParams.has('classRef'), false);
  await api.reconcileProvisional(source, target);
  assert.ok(calls[1].url.pathname.endsWith('/' + source + '/reconcile'));
  assert.deepEqual(JSON.parse(calls[1].body), { officialStudentRef: target });
  await api.deleteProvisional(source);
  assert.ok(calls[2].url.pathname.endsWith('/' + source + '/delete'));
  assert.equal(calls[2].method, 'POST');
  assert.equal(calls.every(call => call.headers.authorization === 'Bearer fixture-only'), true);
});

test('lỗi ghép phải được báo, không được coi là đã ghép', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ message: 'Xung đột thử nghiệm' }), { status: 409 }));
  const api = createTeacherApi('https://example.invalid/');
  await assert.rejects(api.reconcileProvisional('source', 'target'), error => error.status === 409 && error.message === 'Xung đột thử nghiệm');
});

test('giao diện chung có tìm toàn database, xác nhận trước ghi và phiên bản chống cache cũ', async () => {
  const source = await readFile(new URL('../js/teacher-app.js', import.meta.url), 'utf8');
  const html = await readFile(new URL('../teacher.html', import.meta.url), 'utf8');
  assert.match(source, /searchOfficialStudents\(query, item.studentRef\)/);
  assert.match(source, /deleteProvisional\(item.studentRef\)/);
  assert.match(source, /reconcileProvisional\(item.studentRef, candidate.studentRef\)/);
  assert.match(source, /panel.hidden = !state.pending.length/);
  assert.match(source, /reconciliationSearches.get\(item.studentRef\)/);
  assert.match(source, /confirm\(`Ghép hồ sơ/);
  assert.match(source, /confirm\(`Xóa hồ sơ tạm/);
  assert.match(html, /teacher-app.js\?v=[^"]*20260903-reconciliation/);
  assert.match(html, /styles.css\?v=20260903-reconciliation/);
});
