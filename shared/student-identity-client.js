// Nhận kết quả quy đổi từ API của sản phẩm và bộ nhớ chung; không tự mở/nộp bài.
// Caller dùng snapshot để kiểm lại trước khi áp dụng kết quả sau các lần chờ khác.
import { normalizeStudentIdentity } from './student-identity.js?v=20261018-identity-v1';
import { migrateLegacyStudentIdentity } from './student-identity-migration.js?v=20261018-identity-v1';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const classCode = value => typeof value === 'string' ? value.trim().toUpperCase() : '';
const validClassCode = value => /^[A-Z0-9._-]{2,32}$/.test(value);

export class StudentIdentityError extends Error {
  constructor(code) {
    super(code === 'IDENTITY_SOURCE_INVALID'
      ? 'Kết quả nhận diện chưa khớp. Hãy thử lại.'
      : 'Chưa kiểm được người học. Hãy thử lại sau.');
    this.code = code;
  }
}

function validatedResult(value, input) {
  if (!value || value.ok !== true || !['unique', 'missing', 'ambiguous'].includes(value.status)
      || !Array.isArray(value.aliases)) throw new StudentIdentityError('IDENTITY_SOURCE_INVALID');
  if (value.status !== 'unique') {
    if (value.identity !== null || value.aliases.length) throw new StudentIdentityError('IDENTITY_SOURCE_INVALID');
    return { status: value.status, identity: null, aliases: [] };
  }
  const identity = normalizeStudentIdentity(value.identity);
  if (!identity || !value.aliases.length || (input.identity && identity.id !== input.identity.id))
    throw new StudentIdentityError('IDENTITY_SOURCE_INVALID');
  const aliases = value.aliases.map(alias => {
    if (!alias || !uuid.test(alias.studentRef || '') || typeof alias.classId !== 'string'
        || !/^[1-9][0-9]{0,18}$/.test(alias.classId) || !validClassCode(classCode(alias.classCode))
        || typeof alias.studentName !== 'string' || !alias.studentName.trim()
        || (input.studentRef && alias.studentRef.toLowerCase() !== input.studentRef.toLowerCase())
        || (input.classCode && classCode(alias.classCode) !== input.classCode))
      throw new StudentIdentityError('IDENTITY_SOURCE_INVALID');
    return { classId: alias.classId, classCode: classCode(alias.classCode),
      studentRef: alias.studentRef.toLowerCase(), studentName: alias.studentName };
  });
  return { status: 'unique', identity, aliases };
}

// Chỉ chọn khi đúng một mã phù hợp ngữ cảnh của sản phẩm. Danh tính một người có
// nhiều lớp là hợp lệ; chưa rõ bài/lớp thì trả ambiguous thay vì lấy phần tử đầu.
export function selectStudentIdentityAlias(result, { classHint = '', studentRef = '', allowedClassCodes } = {}) {
  if (result?.status !== 'unique') return { status: result?.status || 'missing', alias: null };
  const hint = classCode(classHint);
  const allowed = allowedClassCodes === undefined ? null : new Set(allowedClassCodes.map(classCode));
  const aliases = result.aliases.filter(alias => (!hint || alias.classCode === hint)
    && (!studentRef || alias.studentRef === studentRef.toLowerCase())
    && (!allowed || allowed.has(alias.classCode)));
  return aliases.length === 1 ? { status: 'unique', alias: aliases[0] }
    : { status: aliases.length ? 'ambiguous' : 'missing', alias: null };
}

export function createStudentIdentityClient({ memory, requestIdentity, maxPending = 16 }) {
  const pending = new Map();
  async function request(input) {
    const key = JSON.stringify(input);
    let task = pending.get(key);
    if (!task) {
      // Gộp lượt đang chờ; không giữ kết quả quyền hoặc lỗi sau khi yêu cầu kết thúc.
      task = Promise.resolve().then(() => requestIdentity(input)).then(value => validatedResult(value, input));
      if (pending.size < maxPending) pending.set(key, task);
    }
    try { return await task; }
    finally { if (pending.get(key) === task) pending.delete(key); }
  }

  async function resolveRemembered({ classHint = '' } = {}) {
    let snapshot = memory.read();
    if(snapshot.status==='empty'&&snapshot.revision===null)snapshot=await migrateLegacyStudentIdentity({ memory });
    if (['legacy_conflict', 'legacy_unresolved'].includes(snapshot.status)) return { status: snapshot.status, identity: null, aliases: [], snapshot: memory.read() };
    if (snapshot.status !== 'ok') return { status: snapshot.status, identity: null, aliases: [], snapshot };
    const hint = classCode(classHint);
    if (hint && !validClassCode(hint)) throw new StudentIdentityError('IDENTITY_INPUT_INVALID');
    const result = await request({ identity: snapshot.identity, ...(hint ? { classCode: hint } : {}) });
    if (!memory.isCurrent(snapshot)) return { status: 'changed', identity: null, aliases: [], snapshot };
    return { ...result, snapshot };
  }

  async function resolveSelection({ studentRef, classHint = '' }) {
    const hint = classCode(classHint);
    if (!uuid.test(studentRef || '') || (hint && !validClassCode(hint))) return { status: 'invalid' };
    return request({ studentRef: studentRef.toLowerCase(), ...(hint ? { classCode: hint } : {}) });
  }

  function rememberResolvedSelection(result, snapshot) {
    // Snapshot chụp khi học viên chọn, trước khi chờ. Chỉ commit sau khi sản phẩm
    // xác minh mở phiên thành công; phép tra mã có thể chạy song song để tránh chờ nối tiếp.
    if (!snapshot || !['ok', 'empty', 'invalid'].includes(snapshot.status))
      return { status: snapshot?.status || 'invalid' };
    if (result.status !== 'unique') return result;
    return (memory.rememberAtomic || memory.remember)(result.identity, snapshot.revision);
  }

  async function rememberSelection(input, snapshot) {
    if (!snapshot || !['ok', 'empty', 'invalid'].includes(snapshot.status))
      return { status: snapshot?.status || 'invalid' };
    return rememberResolvedSelection(await resolveSelection(input), snapshot);
  }

  return { captureSelection: () => memory.read(), resolveRemembered, resolveSelection,
    migrateLegacy: () => migrateLegacyStudentIdentity({ memory }),
    rememberSelection, rememberResolvedSelection,
    isCurrent: result => memory.isCurrent(result?.snapshot) };
}
