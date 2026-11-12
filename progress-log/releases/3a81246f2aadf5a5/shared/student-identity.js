// Nhận mã ERP đã được máy chủ kiểm; chỉ nhớ người học, không nhớ quyền hoặc mã phiên.
// Mọi sản phẩm cùng origin dùng khóa này. Lỗi bộ nhớ trả trạng thái để app vẫn xử lý được.
export const STUDENT_IDENTITY_KEY = 'izone:student-identity:v1';
const changeEvent = 'izone:student-identity:changed:v1';
const revisionPattern = /^[A-Za-z0-9_-]{8,100}$/;
const maxContactId = '9223372036854775807';

// Mọi writer mới xếp lượt qua cùng một giao dịch ghi IndexedDB trước khi đọc–ghi
// bản nhận diện trong localStorage. Hai tab không chen nhau giữa kiểm revision và ghi.
// Kho này chỉ có khóa điều phối, không lưu bài hoặc danh tính. Bị chặn thì trả lỗi, không ghi liều.
function browserIdentityWrite(action) {
  if (!globalThis.window) return action(); // Kiểm đơn vị Node không có các tab trình duyệt.
  return new Promise(resolve => {
    let connection, transaction, result, done = false;
    const finish = value => { if (done) return; done = true; clearTimeout(timer); connection?.close(); resolve(value); };
    const timer = setTimeout(() => { try { transaction?.abort(); } catch {} finish(empty('unavailable')); }, 2000);
    try {
      const opened = globalThis.indexedDB.open('izone-student-identity-coordination-v1', 1);
      opened.onupgradeneeded = () => opened.result.createObjectStore('writer');
      opened.onerror = () => finish(empty('unavailable'));
      opened.onblocked = () => finish(empty('unavailable'));
      opened.onsuccess = () => {
        connection = opened.result;
        if (done) { connection.close(); return; }
        try {
          transaction = connection.transaction('writer', 'readwrite');
          transaction.onabort = transaction.onerror = () => finish(empty('unavailable'));
          transaction.oncomplete = () => finish(result || empty('unavailable'));
          transaction.objectStore('writer').get('gate').onsuccess = () => {
            if (done) { transaction.abort(); return; }
            try { result = action(); } catch { transaction.abort(); }
          };
        } catch { finish(empty('unavailable')); }
      };
    } catch { finish(empty('unavailable')); }
  });
}

export function normalizeStudentIdentity(value) {
  if (!value || value.authority !== 'erp-contact' || typeof value.id !== 'string') return null;
  // Giữ bigint ở dạng chuỗi: chuyển sang Number có thể gộp hai mã lớn thành một.
  if (!/^[1-9][0-9]{0,18}$/.test(value.id)
      || (value.id.length === 19 && value.id > maxContactId)) return null;
  return { authority: 'erp-contact', id: value.id };
}

function empty(status) {
  return { status, identity: null, revision: null };
}

function readStoredIdentity(storage) {
  try {
    const raw = storage.getItem(STUDENT_IDENTITY_KEY);
    if (raw === null) return empty('empty');
    const record = JSON.parse(raw);
    if (record?.version !== 1 || typeof record.revision !== 'string'
        || !revisionPattern.test(record.revision) || typeof record.updatedAt !== 'string') return empty('invalid');
    const instant = Date.parse(record.updatedAt);
    if (!Number.isFinite(instant) || new Date(instant).toISOString() !== record.updatedAt) return empty('invalid');
    const state = { revision: record.revision, updatedAt: record.updatedAt };
    // Giữ dấu đã quên, không giữ người cũ: chặn yêu cầu cũ và ngăn nhập lại bộ nhớ legacy.
    if (record.identity === null) return { status: 'empty', identity: null, ...state };
    const identity = normalizeStudentIdentity(record.identity);
    if (!identity) return empty('invalid');
    return { status: 'ok', identity, ...state };
  } catch (error) {
    return empty(error instanceof SyntaxError ? 'invalid' : 'unavailable');
  }
}

export function createStudentIdentityMemory({
  getStorage = () => globalThis.localStorage,
  eventTarget = globalThis.window,
  clock = Date.now,
  createRevision = () => globalThis.crypto.randomUUID(),
} = {}) {
  function read() {
    try { return readStoredIdentity(getStorage()); }
    catch { return empty('unavailable'); }
  }

  function notify() {
    // Sự kiện storage chỉ đến tab khác; sự kiện riêng báo cho các phần trong cùng tab.
    eventTarget?.dispatchEvent(new Event(changeEvent));
  }

  function writable(expectedRevision) {
    if (expectedRevision !== null
        && (typeof expectedRevision !== 'string' || !revisionPattern.test(expectedRevision))) return empty('invalid');
    const current = read();
    if (current.status === 'unavailable') return current;
    if (current.revision !== expectedRevision) return { ...current, status: 'conflict' };
    return null;
  }

  // Nhận dấu danh tính từ trước yêu cầu bất đồng bộ; phản hồi cũ không được ghi đè người mới.
  // Đây là kiểm thay đổi trước ghi và đọc lại sau ghi, không phải transaction liên tab.
  function storeRecord(identity, expectedRevision) {
    const rejected = writable(expectedRevision);
    if (rejected) return rejected;
    let record;
    try {
      const revision = createRevision();
      if (typeof revision !== 'string' || !revisionPattern.test(revision)) return empty('invalid');
      record = { version: 1, identity, revision, updatedAt: new Date(clock()).toISOString() };
      getStorage().setItem(STUDENT_IDENTITY_KEY, JSON.stringify(record));
    } catch { return empty('unavailable'); }
    const saved = read();
    if (saved.status === 'unavailable') return saved;
    if (saved.revision !== record.revision || saved.status !== (identity ? 'ok' : 'empty')
        || saved.identity?.id !== identity?.id) return { ...saved, status: 'conflict' };
    notify();
    return saved;
  }

  function remember(value, expectedRevision) {
    const identity = normalizeStudentIdentity(value);
    return identity ? storeRecord(identity, expectedRevision) : empty('invalid');
  }

  function forget(expectedRevision) {
    return storeRecord(null, expectedRevision);
  }

  function isCurrent(snapshot) {
    const current = read();
    return current.status === 'ok' && snapshot?.status === 'ok'
      && current.revision === snapshot.revision
      && current.identity.id === snapshot.identity?.id;
  }

  function subscribe(listener) {
    if (!eventTarget) return () => {};
    const changed = event => {
      if (event.type === 'storage') {
        if (event.key !== null && event.key !== STUDENT_IDENTITY_KEY) return;
        try { if (event.storageArea && event.storageArea !== getStorage()) return; }
        catch { /* Đọc bên dưới trả unavailable nếu trình duyệt chặn bộ nhớ. */ }
      }
      // Chỉ báo thay đổi. Bộ nhớ chung không sửa danh tính đã ghim vào bài đang làm.
      listener(read());
    };
    eventTarget.addEventListener('storage', changed);
    eventTarget.addEventListener(changeEvent, changed);
    return () => {
      eventTarget.removeEventListener('storage', changed);
      eventTarget.removeEventListener(changeEvent, changed);
    };
  }

  return { read, remember, forget, isCurrent, subscribe,
    rememberAtomic: (value, expectedRevision) => browserIdentityWrite(() => remember(value, expectedRevision)),
    forgetAtomic: expectedRevision => browserIdentityWrite(() => forget(expectedRevision)) };
}
