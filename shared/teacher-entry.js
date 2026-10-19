// Chỉ tạo lối vào giảng viên. Không ghi danh tính/nháp, gọi API hoặc tải Google/audio.
export function teacherEntryUrl({ product, code, teacherPath = './teacher-progress.html', context = {}, location: current = window.location, storage }) {
  const source = new URL(current.href);
  const target = new URL(teacherPath, source);
  if (code) target.searchParams.set('code', code);
  for (const key of ['class', 'classCode', 'classId', 'classRef', 'documentId', 'lesson', 'task']) {
    const value = source.searchParams.get(key) || context[key];
    if (value) target.searchParams.set(key, value);
  }
  target.searchParams.set('back', source.pathname + source.search);
  if (product === 'reading' || product === 'listening') {
    const document = source.searchParams.get('documentId') || (product === 'reading' ? `lesson:${source.searchParams.get('lesson') || '9'}` : 'entry');
    let entry = new URLSearchParams(source.hash.split('?')[1]).get('entry') || '';
    if (!entry) try { entry = (storage || window.sessionStorage).getItem(`${product}-practice67-entry:${document}`) || ''; } catch { /* Thiết bị chặn lưu: link chung vẫn dùng được. */ }
    if (/^[\w-]{43}$/.test(entry)) target.hash = new URLSearchParams({ entry }).toString();
  }
  if (product === 'progress-log') {
    const assignment = new URLSearchParams(source.hash.slice(1)).get('assignment');
    if (assignment) target.hash = new URLSearchParams({assignment}).toString();
  }
  return target.href;
}

export function installTeacherEntry({ product, code, hosts, teacherPath, context } = {}) {
  for (const host of hosts || []) {
    if (!host || host.querySelector('[data-teacher-entry]')) continue;
    const link = document.createElement('a');
    link.dataset.teacherEntry = product;link.className = 'teacher-entry-link';link.textContent = 'Giảng viên';
    link.target = '_blank';link.rel = 'noopener noreferrer';link.setAttribute('aria-label', 'Giảng viên · Mở tab mới');
    const update = () => {
      const currentCode = document.body.dataset.teacherCode || code;
      link.href = teacherEntryUrl({ product, code: currentCode, teacherPath, context });
    };
    update();link.addEventListener('click', update);link.addEventListener('focus', update);host.append(link);
  }
}

const product = typeof document !== 'undefined' && document.body?.dataset.teacherProduct;
if (product) installTeacherEntry({ product, teacherPath: document.body.dataset.teacherPath, hosts: [document.querySelector('.studio-header, .topbar')] });
