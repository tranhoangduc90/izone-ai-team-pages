import {API} from './config.mjs';
const $=id=>document.getElementById(id),show=(id,v=true)=>$(id).hidden=!v;
let latest='',authenticated=false,loading=false,authEpoch=0;
const reopenOperations=new Map();
async function call(path,body){const r=await fetch(API+'/teacher/'+path,{method:body?'POST':'GET',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json','X-Izone-Csrf':'1','X-Request-Id':crypto.randomUUID()},...body?{body:JSON.stringify(body)}:{},signal:AbortSignal.timeout(10000)});const v=await r.json();if(!r.ok)throw Object.assign(Error(v.error),{status:r.status});return v;}
const label={prepared:'Đã chuẩn bị',draft:'Đang làm / đã lưu nháp',submitted:'Đã nộp',technical_stop:'Dừng do sự cố'};
const cell=(tr,value)=>{const td=document.createElement('td');td.textContent=value??'—';tr.append(td);return td;};
function clearSession(){
 authEpoch++;authenticated=false;loading=false;latest='';
 for(const id of ['results','logs'])show(id,false);
 $('rows').replaceChildren();$('log-rows').replaceChildren();
}
function reviewLink(attemptId,classCode){
 const url=new URL('../ic2311-retake-review/teacher.html',location.href);
 url.search=new URLSearchParams({skill:'listening',attemptId});
 if(classCode&&classCode!=='IC2311')url.searchParams.set('class',classCode);
 const link=document.createElement('a');
 link.href=url.href;link.textContent='Xem bài đã nộp';
 return link;
}
async function logs(attemptId){const epoch=authEpoch;try{const r=await call('logs?attemptId='+encodeURIComponent(attemptId));if(epoch!==authEpoch)return;show('logs');$('log-status').textContent=r.coverage==='partial'?'Nhật ký chưa đủ; còn '+r.pendingEvents+' sự kiện chờ ghi.':'Tối đa 2.000 bản ghi mới nhất; thời gian Việt Nam. Khoảng thiếu được ghi bằng log_gap.';$('log-rows').replaceChildren();for(const{fields:f}of r.events){const tr=document.createElement('tr');cell(tr,new Date(f.occurredAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}));cell(tr,f.eventName+(f.errorCode?' · '+f.errorCode:''));cell(tr,(f.requestId||'—')+' / '+(f.operationId||'—'));const a=f.audioAfter||f.audioBefore||f;cell(tr,(a.playerCurrentTime??'—')+' / '+(f.serverAckedHeardSeconds??'—'));$('log-rows').append(tr);}}catch(e){$('status').textContent='Chưa đọc được nhật ký ('+e.message+'). Không suy thành không có sự kiện.';}}
async function refresh(){if(!authenticated||loading)return;loading=true;const epoch=authEpoch;try{
 const r=await call('results');
 if(epoch!==authEpoch)return;
 const canManage=r.role==='admin';
 document.querySelectorAll('[data-admin-only]').forEach(node=>node.hidden=!canManage);
 if(!canManage){show('logs',false);$('log-rows').replaceChildren();}
 const fingerprint=JSON.stringify(r);if(fingerprint===latest){$('status').textContent='Đã cập nhật · không có thay đổi';return;}latest=fingerprint;const fragment=document.createDocumentFragment();for(const student of r.students){const attempts=r.attempts.filter(a=>a.student_ref===student.studentRef);const tr=document.createElement('tr'),a=attempts[0];cell(tr,student.name);cell(tr,a?label[a.status]:'Chưa vào bài');cell(tr,a?.status==='submitted'?a.raw_score+'/40':'—');cell(tr,a?.receipt_id||'—').hidden=!canManage;cell(tr,a?.portal_status==='confirmed'?'Đã ghi Term Test 1 Listening':a?.portal_status==='blocked'?'Cần đối soát · '+(a.portal_error_code||''):a?.portal_status?'Chờ ghi Term Test 1 Listening':'—').hidden=!canManage;const actions=cell(tr,'');
 if(a?.status==='submitted')actions.append(reviewLink(a.id,a.class_code));
 if(canManage&&a){const b=document.createElement('button');b.className='secondary';b.textContent='Xem log';b.onclick=()=>void logs(a.id);actions.append(b);if(a.status!=='submitted'){const reopen=document.createElement('button');reopen.className='secondary';reopen.textContent='Cấp lượt thay thế';reopen.onclick=async()=>{if(!confirm('Chỉ cấp khi đã xác nhận học viên dừng lượt hiện tại. Tạo lượt Listening thay thế cho '+student.name+'? Lượt cũ và đáp án vẫn được giữ; lượt cũ sẽ không gửi tiếp được.'))return;try{const key=student.studentRef+':'+a.generation;if(!reopenOperations.has(key))reopenOperations.set(key,crypto.randomUUID());await call('reopen',{studentRef:student.studentRef,operationId:reopenOperations.get(key)});reopenOperations.delete(key);latest='';await refresh();}catch(e){$('status').textContent='Chưa cấp lượt: '+e.message;}};actions.append(reopen);}}fragment.append(tr);}$('rows').replaceChildren(fragment);show('results');$('status').textContent='Đã cập nhật. Điểm /40 được ghi vào Term Test 1 Listening. Reading/Writing giữ nguyên.';}catch(e){if(epoch!==authEpoch)return;$('status').textContent='Chưa tải được kết quả ('+e.message+'). Dữ liệu đang xem được giữ.';if([401,403].includes(e.status))void authenticate();}finally{if(epoch===authEpoch)loading=false;}}
async function google(){const cfg=await call('config');if(!cfg.googleClientId)throw Error('GOOGLE_CONFIG_UNAVAILABLE');if(!window.google?.accounts?.id){await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.onload=resolve;script.onerror=reject;document.head.append(script);});}window.google.accounts.id.initialize({client_id:cfg.googleClientId,callback:async response=>{try{await window.IzoneTeacherSso.login('listeningretake',response.credential,true);await authenticate();}catch{$('auth-status').textContent='Chưa xác minh được tài khoản Google.';}}});show('google');window.google.accounts.id.renderButton($('google'),{theme:'outline',text:'signin_with'});}
async function authenticate(){clearSession();const epoch=authEpoch;show('google',false);show('retry-auth',false);$('auth-status').textContent='Đang khôi phục đăng nhập của bạn…';try{const restored=await window.IzoneTeacherSso.restore('listeningretake');if(epoch!==authEpoch)return;if(!restored){$('auth-status').textContent='Đăng nhập Google để xem kết quả được cấp quyền.';await google();return;}const session=await call('session');if(epoch!==authEpoch)return;authenticated=true;$('auth-status').textContent='Đã xác minh: '+session.email+(session.role==='viewer'?' · Chỉ xem kết quả':'');show('logout');await refresh();}catch(e){if(epoch!==authEpoch)return;authenticated=false;$('auth-status').textContent=e.status===403?'Tài khoản chưa được cấp quyền xem Listening thi lại IC2311.':'Chưa xác minh được đăng nhập. Hãy thử lại.';show('retry-auth');}}
$('retry-auth').onclick=authenticate;$('refresh').onclick=refresh;$('logout').onclick=async()=>{clearSession();try{await window.IzoneTeacherSso.logout();show('logout',false);await authenticate();}catch{$('auth-status').textContent='Chưa đăng xuất được. Hãy thử lại.';}};
await authenticate();setInterval(()=>void refresh(),10000);

addEventListener('storage',event=>{if(['izone:teacher-sso-logout','izone:teacher-sso-login'].includes(event.key))void authenticate();});

addEventListener('pagehide',clearSession);
addEventListener('pageshow',event=>{if(event.persisted)void authenticate();});
