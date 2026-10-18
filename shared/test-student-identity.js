// Phần nối dùng chung cho các kiểu Test: quy đổi danh tính, giữ chủ nháp và
// chỉ nhớ người sau khi trang đã kiểm được phiên. Không mở bài, tải audio hoặc chạy giờ.
import { createStudentIdentityMemory } from './student-identity.js?v=20261018-identity-v1';
import { createStudentIdentityClient, selectStudentIdentityAlias } from './student-identity-client.js?v=20261018-identity-v1';
import { createStudentProductState } from './student-product-state.js?v=20261018-identity-v1';

export function createTestStudentIdentity({ product, classCode, suffix = '', legacyKeys, requestIdentity,
  getStorages, history, navigationType, memory = createStudentIdentityMemory() } = {}) {
  const client = createStudentIdentityClient({ memory, requestIdentity });
  const productState = createStudentProductState({ product, classCode, suffix, legacyKeys,
    ...(getStorages ? { getStorages } : {}), ...(history ? { history } : {}),
    ...(navigationType ? { navigationType } : {}) });
  let version = 0, selection = null, activeId = '';
  async function resolveRemembered() {
    const generation = version;
    const resolved = await client.resolveRemembered({ classHint: classCode });
    const selected = selectStudentIdentityAlias(resolved, { classHint: classCode });
    if (generation !== version || (resolved.snapshot?.status === 'ok' && !client.isCurrent(resolved)))
      return { status: 'changed', student: null };
    return { status: selected.status, resolution: resolved, student: selected.alias
      ? { ref: selected.alias.studentRef, name: selected.alias.studentName } : null };
  }
  function select(student, { resolution = null, remember = true } = {}) {
    const generation = ++version;
    const snapshot = resolution?.snapshot || client.captureSelection();
    const lookup = resolution ? Promise.resolve(resolution) : client.resolveSelection({ studentRef: student.ref, classHint: classCode });
    const pending = lookup.then(value => ({ value }), error => ({ error }));
    if (resolution?.identity) activeId = resolution.identity.id;
    selection = { generation, studentRef: student.ref, automatic: Boolean(resolution), snapshot, pending, remember };
    return productState.bind(student.ref);
  }
  async function prepared(studentRef) {
    const context = selection;
    if (!context || context.studentRef !== studentRef) return { status: 'not_selected' };
    if (context.generation !== version) return { status: 'changed' };
    if (context.automatic) return { status: 'ok' };
    if (!context.remember) return (memory.forgetAtomic || memory.forget)(context.snapshot?.revision);
    const result = await context.pending;
    if (context.generation !== version || selection !== context) return { status: 'changed' };
    if (result.error) return { status: 'unavailable' };
    if (result.value.status === 'unique') activeId = result.value.identity.id;
    return client.rememberResolvedSelection(result.value, context.snapshot);
  }
  function forget() {
    const snapshot = memory.read(), result = (memory.forgetAtomic || memory.forget)(snapshot.revision);
    const finish = value => { if (value.status !== 'empty') return value;
      ++version; selection = null; activeId = ''; productState.unbind(); return value; };
    return result?.then ? result.then(finish) : finish(result);
  }
  function subscribe(listener) {
    return memory.subscribe(record => { if (record.status !== 'ok' || record.identity.id !== activeId) listener(record); });
  }
  return { current: productState.current, select, prepared, resolveRemembered, forget, subscribe,
    migrateLegacy: client.migrateLegacy,
    read: memory.read, invalidate: () => { ++version; } };
}
