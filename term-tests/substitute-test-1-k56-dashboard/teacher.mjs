import '../../shared/teacher-single-sign-on.js?v=20261026-startup2&startup=20261026-v2';

'use strict';
const BASE='https://tranhoangduc90.github.io/izone-ai-team-pages/term-tests/';
let catalog={entries:[]};
const entryFor=(course,test,skill)=>catalog.entries.find(e=>e.course===Number(course)&&e.examNumber===Number(test)&&e.skill===skill);
const PUBLISHED=new Proxy({}, {get:(_,key)=>{if(typeof key!=='string')return '';const [course,test,skill]=key.split(':');const e=entryFor(course,test,skill);return e?.status==='open'?e.studentUrl:'';}});
const escapeHtml=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const TYPES=[{id:'full',name:'Thi toàn bài',desc:'Listening · Reading · Writing',icon:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>'},{id:'listening',name:'Listening',desc:'Chỉ kỹ năng nghe',icon:'<path d="M4 14v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="12" width="4" height="8" rx="2"/><rect x="17" y="12" width="4" height="8" rx="2"/>'},{id:'reading',name:'Reading',desc:'Chỉ kỹ năng đọc',icon:'<path d="M12 6C9 3 4 3 2 4v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-2-1-7-1-10 2Zm0 0v15"/>'},{id:'writing',name:'Writing',desc:'Đủ Task của đề gốc',icon:'<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14l-1 7Z"/>'}];
const COPY='<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3"/></svg>';
const $=id=>document.getElementById(id);
let state={course:null,test:null,type:null};let generation=0;let catalogGeneration=0;
const linkFor=(course,test,type)=>{const e=entryFor(course,test,type);return e?.status==='open'?e.studentUrl:'';};
const badge=(type,available,status)=>'<span class="badge'+(available?'':' closed')+'">'+(available?(type==='full'?'Đang sử dụng':'Đã mở'):({closed:'Tạm đóng',unreleased:'Chưa mở',unknown:'Chưa xác minh',restricted:'Chưa có quyền'}[status]||'Chưa mở'))+'</span>';
function render(){
 generation++;const stage=!state.course?'course':!state.test?'test':'type';
 ['course','test','type'].forEach((id,i)=>{const button=$('step-'+id),done=id==='course'?!!state.course:id==='test'?!!state.test:!!state.type;button.className='trail-button'+(done?' done':'')+(stage===id?' current':'');button.disabled=id==='test'?!state.course:id==='type'?!state.test:false;if(stage===id)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');button.querySelector('.step-number').textContent=done?'✓':String(i+1);$('stage-'+id).hidden=stage!==id;});
 $('course-summary').textContent=state.course?'Khóa '+state.course:'Khóa học';$('course-hint').textContent=state.course?'Đổi khóa':'Chọn khóa';
 $('test-summary').textContent=state.test?'Kì '+state.test:'Kì thi';$('test-hint').textContent=state.test?'Đổi kì':state.course?'Chọn kì thi':'Chờ chọn khóa';
 const selected=TYPES.find(t=>t.id===state.type);$('type-summary').textContent=selected?selected.name:'Hình thức thi';$('type-hint').textContent=selected?'Đổi hình thức':state.test?'Chọn hình thức':'Chờ chọn kì';
 $('test-context').textContent=state.course?'Bài thi bù dành cho Khóa '+state.course+'.':'';
 $('type-context').textContent=state.test?'Khóa '+state.course+' · Substitute Test '+state.test:'';
 $('types').innerHTML=state.test?TYPES.map((t,i)=>{const available=!!linkFor(state.course,state.test,t.id);return '<button type="button" class="type" role="radio" data-type="'+t.id+'" aria-checked="'+(state.type===t.id)+'" tabindex="'+(state.type===t.id||!state.type&&i===0?'0':'-1')+'"><span class="type-check" aria-hidden="true"></span><div class="type-heading"><span class="type-icon"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">'+t.icon+'</svg></span><h3>'+t.name+'</h3></div><p class="type-description">'+t.desc+'</p>'+badge(t.id,available,entryFor(state.course,state.test,t.id)?.status||'restricted')+'</button>';}).join(''):'';
 $('result').hidden=!state.type;$('choose-type-hint').hidden=!!state.type;
 const link=state.course&&state.test&&state.type?linkFor(state.course,state.test,state.type):'';
 $('student-url').value=link;$('student-url').hidden=!link;$('unavailable').hidden=!!link;$('copy-link').disabled=!link;
 $('copy-label').textContent=link?'Sao chép link học viên':'Chưa có link học viên';$('copy-status').textContent='';$('copy-status').style.color='';
 const status=entryFor(state.course,state.test,state.type)?.status; $('unavailable').textContent=status==='closed'?'Bài đang tạm đóng. Chưa thể sao chép link.':status==='unknown'?'Chưa xác minh được trạng thái bài. Hãy thử tải lại danh mục.':status==='restricted'?'Tài khoản chưa có quyền bài này.':'Bài này chưa mở. Chưa có link gửi học viên.';
 $('result-title').textContent=selected?(selected.id==='full'?'Thi toàn bài':'Thi bù '+selected.name):'';
 $('result-context').textContent=state.type?'Khóa '+state.course+' · Substitute Test '+state.test:'';
 $('result-badge').innerHTML=state.type?badge(state.type,!!link,entryFor(state.course,state.test,state.type)?.status||'restricted'):'';
}
function focusStage(){const id=!state.course?'course':!state.test?'test':'type';$(id+'-title').focus({preventScroll:true});}
document.querySelectorAll('[data-course]').forEach(b=>b.addEventListener('click',()=>{state={course:b.dataset.course,test:null,type:null};render();focusStage();}));
document.querySelectorAll('[data-test]').forEach(b=>b.addEventListener('click',()=>{state.test=b.dataset.test;state.type=null;render();focusStage();}));
$('step-course').addEventListener('click',()=>{state={course:null,test:null,type:null};render();focusStage();});
$('step-test').addEventListener('click',()=>{state.test=null;state.type=null;render();focusStage();});
$('step-type').addEventListener('click',()=>{state.type=null;render();focusStage();});
$('types').addEventListener('click',e=>{const b=e.target.closest('[data-type]');if(!b)return;state.type=b.dataset.type;render();document.querySelector('[data-type="'+state.type+'"]').focus({preventScroll:true});});
$('types').addEventListener('keydown',e=>{const b=e.target.closest('[data-type]');if(!b||!['ArrowRight','ArrowLeft','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;e.preventDefault();let i=TYPES.findIndex(t=>t.id===state.type);if(i<0)i=0;i=e.key==='Home'?0:e.key==='End'?3:(i+(['ArrowLeft','ArrowUp'].includes(e.key)?-1:1)+4)%4;state.type=TYPES[i].id;render();document.querySelector('[data-type="'+state.type+'"]').focus({preventScroll:true});});
async function copyText(link,field){try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(link);return true;}}catch{}field.focus();field.select();try{return document.execCommand('copy');}catch{return false;}}
$('copy-link').addEventListener('click',async()=>{const link=$('student-url').value,g=generation;if(!link)return;const ok=await copyText(link,$('student-url'));if(g!==generation)return;$('copy-status').textContent=ok?'Đã sao chép đúng link đang chọn.':'Hãy chọn link và sao chép thủ công.';$('copy-status').style.color=ok?'var(--green)':'var(--amber)';});
function fillCatalog(){
 let rows='';for(const course of ['56','67'])for(const test of ['1','2'])for(const t of TYPES.filter(t=>t.id!=='full')){
 const key=course+':'+test+':'+t.id,e=entryFor(course,test,t.id),link=e?.status==='open'?e.studentUrl:'',status=e?.status||'restricted',label=t.name+' Substitute Test '+test+' Khóa '+course;
 rows+='<tr data-row="'+key+'"><td><strong>Khóa '+course+'</strong> · Test '+test+'</td><td>'+t.name+'</td><td>'+badge(t.id,!!link,status)+'</td><td><div class="table-link">'+(link?'<input class="catalog-url" aria-label="Link '+label+'" readonly value="'+escapeHtml(link)+'">':'<span class="pending-link">'+({closed:'Bài tạm đóng',unknown:'Chưa xác minh được trạng thái',restricted:'Chưa có quyền bài này'}[status]||'Chưa có link · Bài chưa mở')+'</span>')+'<button class="copy-icon" type="button" data-copy="'+key+'" aria-label="Sao chép link '+label+'" title="'+(link?'Sao chép link '+label:'Chưa thể sao chép')+'" '+(link?'':'disabled')+'>'+COPY+'</button></div></td></tr>';
 }$('catalog-body').innerHTML=rows;
}
$('catalog-open').addEventListener('click',()=>{catalogGeneration++;$('catalog-status').textContent='';$('catalog-body').querySelectorAll('[data-copy]').forEach(b=>{b.innerHTML=COPY;b.classList.remove('copied');if(!b.disabled)b.title=b.getAttribute('aria-label');});$('catalog').showModal();});
$('catalog-close').addEventListener('click',()=>$('catalog').close());
$('catalog').addEventListener('click',e=>{if(e.target!==$('catalog'))return;const r=$('catalog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('catalog').close();});
$('catalog').addEventListener('close',()=>{catalogGeneration++;$('catalog-open').focus({preventScroll:true});});
$('catalog-body').addEventListener('click',async e=>{const b=e.target.closest('[data-copy]');if(!b||b.disabled)return;const link=PUBLISHED[b.dataset.copy];if(!link)return;const g=catalogGeneration,ok=await copyText(link,b.closest('tr').querySelector('input'));if(g!==catalogGeneration)return;const [course,test,type]=b.dataset.copy.split(':'),name=TYPES.find(t=>t.id===type).name;if(ok){b.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';b.classList.add('copied');b.title='Đã sao chép '+name+' · Test '+test+' · Khóa '+course;}$('catalog-status').textContent=ok?'Đã sao chép '+name+' · Test '+test+' · Khóa '+course+'.':'Chưa sao chép tự động được. Hãy chọn link và sao chép thủ công.';$('catalog-status').style.color=ok?'var(--green)':'var(--amber)';});

// Ghép vào module giao diện đã duyệt; quyền và trạng thái bài chỉ từ máy chủ.
const API='https://ducizone.ddns.net/substitute-teacher-api';
let authEpoch=0,authenticated=false,refreshing=false;
const show=(id,value)=>$(id).hidden=!value;
async function call(path){const r=await fetch(API+path,{method:'GET',credentials:'include',cache:'no-store',signal:AbortSignal.timeout(10000)});const data=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(Error('CATALOG_UNAVAILABLE'),{status:r.status});return data;}
function validatedCatalog(value){
 if(value?.schemaVersion!==1||typeof value.revision!=='string'||!Array.isArray(value.entries)||value.entries.length>16)throw Error('CATALOG_INVALID');
 const ids=new Set();for(const e of value.entries){
  if(![56,67].includes(e.course)||![1,2].includes(e.examNumber)||!TYPES.some(t=>t.id===e.skill)||!['open','closed','unknown','unreleased'].includes(e.status))throw Error('CATALOG_INVALID');
  const source=`substitute-test-${e.examNumber}-k${e.course}`,id=e.skill==='full'?source:`${source}-${e.skill}-makeup`;
  if(e.id!==id||e.sourceSlug!==source||ids.has(id))throw Error('CATALOG_INVALID');ids.add(id);
  if(e.status==='open'){const u=new URL(e.studentUrl);if(u.protocol!=='https:'||u.origin!=='https://tranhoangduc90.github.io'||!u.pathname.startsWith('/izone-ai-team-pages/term-tests/')||u.username||u.password||u.hash)throw Error('CATALOG_LINK_INVALID');}
  else if(e.studentUrl!==null)throw Error('CATALOG_INVALID');
 }return value;
}
function clearSession(){
 authEpoch++;authenticated=false;refreshing=false;generation++;catalogGeneration++;
 catalog={entries:[]};state={course:null,test:null,type:null};render();fillCatalog();
 if($('catalog').open)$('catalog').close();
 show('dashboard-workspace',false);show('auth-panel',true);show('logout',false);show('google',false);show('retry-auth',false);
 $('session-status').textContent='Giảng viên';
}
async function refreshCatalog(epoch=authEpoch){
 const value=validatedCatalog(await call('/teacher/skill-tests'));
 if(epoch!==authEpoch)return;
 if(!value.entries.length)throw Object.assign(Error('NO_SCOPE'),{status:403});
 if(value.revision===catalog.revision)return;
 catalog=value;
 if(state.course&&!value.entries.some(e=>e.course===Number(state.course)))state={course:null,test:null,type:null};
 if(state.test&&!value.entries.some(e=>e.course===Number(state.course)&&e.examNumber===Number(state.test)))state.test=state.type=null;
 const focusedType=document.activeElement?.dataset?.type;
 render();fillCatalog();
 document.querySelectorAll('[data-course]').forEach(b=>{b.disabled=!value.entries.some(e=>e.course===Number(b.dataset.course));});
 document.querySelectorAll('[data-test]').forEach(b=>{b.disabled=!!state.course&&!value.entries.some(e=>e.course===Number(state.course)&&e.examNumber===Number(b.dataset.test));});
 if(focusedType)document.querySelector('[data-type="'+focusedType+'"]')?.focus({preventScroll:true});
}
async function googleLogin(epoch){
 const cfg=await call('/teacher/config');if(epoch!==authEpoch)return;if(!cfg.googleClientId)throw Error('GOOGLE_CONFIG_UNAVAILABLE');
 if(!window.google?.accounts?.id)await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.onload=resolve;s.onerror=reject;document.head.append(s);});
 if(epoch!==authEpoch)return;
 window.google.accounts.id.initialize({client_id:cfg.googleClientId,callback:async r=>{if(epoch!==authEpoch)return;try{await window.IzoneTeacherSso.login('substitute',r.credential,true);if(epoch===authEpoch)await authenticate();}catch{$('auth-status').textContent='Chưa xác minh được đăng nhập. Hãy thử lại.';show('retry-auth',true);}}});
 show('google',true);window.google.accounts.id.renderButton($('google'),{theme:'outline',text:'signin_with'});
}
async function authenticate(){
 clearSession();const epoch=authEpoch;$('auth-status').textContent='Đang khôi phục đăng nhập của bạn…';
 try{
  if(!window.IzoneTeacherSso)throw Error('SSO_UNAVAILABLE');
  const restored=await window.IzoneTeacherSso.restore('substitute');if(epoch!==authEpoch)return;
  if(!restored){$('auth-status').textContent='Đăng nhập Google để lấy link các bài được cấp quyền.';await googleLogin(epoch);return;}
  await refreshCatalog(epoch);if(epoch!==authEpoch)return;
  authenticated=true;show('auth-panel',false);show('dashboard-workspace',true);show('logout',true);$('session-status').textContent='Đã xác minh giảng viên';
 }catch(e){if(epoch!==authEpoch)return;clearSession();$('auth-status').textContent=e.status===403?'Tài khoản chưa có quyền lấy link các bài Substitute.':'Chưa tải được phiên hoặc danh mục bài thi. Hãy thử lại.';show('retry-auth',true);}
}
$('retry-auth').addEventListener('click',authenticate);
$('logout').addEventListener('click',async()=>{clearSession();try{await window.IzoneTeacherSso.logout();await authenticate();}catch{$('auth-status').textContent='Chưa xác nhận đã đăng xuất hết. Hãy thử lại.';show('retry-auth',true);}});
addEventListener('storage',e=>{if(['izone:teacher-sso-login','izone:teacher-sso-logout'].includes(e.key))void authenticate();});
addEventListener('pagehide',clearSession);addEventListener('pageshow',e=>{if(e.persisted)void authenticate();});
setInterval(async()=>{if(!authenticated||refreshing)return;refreshing=true;const epoch=authEpoch;try{await refreshCatalog(epoch);}catch{if(epoch===authEpoch){clearSession();$('auth-status').textContent='Chưa xác minh được danh mục hiện tại. Hãy tải lại trước khi sao chép link.';show('retry-auth',true);}}finally{if(epoch===authEpoch)refreshing=false;}},30000);
await authenticate();
