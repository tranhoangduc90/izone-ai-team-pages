import { assignmentClient, mountAssignmentDashboard } from './assignment-browser.mjs';

const endpoint = 'https://ducizone.ddns.net/substitute-teacher-api/assignments/v1/';
const api = assignmentClient(endpoint);
const button = document.getElementById('listening-assignment-open');
const dialog = document.getElementById('listening-assignment');
const body = document.getElementById('assignment-dashboard-mount');
const close = document.getElementById('listening-assignment-close');
let sessionCheck = 0;
let mounted = false;

async function refreshAccess() {
  const check = ++sessionCheck;
  try {
    const { scopes } = await api('teacher/scopes');
    if (check===sessionCheck) button.hidden = !scopes.length;
  } catch {
    if (check!==sessionCheck) return;
    button.hidden = true;
    body.replaceChildren();
    mounted = false;
    if (dialog.open) dialog.close();
  }
}

button.addEventListener('click', async ()=>{
  dialog.showModal();
  if (!mounted) {
    mounted = true;
    await mountAssignmentDashboard(body,{api});
  }
});
close.addEventListener('click',()=>dialog.close());
document.getElementById('logout')?.addEventListener('click',()=>{
  ++sessionCheck;
  button.hidden = true;
  body.replaceChildren();
  mounted = false;
  if (dialog.open) dialog.close();
});
addEventListener('storage',event=>{
  if (['izone:teacher-sso-login','izone:teacher-sso-logout'].includes(event.key)) void refreshAccess();
});
addEventListener('focus',()=>void refreshAccess());
void refreshAccess();
