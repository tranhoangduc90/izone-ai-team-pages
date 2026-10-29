import {createTeacherSessionClient,teacherSessionRequestOptions} from '../shared/teacher-session-client.js?v=20261029-portal-sync';
const base='https://ducizone.ddns.net/portal-sync-trial/api',session=createTeacherSessionClient({apiBaseUrl:base,sessionPath:'auth/session',sharedProduct:'portal_sync'}),$=id=>document.getElementById(id);
let hooks,generation=0,googleLoading;
function reset(){generation++;hooks?.lock();$('who').textContent='';$('google-panel').hidden=true;$('login-error').textContent='';}
function showError(error){$('restore-status').textContent=error.status===403?'Tài khoản chưa có quyền xem các lớp trong bản thử.':'Chưa xác minh được phiên đăng nhập.';$('login-error').textContent=error.message;$('auth-retry').hidden=false;$('change-account').hidden=false;}
async function raw(path,options={}) {const response=await fetch(base+path,teacherSessionRequestOptions(options));const value=await response.json().catch(()=>({}));if(!response.ok)throw Object.assign(Error(response.status===401?'Phiên đã hết hạn.':response.status===403?'Bạn chưa có quyền xem dữ liệu này.':value.error??'Dịch vụ chưa phản hồi, hãy thử lại.'),{status:response.status});return value;}
async function open(current){const identity=await raw('/auth/session');if(current!==generation)return;$('who').textContent=identity.reviewer.email;$('auth-retry').hidden=true;$('change-account').hidden=true;await hooks.open();}
async function loadGoogle(){
  if(!googleLoading)googleLoading=(async()=>{const config=await raw('/teacher/config');if(!window.google?.accounts?.id){await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.onload=resolve;script.onerror=()=>reject(Error('Chưa tải được đăng nhập Google.'));document.head.append(script);});}return config;})().catch(e=>{googleLoading=null;throw e;});
  return googleLoading;
}
async function missing(current){$('restore-status').textContent='Đăng nhập bằng tài khoản giảng viên của bạn.';const config=await loadGoogle();if(current!==generation)return;window.google.accounts.id.initialize({client_id:config.googleClientId,callback:async response=>{reset();const next=generation;try{await raw('/auth/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({credential:response.credential,remember:$('remember').checked})});await open(next);}catch(e){if(next===generation)showError(e);}}});window.google.accounts.id.renderButton($('google-button'),{theme:'outline',size:'large',text:'signin_with',width:280});$('google-panel').hidden=false;}
async function restore(){reset();const current=generation;$('restore-status').textContent='Đang khôi phục đăng nhập của bạn…';$('auth-retry').hidden=true;try{if(await session.restore())await open(current);else if(current===generation)await missing(current);}catch(e){if(current===generation){if(e.status===401)await missing(current).catch(error=>{if(current===generation)showError(error);});else showError(e);}}}
globalThis.PortalTeacherSession={
  start(value){hooks=value;restore();},
  async request(path,body){if(body!==undefined)throw Error('Màn giảng viên chỉ cho đọc.');const current=generation,mapped=path==='ops/status'?'/teacher/status':'/teacher/'+path.replace(/^v1\//,'');try{const result=await raw(mapped);if(current!==generation)throw Error('Phiên vừa thay đổi.');return result;}catch(e){if(current===generation&&[401,403].includes(e.status)){reset();const next=generation;if(e.status===401)missing(next).catch(error=>{if(next===generation)showError(error);});else showError(e);}throw e;}},
  async logout(){try{await window.IzoneTeacherSso.logout();await restore();}catch(e){showError(e);}}
};
$('auth-retry').addEventListener('click',restore);$('change-account').addEventListener('click',()=>globalThis.PortalTeacherSession.logout());
window.addEventListener('storage',e=>{if(['izone:teacher-sso-login','izone:teacher-sso-logout'].includes(e.key))restore();});
await import('./dashboard.js?v=20261029-phase3');
