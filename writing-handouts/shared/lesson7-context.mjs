const key = 'izone:writing67:lesson7-entry';
const assignmentPattern = /^hw-k67-writing-lesson6-[1-9]\d{0,17}$/;
const valid = value => assignmentPattern.test(value?.assignmentId || '') && /^[\w-]{20,200}$/.test(value?.documentId || '');

export function rememberLesson7Entry(context) {
  if (!valid(context)) throw Error('WRITING_ENTRY_REQUIRED');
  sessionStorage.setItem(key, JSON.stringify({ assignmentId: context.assignmentId, documentId: context.documentId }));
}

export function lesson7Entry(search = location.search) {
  const query = new URLSearchParams(search);
  if (query.get('from') !== 'lesson6' || query.get('mode') !== 'student' || query.get('workspace') !== 'k67') return null;
  try {
    const context = JSON.parse(sessionStorage.getItem(key));
    return valid(context) && context.assignmentId === query.get('assignment') ? context : null;
  } catch { return null; }
}
