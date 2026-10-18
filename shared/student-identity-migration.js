// Chuyển riêng các khóa ghi nhớ cũ sau đối chiếu máy chủ; không lấy nháp làm danh tính.
// Không xóa dữ liệu cũ. Nhiều người/lỗi nguồn dừng tự chọn và giữ đường chọn tay một lần.
import { normalizeStudentIdentity } from './student-identity.js?v=20261018-identity-v1';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const pending = new WeakMap();
export function collectLegacyStudentIdentities(storage) {
  const candidates = new Map();
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    const shared = key?.startsWith('izone:remembered-writing-student:v1:');
    const practice = ['reading-practice67-identity', 'listening-practice67-identity'].includes(key);
    const handout = key === 'izone-handout67:identity', mini = key === 'izone-mini-identity:v2';
    const substitute = /^izone-test:substitute-test-[12]-k(?:56|67):[^:]+:server-grade:state-v2:[^:]+:lobby$/.test(key || '');
    if (!shared && !practice && !handout && !mini && !substitute) continue;
    let record;
    try { record = JSON.parse(storage.getItem(key)); } catch { continue; }
    if (!record || record.temporary || record.provisional || record.classCode === 'DEMO') continue;
    if (shared && record.version !== 1) continue;
    const ref = practice ? record.studentId : record.studentRef;
    if (substitute) {
      const identity = normalizeStudentIdentity({ authority: 'erp-contact', id: ref });
      if (identity) candidates.set('erp:' + identity.id, { identity });
    } else if (typeof ref === 'string' && uuid.test(ref)) candidates.set('uuid:' + ref.toLowerCase(), { studentRef: ref.toLowerCase() });
  }
  return [...candidates.values()];
}
export async function requestLegacyStudentIdentity(input) {
  const response = await fetch('https://ducizone.ddns.net/mapping-api/api/student-identity/resolve', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
    cache: 'no-store', signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) throw new Error('LEGACY_IDENTITY_SOURCE_UNAVAILABLE');
  return response.json();
}
function showMigrationNotice(status, memory) {
  if (!globalThis.document) return;
  let notice = document.getElementById('studentIdentityMigrationNotice');
  if (!notice) { notice = document.createElement('aside'); notice.id = 'studentIdentityMigrationNotice';
    notice.className = 'notice'; notice.setAttribute('role', 'alert'); document.body.prepend(notice); }
  notice.textContent = status === 'legacy_conflict'
    ? 'Trình duyệt đang nhớ nhiều người từ các bài cũ. Hãy chọn đúng bạn một lần; các bài sau sẽ dùng chung lựa chọn đó. Bài và nháp cũ vẫn được giữ.'
    : 'Chưa đối chiếu đủ thông tin đăng nhập cũ. Bạn có thể chọn đúng người một lần; các bài và nháp cũ vẫn được giữ.';
  const stop = memory.subscribe(value => { if (['ok', 'empty'].includes(value.status) && value.revision) { notice.remove(); stop(); } });
}
export async function migrateLegacyStudentIdentity({ memory, getStorage = () => globalThis.localStorage,
  requestIdentity = requestLegacyStudentIdentity, notify = status => showMigrationNotice(status, memory) }) {
  const before = memory.read();
  if (before.status !== 'empty' || before.revision !== null) return before;
  if (pending.has(memory)) return pending.get(memory);
  const task = (async () => {
    let candidates;
    try { const storage = getStorage(); if (!storage) return before; candidates = collectLegacyStudentIdentities(storage); }
    catch { return before; }
    if (!candidates.length) return before;
    if (candidates.length > 64) { notify('legacy_conflict'); return { status: 'legacy_conflict' }; }
    const identities = new Map();
    try {
      // Ít yêu cầu song song để lần chuyển đầu không dồn tải từ một trình duyệt.
      for (let offset = 0; offset < candidates.length; offset += 4) {
        const batch = candidates.slice(offset, offset + 4);
        const results = await Promise.all(batch.map(input => requestIdentity(input)));
        results.forEach((result, i) => {
          const identity = normalizeStudentIdentity(result?.identity), input = batch[i];
          if (result?.ok !== true || result.status !== 'unique' || !identity || !Array.isArray(result.aliases) || !result.aliases.length
            || (input.identity && input.identity.id !== identity.id)
            || result.aliases.some(alias => !uuid.test(alias.studentRef || '') || (input.studentRef && alias.studentRef.toLowerCase() !== input.studentRef)))
            throw new Error('LEGACY_IDENTITY_UNRESOLVED');
          identities.set(identity.id, identity);
        });
      }
    } catch {
      const current = memory.read(); if (current.revision !== before.revision || current.status !== before.status) return current;
      notify('legacy_unresolved'); return { status: 'legacy_unresolved' };
    }
    const current = memory.read();
    if (current.revision !== before.revision || current.status !== before.status) return current;
    if (identities.size !== 1) { notify('legacy_conflict'); return { status: 'legacy_conflict' }; }
    return (memory.rememberAtomic || memory.remember)(identities.values().next().value, before.revision);
  })();
  pending.set(memory, task);
  try { return await task; } finally { if (pending.get(memory) === task) pending.delete(memory); }
}
