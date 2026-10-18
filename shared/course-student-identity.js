// Nối nhận diện cho bài trong khóa: chỉ tra mã và ghim chủ tab, không bắt đầu/nộp bài.
// API sản phẩm vẫn kiểm quyền và cấp token riêng. Lỗi trả về để màn chọn tay tiếp tục dùng được.
import { createStudentIdentityMemory } from './student-identity.js?v=20261018-identity-v1';
import { createStudentIdentityClient, selectStudentIdentityAlias } from './student-identity-client.js?v=20261018-identity-v1';
const bindingKey = 'izoneCourseStudentIdentityV1';
export function createCourseStudentIdentity({ product, entry, requestIdentity, memory = createStudentIdentityMemory(),
  history = globalThis.history, navigationType = globalThis.performance?.getEntriesByType('navigation')[0]?.type } = {}) {
  const client = createStudentIdentityClient({ memory, requestIdentity });
  const initial = history?.state?.[bindingKey];
  let currentBinding = initial;
  let activeId = '', generation = 0;
  function pin(studentRef, { classRef = '' } = {}) {
    currentBinding = { product, entry, studentRef, classRef };
    try { history?.replaceState({ ...(history.state || {}), [bindingKey]: currentBinding }, ''); }
    catch { /* Token trong RAM vẫn gắn đúng người, không lấy mã chung làm quyền. */ }
  }
  function canRestoreSession() {
    return initial?.product === product && initial.entry === entry && !initial.cleared
      || (!initial && ['reload', 'back_forward'].includes(navigationType));
  }
  async function resolve({ classCode = '', studentRefs, allowedClassCodes, expectedRef = '' } = {}) {
    const version = generation, result = await client.resolveRemembered({ classHint: classCode });
    if (version !== generation) return { status: 'changed' };
    let aliases = result.aliases || [];
    if (studentRefs) aliases = aliases.filter(a => studentRefs.includes(a.studentRef));
    const selected = selectStudentIdentityAlias({ ...result, aliases }, { classHint: classCode, allowedClassCodes });
    if (selected.status !== 'unique') return { ...selected, resolution: result };
    if (expectedRef && selected.alias.studentRef !== expectedRef) return { status: 'wrong_owner', resolution: result };
    return { ...selected, resolution: result };
  }
  function prepare(studentRef, classCode) {
    const snapshot = client.captureSelection(), version = generation;
    const pending = client.resolveSelection({ studentRef, classHint: classCode }).then(result => ({ result }), error => ({ error }));
    return { studentRef, snapshot, pending, version };
  }
  async function commit(context, { automatic = false, remember = true } = {}) {
    if (!context || context.version !== generation) return { status: 'changed' };
    pin(context.studentRef);
    if (automatic) {
      activeId = context.resolution?.identity?.id || '';
      return { status: 'ok' };
    }
    if (!remember) return (memory.forgetAtomic || memory.forget)(context.snapshot?.revision);
    const value = await context.pending;
    if (context.version !== generation) return { status: 'changed' };
    if (value.error) return { status: 'unavailable' };
    if (value.result.status === 'unique') activeId = value.result.identity.id;
    return client.rememberResolvedSelection(value.result, context.snapshot);
  }
  function automaticContext(selection) {
    return { studentRef: selection.alias.studentRef, resolution: selection.resolution, version: generation };
  }
  function forget() {
    const previousBinding = currentBinding;
    currentBinding = { product, entry, cleared: true };
    const snapshot = memory.read(), result = (memory.forgetAtomic || memory.forget)(snapshot.revision);
    const finish = value => {
      if (value.status !== 'empty') { currentBinding = previousBinding; return value; }
      ++generation; activeId = '';
      try { history?.replaceState({ ...(history.state || {}), [bindingKey]: { product, entry, cleared: true } }, ''); }
      catch { /* Chỉ bỏ ghim tab, không xóa nháp. */ }
      return value;
    };
    return result?.then ? result.then(finish) : finish(result);
  }
  function subscribe(listener) { return memory.subscribe(record => {
    if (record.status !== 'ok' || record.identity.id !== activeId) listener(record);
  }); }
  return { read: memory.read, canRestoreSession, pin, resolve, prepare, commit, automaticContext, forget, subscribe,
    getPinned: () => currentBinding?.product === product && currentBinding.entry === entry && !currentBinding.cleared ? currentBinding : null,
    resolveAliases: () => client.resolveRemembered(),
    isCurrent: selection => client.isCurrent(selection?.resolution),
    invalidate: () => { ++generation; } };
}

// Nguồn Mapping chỉ quy đổi mã UUID ↔ mã ERP. Không gửi token bài học sang nguồn này.
export async function requestMappingStudentIdentity(input, apiBase = 'https://ducizone.ddns.net/mapping-api') {
  const response = await fetch(apiBase.replace(/\/$/, '') + '/api/student-identity/resolve', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
    cache: 'no-store', signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) throw new Error('Chưa kiểm được mã người học.');
  return response.json();
}
