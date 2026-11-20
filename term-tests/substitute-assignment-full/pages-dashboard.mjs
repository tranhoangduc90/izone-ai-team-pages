import { assignmentClient, mountAssignmentDashboard } from './assignment-browser.mjs?v=registration-live-20261120-r4';

const api = assignmentClient('https://ducizone.ddns.net/substitute-teacher-api/assignments/v1/');
const button = document.getElementById('listening-assignment-open');
const teacherButton = document.getElementById('teacher-assignment-open');
const teacherDialog = document.getElementById('teacher-dialog');
const dialog = document.getElementById('listening-assignment');
const body = document.getElementById('assignment-dashboard-mount');
const close = document.getElementById('listening-assignment-close');
const status = document.getElementById('assignment-access-status');
const teacherStatus = document.getElementById('teacher-assignment-status');
const retry = document.getElementById('assignment-access-retry');
const login = document.getElementById('assignment-access-login');
const link = document.getElementById('listening-assignment-link');
let check = 0, viewEpoch = 0, mounted = false, pressedBackdrop = false, authKey;
let opener = button;

function feedback(message, needsLogin = false) {
  status.textContent = teacherStatus.textContent = message;
  login.hidden = !needsLogin;
}

function clearDashboard() {
  ++viewEpoch;
  mounted = false;
  body.replaceChildren();
  link.hidden = true;
  link.removeAttribute('href');
}

async function refreshAccess() {
  const request = ++check;
  feedback('Đang kiểm tra quyền Giao bài…');
  try {
    const { scopes } = await api('teacher/scopes');
    if (request !== check) return;
    if (!Array.isArray(scopes)) throw Error('ASSIGNMENT_UNAVAILABLE');
    if (!scopes.length) {
      clearDashboard();
      feedback('Chưa có ca thi trong phạm vi tài khoản này.');
      return;
    }
    feedback(scopes.some(scope => scope.canAssign) ? '' : 'Tài khoản chỉ có quyền xem danh sách, chưa có quyền Giao bài.');
    if (dialog.open && !mounted) {
      mounted = true;
      const epoch = viewEpoch;
      await mountAssignmentDashboard(body, { api, onScope: scope => {
        if (epoch !== viewEpoch) return;
        link.hidden = !scope?.studentUrl;
        if (scope?.studentUrl) link.href = scope.studentUrl;
        else link.removeAttribute('href');
      }});
    }
  } catch (error) {
    if (request !== check) return;
    clearDashboard();
    const needsLogin = error.message === 'LOGIN_REQUIRED';
    feedback(needsLogin ? 'Hãy đăng nhập tại Khu vực giảng viên để mở danh sách Giao bài.' :
      'Chưa kiểm tra được quyền Giao bài. Bấm Kiểm tra lại quyền để thử lại.', needsLogin);
  }
}

function openDashboard(event) {
  opener = event.currentTarget;
  if (teacherDialog.open) teacherDialog.close();
  if (!dialog.open) dialog.showModal();
  void refreshAccess();
}
button.addEventListener('click', openDashboard);
teacherButton.addEventListener('click', openDashboard);
retry.addEventListener('click', () => void refreshAccess());
login.addEventListener('click', () => {
  dialog.close();
  document.getElementById('teacher').click();
});
close.addEventListener('click', () => dialog.close());
function isBackdrop(event) {
  if (event.target !== dialog) return false;
  const { left, top, right, bottom } = dialog.getBoundingClientRect();
  return event.clientX < left || event.clientX >= right || event.clientY < top || event.clientY >= bottom;
}
dialog.addEventListener('pointerdown', event => { pressedBackdrop = event.button === 0 && isBackdrop(event); });
dialog.addEventListener('pointerup', event => {
  const dismiss = pressedBackdrop && isBackdrop(event);
  pressedBackdrop = false;
  if (dismiss) dialog.close();
});
dialog.addEventListener('pointercancel', () => { pressedBackdrop = false; });
dialog.addEventListener('close', () => (opener.getClientRects().length ? opener : button).focus());

// Storage events only notify other tabs; the catalog explicitly reports
// authentication changes in this tab as well. Backend still owns permission.
addEventListener('izone:substitute-teacher-state', event => {
  const { state, epoch } = event.detail;
  const key = epoch + ':' + state;
  if (key === authKey) return;
  authKey = key;
  ++check;
  clearDashboard();
  if (state === 'ready') void refreshAccess();
  else feedback(state === 'restoring' ? 'Đang xác minh phiên giảng viên…' :
    'Hãy đăng nhập tại Khu vực giảng viên để mở danh sách Giao bài.', state !== 'restoring');
});
document.getElementById('logout').addEventListener('click', () => {
  ++check;
  clearDashboard();
  feedback('Đang đăng xuất giảng viên…');
});
addEventListener('storage', event => {
  if (['izone:teacher-sso-login', 'izone:teacher-sso-logout'].includes(event.key)) {
    ++check;
    clearDashboard();
  }
});
addEventListener('focus', () => void refreshAccess());
void refreshAccess();
