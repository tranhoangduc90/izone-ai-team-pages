import runtime from '../../homework-writing/runtime-config.js?v=20261111-ic2363';
import { frontendConfiguration, createOnlineAccess } from '../../homework-writing/online-access.js?v=20261113-single-entry';

const root = document.getElementById('lesson-access');
const config = frontendConfiguration(runtime);
const query = new URLSearchParams(location.search);
const assignment = query.get('assignment');
const documentId = query.get('documentId');

function showOpeningError(host, error, retry) {
  if (error.stale) return;
  const denied = [401, 403].includes(error.status);
  const status = document.createElement('p');
  status.setAttribute('role', 'alert');
  status.textContent = denied ? 'Hãy mở lại bài từ nút Writing trong Docs cá nhân của bạn.' :
    'Chưa mở được dàn ý. Bài đã lưu vẫn được giữ.';
  if (denied) {
    host.replaceChildren(status);
    return;
  }
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'primary';
  button.textContent = 'Thử lại';
  button.onclick = retry;
  host.replaceChildren(status, button);
}

async function start() {
  if (query.get('mode') !== 'student' || query.get('workspace') !== 'k67' ||
      !/^hw-k67-writing-lesson4-\d+$/.test(assignment || '') || !/^[\w-]{20,200}$/.test(documentId || '')) {
    throw Object.assign(Error('WRITING_ENTRY_REQUIRED'), { status: 403 });
  }
  const access = createOnlineAccess(config, { onReady: enter });
  async function enter(session) {
    const studentRef = access.verifiedDocsOwner();
    const stamp = access.stamp();
    if (session.person?.role !== 'student' || !studentRef) throw Object.assign(Error('WRITING_ENTRY_REQUIRED'), { status: 403 });
    const apiBase = config.apiBase + '/student/assignments/' + encodeURIComponent(assignment) + '/handout-editor';
    function request(input, options = {}) {
      const url = new URL(input);
      if (!url.href.startsWith(apiBase + '/')) throw Error('HANDOUT_PATH_MISMATCH');
      if (!access.isCurrent(stamp)) throw Object.assign(Error('ACCOUNT_CHANGED'), { status: 401 });
      const headers = new Headers(options.headers);
      const native = headers.get('Authorization');
      if (native) headers.set('X-HW-Handout', native);
      for (const [name, value] of Object.entries(access.headers())) headers.set(name, value);
      headers.set('X-HW-Csrf', session.csrf);
      return fetch(url, { ...options, headers });
    }
    globalThis.handout67WritingHandoff = Object.freeze({
      apiBase, request, verifiedDocsStudent: studentRef, showOpeningError,
    });
    await import('../shared/loader.mjs?v=20261114-lesson4-check');
  }
  await enter(await access.open(root));
}

const boot = () => start().catch(error => showOpeningError(root, error, boot));
void boot();
