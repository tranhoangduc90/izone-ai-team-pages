import '../../shared/teacher-single-sign-on.js?v=20261026-startup2&startup=20261026-v2';

const $=id=>document.getElementById(id);
const API='https://ducizone.ddns.net/substitute-teacher-api';
const TYPES=[{id:'full',name:'Thi toàn bài',description:'Listening · Reading · Writing'},{id:'listening',name:'Listening',description:'Chỉ kỹ năng nghe'},{id:'reading',name:'Reading',description:'Chỉ kỹ năng đọc'},{id:'writing',name:'Writing',description:'Đủ Task của đề gốc'}];
const COPY='<svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3"/></svg>';
const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const allowedCourses=new Set(['k56','k67']);
const fullLinks=new Map([...document.querySelectorAll('.test-group a')].map(a=>[a.closest('[data-course]').dataset.course+':'+a.dataset.test,a.href]));
let state={course:null,test:null,type:null},generation=0,catalogGeneration=0;
let catalog=null,authenticated=false,authEpoch=0,authState='restoring',authMessage='Đang khôi phục đăng nhập giảng viên…',refreshing=false,googleEpoch=-1;
const entryFor=(course,test,skill)=>catalog?.entries.find(e=>e.course===Number(String(course).replace('k',''))&&e.examNumber===Number(test)&&e.skill===skill);
const statusLabel=status=>({open:'Đang mở',closed:'Tạm đóng',unreleased:'Chưa mở',unknown:'Chưa xác minh',restricted:'Chưa có quyền',login:'Cần đăng nhập',restoring:'Đang xác minh'}[status]||'Chưa xác minh');

function availability(type=state.type){
 const entry=entryFor(state.course,state.test,type);
 // Bốn đường thi toàn phần đã công khai từ trước; vẫn dùng được khi chưa đăng nhập.
 if(type==='full'&&!entry)return {status:'open',url:fullLinks.get(state.course+':'+state.test)||''};
 if(!authenticated)return {status:authState==='restoring'?'restoring':'login',url:''};
 return {status:entry?.status||'restricted',url:entry?.status==='open'?entry.studentUrl:''};
}
function render(){
 generation++;
 const stage=!state.course?0:!state.test?1:2;
 $('pick-course').hidden=stage!==0;$('test-picker').hidden=stage!==1;$('type-picker').hidden=stage!==2;
 ['course','test','type'].forEach((name,i)=>{const button=$('step-'+name),done=i===0?!!state.course:i===1?!!state.test:!!state.type;button.disabled=i>stage;button.toggleAttribute('data-complete',done);button.querySelector('span').textContent=done?'✓':String(i+1);if(i===stage)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');});
 $('course-summary').textContent=state.course?'Khóa '+state.course.slice(1):'Chọn khóa';$('test-summary').textContent=state.test?'Kì '+state.test:'Chọn kì thi';$('type-summary').textContent=TYPES.find(t=>t.id===state.type)?.name||'Hình thức thi';
 document.querySelectorAll('.course-choice').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.course===state.course)));
 document.querySelectorAll('.test-group').forEach(group=>group.hidden=group.dataset.course!==state.course);
 $('test-course').textContent=state.course?'Bạn đang chọn Khóa '+state.course.slice(1)+'.':'';
 $('type-context').textContent=state.course&&state.test?'Khóa '+state.course.slice(1)+' · Substitute Test '+state.test:'';
 $('types').replaceChildren();
 for(const type of TYPES){const available=availability(type.id),button=document.createElement('button');button.type='button';button.className='type-choice';button.dataset.type=type.id;button.setAttribute('role','radio');button.setAttribute('aria-checked',String(state.type===type.id));button.tabIndex=state.type===type.id||!state.type&&type.id==='full'?0:-1;button.innerHTML='<strong>'+type.name+'</strong><small>'+type.description+'</small><span class="badge '+(available.status==='open'?'':'closed')+'">'+statusLabel(available.status)+'</span>';$('types').append(button);}
 $('selected-test').hidden=!state.type;
 const selected=TYPES.find(t=>t.id===state.type),available=availability();
 $('selected-title').textContent=selected?(selected.id==='full'?'Thi toàn bài':'Thi bù '+selected.name):'';
 $('selected-status').textContent=selected?statusLabel(available.status):'';
 $('selected-test').classList.toggle('has-link',!!available.url);$('student-url').value=available.url;$('student-url').hidden=!available.url;$('copy-link').disabled=!available.url;
 $('open-test').hidden=!available.url;if(available.url)$('open-test').href=available.url;else $('open-test').removeAttribute('href');
 $('selection-login').hidden=!state.type||state.type==='full'||authenticated||authState==='restoring';
 $('selection-note').textContent=!selected?'':available.url?'Học viên chọn lớp và xác nhận họ tên khi mở bài.':available.status==='restoring'?'Đang xác minh phiên giảng viên. Thi toàn bài vẫn dùng được.':available.status==='login'?'Đăng nhập giảng viên để lấy đúng link kỹ năng gửi học viên.':available.status==='closed'?'Bài đang tạm đóng. Chưa thể lấy link.':available.status==='unreleased'?'Bài chưa mở. Chưa có link gửi học viên.':available.status==='restricted'?'Tài khoản chưa được cấp quyền lấy link bài này.':'Chưa xác minh được danh mục. Hãy thử xác minh lại trong khu vực giảng viên.';
 $('copy-status').textContent='';renderAuth();fillCatalog();
}
function focusStage(){const id=!state.course?'course-heading':!state.test?'test-heading':'type-heading';$(id).focus({preventScroll:true});}
function saveCourse(){const next=new URL(location.href);if(state.course)next.searchParams.set('course',state.course);else next.searchParams.delete('course');try{history.replaceState(null,'',next);}catch{}}
document.querySelectorAll('.course-choice').forEach(button=>button.addEventListener('click',()=>{state={course:button.dataset.course,test:null,type:null};render();saveCourse();focusStage();}));
document.querySelectorAll('.test-group a').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();state.test=link.dataset.test;state.type=null;render();focusStage();}));
$('step-course').addEventListener('click',()=>{state={course:null,test:null,type:null};render();saveCourse();focusStage();});
$('step-test').addEventListener('click',()=>{state.test=null;state.type=null;render();focusStage();});
$('step-type').addEventListener('click',()=>{state.type=null;render();focusStage();});
function chooseType(type){state.type=type;render();document.querySelector('[data-type="'+type+'"]')?.focus({preventScroll:true});}
$('types').addEventListener('click',event=>{const button=event.target.closest('[data-type]');if(button)chooseType(button.dataset.type);});
$('types').addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;event.preventDefault();let i=Math.max(0,TYPES.findIndex(t=>t.id===state.type));i=event.key==='Home'?0:event.key==='End'?3:(i+(['ArrowLeft','ArrowUp'].includes(event.key)?-1:1)+4)%4;chooseType(TYPES[i].id);});

async function copyText(link,field,current){if(!current())return false;try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(link);return true;}}catch{}if(!current())return false;field.focus();field.select();try{return document.execCommand('copy');}catch{return false;}}
$('copy-link').addEventListener('click',async()=>{const link=$('student-url').value,g=generation;if(!link)return;const current=()=>g===generation,ok=await copyText(link,$('student-url'),current);if(current())$('copy-status').textContent=ok?'Đã sao chép đúng link đang chọn.':'Hãy chọn link và sao chép thủ công.';});
function fillCatalog(){
 catalogGeneration++;let html='';
 for(const course of['k56','k67'])for(const test of['1','2'])for(const type of TYPES.filter(t=>t.id!=='full')){
  const entry=entryFor(course,test,type.id),status=authenticated?entry?.status||'restricted':authState==='restoring'?'restoring':'login',url=authenticated&&status==='open'?entry.studentUrl:'',key=course+':'+test+':'+type.id,label=type.name+' · Test '+test+' · Khóa '+course.slice(1);
  html+='<tr><td><strong>Khóa '+course.slice(1)+'</strong> · Test '+test+'</td><td>'+type.name+'</td><td><span class="badge '+(url?'':'closed')+'">'+statusLabel(status)+'</span></td><td><div class="table-link">'+(url?'<input readonly aria-label="Link '+label+'" value="'+escapeHtml(url)+'">':'<span>'+statusLabel(status)+'</span>')+'<button type="button" class="copy-icon" data-copy="'+key+'" aria-label="Sao chép '+label+'" '+(url?'':'disabled')+'>'+COPY+'</button></div></td></tr>';
 }$('catalog-body').innerHTML=html;$('catalog-status').textContent='';
}
$('catalog-body').addEventListener('click',async event=>{const button=event.target.closest('[data-copy]');if(!button||button.disabled)return;const [course,test,type]=button.dataset.copy.split(':'),entry=entryFor(course,test,type);if(!authenticated||entry?.status!=='open')return;const g=catalogGeneration,current=()=>g===catalogGeneration&&$('catalog').open,ok=await copyText(entry.studentUrl,button.closest('tr').querySelector('input'),current);if(!current())return;if(ok){button.textContent='✓';button.classList.add('copied');}$('catalog-status').textContent=ok?'Đã sao chép '+TYPES.find(t=>t.id===type).name+' · Test '+test+' · Khóa '+course.slice(1)+'.':'Hãy chọn link và sao chép thủ công.';});

function wireDialog(dialog,opener){
 dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
 dialog.addEventListener('close',()=>{catalogGeneration++;const target=dialog._returnFocus?.getClientRects().length?dialog._returnFocus:document.querySelector('[data-type][aria-checked="true"]')||opener;target.focus({preventScroll:true});});
}
wireDialog($('teacher-dialog'),$('teacher'));wireDialog($('catalog'),$('catalog-open'));
function openDialog(dialog,opener,slot){
 $('auth-panel').removeAttribute('hidden');$(slot).append($('auth-panel'));renderAuth();dialog._returnFocus=opener;dialog.showModal();void ensureGoogle();
}
$('teacher').addEventListener('click',()=>openDialog($('teacher-dialog'),$('teacher'),'teacher-auth-slot'));
$('selection-login').addEventListener('click',()=>openDialog($('teacher-dialog'),$('selection-login'),'teacher-auth-slot'));
$('teacher-dialog').querySelector('.close').addEventListener('click',()=>$('teacher-dialog').close());
$('catalog-open').addEventListener('click',()=>{fillCatalog();openDialog($('catalog'),$('catalog-open'),'catalog-auth-slot');});
$('catalog-close').addEventListener('click',()=>$('catalog').close());

function renderAuth(){
 $('auth-panel').hidden=authenticated;$('auth-status').textContent=authMessage;$('google').hidden=authState!=='signed-out';$('retry-auth').hidden=!['error','forbidden'].includes(authState);$('logout').hidden=!authenticated;$('session-status').textContent=authenticated?'Đã xác minh giảng viên.':'';
}
function clearSession(message='Đăng nhập giảng viên để lấy link kỹ năng.',kind='signed-out'){
 authEpoch++;authenticated=false;catalog=null;authState=kind;authMessage=message;googleEpoch=-1;$('google').replaceChildren();render();
}
async function call(path){const response=await fetch(API+path,{method:'GET',credentials:'include',cache:'no-store',signal:AbortSignal.timeout(10000)}),data=await response.json().catch(()=>({}));if(!response.ok)throw Object.assign(Error('CATALOG_UNAVAILABLE'),{status:response.status});return data;}
function validatedCatalog(value){
 if(value?.schemaVersion!==1||typeof value.revision!=='string'||!Array.isArray(value.entries)||value.entries.length>16)throw Error('CATALOG_INVALID');
 const ids=new Set();for(const entry of value.entries){
  if(![56,67].includes(entry.course)||![1,2].includes(entry.examNumber)||!TYPES.some(t=>t.id===entry.skill)||!['open','closed','unreleased','unknown'].includes(entry.status))throw Error('CATALOG_INVALID');
  const source='substitute-test-'+entry.examNumber+'-k'+entry.course,id=entry.skill==='full'?source:source+'-'+entry.skill+'-makeup';if(entry.id!==id||entry.sourceSlug!==source||ids.has(id))throw Error('CATALOG_INVALID');ids.add(id);
  if(entry.status==='open'){const url=new URL(entry.studentUrl);if(url.protocol!=='https:'||url.origin!=='https://tranhoangduc90.github.io'||!url.pathname.startsWith('/izone-ai-team-pages/term-tests/')||url.username||url.password||url.hash)throw Error('CATALOG_LINK_INVALID');}else if(entry.studentUrl!==null)throw Error('CATALOG_INVALID');
 }return value;
}
async function readCatalog(epoch){
 const value=validatedCatalog(await call('/teacher/skill-tests'));if(epoch!==authEpoch)return false;if(!value.entries.length)throw Object.assign(Error('NO_SCOPE'),{status:403});
 if(value.revision!==catalog?.revision){catalog=value;render();}return true;
}
let googleScript;
async function ensureGoogle(){
 if(authState!=='signed-out'||!$('auth-panel').closest('dialog[open]'))return;const epoch=authEpoch;
 try{
  const config=await call('/teacher/config');if(epoch!==authEpoch)return;if(!config.googleClientId)throw Error('GOOGLE_CONFIG_UNAVAILABLE');
  if(!window.google?.accounts?.id){googleScript??=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.onload=resolve;script.onerror=()=>{googleScript=null;reject(Error('GOOGLE_UNAVAILABLE'));};document.head.append(script);});await googleScript;}
  if(epoch!==authEpoch)return;
  if(googleEpoch!==epoch){window.google.accounts.id.initialize({client_id:config.googleClientId,callback:async response=>{if(epoch!==authEpoch)return;try{await window.IzoneTeacherSso.login('substitute',response.credential,true);if(epoch===authEpoch)await authenticate();}catch{if(epoch===authEpoch)clearSession('Chưa xác minh được đăng nhập. Hãy thử lại.','error');}}});googleEpoch=epoch;}
  if(!$('google').childNodes.length)window.google.accounts.id.renderButton($('google'),{theme:'outline',text:'signin_with'});
 }catch{if(epoch===authEpoch)clearSession('Chưa tải được đăng nhập Google. Hãy thử xác minh lại.','error');}
}
async function authenticate(){
 clearSession('Đang khôi phục đăng nhập giảng viên…','restoring');const epoch=authEpoch;
 try{
  if(!window.IzoneTeacherSso)throw Error('SSO_UNAVAILABLE');const restored=await window.IzoneTeacherSso.restore('substitute');if(epoch!==authEpoch)return;
  if(!restored){authState='signed-out';authMessage='Đăng nhập Google để lấy link các bài kỹ năng được cấp quyền.';render();await ensureGoogle();return;}
  if(!await readCatalog(epoch)||epoch!==authEpoch)return;authenticated=true;authState='ready';authMessage='Đã xác minh giảng viên.';render();
 }catch(error){if(epoch===authEpoch)clearSession(error.status===403?'Tài khoản chưa có quyền lấy link các bài Substitute.':'Chưa xác minh được phiên hoặc danh mục. Thi toàn bài vẫn dùng được.',error.status===403?'forbidden':'error');}
}
$('retry-auth').addEventListener('click',()=>void authenticate());
$('logout').addEventListener('click',async()=>{clearSession('Đang đăng xuất giảng viên…','restoring');try{await window.IzoneTeacherSso.logout();await authenticate();}catch{clearSession('Chưa xác nhận đã đăng xuất hết. Hãy thử xác minh lại.','error');}});
addEventListener('storage',event=>{if(['izone:teacher-sso-login','izone:teacher-sso-logout'].includes(event.key))void authenticate();});
addEventListener('pagehide',()=>clearSession());addEventListener('pageshow',event=>{if(event.persisted)void authenticate();});
setInterval(async()=>{if(!authenticated||refreshing)return;refreshing=true;const epoch=authEpoch;try{await readCatalog(epoch);}catch{if(epoch===authEpoch)clearSession('Chưa xác minh được danh mục hiện tại. Hãy thử xác minh lại trước khi sao chép.','error');}finally{refreshing=false;}},30000);
const requested=new URLSearchParams(location.search).get('course');if(allowedCourses.has(requested))state.course=requested;
render();void authenticate();
