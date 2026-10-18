// Chỉ danh tính cũ được chuyển, qua nguồn chỉ đọc giả; không lấy nháp/phiên làm quyền.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudentIdentityMemory, STUDENT_IDENTITY_KEY } from '../shared/student-identity.js';
import { collectLegacyStudentIdentities, migrateLegacyStudentIdentity } from '../shared/student-identity-migration.js';
const a = '11111111-1111-4111-8111-111111111111', b = '22222222-2222-4222-8222-222222222222';
function setup(values = {}) {
  const data = new Map(Object.entries(values).map(([k, v]) => [k, JSON.stringify(v)]));
  const storage = { get length() { return data.size; }, key: n => [...data.keys()][n], getItem: k => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v) };
  let revision = 0;
  const memory = createStudentIdentityMemory({ getStorage: () => storage, eventTarget: null, createRevision: () => 'revision_' + (++revision) });
  const notices = [], calls = [];
  const run = (resolver = () => '900001') => migrateLegacyStudentIdentity({ memory, getStorage: () => storage, notify: v => notices.push(v),
    requestIdentity: async input => { calls.push(input); const id = await resolver(input); return { ok: true, status: 'unique', identity: { authority: 'erp-contact', id },
      aliases: [{ studentRef: input.studentRef || a, classId: '1293', classCode: 'IC2304', studentName: 'Người giả' }] }; } });
  return { memory, data, storage, run, notices, calls };
}
const old = 'izone:remembered-writing-student:v1:https://ducizone.ddns.net/writing-api';
test('Không có ghi nhớ cũ: không gọi máy chủ và không tạo danh tính', async () => {
  const f = setup({ ['izone-test:term-test-1:IC2304']: { studentRef: a, attemptToken: b, drafts: { writing: 'Nháp A' } } });
  assert.deepEqual(collectLegacyStudentIdentities(f.storage), []); assert.equal((await f.run()).status, 'empty'); assert.deepEqual(f.calls, []);
});
test('Nhiều UUID cũ cùng người ERP được chuyển một lần, giữ nguyên mọi khóa/nháp cũ', async () => {
  const f = setup({ [old]: { version: 1, studentRef: a }, 'reading-practice67-identity': { studentId: b } });
  const before = new Map(f.data); const result = await f.run();
  assert.equal(result.identity.id, '900001'); assert.equal(f.calls.length, 2);
  for (const [key, value] of before) assert.equal(f.data.get(key), value);
  assert.equal((await f.run()).identity.id, '900001'); assert.equal(f.calls.length, 2);
});
test('Hai người cũ khác ERP: yêu cầu chọn một lần, không đoán hoặc ghi người mặc định', async () => {
  const f = setup({ [old]: { version: 1, studentRef: a }, 'izone-handout67:identity': { studentRef: b } });
  assert.equal((await f.run(input => input.studentRef === a ? '900001' : '900002')).status, 'legacy_conflict');
  assert.deepEqual(f.notices, ['legacy_conflict']); assert.equal(f.data.has(STUDENT_IDENTITY_KEY), false);
});
test('Lỗi một nguồn không bị bỏ qua để chọn người của nguồn còn lại', async () => {
  const f = setup({ [old]: { version: 1, studentRef: a }, 'listening-practice67-identity': { studentId: b } });
  assert.equal((await f.run(input => { if (input.studentRef === b) throw Error('Nguồn lỗi'); return '900001'; })).status, 'legacy_unresolved');
  assert.equal(f.memory.read().status, 'empty');
});
test('Dấu Đổi người học ngăn hồi sinh tất cả ghi nhớ cũ', async () => {
  const f = setup({ [old]: { version: 1, studentRef: a } }); f.memory.forget(null);
  assert.equal((await f.run()).status, 'empty'); assert.deepEqual(f.calls, []);
});
test('Đổi sang B trong lúc tra mã cũ A: không ghi A đè B', async () => {
  const f = setup({ [old]: { version: 1, studentRef: a } });
  const result = await f.run(() => { f.memory.remember({ authority: 'erp-contact', id: '900002' }, null); return '900001'; });
  assert.equal(result.identity.id, '900002'); assert.equal(f.memory.read().identity.id, '900002');
});
test('Mã tạm/demo không được chuyển; lobby Substitute chỉ đối chiếu ERP hợp lệ', async () => {
  const f = setup({ 'izone-mini-identity:v2': { studentRef: a, temporary: true },
    ['izone-test:substitute-test-1-k56:RETAKE-LOBBY:server-grade:state-v2:' + a + ':lobby']: { studentRef: '900001', classCode: 'IC2304' },
    ['izone-test:substitute-test-2-k67:RETAKE-LOBBY:server-grade:state-v2:' + b + ':lobby']: { studentRef: '990001', classCode: 'DEMO' } });
  assert.deepEqual(collectLegacyStudentIdentities(f.storage), [{ identity: { authority: 'erp-contact', id: '900001' } }]);
  assert.equal((await f.run()).identity.id, '900001'); assert.equal(f.calls.length, 1);
});
