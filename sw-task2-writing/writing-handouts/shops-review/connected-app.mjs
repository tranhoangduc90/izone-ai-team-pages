import {PEOPLE,ACTIVITY,TASK,LABELS,fixture,wordCount} from './model.mjs';
import {studentLayout,teacherLayout,esc,SECTION_FIELDS} from './lesson9-view.mjs';
import {connectedState,SECTION,serverField} from './connected-adapter.mjs';
import {appendMarkdown} from '../js/markdown.js';
import {renderLmsDraftResult} from '../js/lms-draft-result.js';
import {installStyles} from '../lesson5-thu/features.mjs';
import {renderActivityDetail} from '../lesson5/activity-ui.mjs';
import {renderGoogleLogin} from './teacher-google.mjs?startup=20261026-v2';
import {readLegacyDraft} from './legacy-draft.mjs';
import {patchReadingView} from '../../../shared/reading-view.mjs?v=20261027-draft-reading-v1';
installStyles();
const root=document.querySelector('#app'),teacher=document.body.dataset.view==='teacher',$=s=>root.querySelector(s);
const namespace='izone:sw-task2:production:'+ACTIVITY+':',drafts=new Map(),composers=new Map();
const openDetails=new Map(),historyCounts=new Map(),resultIndexes=new Map();let renderedOwner='login';
const vocabularyRequests=new Set(),resultRequests=new Map();
let legacyDraft=null;
let pendingIdentity=null,rememberStudent=true;
let classes=[],person=null,current=null,threads=[],rows=[],responses={},dirty=false,conflict=false,busy=false,saveTimer,pollTimer,generation=0;
let teacherAuth='checking';
let notice='',filter='all',query='',order='recent',detailOpen=false,editor=null,attestKey=null,composer=null,loggedIn=false,conflictServer=null;
const id=()=>crypto.randomUUID();
const apiBase=window.IZONE_SHOPS?.apiBase||'/api/v1/';
const entry=new URL(location.href).searchParams;let requestedClass=null;
function indexPeople(){PEOPLE.splice(0,PEOPLE.length,...classes.flatMap(c=>c.students.map(p=>({id:p.studentRef,name:p.displayAlias||p.displayName,classRef:c.classRef,classCode:c.className,scenario:'fresh',requiresAccessCode:!!p.requiresAccessCode}))));}
function authMessage(error){return error.status===403?'Tài khoản Google chưa có quyền xem lớp hoặc bài này.':error.status===401?'Chưa xác minh được phiên Google. Hãy đăng nhập lại.':error.status>=500?'Dịch vụ đăng nhập đang gián đoạn. Lời đang soạn được giữ; bạn có thể thử lại.':error.message;}
async function api(path,method='GET',body){
 const response=await fetch(apiBase+path,{method,credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json','X-Izone-Csrf':'1'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Object.assign(Error(data.message||data.error||'Chưa kết nối được máy chủ.'),{status:response.status,code:data.error});return data;
}
function message(text){notice=text;const node=$('#notice');if(node){node.textContent=text;if(conflict)node.insertAdjacentHTML('beforeend',' <button class="secondary" data-action="compare-conflict">Đối chiếu hai bản</button>');}const modal=$('#comment-status');if(modal)modal.textContent=text;}
function cache(){if(!current)return;try{localStorage.setItem(namespace+current.sessionRef,JSON.stringify({studentRef:person.id,classRef:person.classRef,responses,baseVersion:current.draftVersion,dirty}));}catch{message('Chưa lưu được bản dự phòng trên thiết bị; hãy giữ tab và lưu máy chủ.');}}
function state(raw=current,p=person,t=threads){return connectedState({...raw,responses:raw===current?responses:raw.responses},p,t);}
function banner(){return '';}
function top(){return `<header class="topbar"><a class="brand" href="./index.html?task=${encodeURIComponent(ACTIVITY)}" aria-label="IZONE Writing"><img class="m170-logo handout-brand-mark" src="./shared/master170/assets/izone-logo-color.png" alt="IZONE — IELTS chiến lược" width="145" height="48"><span class="brand-divider"></span><span class="brand-product">Writing<span>Handout trên lớp</span></span></a><span>Speaking Writing chuyên sâu · Bài ${TASK?.number||'?'} · ${esc(TASK?.shortTitle||'Đề chưa xác định')}</span></header>`;}
function fallbackPerson(){return person||PEOPLE[0];}
function working(raw){return Object.fromEntries([...new Set(raw.sectionDefinitions.flatMap(d=>d.inputFields))].map(key=>[key,raw.responses[key]??(key==='body_choice'?'body1':'')]));}
function draftComparison(values){
 const labels={body1_message:'Thân bài 1 · Thông điệp',body1_idea1:'Thân bài 1 · Idea 1',body1_idea2:'Thân bài 1 · Idea 2',body2_message:'Thân bài 2 · Thông điệp',body2_idea1:'Thân bài 2 · Idea 1',body2_idea2:'Thân bài 2 · Idea 2',body_choice:'Thân bài đã chọn',topic_sentence:'Topic Sentence',idea1_a:LABELS.a1,idea1_x:LABELS.x1,idea1_b:LABELS.b1,idea2_a:LABELS.a2,idea2_x:LABELS.x2,idea2_b:LABELS.b2,draft1:'Draft 1',draft2:'Draft 2'};
 const content=Object.entries(labels).filter(([key])=>values[key]?.trim()).map(([key,label])=>'<dt>'+esc(label)+'</dt><dd>'+esc(key==='body_choice'?(values[key]==='body2'?'Thân bài 2':'Thân bài 1'):values[key])+'</dd>').join('');
 return content?'<dl class="draft-comparison">'+content+'</dl>':'<p>Chưa có nội dung.</p>';
}
function detailsKey(el,scope=root){const group=el.closest('.teacher-detail-section'),index=group?[...scope.querySelectorAll('.teacher-detail-section')].indexOf(group):'';return el.id||(el.dataset.history?'history:'+el.dataset.history:el.className+':'+index+':'+el.querySelector(':scope>summary')?.textContent.trim().split('·')[0]);}
function draw({background=false}={}){
 for(const el of root.querySelectorAll('details'))openDetails.set(renderedOwner+':'+detailsKey(el),el.open);
 const owner=person?.id||'login',count=current?.comments.length||0;
 if(historyCounts.get(owner)!==count){for(const key of openDetails.keys())if(key.startsWith(owner+':history:'))openDetails.delete(key);historyCounts.set(owner,count);}
 const view=document.createElement('div'),$=selector=>view.querySelector(selector);let drawNotice=null;
 const s=current?state():teacher&&loggedIn?{...fixture(fallbackPerson(),'fresh'),connected:true}:null;
 let html=teacher?(loggedIn?teacherLayout(s||fixture(fallbackPerson(),'fresh'),{rows,query,filter,order,detailOpen,drafts,composer}):teacherAuth!=='signedOut'?'<section class="answer-card"><h1>Không gian giảng viên</h1><p role="status" aria-live="polite"'+(teacherAuth==='checking'?' aria-busy="true"':'')+'>'+esc(teacherAuth==='checking'?'Đang khôi phục đăng nhập của bạn…':notice)+'</p>'+(teacherAuth==='failed'?'<button class="secondary" data-action="retry-login">Thử lại</button>':'')+'</section>':'<section class="answer-card"><h1>Giảng viên · Đăng nhập Google</h1><p>Dùng tài khoản Google đã được cấp quyền giảng viên. Phiên đăng nhập dùng chung được ghi nhớ trên trình duyệt này.</p><div id="google-signin"></div><button class="text-button" data-action="retry-login">Thử lại đăng nhập</button></section>'):(s?studentLayout(s,''):pendingIdentity?confirmLoginView():loginView());
 view.innerHTML=top()+banner()+'<main id="main"><p id="notice" role="status">'+esc(notice)+'</p>'+html+'</main>';
 if(!teacher&&s&&legacyDraft?.sessionRef===current.sessionRef)$('#notice').insertAdjacentHTML('afterend','<section class="answer-card" id="legacy-draft-notice"><h2>Bản nháp từ giao diện cũ</h2><p>Tìm thấy bản gõ khác trên thiết bị này. Xem và chọn trước khi dùng; bản gốc vẫn được giữ.</p><button class="secondary" data-action="legacy-compare">Xem hai bản nháp</button></section>');
 if(teacher&&!loggedIn&&teacherAuth==='signedOut')void renderGoogleLogin($('#google-signin'),{onCredential:async credential=>{const epoch=generation;await fetch('https://ducizone.ddns.net/shops-writing-api/api/v1/auth/session',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','X-Izone-Csrf':'1'},body:JSON.stringify({credential})}).then(r=>{if(!r.ok)throw Error('Chưa xác minh được Google.');});if(epoch===generation)await setupTeacher();},onError:error=>message(authMessage(error))}).catch(error=>message(authMessage(error)));
 if(teacher&&loggedIn)view.querySelector('.teacher-heading .teacher-actions')?.insertAdjacentHTML('beforeend','<button class="secondary" data-export-csv>Xuất CSV</button><button class="secondary" data-action="teacher-logout">Đăng xuất chung</button>');
 for(const el of view.querySelectorAll('details')){const key=owner+':'+detailsKey(el,view);if(openDetails.has(key))el.open=openDetails.get(key);}
 renderedOwner=owner;
 if(s&&(s.raw?.ui?.version==='legacy-v1'||s.raw?.previewReadOnly)){
  const scope=teacher?$('#detail'):view;
  scope?.querySelectorAll('[data-check],[data-attest],[data-edit],[data-vocab-retry],[data-comment-field],[data-thread-status],[data-action="copy-draft"],[data-action="grade"],textarea,select,form button[type="submit"],#comment-form .primary').forEach(el=>el.disabled=true);
  drawNotice='Phiên cũ đang được xem chỉ đọc để đối chiếu; chưa chuyển phiên hoặc chấm lại.';
 }

 for(const form of view.querySelectorAll('[data-thread-reply]'))form.elements.body.value=drafts.get(person.id+':'+form.dataset.threadReply)||'';
 if(teacher&&detailOpen&&!current){$('#comment-form').querySelectorAll('textarea,select,button').forEach(el=>el.disabled=true);drawNotice='Học viên chưa mở bài. Bạn có thể xem cấu trúc trống; trao đổi mở khi học viên có phiên bài làm.';}
 if(attestKey){view.insertAdjacentHTML('beforeend','<dialog id="attest-dialog" class="feature-dialog"><h3>Xác nhận lời đồng ý của GV</h3><p>Ghi riêng nguồn xác nhận của học viên, giữ feedback AI trước đó.</p><form id="attest-form"><label class="permission"><input id="teacher-permission" type="checkbox">Tôi đã được GV đồng ý miệng cho bỏ qua comment ở phần này.</label><footer><button type="button" class="secondary" data-action="cancel-attest">Hủy</button><button id="attest-submit" class="primary" disabled>Xác nhận và mở phần tiếp theo</button></footer></form></dialog>');}
 if(s){
  const save=$('#save-state');if(save)save.textContent=dirty?'Chưa lưu máy chủ':'✓ Đã lưu máy chủ';
  if(save)save.parentElement.insertAdjacentHTML('beforeend','<button class="text-button" data-action="save">Lưu máy chủ</button><button class="text-button" data-action="refresh">Đọc cập nhật</button>');
  if(!teacher&&['shops-lesson9-v1','sw-task2-lesson9-v1'].includes(current.ui?.version)&&['topic_sentence','supporting_idea_1','supporting_idea_2'].every(key=>current.sections[key]?.locked)){
   if((current.ui.data.editedFields||[]).length&&$('#completion'))$('#completion').insertAdjacentHTML('beforeend','<p class="preview-vocab-note">Gợi ý thuộc bản nội dung đã chốt. Sau khi sửa, bạn có thể <button class="text-button" data-vocab-retry="all">lấy lại từ vựng</button>.</p>');
   if(current.uiVocabulary?.status==='missing'&&!dirty&&!editor)void requestVocabulary();
  }
  for(const details of view.querySelectorAll('[data-history]')){
   const label=details.querySelector('.section-title')?.textContent||'',section=details.closest('[id^="step-"]')?.id.slice(5),index=Number(label.match(/Lần (\d+)/)?.[1])-1;
   const text=s.steps[section]?.history[index]?.feedback,body=details.querySelector('.comment-body>p');if(text&&body){body.replaceChildren();appendMarkdown(body,text);}
  }
  const vocab=$('.teacher-detail-vocabulary');if(vocab){vocab.innerHTML='<h3>Từ vựng theo nội dung đã chấm</h3>'+Object.entries(s.vocabularyGroups||{}).map(([key,terms])=>'<p><b>'+key+'</b>: '+terms.map(t=>esc(t.phrase)+(t.meaningVi?' · '+esc(t.meaningVi):'')).join('; ')+'</p>').join('')+(s.legacyVocabulary?.length?'<h4>Từ vựng đã lưu của bài cũ</h4>'+s.legacyVocabulary.map(row=>'<p><b>'+esc(row.label)+'</b>: '+row.terms.map(t=>esc(t.phrase)+(t.meaningVi?' · '+esc(t.meaningVi):'')).join('; ')+'</p>').join(''):'');}
  const foot=$('.teacher-draft-read .fine-print');if(foot)foot.textContent='Nhận xét từng câu của Draft 2; học viên xem cùng nội dung tại mục Kết quả.';
  if(teacher){
   for(const [index,section] of Object.keys(SECTION_FIELDS).entries()){
    const block=view.querySelectorAll('.teacher-detail-section')[index];if(!block)continue;
    for(const [i,body] of [...block.querySelectorAll('.attempt-content>p')].entries()){
     const feedback=s.steps[section].history.toReversed()[i]?.feedback;if(feedback){body.replaceChildren();appendMarkdown(body,feedback);}
    }
   }
   if(s.steps.draft.status==='passed'&&detailOpen){$('.teacher-draft-read').insertAdjacentHTML('beforeend','<div id="connected-draft-result"></div>');}
  }
 }
 const result=$('#connected-draft-result'),previous=root.querySelector('#connected-draft-result');
 if(result){result.dataset.resultKey=resultKey();if(!background&&previous?.dataset.resultKey===result.dataset.resultKey)result.replaceWith(previous);}
 if(background)patchReadingView(root,view);else root.replaceChildren(...view.childNodes);
 const dialog=root.querySelector('#detail');if(teacher&&detailOpen&&dialog&&!dialog.open)dialog.showModal();
 const attest=root.querySelector('#attest-dialog');if(attest&&!attest.open){attest.showModal();attest.querySelector('input')?.focus();}
 if(drawNotice)message(drawNotice);
 if(root.querySelector('#connected-draft-result'))void loadResult(current.sessionRef);
}
function loginView(){
 return '<section id="identity" class="login-shell" aria-labelledby="login-title"><div class="login-card"><p class="kicker red">Speaking Writing chuyên sâu · Writing buổi '+esc(TASK.number)+'</p><h1 id="login-title">Bắt đầu bài học</h1><p class="login-description">Xây lập luận cho một thân bài,<br>từng bước từ ý tưởng đến A–X–B.</p><form id="identity-form"><label>Lớp của bạn<select id="identity-class" required><option value="">Chọn lớp của bạn</option>'+classes.map(c=>`<option value="${c.classRef}" ${classes.length===1?'selected':''}>${esc(c.className)}</option>`).join('')+'</select></label><label>Tên của bạn<select id="identity-person" required></select></label><label class="checkbox"><input id="identity-remember" type="checkbox" checked><span>Ghi nhớ tôi trên thiết bị này</span></label><button class="primary wide" type="submit">Tiếp tục <span aria-hidden="true">→</span></button></form><p class="fine-print">Chọn đúng tên của bạn. Bài làm và các lần nhận xét được lưu để bạn tiếp tục khi quay lại.</p></div></section>';
}
function confirmLoginView(){const {p}=pendingIdentity;return '<section id="identity-confirm-screen" class="login-shell" aria-labelledby="confirm-title"><div class="login-card confirm-card"><p class="kicker red">Xác nhận người học</p><div class="avatar" aria-hidden="true">HV</div><h1 id="confirm-title">'+esc(p.name)+'</h1><p><span>'+esc(p.classCode)+'</span><br><strong>Writing · Buổi '+esc(TASK.number)+'</strong></p><button id="confirm-button" class="primary wide" data-action="confirm-identity">Đúng là tôi · mở bài làm →</button><button class="text-button" data-action="identity-back">Chọn lại tên</button><p class="fine-print">Chọn tên và xác nhận như Progress Log.</p></div></section>';}
function pinControl(){const p=PEOPLE.find(p=>p.id===$('#identity-person')?.value);let box=$('#pin-box');if(!box&&$('#identity-form')){$('#identity-form .primary').insertAdjacentHTML('beforebegin','<label id="pin-box" hidden>Mã 4 số<input id="access-code" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="off"></label>');box=$('#pin-box');}if(box){box.hidden=!p?.requiresAccessCode;$('#access-code').required=!!p?.requiresAccessCode;$('#access-code').value='';}}
function fillPeople(){const c=classes.find(c=>c.classRef===$('#identity-class')?.value);if($('#identity-person')){$('#identity-person').innerHTML='<option value="">Chọn tên của bạn</option>'+(c?.students||[]).map(p=>`<option value="${p.studentRef}">${esc(p.displayAlias||p.displayName)}</option>`).join('');if(c?.students.some(p=>p.studentRef===entry.get('student')))$('#identity-person').value=entry.get('student');}pinControl();}
function jump(key){const target=document.getElementById(key);if(!target)return;if(target.matches('details'))target.open=true;const inner=target.querySelector('details.prior-step');if(inner)inner.open=true;target.scrollIntoView({block:'start'});}
async function openPerson(p,accessCode,rememberedRef){
 const epoch=++generation;person=p;
 const data=rememberedRef?await api('lesson9/sessions/'+rememberedRef):await api('lesson9/sessions','POST',{activitySlug:ACTIVITY,classRef:p.classRef,studentRef:p.id,...(accessCode?{accessCode}:{})});
 if(epoch!==generation)return;
 if(data.session.studentRef!==p.id||data.session.classRef!==p.classRef)throw Error('Máy chủ trả phiên khác chủ; chưa mở bài.');
 if(data.session.activitySlug!==ACTIVITY)throw Error('Phiên không thuộc đúng đề. Chưa mở bài.');
 current=data.session;responses=working(current);dirty=false;conflict=false;legacyDraft=null;pendingIdentity=null;
 try{
  const saved=JSON.parse(localStorage.getItem(namespace+current.sessionRef)||'null');
  if(saved?.dirty&&saved.studentRef===p.id&&saved.classRef===p.classRef){responses=saved.responses;dirty=true;conflict=saved.baseVersion!==current.draftVersion;message(conflict?'Bản dự phòng chưa lưu khác phiên bản máy chủ. Giữ bản gõ để đối chiếu; chưa ghi đè.':'Đã khôi phục bản gõ chưa lưu; bấm Lưu máy chủ trước khi Check.');}
  if(rememberStudent)localStorage.setItem(namespace+'identity',JSON.stringify({id:p.id,classRef:p.classRef,sessionRef:current.sessionRef}));else localStorage.removeItem(namespace+'identity');
 }catch{}
 try{const found=await readLegacyDraft(current,ACTIVITY);if(epoch!==generation)return;legacyDraft=found&&localStorage.getItem(namespace+current.sessionRef+':legacy-reviewed')!==JSON.stringify(found)?found:null;}catch{if(epoch!==generation)return;message('Chưa đọc được bản nháp cũ trên thiết bị; bản gốc vẫn giữ. Bạn có thể tải lại để thử.');}
 if(epoch!==generation)return;
 threads=(await api('sessions/'+current.sessionRef+'/teacher-comments')).threads;draw();startPoll();
}
async function save(){
 clearTimeout(saveTimer);if(!current||!dirty)return;if(conflict)throw Error('Bản đang gõ khác máy chủ. Hãy đối chiếu trước khi lưu.');
 if(busy){const end=Date.now()+32000;while(busy&&Date.now()<end)await new Promise(resolve=>setTimeout(resolve,30));if(busy)throw Error('Máy chủ vẫn đang lưu; chữ được giữ. Hãy thử lại.');if(!dirty)return;}
 busy=true;
 const epoch=generation,ref=current.sessionRef,submitted={...responses},version=current.draftVersion;
 try{
  const result=await api('lesson-sessions/'+ref+'/responses','PUT',{baseVersion:version,requestId:id(),responses:submitted});
  if(epoch!==generation)return;current=result.session;current={...(await api('lesson9/sessions/'+ref)).session};
  dirty=JSON.stringify(submitted)!==JSON.stringify(responses);cache();if($('#save-state'))$('#save-state').textContent=dirty?'Có chỉnh sửa mới chưa lưu':'✓ Đã lưu máy chủ';
 }catch(error){if(epoch===generation){if(error.status===409)conflict=true;dirty=true;cache();message(error.message+' Nội dung đang gõ được giữ, chưa ghi đè máy chủ.');}throw error;}finally{busy=false;}
}
async function refresh({background=false}={}){
 if($('#legacy-dialog')||$('#conflict-dialog'))return;
 if(!current)return;const ref=current.sessionRef,epoch=generation;
 const path=teacher?'admin/lesson9/sessions/':'lesson9/sessions/';
 const result=await api(path+ref);const threadData=await api((teacher?'admin/live/':'')+'sessions/'+ref+'/teacher-comments');
 if(epoch!==generation||ref!==current.sessionRef)return;
 if(!dirty){current=result.session;responses=working(current);}else if(result.session.draftVersion!==current.draftVersion){conflict=true;message('Máy chủ có bản mới. Bản đang gõ được giữ, chưa ghi đè.');}
 threads=threadData.threads;
 if(!editor&&!attestKey&&!document.activeElement?.matches('textarea,input,select'))draw({background});
 else message('Đã đọc cập nhật; giữ nguyên vùng bạn đang gõ. Bấm Cập nhật để xem khi đã xong.');
}
function startPoll(){clearTimeout(pollTimer);if(teacher&&!loggedIn)return;pollTimer=setTimeout(async()=>{if(!document.hidden&&!busy){try{if(teacher)await loadTeacher(false);else await refresh({background:true});}catch(error){if(teacher&&[401,403].includes(error.status))invalidateTeacher('Phiên đã hết hạn hoặc quyền vừa thay đổi. Lời đang soạn được giữ; hãy xác minh lại tài khoản.');else message(error.message);}}startPoll();},5000);}
async function action(kind,extra={}){
 if(editor&&kind!=='edit')throw Error('Hãy lưu hoặc hủy ô đang chỉnh.');const epoch=generation,ref=current.sessionRef;await save();
 if(epoch!==generation||ref!==current.sessionRef)throw Error('Đã đổi hồ sơ; thao tác cũ được dừng.');
 const result=await api('lesson9/sessions/'+ref+'/actions','POST',{baseVersion:current.draftVersion,requestId:id(),kind,...extra});
 if(epoch!==generation||ref!==current.sessionRef)return;
 current=result.session;responses=working(current);dirty=false;cache();return result.session;
}
async function check(key){
 if(editor)throw Error('Hãy lưu hoặc hủy ô đang chỉnh.');const epoch=generation,ref=current.sessionRef;await save();
 if(epoch!==generation||ref!==current.sessionRef)return;
 if(key==='draft'&&current.sections.draft.locked)await action('revise_draft');
 await api('lesson-sessions/'+ref+'/checks','POST',{section:SECTION[key],requestId:id()});if(epoch!==generation)return;await refresh();draw();
}
async function loadTeacher(render=true){
 const epoch=generation;
 const classRef=person?.classRef||classes[0]?.classRef;
 const data=await api('admin/live/activities/'+ACTIVITY+'?classRef='+encodeURIComponent(classRef));
 if(epoch!==generation||!loggedIn)return;
 rows=[];
 for(const row of data.students||[]){
  const p=PEOPLE.find(p=>p.id===row.studentRef&&p.classRef===row.classRef);if(!p)continue;
  if(row.sessionRef){const raw=(await api('admin/lesson9/sessions/'+row.sessionRef)).session;if(epoch!==generation||!loggedIn)return;rows.push(connectedState(raw,p));if((current?.sessionRef===raw.sessionRef||detailOpen&&!current&&person?.id===p.id)&&!editor){current=raw;responses=working(raw);}}
  else rows.push({...fixture(p,'fresh'),connected:true});
 }
 if(render)draw();else if(detailOpen)await refresh({background:true});else if(!document.activeElement?.matches('input,textarea,select'))draw({background:true});
}
// Lượt chấm là ranh giới của trạng thái đọc; cùng phiên có thể có nhiều lượt.
function resultKey(){
 const attempt=current?.attempts.find(a=>a.section==='draft'&&a.status==='completed'&&a.resultStatus==='passed');
 return JSON.stringify([ACTIVITY,person?.classRef,person?.id,current?.sessionRef,attempt?.attemptRef,attempt?.completedAt,generation]);
}
async function loadResult(ref){
 const target=$('#connected-draft-result'),key=resultKey(),epoch=generation;
 if(!target||target.dataset.resultKey!==key)return;
 let request=resultRequests.get(key);
 if(!request){request=api('lesson-sessions/'+ref+'/draft-result');resultRequests.set(key,request);}
 try{
  const data=await request;
  if(epoch!==generation||current?.sessionRef!==ref||resultKey()!==key||!target.isConnected)return;
  const payload=data.result||data;
  // Vẫn đọc HTTP để nhận sửa cùng lượt; timestamp riêng không phá thẻ đang xem.
  const signature=JSON.stringify([key,payload.essays,payload.noCorrections,payload.readbackOk,payload.reviewCaseCount]);
  if(target.dataset.resultSignature===signature)return;
  renderLmsDraftResult(target,payload,{initialIndex:resultIndexes.get(key)||0,onPageChange:index=>resultIndexes.set(key,index)});
  target.dataset.resultSignature=signature;
 }catch(error){
  if(epoch!==generation||resultKey()!==key||!target.isConnected)return;
  if(!target.dataset.resultSignature||[401,403].includes(error.status)){target.textContent=error.message;delete target.dataset.resultSignature;}
  else message('Chưa đọc được cập nhật kết quả. Bản đang xem được giữ. '+error.message);
 }finally{if(resultRequests.get(key)===request)resultRequests.delete(key);}
}
async function requestVocabulary(retry=false){
 const ref=current?.sessionRef,epoch=generation;if(!ref||vocabularyRequests.has(ref))return;vocabularyRequests.add(ref);
 try{const result=await api('lesson9/sessions/'+ref+'/vocabulary','POST',{requestId:id(),retry});if(epoch===generation&&current.sessionRef===ref){current=result.session;if(!dirty)responses=working(current);if(!editor&&!document.activeElement?.matches('textarea,input,select'))draw();}}
 catch(error){message(error.message);}finally{vocabularyRequests.delete(ref);}
}
root.addEventListener('input',e=>{
 const el=e.target;
 if(el.dataset.field){responses[serverField(el.dataset.field,responses.body_choice)]=el.value;dirty=true;cache();if($('#save-state'))$('#save-state').textContent='Chưa lưu máy chủ';clearTimeout(saveTimer);saveTimer=setTimeout(()=>save().catch(()=>{}),900);
  if(el.dataset.field.startsWith((responses.body_choice||'body1')+'_idea')){const mirror=$('#field-idea'+el.dataset.field.at(-1));if(mirror)mirror.value=el.value;}
  if(['idea1','idea2'].includes(el.dataset.field)){const mirror=$('#field-'+(responses.body_choice||'body1')+'_'+el.dataset.field);if(mirror)mirror.value=el.value;}
  const view=state(),key=Object.keys(SECTION_FIELDS).find(k=>SECTION_FIELDS[k].includes(el.dataset.field))||'topic';
  if($(`[data-count="${key}"]`))$(`[data-count="${key}"]`).textContent=SECTION_FIELDS[key].reduce((n,k)=>n+wordCount(view.responses[k]),0)+' từ';
  if($(`[data-draft-count="${el.dataset.field}"]`))$(`[data-draft-count="${el.dataset.field}"]`).textContent=wordCount(el.value)+' từ';
 }
 if(el.id==='comment-body')drafts.set(person.id+':composer',el.value);
 const form=el.closest('[data-thread-reply]');if(form&&el.tagName==='TEXTAREA')drafts.set(person.id+':'+form.dataset.threadReply,el.value);
 if(el.id==='search'){query=el.value;const caret=el.selectionStart;draw();$('#search').focus();$('#search').setSelectionRange(caret,caret);}
});
root.addEventListener('change',e=>{
 const el=e.target;if(el.id==='identity-class')fillPeople();
 if(el.id==='identity-person')pinControl();
 if(el.id==='body-choice'){
  if(current?.sections.topic_sentence.locked){const value=el.value;if(!confirm('Đổi thân bài sẽ mở vòng Check mới. Nội dung và lịch sử cũ vẫn giữ. Tiếp tục?')){draw();return;}void action('change_body',{value,confirmed:true}).then(()=>draw()).catch(e=>message(e.message));return;}
  responses.body_choice=el.value;dirty=true;cache();draw();
 }
 if(el.id==='status-filter'){filter=el.value;draw();}if(el.id==='order'){order=el.value;draw();}
 if(el.id==='teacher-class'){const p=PEOPLE.find(p=>p.classCode===el.value);if(p){const previous=person;person=p;detailOpen=false;current=null;void loadTeacher().catch(e=>{person=previous;draw();message(e.message);});}}
 if(el.id==='comment-field')composer={personId:person.id,field:el.value,quote:''};
 if(el.id==='teacher-permission')$('#attest-submit').disabled=!el.checked;
});
root.addEventListener('click',async e=>{
 const b=e.target.closest('button,[data-threads]');if(!b||b.disabled)return;
 try{
  if(b.dataset.exportCsv!==undefined){
   const response=await fetch(apiBase+'admin/activities/'+ACTIVITY+'/export.csv?classRef='+encodeURIComponent(person.classRef),{credentials:'include',cache:'no-store'});
   if(!response.ok)throw Error('Chưa xuất được CSV. Hãy kiểm tra phiên và quyền lớp.');
   const url=URL.createObjectURL(await response.blob()),link=document.createElement('a');link.href=url;link.download=ACTIVITY+'-progress.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;
  }
  if(b.dataset.target){jump(b.dataset.target);return;}
  if(b.dataset.threads){const target=document.getElementById('thread-'+b.dataset.threads.split(',')[0]);if(target){let parent=target.parentElement;while(parent){if(parent.tagName==='DETAILS')parent.open=true;parent=parent.parentElement;}target.scrollIntoView({block:'center'});target.querySelector('textarea')?.focus();}return;}
  if(b.dataset.logJob){const event=state().events.find(e=>e.job_ref===b.dataset.logJob);$('#activity-job').innerHTML=renderActivityDetail(event?{input:{job_ref:event.job_ref,created_at:event.event_at,snapshot:{topic:ACTIVITY,responses:event.snapshot}},attempts:[{attempt_index:1,status:event.status==='technical_error'?'failed':'completed',started_at:event.event_at,model:'Phản hồi đã lưu từ API Writing',response_text:event.feedback||null}]}:null);return;}
  if(b.dataset.cancelInline!==undefined){editor=null;draw();return;}
  if(editor&&!b.closest('.inline-edit-box'))throw Error('Hãy lưu hoặc hủy ô đang chỉnh.');
  if(b.dataset.edit){const field=b.dataset.edit,host=b.closest('.saved-field');editor={field};host.querySelector('.saved-text').hidden=true;b.hidden=true;host.insertAdjacentHTML('beforeend',`<form class="inline-edit-box" data-inline-field="${field}"><label>${esc(LABELS[field])}<textarea required maxlength="4000">${esc(state().responses[field])}</textarea></label><footer><button class="primary">Lưu thay đổi</button><button class="secondary" type="button" data-cancel-inline>Hủy</button></footer><p>Giữ trạng thái đã đạt và snapshot nhận xét cũ.</p></form>`);host.querySelector('textarea').focus();return;}
  if(b.dataset.check){await check(b.dataset.check);return;}
  if(b.dataset.vocabRetry){await save();await requestVocabulary(true);return;}
  if(b.dataset.attest){attestKey=b.dataset.attest;draw();return;}
  if(b.id==='next-idea'){await action('open_idea2');draw();jump('idea2');return;}
  if(b.dataset.filter){filter=filter===b.dataset.filter?'all':b.dataset.filter;draw();return;}
  if(b.dataset.student){
   if(composer&&person)composers.set(person.id,composer);person=PEOPLE.find(p=>p.id===b.dataset.student);composer=composers.get(person.id)||null;
   const row=rows.find(r=>r.id===person.id);if(!row?.sessionRef){current=null;responses={};threads=[];detailOpen=true;generation++;draw();return;}
   current=(await api('admin/lesson9/sessions/'+row.sessionRef)).session;responses=working(current);dirty=false;threads=(await api('admin/live/sessions/'+current.sessionRef+'/teacher-comments')).threads;detailOpen=true;generation++;draw();return;
  }
  if(b.dataset.commentField){composer={personId:person.id,field:b.dataset.commentField,quote:''};draw();$('#comment-body').focus();return;}
  if(b.dataset.threadStatus){const t=threads.find(t=>t.threadRef===b.dataset.threadStatus);await api('admin/teacher-comments/'+t.threadRef+'/status','POST',{status:t.status==='addressed'?'open':'addressed',requestId:id()});await refresh();draw();return;}
  const a=b.dataset.action;
  if(a==='confirm-identity'){const chosen=pendingIdentity;if(!chosen)throw Error('Hãy chọn lại tên của bạn.');rememberStudent=chosen.remember;await openPerson(chosen.p,chosen.accessCode);return;}
  if(a==='identity-back'){const chosen=pendingIdentity;pendingIdentity=null;draw();$('#identity-class').value=chosen.p.classRef;fillPeople();$('#identity-person').value=chosen.p.id;$('#identity-remember').checked=chosen.remember;pinControl();$('#identity-person').focus();return;}
  if(a==='legacy-compare'){
   root.insertAdjacentHTML('beforeend',`<dialog id="legacy-dialog" class="feature-dialog"><h3>Đối chiếu bản nháp cũ</h3><h4>Bản từ giao diện cũ</h4>${draftComparison(legacyDraft.responses)}<h4>Bản đang mở</h4>${draftComparison(responses)}<p>Bản cũ chỉ được đưa vào ô soạn. Hãy kiểm tra rồi bấm Lưu máy chủ.</p><footer><button class="secondary" data-action="legacy-cancel">Giữ bản đang mở</button><button class="primary" data-action="legacy-use">Dùng bản nháp cũ</button></footer></dialog>`);$('#legacy-dialog').showModal();return;
  }
  if(a==='legacy-cancel'){$('#legacy-dialog').remove();return;}
  if(a==='legacy-use'){
   localStorage.setItem(namespace+current.sessionRef+':handover-backup:'+Date.now(),JSON.stringify({studentRef:person.id,classRef:person.classRef,current:responses,legacy:legacyDraft,server:current.responses}));
   localStorage.setItem(namespace+current.sessionRef+':legacy-reviewed',JSON.stringify(legacyDraft));
   responses={...responses,...legacyDraft.responses};dirty=true;conflict=legacyDraft.baseVersion!==current.draftVersion;legacyDraft=null;cache();draw();message(conflict?'Đã giữ bản nháp cũ. Phiên bản máy chủ đã đổi; hãy đối chiếu trước khi lưu.':'Đã đưa bản nháp cũ vào ô soạn. Hãy kiểm tra rồi bấm Lưu máy chủ.');return;
  }
  if(a==='reload'){location.reload();return;}
  if(a==='save'){await save();message('Đã lưu máy chủ.');}
  if(a==='compare-conflict'){
   conflictServer=(await api('lesson9/sessions/'+current.sessionRef)).session;
   root.insertAdjacentHTML('beforeend',`<dialog id="conflict-dialog" class="feature-dialog"><h3>Đối chiếu bản nháp</h3><p>Cả hai bản được giữ trong thiết bị. Chọn bản dùng tiếp.</p><h4>Bản đang gõ</h4>${draftComparison(responses)}<h4>Bản máy chủ</h4>${draftComparison(working(conflictServer))}<footer><button class="secondary" data-action="conflict-server">Dùng bản máy chủ</button><button class="primary" data-action="conflict-local">Lưu bản đang gõ</button><button class="secondary" data-action="conflict-cancel">Để tôi đối chiếu thêm</button></footer></dialog>`);$('#conflict-dialog').showModal();return;
  }
  if(a==='conflict-cancel'){$('#conflict-dialog').remove();return;}
  if(a==='conflict-server'||a==='conflict-local'){
   localStorage.setItem(namespace+current.sessionRef+':conflict-backup:'+Date.now(),JSON.stringify({local:responses,server:conflictServer.responses}));
   current=conflictServer;conflict=false;conflictServer=null;
   if(a==='conflict-server'){responses=working(current);dirty=false;cache();}else{dirty=true;await save();}
   draw();message('Đã chọn bản dùng tiếp; bản đối chiếu vẫn giữ trên thiết bị.');return;
  }
  if(a==='retry-login'){await restoreTeacher();}
  if(a==='teacher-logout'){try{await api('auth/session','DELETE');}catch(error){if(error.status!==401)throw error;}invalidateTeacher('Đã đăng xuất phiên dùng chung. Lời đang soạn được giữ trong tab.');return;}
  if(a==='refresh'){if(dirty)await save();await refresh();draw();}
  if(a==='identity'){await save();current=null;generation++;clearTimeout(pollTimer);draw();fillPeople();}
  if(a==='close-detail'){if(person&&composer)composers.set(person.id,composer);detailOpen=false;draw();$(`[data-student="${person.id}"]`)?.focus();}
  if(a==='cancel-attest'){attestKey=null;draw();}
  if(a==='copy-draft'){const overwrite=!!responses.draft2?.trim();if(overwrite&&!confirm('Sao chép lại sẽ thay Draft 2. Tiếp tục?'))return;await action('copy_draft',{confirmed:overwrite});draw();$('#field-draft2').focus();}
  if(a==='grade')await check('draft');
  if(a==='clear-quote'){composer={personId:person.id,field:composer.field,quote:''};draw();}
 }catch(error){message(error.message);}
});
root.addEventListener('submit',async e=>{
 e.preventDefault();const form=e.target;
 try{
  if(form.id==='identity-form'){const p=PEOPLE.find(p=>p.id===$('#identity-person').value&&p.classRef===$('#identity-class').value);if(!p)throw Error('Hãy chọn đúng người trong lớp.');pendingIdentity={p,accessCode:$('#access-code')?.value,remember:$('#identity-remember').checked};draw();$('#confirm-button').focus();}
  if(form.dataset.inlineField){await action('edit',{field:serverField(form.dataset.inlineField,responses.body_choice),value:form.querySelector('textarea').value});editor=null;draw();}
  if(form.id==='attest-form'){if(!$('#teacher-permission').checked)return;await action('attest',{section:SECTION[attestKey],confirmed:true});attestKey=null;draw();}
  if(form.id==='comment-form'){
   const field=serverField(composer?.field||$('#comment-field').value,responses.body_choice),source=responses[field]||'',quote=composer?.quote||source;
   const start=composer?.start??0;if(!quote||source.slice(start,start+quote.length)!==quote)throw Error('Nội dung đã đổi; lời góp ý được giữ. Hãy chọn lại đoạn.');
   const sectionKey=Object.entries(SECTION).find(([key])=>SECTION_FIELDS[key]?.includes(composer?.field||$('#comment-field').value))?.[1]||'draft';
   await api('admin/live/sessions/'+current.sessionRef+'/teacher-comments','POST',{sectionKey,fieldKey:field,start,end:start+quote.length,baseVersion:current.draftVersion,body:$('#comment-body').value,requestId:id()});
   drafts.delete(person.id+':composer');composer=null;await refresh();draw();message('Góp ý đã lưu trên máy chủ.');
  }
  if(form.dataset.threadReply){await api(teacher?'admin/teacher-comments/'+form.dataset.threadReply+'/replies':'sessions/'+current.sessionRef+'/teacher-comments/'+form.dataset.threadReply+'/replies','POST',{body:form.elements.body.value,requestId:id()});drafts.delete(person.id+':'+form.dataset.threadReply);await refresh();draw();}
 }catch(error){message(error.message);}
});
function selectQuote(){
 if(!teacher||!detailOpen)return;const selection=getSelection();if(!selection?.rangeCount||selection.isCollapsed)return;
 const range=selection.getRangeAt(0),host=node=>(node.nodeType===1?node:node.parentElement)?.closest('[data-select-field]'),a=host(range.startContainer),b=host(range.endContainer);
 if(!a||a!==b)return;const prefix=range.cloneRange();prefix.selectNodeContents(a);prefix.setEnd(range.startContainer,range.startOffset);
 composer={personId:person.id,field:a.dataset.selectField,quote:selection.toString(),start:prefix.toString().length};
 $('#comment-field').value=composer.field;let bar=$('#selection-action');if(!bar){bar=document.createElement('div');bar.id='selection-action';$('#comment-form').before(bar);}bar.innerHTML='<blockquote>'+esc(composer.quote)+'</blockquote><button class="secondary" type="button">Góp ý đoạn đã chọn</button>';bar.querySelector('button').onclick=()=>{draw();$('#comment-body').focus();};
}
root.addEventListener('mouseup',selectQuote);root.addEventListener('keyup',e=>{if(e.key==='Shift')selectQuote();});
function closeDialog(){if(attestKey)attestKey=null;else{if(composer)composers.set(person.id,composer);detailOpen=false;}draw();$(`[data-student="${person?.id}"]`)?.focus();}
root.addEventListener('cancel',e=>{if(e.target.tagName==='DIALOG'){e.preventDefault();if(e.target.id==='conflict-dialog'){e.target.remove();return;}closeDialog();}},true);
let down=false;const outside=e=>{if(e.target.tagName!=='DIALOG')return false;const r=e.target.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;};
root.addEventListener('pointerdown',e=>down=outside(e));root.addEventListener('pointerup',e=>{if(down&&outside(e))closeDialog();down=false;});
window.addEventListener('beforeunload',e=>{if(dirty||editor){cache();e.preventDefault();e.returnValue='';}});
async function restoreTeacher(){
 const epoch=generation;teacherAuth='checking';notice='';draw();
 try{
  if(await window.IzoneTeacherSso?.restore('shops')===false)throw Object.assign(Error('Chưa có phiên đăng nhập.'),{status:401});await api('auth/session');
  if(epoch!==generation)return;await setupTeacher();
 }catch(error){
  if(epoch!==generation)return;
  // Native session, account and class checks already passed. A failed data read
  // keeps the verified workspace; the owner guard still excludes mismatched work.
  if(loggedIn&&![401,403].includes(error.status)){notice='Chưa tải đủ tiến độ: '+error.message+'. Nhấn Cập nhật để thử lại.';draw();return;}
  loggedIn=false;teacherAuth=error.status===401?'signedOut':'failed';notice=error.status===401?'':authMessage(error);draw();
 }
}
async function boot(){
 if(!TASK||!TASK.previewAvailable)throw Error('Đề này chưa có trong khóa Speaking Writing chuyên sâu. Hãy chọn bài từ chỉ mục tám buổi Writing Task 2.');
 document.title=TASK.shortTitle+' · '+(teacher?'Giảng viên':'Học viên')+' · SW';
 await api('sw/status');classes=(await api('activities/'+ACTIVITY+'/roster')).classes;
 classes.sort((a,b)=>b.className.localeCompare(a.className));
 const query=entry.get('class')?.trim();if(query&&!teacher){requestedClass=classes.find(c=>[c.classRef,c.className].some(v=>v.toLowerCase()===query.toLowerCase()));if(!requestedClass)throw Error('Không tìm thấy lớp trong đường link này. Chưa mở bài.');if(!teacher)classes=[requestedClass];}
 indexPeople();if(!teacher&&entry.has('student')&&!PEOPLE.some(p=>p.id===entry.get('student')&&(!requestedClass||p.classRef===requestedClass.classRef)))throw Error('Học viên trong link không thuộc lớp đã chọn. Chưa mở bài.');
 if(teacher){await restoreTeacher();}
 else{let remembered;try{remembered=JSON.parse(localStorage.getItem(namespace+'identity')||'null');if(!remembered&&ACTIVITY==='writing-task2-public-health-ban')remembered=JSON.parse(localStorage.getItem('izone:shops-writing:production:identity')||'null');}catch{}
  const p=PEOPLE.find(p=>p.id===remembered?.id&&p.classRef===remembered?.classRef&&(!entry.has('student')||p.id===entry.get('student')));if(p&&(!p.requiresAccessCode||remembered.sessionRef))await openPerson(p,undefined,remembered.sessionRef);else{draw();fillPeople();}}
}
async function setupTeacher(){
 const epoch=generation,access=await api('admin/me');if(epoch!==generation)return;
 classes=(await api('admin/activities/'+ACTIVITY+'/roster')).classes;
 const queryClass=entry.get('class')?.trim();requestedClass=queryClass?classes.find(c=>[c.classRef,c.className].some(v=>v.toLowerCase()===queryClass.toLowerCase())):null;
 if(queryClass&&!requestedClass)throw Error('Không tìm thấy lớp có quyền trong đường link.');
 indexPeople();
 if(access.reviewer.role!=='admin'){const allowed=new Set(access.classes.map(c=>c.classCode));PEOPLE.splice(0,PEOPLE.length,...PEOPLE.filter(p=>allowed.has(p.classCode)));}
 if(!PEOPLE.length)throw Error('Tài khoản giảng viên chưa có lớp được phân công.');
 let selected=entry.has('student')?PEOPLE.find(p=>p.id===entry.get('student')):requestedClass?PEOPLE.find(p=>p.classRef===requestedClass.classRef):PEOPLE[0];
 let linked;
 if(entry.has('session')){linked=(await api('admin/lesson9/sessions/'+encodeURIComponent(entry.get('session')))).session;if(linked.activitySlug!==ACTIVITY||requestedClass&&linked.classRef!==requestedClass.classRef)throw Error('Bài trong link không thuộc đúng đề/lớp.');selected=PEOPLE.find(p=>p.id===linked.studentRef&&p.classRef===linked.classRef);}
 if(epoch!==generation)return;if(!selected)throw Error('Tài khoản chưa có quyền lớp hoặc học viên trong đường link.');
 loggedIn=true;notice='';person=selected;await loadTeacher();if(epoch!==generation)return;
 if(linked||entry.has('student')){const row=rows.find(r=>r.id===person.id);current=linked||(row?.sessionRef?(await api('admin/lesson9/sessions/'+row.sessionRef)).session:null);responses=current?working(current):{};threads=current?(await api('admin/live/sessions/'+current.sessionRef+'/teacher-comments')).threads:[];detailOpen=true;draw();}
 startPoll();
}
function invalidateTeacher(text){teacherAuth='signedOut';if(composer&&person)composers.set(person.id,composer);loggedIn=false;detailOpen=false;current=null;threads=[];generation++;clearTimeout(pollTimer);draw();message(text);}
window.addEventListener('storage',event=>{if(teacher&&['izone:teacher-sso-logout'].includes(event.key))invalidateTeacher('Phiên đã đăng xuất ở tab khác. Lời đang soạn được giữ.');});
boot().catch(error=>{root.innerHTML=top()+banner()+'<main><h1>Chưa mở được handout</h1><p role="alert">'+esc(error.message)+'</p><button data-action="reload">Thử lại</button></main>';});
