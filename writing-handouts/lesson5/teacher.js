import {ORDER,FIELDS} from '../lesson5-demo/core.mjs';
import {renderActivityList,renderActivityDetail} from './activity-ui.mjs?v=20261006-2';
import {savedContent,threadsView,approvalLabel,selectionOffsets,fieldHash,installStyles} from '../lesson5-thu/features.mjs?v=20261006-2';
installStyles();
// Nhận cookie giảng viên riêng, đọc tiến độ/bài và ghi góp ý vào đúng phiên/phần.
// Không lưu credential Google trong localStorage. Lỗi giữ lời góp ý để thử lại.
const base='https://ducizone.ddns.net/api/handout67/v1/teacher';
const $=id=>document.getElementById(id);
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={topic:'Topic sentence và idea',b1:'Điểm B · Ý 1',a1:'Điểm A · Ý 1',x1:'Cầu nối X · Ý 1',b2:'Điểm B · Ý 2',a2:'Điểm A · Ý 2',x2:'Cầu nối X · Ý 2',idea1:'Idea 1',idea2:'Idea 2',topicSentence:'Topic sentence'};
const statuses={draft:'Chưa check',passed:'Đạt',revision:'Cần sửa',pending:'Đang chấm',technical_error:'Gặp lỗi'};
let epoch=0,rows=[],selected=null,timer=null,loading=false,sending=false,detailSequence=0,detailVersion=null,authBusy=false,actorEmail='';
let activitySequence=0,activityRef=null,activityEvents=[],activityCursor=null;
let detailSession=null,composer=null,activeClass='';
const hasThreadDraft=()=>!!composer||!!$('comment-text').value.trim()||[...document.querySelectorAll('[data-thread-reply] textarea')].some(el=>el.value.trim());
async function request(path,method='GET',body){
 const payload=body===undefined?undefined:JSON.stringify(body);
 const requestEpoch=epoch;
 let response,value;
 for(let i=0;i<2;i++){
  if(requestEpoch!==epoch)throw Object.assign(new Error('IDENTITY_CHANGED'),{status:401});
  try{response=await fetch(base+path,{method,credentials:'include',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json',...(method==='GET'?{}:{'X-Handout67-CSRF':'1'})},...(payload===undefined?{}:{body:payload})});value=await response.json();break;}catch(e){if(i===1)throw e;}
 }
 if(requestEpoch!==epoch)throw Object.assign(new Error('IDENTITY_CHANGED'),{status:401});
 if(!response.ok||value.ok!==true)throw Object.assign(new Error(value.error||'TECHNICAL_FAILURE'),{status:response.status});return value;
}
function errorText(error){return error.status===409?'Học viên vừa sửa bài. Nhấn Cập nhật để đọc bài mới rồi gửi lại góp ý; lời góp ý đang nhập được giữ.':error.status===401?'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.':error.status===403?'Tài khoản của bạn chưa có quyền xem lớp hoặc thao tác này.':'Chưa tải được dữ liệu. Hãy thử lại khi kết nối ổn định.';}
function report(error,target='error'){const node=$(target);node.textContent=errorText(error);node.hidden=false;}
function rowStatus(row){const s=Object.values(row.steps);return !row.sessionRef?'not_started':row.passed===7?'complete':s.includes('technical_error')?'technical_error':s.includes('pending')?'pending':s.includes('revision')?'revision':'working';}
function renderRows(){
 const q=$('search').value.trim().toLocaleLowerCase('vi'),filter=$('status-filter').value;
 const filtered=rows.filter(r=>r.displayName.toLocaleLowerCase('vi').includes(q)&&(filter==='all'||rowStatus(r)===filter));
 $('students').innerHTML=filtered.map(r=>`<tr><td><button type="button" data-student="${escape(r.studentRef)}">${escape(r.displayName)}</button><small>${r.sessionRef?'Đã mở bài':'Chưa bắt đầu'}</small></td><td>${r.passed}/7</td>${ORDER.map(k=>`<td><span class="step-status ${escape(r.steps[k]||'draft')}">${r.steps[k]?statuses[r.steps[k]]:'—'}</span></td>`).join('')}<td>${r.comments}</td></tr>`).join('')||'<tr><td colspan="10" class="empty">Không có học viên phù hợp.</td></tr>';
 $('summary').textContent=`${rows.length} học viên · ${rows.filter(r=>!r.sessionRef).length} chưa bắt đầu · ${rows.filter(r=>r.passed===7).length} đã xong · ${rows.filter(r=>rowStatus(r)==='revision').length} cần sửa`;
}
async function refresh(forceDetail=false){
 if(loading||document.hidden)return;loading=true;const current=epoch,classRef=$('class-select').value;
 try{const value=await request('/students?class='+encodeURIComponent(classRef));if(current!==epoch||classRef!==$('class-select').value)return;rows=value.students;renderRows();$('updated').textContent='Đã cập nhật '+new Date().toLocaleTimeString('vi-VN');$('error').hidden=true;if(selected?.ref&&!sending&&!hasThreadDraft()&&(forceDetail||!$('comment-text').value.trim()))await readDetail(selected.ref);}catch(e){if(current===epoch)report(e);}finally{loading=false;}
}
function snapshot(note){return Object.entries(note.snapshot||{}).map(([k,v])=>(labels[k]||k)+': '+v).join('\n\n');}
function renderDetail(session){
 const drafts=new Map([...document.querySelectorAll('[data-thread-reply]')].map(f=>[f.dataset.threadReply,f.elements.body.value]));
 detailSession=session;composer=null;
 detailVersion=session.version;
 $('comment-form').hidden=false;if(!sending)$('comment-submit').disabled=false;
 $('detail-content').innerHTML=ORDER.map(key=>{
  const s=session.steps[key];
  const fields=FIELDS[key].map(f=>`<b>${labels[f]||labels[key]}</b>${savedContent(session,f,{teacher:true})}`).join('');
  const ai=[...s.history].reverse().map((h,i)=>`<details class="detail-comments" ${i===0?'open':''}><summary>AI · Comment lần ${h.number} · ${statuses[h.status]}</summary><p>${escape(h.feedback)}</p><details><summary>Nội dung đã gửi</summary><pre>${escape(snapshot(h))}</pre></details></details>`).join('');
  const teacher=(session.teacherComments||[]).filter(c=>c.section===key).reverse().map(c=>`<details class="detail-comments teacher-note" open><summary>Giảng viên · ${escape(c.authorName)}</summary><p>${escape(c.feedback)}</p><details><summary>Nội dung lúc góp ý</summary><pre>${escape(snapshot(c))}</pre></details></details>`).join('');
  return `<section class="detail-step"><header><h3>${labels[key]}</h3><span class="step-status ${escape(s.status)}">${statuses[s.status]}</span></header>${approvalLabel(s)?`<p class="approval-note">${approvalLabel(s)}</p>`:''}${s.editedAfterApproval?'<p class="edited-note">HV đã chỉnh nội dung sau khi thông qua.</p>':''}${fields}${threadsView((session.commentThreads||[]).filter(t=>t.section===key),{teacher:true})}${teacher}${ai}${s.status==='technical_error'?'<p class="error">Chấm gặp lỗi kỹ thuật. Học viên có thể gửi Check lại; nội dung đã lưu được giữ.</p>':''}</section>`;
 }).join('')+Object.entries(session.vocabulary||{}).map(([idea,v])=>`<div class="vocab-read"><h3>Từ vựng · Ý ${escape(idea)}</h3>${v.status==='ready'?Object.entries(v.groups).map(([k,list])=>`<p><b>${k}</b> · ${list.map(x=>escape(x.phrase)+' — '+escape(x.meaningVi)).join('; ')}</p>`).join(''):`<p>${v.status==='failed'?'Gợi ý gặp lỗi, học viên có thể thử lại.':'Đang chuẩn bị gợi ý.'}</p>`}</div>`).join('')+'<section class="activity-panel"><h3>Nhật ký hoạt động · Giữ hai tháng</h3><p class="fine-print">Gồm sự kiện, nội dung gửi chấm và phản hồi AI. Các lượt trước khi bật tính năng có thể chưa đủ nhật ký.</p><p id="activity-state" role="status">Đang tải nhật ký…</p><div id="activity-list"></div><div id="activity-job"></div></section>';
 for(const f of document.querySelectorAll('[data-thread-reply]'))if(drafts.has(f.dataset.threadReply))f.elements.body.value=drafts.get(f.dataset.threadReply);
}
async function readDetail(ref){
 const current=epoch,sequence=++detailSequence;
 const value=await request('/sessions/'+ref);
 if(current===epoch&&selected?.ref===ref&&sequence===detailSequence&&!hasThreadDraft()){
  renderDetail(value.session);
  await readActivity(ref);
 }
}
async function readActivity(ref,{more=false,job=null}={}){
 const current=epoch,sequence=++activitySequence;
 const before=more?activityCursor:null;
 $('activity-state').textContent='Đang tải nhật ký…';
 try{
  const query=new URLSearchParams({limit:'50'});if(before)query.set('before',before);if(job)query.set('job',job);
  const value=await request('/sessions/'+encodeURIComponent(ref)+'/activity?'+query);
  if(current!==epoch||selected?.ref!==ref||sequence!==activitySequence)return;
  if(job)$('activity-job').innerHTML=renderActivityDetail(value.detail);
  else{
   activityEvents=more&&activityRef===ref?[...activityEvents,...value.events]:value.events;activityRef=ref;activityCursor=value.nextCursor;
   $('activity-list').innerHTML=renderActivityList(activityEvents,activityCursor);$('activity-job').innerHTML='';
  }
  $('activity-state').textContent='Nhật ký của đúng phiên đang xem · Giờ Việt Nam';
 }catch(e){if(current===epoch&&selected?.ref===ref&&sequence===activitySequence)$('activity-state').textContent=errorText(e)+' Nhật ký chưa được tải; dữ liệu bài làm vẫn giữ.';}
}
async function openDetail(studentRef){
 if(sending)return;
 const row=rows.find(r=>r.studentRef===studentRef);if(!row)return;
 // Hủy lượt đọc nhật ký trước khi thay DOM, kể cả khi mở lại cùng một bài.
 if(hasThreadDraft()&&!window.confirm('Có lời góp ý chưa gửi. Bỏ bản nháp này để mở bài khác?'))return;
 composer=null;detailSession=null;
 const current=epoch;detailVersion=null;detailSequence++;activitySequence++;selected={studentRef,ref:row.sessionRef};$('detail').hidden=false;$('detail-name').textContent=row.displayName;$('detail-content').textContent=row.sessionRef?'Đang tải bài…':'Học viên chưa bắt đầu bài làm.';$('comment-form').hidden=true;$('comment-submit').disabled=true;$('comment-text').value='';$('comment-status').textContent='';
 if(row.sessionRef){try{await readDetail(row.sessionRef);}catch(e){if(current===epoch&&selected?.ref===row.sessionRef)report(e);}}
 $('detail').scrollIntoView({behavior:'smooth',block:'start'});
}
async function enter(){
 const current=++epoch;
 const result=await request('/classes');if(current!==epoch)return;
 $('class-select').innerHTML=result.classes.map(c=>`<option value="${escape(c.classRef)}">${escape(c.className)}</option>`).join('');
 activeClass=$('class-select').value;
 if(!result.classes.length)throw Object.assign(new Error('TEACHER_FORBIDDEN'),{status:403});
 $('login').hidden=true;$('dashboard').hidden=false;await refresh();if(current!==epoch)return;clearInterval(timer);timer=setInterval(refresh,15000);
}
async function login(response){if(authBusy)return;authBusy=true;try{const result=await request('/session','POST',{credential:response.credential});actorEmail=result.reviewer.email;await enter();$('login-error').hidden=true;}catch(e){report(e,'login-error');}finally{authBusy=false;}}
$('refresh').addEventListener('click',()=>refresh(true));$('search').addEventListener('input',renderRows);$('status-filter').addEventListener('change',renderRows);
$('class-select').addEventListener('change',()=>{
 if(sending||hasThreadDraft()&&!window.confirm('Có lời góp ý chưa gửi. Bỏ bản nháp này để chuyển lớp?')){$('class-select').value=activeClass;return;}
 activeClass=$('class-select').value;epoch++;selected=null;composer=null;detailSession=null;detailVersion=null;$('comment-text').value='';$('detail-content').innerHTML='';$('detail').hidden=true;void refresh();
});
$('students').addEventListener('click',event=>{const b=event.target.closest('[data-student]');if(b)void openDetail(b.dataset.student);});
$('close-detail').addEventListener('click',()=>{if(sending)return;if(hasThreadDraft()&&!window.confirm('Bỏ lời góp ý chưa gửi và đóng bài?'))return;selected=null;detailSession=null;composer=null;detailVersion=null;detailSequence++;$('detail-content').innerHTML='';$('detail').hidden=true;});
$('detail').addEventListener('click',event=>{
 const marked=event.target.closest('[data-threads]');if(marked){showThreads(marked.dataset.threads);return;}
 const button=event.target.closest('button');if(!button||!selected?.ref)return;
 if(button.dataset.commentField){void startComposer(button.closest('.saved-field').querySelector('[data-select-field]'));return;}
 if(button.dataset.threadStatus){void sendStatus(button);return;}
 if(button.dataset.logJob)void readActivity(selected.ref,{job:button.dataset.logJob});
 else if(button.dataset.logMore&&activityCursor)void readActivity(selected.ref,{more:true});
});
function showThreads(refs){
 for(const ref of refs.split(','))$('thread-'+ref)?.classList.add('highlight-thread');
 const node=$('thread-'+refs.split(',')[0]);node?.scrollIntoView({block:'center'});node?.querySelector('textarea')?.focus({preventScroll:true});
}
async function startComposer(root,range){
 if(!root||!detailSession||sending||composer)return;
 const field=root.dataset.selectField,text=detailSession.responses[field],ref=selected?.ref,current=epoch;
 if(!text?.trim())return;
 const hash=await fieldHash(text);if(current!==epoch||selected?.ref!==ref||!root.isConnected||composer)return;
 const form=document.createElement('form');form.className='comment-composer';form.dataset.commentCreate='1';
 form.innerHTML=`<strong>Comment · ${escape(labels[field]||field)}</strong>${range?`<blockquote>${escape(text.slice(range.start,range.end))}</blockquote>`:'<p>Nhận xét cả phần nội dung này.</p>'}<label>Lời góp ý<textarea name="body" required maxlength="5000" placeholder="Nhập nhận xét cho học viên…"></textarea></label><button class="primary" type="submit">Gửi comment</button><button class="secondary" type="button" data-cancel-comment>Hủy</button><p class="thread-status" role="status"></p>`;
 composer={form,field,fieldHash:hash,range,ref,epoch:current};root.closest('.saved-field').append(form);form.elements.body.focus();
 form.querySelector('[data-cancel-comment]').addEventListener('click',()=>{if(sending)return;form.remove();composer=null;root.focus();});
}
for(const eventName of ['mouseup','keyup'])$('detail-content').addEventListener(eventName,event=>{
 const root=event.target.closest('[data-select-field]');if(!root)return;
 const range=selectionOffsets(root,window.getSelection());if(range)void startComposer(root,range);
});
$('detail-content').addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)&&event.target.dataset.threads){event.preventDefault();showThreads(event.target.dataset.threads);}});
async function sendStatus(button){
 if(sending||composer||!selected?.ref)return;const ref=selected.ref,current=epoch;
 sending=true;button.disabled=true;detailSequence++;
 try{const value=await request('/sessions/'+ref+'/threads','POST',{action:'status',threadRef:button.dataset.threadStatus,status:button.dataset.status,requestId:crypto.randomUUID(),expectedActor:actorEmail});if(current===epoch&&selected?.ref===ref)renderDetail(value.session);}
 catch(e){if(current===epoch)report(e);}
 finally{sending=false;button.disabled=false;}
}
$('detail-content').addEventListener('submit',async event=>{
 const form=event.target.closest('[data-thread-reply],[data-comment-create]');if(!form)return;event.preventDefault();
 if(sending||!selected?.ref)return;const body=form.elements.body.value.trim();if(!body)return;
 const creation=!!form.dataset.commentCreate,c=creation?composer:null,ref=selected.ref,current=epoch;
 if(creation&&(!c||c.ref!==ref||c.epoch!==current))return;
 if(form.dataset.requestBody!==body){form.dataset.requestBody=body;form.dataset.requestId=crypto.randomUUID();}
 const input={action:creation?'create':'reply',body,requestId:form.dataset.requestId,expectedActor:actorEmail,...(creation?{field:c.field,fieldHash:c.fieldHash,...(c.range?{range:c.range}:{})}:{threadRef:form.dataset.threadReply})};
 const button=form.querySelector('button[type="submit"]'),status=form.querySelector('.thread-status');sending=true;detailSequence++;button.disabled=true;status.textContent='Đang gửi…';
 try{
  const value=await request('/sessions/'+ref+'/threads','POST',input);
  if(current!==epoch||selected?.ref!==ref)return;
  form.elements.body.value='';composer=null;renderDetail(value.session);await readActivity(ref);$('comment-status').textContent='Đã lưu trao đổi; học viên đọc được trên bài của mình.';
 }catch(e){if(current===epoch&&selected?.ref===ref)status.textContent=e.message==='COMMENT_CONTENT_CHANGED'?'Nội dung trích đã thay đổi. Lời góp ý vẫn giữ; sao chép rồi hủy, cập nhật bài và chọn lại đoạn.':errorText(e);}
 finally{sending=false;button.disabled=false;}
});
$('logout').addEventListener('click',async()=>{if(authBusy)return;if(hasThreadDraft()&&!window.confirm('Bỏ lời trao đổi chưa gửi và đăng xuất?'))return;authBusy=true;epoch++;clearInterval(timer);selected=null;composer=null;detailSession=null;actorEmail='';rows=[];$('detail-content').innerHTML='';$('detail').hidden=true;$('dashboard').hidden=true;$('login').hidden=true;$('students').innerHTML='';$('comment-text').value='';try{await request('/session','DELETE');}catch(e){report(e,'login-error');}finally{authBusy=false;$('login').hidden=false;}window.google?.accounts.id.disableAutoSelect();});
$('comment-form').addEventListener('submit',async event=>{
 event.preventDefault();if(sending||!selected?.ref||!Number.isSafeInteger(detailVersion))return;
 const ref=selected.ref,current=epoch,feedback=$('comment-text').value.trim(),section=$('comment-section').value;if(!feedback)return;
 sending=true;detailSequence++;$('comment-submit').disabled=true;$('comment-status').textContent='Đang gửi góp ý…';
 try{const value=await request('/sessions/'+ref+'/comments','POST',{section,feedback,expectedActor:actorEmail,expectedVersion:detailVersion,requestId:crypto.randomUUID()});if(current!==epoch||selected?.ref!==ref)return;detailSequence++;renderDetail(value.session);if($('comment-text').value.trim()===feedback)$('comment-text').value='';$('comment-status').textContent='Đã lưu góp ý; học viên sẽ thấy ở đúng phần bài.';await readActivity(ref);await refresh();}catch(e){if(current===epoch&&selected?.ref===ref)$('comment-status').textContent=errorText(e);}finally{sending=false;$('comment-submit').disabled=false;}
});
async function boot(){
 try{const result=await request('/session');actorEmail=result.reviewer.email;await enter();}catch(e){if(e.status!==401)report(e,'login-error');}
 try{const {clientId}=await request('/config');let attempts=0;const setup=()=>{if(window.google?.accounts?.id){window.google.accounts.id.initialize({client_id:clientId,callback:login,auto_select:false});window.google.accounts.id.renderButton($('google-signin'),{theme:'outline',size:'large',text:'signin_with',locale:'vi'});}else if(attempts++<100)setTimeout(setup,100);else $('login-error').textContent='Chưa tải được nút Google. Hãy tải lại trang.';};setup();}catch(e){report(e,'login-error');}
}
void boot();
