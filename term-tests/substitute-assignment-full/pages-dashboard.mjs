import { assignmentClient, mountAssignmentDashboard } from './assignment-browser.mjs?v=sitting-release-20261122';

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
let mode;

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

async function mountSitting(epoch, value) {
  const message=document.createElement('p'); message.className='description'; message.setAttribute('role','status');
  const action=document.createElement('button'); action.type='button'; action.className='button primary';
  const time=new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Ho_Chi_Minh'});
  let current;
  function show(value) {
    if(epoch!==viewEpoch || !dialog.open)return;
    current=value;
    const open=value.state==='open';
    message.textContent=open?`Đang mở cả 16 bài từ ${time.format(value.openedAt)}`:
      value.closedAt?`Đã đóng nhận lượt mới lúc ${time.format(value.closedAt)}`:'Ca mới chưa mở';
    action.textContent=open?'Thu hồi':'Mở ca thi';
    if(value.changedBy)message.textContent+=` · Tài khoản thao tác …${value.changedBy.slice(-6)}`;
    action.disabled=false;
  }
  action.onclick=async()=>{
    if(action.disabled || !current)return;
    const operation=current.state==='open'?'close':'open';
    action.disabled=true;
    try{
      await api('teacher/sitting',{body:{action:operation,expectedVersion:current.version,operation:crypto.randomUUID()}});
      show(await api('teacher/sitting'));
    }catch{
      try{show(await api('teacher/sitting'));message.textContent+=' · Đã đọc lại trạng thái ca.';}
      catch{message.textContent='Chưa đọc được trạng thái. Hãy đóng hộp thoại rồi mở lại.';}
    }
  };
  action.disabled=true;
  const note=document.createElement('p'); note.className='description';
  note.textContent='Học viên vào link đã nhận và chọn lớp, họ tên. Thu hồi chỉ dừng lượt mới. Lượt đang làm vẫn nộp được.';
  body.replaceChildren(message,action,note);
  const link=document.getElementById('listening-assignment-link');
  if(link){link.hidden=true;link.removeAttribute('href');}
  show(value);
}

async function refreshAccess() {
  const request = ++check;
  retry.parentElement.hidden=false;
  feedback('Đang kiểm tra quyền vận hành ca thi…');
  try {
    const sitting = await api('teacher/sitting').catch(error => {
      if (error.message === 'NOT_FOUND') return {enabled:false};
      throw error;
    });
    if (request !== check) return;
    if (mode !== sitting.enabled) { clearDashboard(); mode=sitting.enabled; }
    const label=sitting.enabled?'Mở và đóng ca thi':'Giao bài';
    button.textContent=teacherButton.textContent=label;
    document.getElementById('listening-assignment-title').textContent=label;
    if (sitting.enabled) {
      feedback('');
      retry.parentElement.hidden=true;
      if (dialog.open) { mounted=true; await mountSitting(viewEpoch,sitting); }
      return;
    }
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
    if(error.message==='SITTING_CONTROL_DENIED'){feedback('Tài khoản chỉ xem kết quả hoặc chưa có quyền mở ca.');return;}
    feedback(needsLogin ? 'Đăng nhập tại Khu vực giảng viên để điều khiển ca thi.' :
      'Chưa kiểm tra được quyền vận hành ca thi. Bấm Kiểm tra lại quyền để thử lại.', needsLogin);
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
    'Đăng nhập tại Khu vực giảng viên để điều khiển ca thi.', state !== 'restoring');
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
