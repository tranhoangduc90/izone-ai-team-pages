// Nhận mã bài/lớp và người đã chọn; tách bộ nhớ nháp theo người, không cấp quyền.
// Dữ liệu cũ được sao chép đúng chủ, giữ nguyên bản gốc để tab đang làm vẫn dùng được.
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bindingKey = 'izoneStudentProductStateV1';

export function createStudentProductState({ product, classCode, suffix = '', legacyKeys,
  getStorages = () => [sessionStorage, localStorage],
  history = globalThis.history, navigationType = globalThis.performance?.getEntriesByType('navigation')[0]?.type } = {}) {
  const legacy = Object.freeze(legacyKeys || { state: `izone-test:${product}:${classCode}${suffix}`,
    ui: `izone-test-ui:${product}:${classCode}${suffix}`,
    annotations: `izone-test-annotations:${product}:${classCode}${suffix}` });
  let owner = null;
  function stores() { try { return getStorages().filter(Boolean); } catch { return []; } }
  function read(key, candidates = stores(), accepts = () => true) {
    for (const storage of candidates) {
      try {
        const value = JSON.parse(storage.getItem(key) || 'null');
        if (value && typeof value === 'object' && !Array.isArray(value) && accepts(value)) return value;
      } catch { /* Không xóa dữ liệu lỗi hoặc dữ liệu của người khác. */ }
    }
    return null;
  }
  function keysFor(studentRef, legacyScope = false) {
    return legacyScope ? legacy : Object.fromEntries(Object.entries(legacy)
      .map(([kind, key]) => [kind, `${key}:student:${studentRef}`]));
  }
  function pin(studentRef, legacyScope = false) {
    owner = { product, classCode, studentRef, legacyScope };
    try { history?.replaceState({ ...(history.state || {}), [bindingKey]: owner }, ''); }
    catch { /* Không cần history để giữ đúng chủ trong tab đang mở. */ }
  }
  const previous = history?.state?.[bindingKey];
  if (previous?.product === product && previous?.classCode === classCode && uuid.test(previous.studentRef)
      && typeof previous.legacyScope === 'boolean') pin(previous.studentRef, previous.legacyScope);
  // Chỉ khôi phục tab cũ bằng bộ nhớ của chính tab khi reload/quay lại.
  // Tab mới không tự nhận chủ từ localStorage hoặc sessionStorage được cửa sổ cha sao chép.
  const explicitlyUnbound = previous?.product === product && previous?.classCode === classCode && previous?.cleared === true;
  if (!owner && !explicitlyUnbound && ['reload', 'back_forward'].includes(navigationType)) {
    const previousState = read(legacy.state, stores().slice(0, 1));
    if (uuid.test(previousState?.studentRef || '') && (previousState.attemptToken || previousState.examSessionToken)
        && (previousState.listeningStartedAt || previousState.readingStartedAt || previousState.writingStartedAt))
      pin(previousState.studentRef, true);
  }
  function current() {
    if (!owner) return { studentRef: '', scope: '', keys: null, state: {} };
    const keys = keysFor(owner.studentRef, owner.legacyScope);
    const saved = read(keys.state, stores(), value => value.studentRef === owner.studentRef);
    return { studentRef: owner.studentRef, scope: owner.legacyScope ? '' : `:student:${owner.studentRef}`,
      keys, state: saved?.studentRef === owner.studentRef ? saved : {} };
  }
  function bind(studentRef) {
    if (!uuid.test(studentRef || '')) throw new Error('STUDENT_STATE_OWNER_INVALID');
    studentRef = studentRef.toLowerCase();
    if (owner?.studentRef === studentRef) return current();
    pin(studentRef);
    const keys = keysFor(studentRef);
    const scoped = read(keys.state);
    if (scoped?.studentRef === studentRef) return current();
    // Mỗi nơi lưu phải kiểm đúng chủ; session sao chép từ tab B không che nháp A.
    const legacyStore = stores().find(storage => read(legacy.state, [storage], value => value.studentRef === studentRef));
    const old = legacyStore && read(legacy.state, [legacyStore]);
    if (!old) return current();
    // Không ghi đè phiên đã tách, kể cả bản đó hỏng: giữ lại để có thể khôi phục.
    if (scoped) return current();
    for (const [kind, target] of Object.entries(keys)) {
      // Ghi chú và bố cục đi cùng nơi giữ nháp đúng chủ, không lấy từ tab người khác.
      const value = kind === 'state' ? old : read(legacy[kind], [legacyStore]);
      if (!value) continue;
      for (const storage of stores()) {
        try { if (!storage.getItem(target)) storage.setItem(target, JSON.stringify(value)); }
        catch { /* Bản gốc còn nguyên; caller có thể tiếp tục bằng state được trả về. */ }
      }
    }
    const result = current();
    return { ...result, state: Object.keys(result.state).length ? result.state : old };
  }
  function unbind() {
    owner = null;
    try {
      const next = { ...(history?.state || {}) };
      next[bindingKey] = { product, classCode, cleared: true };
      history?.replaceState(next, '');
    } catch { /* Chỉ bỏ liên kết tab, không xóa bài của người trước. */ }
  }
  return { current, bind, unbind };
}
