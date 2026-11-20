import { assignmentClient, mountAssignmentDashboard } from './assignment-browser.mjs?v=registration-live-20261120-r4';

const endpoint = 'https://ducizone.ddns.net/substitute-teacher-api/assignments/v1/';
const api = assignmentClient(endpoint);
const button = document.getElementById('listening-assignment-open');
const dialog = document.getElementById('listening-assignment');
const body = document.getElementById('assignment-dashboard-mount');
const close = document.getElementById('listening-assignment-close');
let sessionCheck = 0;
let mounted = false;
let pressedBackdrop = false;

function isBackdrop(event) {
  if (event.target !== dialog) return false;
  const {left, top, right, bottom} = dialog.getBoundingClientRect();
  return event.clientX < left || event.clientX >= right ||
    event.clientY < top || event.clientY >= bottom;
}

function hideDashboard() {
  button.hidden = true;
  body.replaceChildren();
  const link=document.getElementById('listening-assignment-link');
  link.hidden=true;
  link.removeAttribute('href');
  mounted = false;
  if (dialog.open) dialog.close();
}

async function refreshAccess() {
  const check = ++sessionCheck;
  try {
    const { scopes } = await api('teacher/scopes');
    if (check!==sessionCheck) return;
    if (!scopes.length) hideDashboard();
    else button.hidden = false;
  } catch {
    if (check!==sessionCheck) return;
    hideDashboard();
  }
}

button.addEventListener('click', async ()=>{
  dialog.showModal();
  if (!mounted) {
    mounted = true;
    await mountAssignmentDashboard(body,{api,onScope:scope=>{
      const link=document.getElementById('listening-assignment-link');
      link.hidden=!scope?.studentUrl;
      if(scope?.studentUrl)link.href=scope.studentUrl;
      else link.removeAttribute('href');
    }});
  }
});
close.addEventListener('click',()=>dialog.close());
dialog.addEventListener('pointerdown',event=>{
  pressedBackdrop = event.button === 0 && isBackdrop(event);
});
dialog.addEventListener('pointerup',event=>{
  const dismiss = pressedBackdrop && isBackdrop(event);
  pressedBackdrop = false;
  if (dismiss) dialog.close();
});
dialog.addEventListener('pointercancel',()=>{ pressedBackdrop = false; });
dialog.addEventListener('close',()=>{
  if (!button.hidden) button.focus();
});
document.getElementById('logout')?.addEventListener('click',()=>{
  ++sessionCheck;
  hideDashboard();
});
addEventListener('storage',event=>{
  if (['izone:teacher-sso-login','izone:teacher-sso-logout'].includes(event.key)) void refreshAccess();
});
addEventListener('focus',()=>void refreshAccess());
void refreshAccess();
