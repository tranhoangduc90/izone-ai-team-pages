// Nhận roster đã được API Substitute kiểm và phiên lịch sử hiện hành.
// Portal dùng mã ERP dạng số; DEMO không được ghi thành người chính thức.
import { createStudentIdentityMemory, normalizeStudentIdentity } from './student-identity.js?v=20261018-identity-v1';
import { migrateLegacyStudentIdentity } from './student-identity-migration.js?v=20261018-identity-v1';
const tabKey = 'izoneSubstituteIdentityV1';

export function createSubstituteStudentIdentity({ testSlug, historyEpoch, history = globalThis.history,
  memory = createStudentIdentityMemory(), navigationType = globalThis.performance?.getEntriesByType('navigation')[0]?.type } = {}) {
  let activeId = '';
  function sameProduct(value) { return value?.testSlug === testSlug && value?.historyEpoch === historyEpoch; }
  function pin(value) {
    const binding = { testSlug, historyEpoch, classCode: value.classCode, studentRef: value.studentRef,
      clientRunId: value.clientRunId };
    try { history.replaceState({ ...(history.state || {}), [tabKey]: binding }, ''); }
    catch { /* Quyền/phiên vẫn do Substitute kiểm, không dựa vào history. */ }
  }
  function mayRestore(value) {
    const tab = history?.state?.[tabKey];
    if (sameProduct(tab)) return tab.cleared !== true
      && ['classCode', 'studentRef', 'clientRunId'].every(key => String(tab[key] || '') === String(value[key] || ''));
    return ['reload', 'back_forward'].includes(navigationType);
  }
  function selectFromRoster(classCode, students) {
    const snapshot = memory.read();
    if (snapshot.status !== 'ok' || classCode === 'DEMO') return { status: snapshot.status, snapshot, student: null };
    const matches = students.filter(student => typeof student.ref === 'string' && student.ref === snapshot.identity.id);
    return { status: matches.length === 1 ? 'unique' : matches.length ? 'ambiguous' : 'missing', snapshot,
      student: matches.length === 1 ? matches[0] : null };
  }
  function rememberSelected(classCode, student, snapshot) {
    if (classCode === 'DEMO') return { status: 'demo' };
    const identity = normalizeStudentIdentity({ authority: 'erp-contact', id: student?.ref });
    if (!identity) return { status: 'invalid' };
    activeId = identity.id;
    if (snapshot?.status === 'ok' && snapshot.identity.id === identity.id && memory.isCurrent(snapshot)) return snapshot;
    return (memory.rememberAtomic || memory.remember)(identity, snapshot?.revision);
  }
  function forget() {
    const snapshot = memory.read(), result = (memory.forgetAtomic || memory.forget)(snapshot.revision);
    const finish = value => {
      if (value.status !== 'empty') return value;
      try { history.replaceState({ ...(history.state || {}), [tabKey]: { testSlug, historyEpoch, cleared: true } }, ''); }
      catch { return { status: 'unavailable' }; }
      activeId = ''; return value;
    };
    return result?.then ? result.then(finish) : finish(result);
  }
  function subscribe(listener) {
    return memory.subscribe(record => { if (record.status !== 'ok' || record.identity.id !== activeId) listener(record); });
  }
  return { read: memory.read, isCurrent: memory.isCurrent, mayRestore, pin,
    migrateLegacy: () => migrateLegacyStudentIdentity({ memory }),
    selectFromRoster, rememberSelected, forget, subscribe };
}
