import {card,ordered,rowState,states,patchHTML,patchThreads,names,approval,stepLabel,jobText,stamp} from './teacher-dashboard.mjs?v=20261007-1';
import {ORDER,FIELDS} from '../lesson5-demo/core.mjs';
import {renderActivityList,renderActivityDetail} from './activity-ui.mjs?v=20261007-1';
import {savedContent,threadsView,selectionOffsets,fieldHash,installStyles} from '../lesson5-thu/features.mjs?v=20261007-1';
installStyles();
// Nhận cookie giảng viên riêng, đọc tiến độ/bài và ghi góp ý vào đúng phiên/phần.
// Không lưu credential Google trong localStorage. Lỗi giữ lời góp ý để thử lại.
const base='https://ducizone.ddns.net/api/handout67/v1/teacher';
const $=id=>document.getElementById(id);
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={topic:'Topic sentence và idea',b1:'Điểm B · Ý 1',a1:'Điểm A · Ý 1',x1:'Cầu nối X · Ý 1',b2:'Điểm B · Ý 2',a2:'Điểm A · Ý 2',x2:'Cầu nối X · Ý 2',idea1:'Idea 1',idea2:'Idea 2',topicSentence:'Topic sentence'};
const statuses={draft:'Chưa check',passed:'Đã đạt',revision:'Cần sửa',pending:'Đang chấm',technical_error:'Gặp lỗi'};
let epoch=0,rows=[],selected=null,timer=null,loading=false,sending=false,detailSequence=0,detailVersion=null,authBusy=false,actorEmail='';
let activitySequence=0,activityRef=null,activityEvents=[],activityCursor=null;
let detailSession=null,composer=null,activeClass='';
let readGeneration=0;
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
function errorText(error){return error.message==='COMMENT_VERSION_CONFLICT'?'Trao đổi vừa thay đổi. Kiểm tra trạng thái mới trước khi xác nhận lại; lời trả lời đang nhập được giữ.':error.status===409?'Học viên vừa sửa bài. Nhấn Cập nhật để đọc bài mới rồi gửi lại góp ý; lời góp ý đang nhập được giữ.':error.status===401?'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.':error.status===403?'Tài khoản của bạn chưa có quyền xem lớp hoặc thao tác này.':'Chưa tải được dữ liệu. Hãy thử lại khi kết nối ổn định.';}
function report(error,target='error'){const node=$(target);node.textContent=errorText(error);node.hidden=false;}
function renderRows(){
 const q=$('search').value.trim().toLocaleLowerCase('vi'),filter=$('status-filter').value;
 const filtered=ordered(rows.filter(r=>r.displayName.toLocaleLowerCase('vi').includes(q)&&(filter==='all'||rowState(r)===filter)),$('order').value);
 $('summary').innerHTML=Object.entries(states).map(([key,label])=>`<button class="teacher-summary-card" data-filter="${key}" data-state="${key}" aria-pressed="${filter===key}"><span>${label}</span><strong>${rows.filter(r=>rowState(r)===key).length}</strong></button>`).join('');
 const focused=document.activeElement?.dataset.student;
 const groups=new Map();for(const r of filtered){const key=r.sessionRef?r.dashboard?.priority??3:5;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
 $('students').innerHTML=[...groups].map(([key,list])=>`<section class="group"><div class="group-heading"><h2>${['Cần hỗ trợ','Lỗi hoặc chờ quá hạn','Bài đã sửa và HV trả lời','Đang làm bài','Đã thông qua','Chưa bắt đầu'][key]} <span class="group-count">${list.length}</span></h2></div><div class="teacher-students">${list.map(card).join('')}</div></section>`).join('')||'<p class="empty">Không có học viên phù hợp.</p>';
 if(focused)$('students').querySelector(`[data-student="${CSS.escape(focused)}"]`)?.focus({preventScroll:true});
 $('list-description').textContent=`${filtered.length}/${rows.length} học viên · hỗ trợ và bài đáng chú ý lên trước`;
}
function schedule(){clearTimeout(timer);if(!$('dashboard').hidden&&!document.hidden)timer=setTimeout(()=>refresh(),5000);}
async function refresh(forceDetail=false){
 if(loading||document.hidden||$('dashboard').hidden)return;clearTimeout(timer);loading=true;const generation=++readGeneration,current=epoch,classRef=$('class-select').value;
 try{const value=await request('/students?class='+encodeURIComponent(classRef));if(current!==epoch||classRef!==$('class-select').value)return;rows=value.students;renderRows();$('updated').textContent='Đã cập nhật '+new Date().toLocaleTimeString('vi-VN')+' · đọc lại sau 5 giây';$('error').hidden=true;if(selected?.ref&&!sending)await readDetail(selected.ref,{activity:forceDetail});}catch(e){if(current===epoch)report(e);}finally{if(generation===readGeneration){loading=false;if(current===epoch)schedule();}}
}
function snapshot(note){return Object.entries(note.snapshot||{}).map(([k,v])=>(labels[k]||k)+': '+v).join('\n\n');}
function renderDetail(session){
 detailSession=session;detailVersion=session.version;
 $('comment-form').hidden=false;if(!sending)$('comment-submit').disabled=false;
 const content=$('detail-content');
 if(content.dataset.session!==session.ref){
  content.dataset.session=session.ref;
  const field=f=>`<div class="teacher-response-field" data-field-box="${f}"><strong>${names[f]}</strong><span data-current-status="${f}" class="step-status"></span><div data-field-read="${f}"></div><div data-keywords="${f}"></div></div>`;
  content.innerHTML=`<section class="recap"><h3>Bài hiện tại · A → X → B</h3><p class="fine-print">Thứ tự Check vẫn B → A → X. Bôi đen để góp ý đoạn hoặc chọn Comment cả phần.</p>${['idea1','idea2','topicSentence'].map(field).join('')}<div class="recap-scroll"><table class="recap-table"><thead><tr><th>Ý</th><th>Điểm đầu A</th><th>Cầu nối X</th><th>Điểm cuối B</th></tr></thead><tbody>${[1,2].map(n=>`<tr><th>Ý ${n}</th>${['a','x','b'].map(k=>`<td>${field(k+n)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><div id="recap-status"></div></section><div class="teacher-detail-section-layout"><section><h3>Các phần làm bài</h3>${ORDER.map(k=>`<details class="teacher-detail-section expandable" data-history="section-${k}"><summary><span class="section-title">${labels[k]}</span><span data-section-status="${k}" class="step-status"></span><span class="expand-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12h14"/><path class="vertical" d="M12 5v14"/></svg></span></summary><div class="teacher-section-body"><div data-step-read="${k}"></div><div data-history-read="${k}"></div><div data-legacy-read="${k}"></div></div></details>`).join('')}<section class="teacher-detail-vocabulary"><h3>Từ vựng từng ý</h3><div id="vocabulary-read"></div></section><details class="activity-panel"><summary>Nhật ký hoạt động · Giữ hai tháng</summary><p class="fine-print">Lượt trước khi bật tính năng có thể thiếu nhật ký. Mở lượt chấm để xem nội dung và phản hồi AI.</p><p id="activity-state" role="status">Đang tải nhật ký…</p><div id="activity-list"></div><div id="activity-job"></div></details></section><aside class="teacher-note"><h3>Trao đổi GV–HV</h3><p class="fine-print">Đã xử lý chỉ đổi trạng thái trao đổi; không cho qua Check.</p><div id="threads-read"></div></aside></div>`;
 }
 const d=session.dashboard;
 $('detail-meta').textContent=d?`${d.filled}/9 ô · ${d.passed}/7 phần thông qua · ${d.checks} Check · ${d.openThreads} trao đổi mở`:'';
 for(const f of Object.keys(session.responses)){
  // Comment đang soạn giữ hash/range gốc; bài mới vẫn cập nhật tiến độ và các vùng khác.
  const node=content.querySelector(`[data-field-read="${f}"]`);
  if(composer?.field!==f)patchHTML(node,savedContent(session,f,{teacher:true}));
  else if(composer.fieldHash){const note=composer.form.querySelector('.thread-status');if(node.dataset.currentText!==undefined&&node.dataset.currentText!==session.responses[f])note.textContent='HV vừa sửa phần này. Bản nháp/đoạn chọn được giữ trên bản trước; chọn lại đoạn trước khi gửi nếu nội dung đã đổi.';}
  if(node)node.dataset.currentText=session.responses[f];
  const k=ORDER.find(k=>FIELDS[k].includes(f)),status=session.steps[k]?.status||'draft';
  const pill=content.querySelector(`[data-current-status="${f}"]`);
  if(pill){pill.className='step-status '+status;pill.textContent=statuses[status];}
  if(node?.closest('td')){node.closest('td').dataset.status=status;node.closest('td').dataset.cell=f;}
 }
 patchHTML($('recap-status'),`<p class="fine-print">${d?.passed===7?'7/7 phần đã thông qua.':'Tiến độ theo các phần Check.'} ${d?.attested?d.attested+' phần do HV xác nhận được GV đồng ý.':''}</p>`);
 for(const key of ORDER){
  const step=session.steps[key],job=session.processing?.[key];
  const pill=content.querySelector(`[data-section-status="${key}"]`);pill.className='step-status '+step.status;pill.textContent=stepLabel(d?.stepStates[key]||step);
  patchHTML(content.querySelector(`[data-step-read="${key}"]`),`<span class="step-status ${step.status}">${stepLabel(d?.stepStates[key]||step)}</span>${approval(step)?`<p class="approval-note">${escape(approval(step))}${step.approval?.at?" · "+stamp(step.approval.at):""}</p>`:''}${step.editedAfterApproval?`<p class="attention-line">Đã sửa sau khi thông qua · ${stamp(step.editedAt)}. Tiến độ giữ nguyên; nhận xét cũ chưa đánh giá nội dung mới.</p>`:''}${job?`<p class="job-line">${escape(jobText(key,job))}</p>`:''}`);
  patchHTML(content.querySelector(`[data-history-read="${key}"]`),[...step.history].reverse().map(h=>`<details class="detail-comments expandable" data-history="${escape(h.jobRef||h.number)}"><summary><span class="section-title">Lần ${h.number} · ${statuses[h.status]}${FIELDS[key].some(f=>(h.snapshot?.[f]||'')!==(session.responses[f]||''))?' · Nhận xét bản trước':''}</span><span class="expand-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12h14"/><path class="vertical" d="M12 5v14"/></svg></span></summary><div class="attempt-content"><h5>Nội dung đã gửi</h5><pre>${escape(snapshot(h))}</pre><h5>Nhận xét AI</h5><p>${escape(h.feedback)}</p></div></details>`).join('')||'<p class="fine-print">Chưa có nhận xét AI.</p>');
  patchHTML(content.querySelector(`[data-legacy-read="${key}"]`),(session.teacherComments||[]).filter(c=>c.section===key).reverse().map(c=>`<details class="detail-comments expandable"><summary><span class="section-title">Giảng viên · ${escape(c.authorName)}</span><span class="expand-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12h14"/><path class="vertical" d="M12 5v14"/></svg></span></summary><div class="attempt-content"><h5>Nội dung lúc góp ý</h5><pre>${escape(snapshot(c))}</pre><h5>Nhận xét</h5><p>${escape(c.feedback)}</p></div></details>`).join(''));
 }
 patchThreads($('threads-read'),(session.commentThreads||[]).map(t=>threadsView([t],{teacher:true}).replace('Trao đổi với giảng viên','Trao đổi · '+escape(names[t.field]||t.field))).join('')||'<p class="empty">Chưa có trao đổi.</p>');
 patchHTML($('vocabulary-read'),[1,2].map(n=>{const v=session.vocabulary[n],status=v?.status==='ready'?'Đã có, khớp bản hiện tại':v?.status==='failed'?'Gặp lỗi; tiến độ vẫn giữ':v?'Đang tạo lại gợi ý':'Chưa mở — chờ B/A/X thông qua';return `<p><strong>Ý ${n}:</strong> ${status}${session.processing?.['vocab'+n]?'<br>'+escape(jobText('vocab'+n,session.processing['vocab'+n])):''}</p>`;}).join(''));
 for(const n of [1,2])for(const k of ['a','x','b']){const v=session.vocabulary[n];patchHTML(content.querySelector(`[data-keywords="${k+n}"]`),v?.status==='ready'?`<div class="vocab">${(v.groups?.[k.toUpperCase()]||[]).map(w=>`<span>${escape(w.phrase)} · ${escape(w.meaningVi)}</span>`).join('')}</div>`:'');}
}
async function readDetail(ref,{activity=false}={}){
 const current=epoch,sequence=++detailSequence;
 const value=await request('/sessions/'+ref);
 if(current===epoch&&selected?.ref===ref&&sequence===detailSequence){
  const initial=$('detail-content').dataset.session!==ref;
  renderDetail(value.session);
  if(initial||activity)await readActivity(ref);
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
 if($('detail-content').dataset.session===row.sessionRef&&detailSession){selected={studentRef,ref:row.sessionRef};$('detail').hidden=false;if(!$('detail').open)$('detail').showModal();void readDetail(row.sessionRef,{activity:true}).catch(e=>report(e));return;}
 if(hasThreadDraft()&&!window.confirm('Có lời góp ý chưa gửi. Bỏ bản nháp này để mở bài khác?'))return;
 composer=null;detailSession=null;
 const current=epoch;detailVersion=null;detailSequence++;activitySequence++;selected={studentRef,ref:row.sessionRef};$('detail').hidden=false;if(!$('detail').open)$('detail').showModal();$('detail-name').textContent=row.displayName;delete $('detail-content').dataset.session;$('detail-content').textContent=row.sessionRef?'Đang tải bài…':'Học viên chưa bắt đầu bài làm.';$('comment-form').hidden=true;$('comment-submit').disabled=true;$('comment-text').value='';$('comment-status').textContent='';
 if(row.sessionRef){try{await readDetail(row.sessionRef);}catch(e){if(current===epoch&&selected?.ref===row.sessionRef)report(e);}}
 $('detail').scrollTop=0;
}
async function enter(){
 const current=++epoch;
 const result=await request('/classes');if(current!==epoch)return;
 $('class-select').innerHTML=result.classes.map(c=>`<option value="${escape(c.classRef)}">${escape(c.className)}</option>`).join('');
 activeClass=$('class-select').value;
 if(!result.classes.length)throw Object.assign(new Error('TEACHER_FORBIDDEN'),{status:403});
 $('login').hidden=true;$('dashboard').hidden=false;await refresh();if(current!==epoch)return;schedule();
}
async function login(response){if(authBusy)return;authBusy=true;try{const result=await request('/session','POST',{credential:response.credential});actorEmail=result.reviewer.email;await enter();$('login-error').hidden=true;}catch(e){report(e,'login-error');}finally{authBusy=false;}}
$('refresh').addEventListener('click',()=>refresh(true));$('search').addEventListener('input',renderRows);$('status-filter').addEventListener('change',renderRows);$('order').addEventListener('change',renderRows);$('summary').addEventListener('click',event=>{const b=event.target.closest('[data-filter]');if(b){$('status-filter').value=$('status-filter').value===b.dataset.filter?'all':b.dataset.filter;renderRows();}});
$('detail-refresh').addEventListener('click',()=>refresh(true));
$('class-select').addEventListener('change',()=>{
 if(sending||hasThreadDraft()&&!window.confirm('Có lời góp ý chưa gửi. Bỏ bản nháp này để chuyển lớp?')){$('class-select').value=activeClass;return;}
 activeClass=$('class-select').value;epoch++;readGeneration++;loading=false;clearTimeout(timer);rows=[];renderRows();selected=null;composer=null;detailSession=null;detailVersion=null;$('comment-text').value='';$('detail-content').innerHTML='';delete $('detail-content').dataset.session;$('detail').close();$('detail').hidden=true;void refresh();
});
$('students').addEventListener('click',event=>{const b=event.target.closest('[data-student]');if(b)void openDetail(b.dataset.student);});
// Đóng popup chỉ ẩn; giữ nguyên bản nháp, form, phần mở để tiếp tục khi mở lại.
function closeDetail(){if(sending)return;const studentRef=selected?.studentRef;selected=null;detailSequence++;activitySequence++;$('detail').close();$('detail').hidden=true;$('students').querySelector(`[data-student="${studentRef}"]`)?.focus();}
$('close-detail').addEventListener('click',closeDetail);
let backdropDown=false;
const outside=e=>{const r=$('detail').getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;};
$('detail').addEventListener('pointerdown',e=>{backdropDown=e.target===$('detail')&&outside(e);});
$('detail').addEventListener('pointerup',e=>{if(backdropDown&&e.target===$('detail')&&outside(e))closeDetail();backdropDown=false;});
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
 const hash=await fieldHash(text);if(current!==epoch||selected?.ref!==ref||!root.isConnected||composer||sending)return;
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
 try{const value=await request('/sessions/'+ref+'/threads','POST',{action:'status',threadRef:button.dataset.threadStatus,status:button.dataset.status,expectedCommentVersion:detailSession.commentVersion||0,requestId:crypto.randomUUID(),expectedActor:actorEmail});if(current===epoch&&selected?.ref===ref)renderDetail(value.session);}
 catch(e){if(current===epoch){
  report(e);
  if(e.message==='COMMENT_VERSION_CONFLICT')try{
   const latest=await request('/sessions/'+ref);if(current===epoch&&selected?.ref===ref)renderDetail(latest.session);
  }catch(readError){if(current===epoch)report(readError);}
 }}
 finally{sending=false;button.disabled=false;}
}
$('detail-content').addEventListener('submit',async event=>{
 const form=event.target.closest('[data-thread-reply],[data-comment-create]');if(!form)return;event.preventDefault();
 if(sending||!selected?.ref)return;const body=form.elements.body.value.trim();if(!body)return;
 const creation=!!form.dataset.commentCreate,c=creation?composer:null,ref=selected.ref,current=epoch;
 if(!creation&&composer){$('comment-status').textContent='Hãy gửi hoặc hủy comment đang soạn trước khi trả lời trao đổi khác; bản nháp đang được giữ.';return;}
 if(creation&&(!c||c.ref!==ref||c.epoch!==current))return;
 if(form.dataset.requestBody!==body){form.dataset.requestBody=body;form.dataset.requestId=crypto.randomUUID();}
 const input={action:creation?'create':'reply',body,requestId:form.dataset.requestId,expectedActor:actorEmail,...(creation?{field:c.field,fieldHash:c.fieldHash,...(c.range?{range:c.range}:{})}:{threadRef:form.dataset.threadReply})};
 const button=form.querySelector('button[type="submit"]'),status=form.querySelector('.thread-status');sending=true;detailSequence++;button.disabled=true;form.elements.body.disabled=true;status.textContent='Đang gửi…';
 try{
  const value=await request('/sessions/'+ref+'/threads','POST',input);
  if(current!==epoch||selected?.ref!==ref)return;
  form.elements.body.value='';status.textContent='Đã lưu trao đổi.';delete form.dataset.requestId;delete form.dataset.requestBody;composer?.form.remove();composer=null;renderDetail(value.session);await readActivity(ref);$('comment-status').textContent='Đã lưu trao đổi; học viên đọc được trên bài của mình.';
 }catch(e){if(current===epoch&&selected?.ref===ref)status.textContent=e.message==='COMMENT_CONTENT_CHANGED'?'Nội dung trích đã thay đổi. Lời góp ý vẫn giữ; sao chép rồi hủy, cập nhật bài và chọn lại đoạn.':errorText(e);}
 finally{sending=false;button.disabled=false;form.elements.body.disabled=false;}
});
$('logout').addEventListener('click',async()=>{if(authBusy)return;if(hasThreadDraft()&&!window.confirm('Bỏ lời trao đổi chưa gửi và đăng xuất?'))return;authBusy=true;epoch++;clearTimeout(timer);selected=null;composer=null;detailSession=null;actorEmail='';rows=[];$('detail-content').innerHTML='';delete $('detail-content').dataset.session;$('detail').close();$('detail').hidden=true;$('dashboard').hidden=true;$('login').hidden=true;$('students').innerHTML='';$('comment-text').value='';try{await request('/session','DELETE');}catch(e){report(e,'login-error');}finally{authBusy=false;$('login').hidden=false;}window.google?.accounts.id.disableAutoSelect();});
$('comment-form').addEventListener('submit',async event=>{
 event.preventDefault();if(sending||!selected?.ref||!Number.isSafeInteger(detailVersion))return;
 if(composer){$('comment-status').textContent='Hãy gửi hoặc hủy comment đang soạn trước khi gửi góp ý theo phần; bản nháp đang được giữ.';return;}
 const ref=selected.ref,current=epoch,feedback=$('comment-text').value.trim(),section=$('comment-section').value;if(!feedback)return;
 sending=true;detailSequence++;$('comment-submit').disabled=true;$('comment-status').textContent='Đang gửi góp ý…';
 try{const value=await request('/sessions/'+ref+'/comments','POST',{section,feedback,expectedActor:actorEmail,expectedVersion:detailVersion,requestId:crypto.randomUUID()});if(current!==epoch||selected?.ref!==ref)return;detailSequence++;renderDetail(value.session);if($('comment-text').value.trim()===feedback)$('comment-text').value='';$('comment-status').textContent='Đã lưu góp ý; học viên sẽ thấy ở đúng phần bài.';await readActivity(ref);await refresh();}catch(e){if(current===epoch&&selected?.ref===ref)$('comment-status').textContent=errorText(e);}finally{sending=false;$('comment-submit').disabled=false;}
});
async function boot(){
 try{const result=await request('/session');actorEmail=result.reviewer.email;await enter();}catch(e){if(e.status!==401)report(e,'login-error');}
 try{const {clientId}=await request('/config');let attempts=0;const setup=()=>{if(window.google?.accounts?.id){window.google.accounts.id.initialize({client_id:clientId,callback:login,auto_select:false});window.google.accounts.id.renderButton($('google-signin'),{theme:'outline',size:'large',text:'signin_with',locale:'vi'});}else if(attempts++<100)setTimeout(setup,100);else $('login-error').textContent='Chưa tải được nút Google. Hãy tải lại trang.';};setup();}catch(e){report(e,'login-error');}
}
$('detail').addEventListener('cancel',e=>{e.preventDefault();$('close-detail').click();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimeout(timer);else if(!$('dashboard').hidden)void refresh();});
void boot();
