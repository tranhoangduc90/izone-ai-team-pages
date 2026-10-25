import {appendMarkdown} from './markdown.js?v=20260818-numbering-v3';
import {safeLmsUrl} from './core.js?v=20260921-draft-result-v1';
import {renderLmsDraftResult} from './lms-draft-result.js?v=20260818-numbering-v3';

// Nhận dữ liệu của lượt chấm, dựng bản gửi bất biến trước nhận xét; không viết vào bài.
export const FIELD_LABELS={overview:'Overview',body1:'Body 1',body2:'Body 2',draft1:'Draft 1',draft2:'Draft 2'};
export const SECTION_FIELDS={overview:['overview'],outline:['body1','body2'],draft:['draft1','draft2']};
export function snapshotFields(item,section){
 const snapshot=item.snapshot;if(!snapshot||typeof snapshot!=='object')return null;
 return SECTION_FIELDS[section].map(key=>({key,label:FIELD_LABELS[key],text:typeof snapshot[key]==='string'?snapshot[key]:''}));
}
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
const legacyCache=new Map();
export function renderTimeline(root,items,{section,onRetry,api,sessionRef}={}){
 root.replaceChildren();
 for(const [i,item] of items.entries()){
  const li=el('li','comment');li.dataset.status=item.status||'completed';
  const details=el('details','history');details.open=i===0;details.dataset.historyKey=item.attemptRef||item.commentRef||`${section}:${item.commentNumber}`;
  const time=item.createdAt?new Date(item.createdAt).toLocaleString('vi-VN'):'';
  const label=`Lần ${item.commentNumber||'?'} · ${item.status==='queued'?'Đang chấm':item.status==='technical_error'?'Lỗi kỹ thuật':'Nhận xét'}${time?' · '+time:''}`;
  details.append(el('summary','comment-header',label));
  const content=el('div','comment-body markdown-body');
  const submitted=el('details','submitted-snapshot');submitted.append(el('summary','', 'Nội dung đã gửi'));
  const fields=snapshotFields(item,section);
  if(fields)for(const f of fields){submitted.append(el('strong','snapshot-label',f.label),el('div','snapshot',f.text||'Chưa viết'));}
  else submitted.append(el('p','fine-print','Lượt cũ này chưa có bản gửi lưu riêng trong dữ liệu trả về. Bài đang viết không được dùng thay cho bản gửi cũ.'));
  content.append(submitted,el('h4','feedback-label','Nhận xét AI'));
  const body=el('div','feedback-content');appendMarkdown(body,item.feedback||item.message||'Đang chuẩn bị phản hồi gợi mở…');content.append(body);
  const url=safeLmsUrl(item.artifacts?.lmsUrl||item.feedback);
  if(url){
   content.append(el('p','fine-print','Kết quả LMS lịch sử · giữ nội dung và nguồn gốc của lượt cũ.'));
   const link=el('a','lms-result-link','Mở kết quả LMS gốc ↗');link.href=url;link.target='_blank';link.rel='noopener noreferrer';content.append(link);
   if(i===0&&api?.draftResult){
    const inline=el('div','lms-inline-result');content.append(inline);const key=sessionRef+':'+url;
    const draw=()=>{const cached=legacyCache.get(key);if(!inline.isConnected)return;if(cached?.data)renderLmsDraftResult(inline,cached.data);else inline.textContent=cached?.error?'Chưa đọc được thẻ LMS cũ. Bạn vẫn có thể mở link gốc bên trên.':'Đang đọc thẻ LMS lịch sử…';};
    if(!legacyCache.has(key)){legacyCache.set(key,{});void api.draftResult(sessionRef).then(r=>legacyCache.set(key,{data:r.data.result})).catch(()=>legacyCache.set(key,{error:true})).finally(draw);}
    queueMicrotask(draw);
   }
  }
  if(item.status==='technical_error'&&item.attemptRef&&item.canRetry!==false&&onRetry){const retry=el('button','secondary','Check lại');retry.type='button';retry.onclick=()=>onRetry(item,retry);content.append(retry);}
  details.append(content);li.append(details);root.append(li);
 }
}

// Giữ trạng thái đọc và vị trí con trỏ khi poll dựng lại DOM, không thay giá trị đang nhập.
export function preserveView(root){
 const open=new Map([...root.querySelectorAll('details[data-history-key],details[data-section-key]')].map(x=>[x.dataset.historyKey||x.dataset.sectionKey,x.open]));
 const active=document.activeElement,field=active?.tagName==='TEXTAREA'?active.name:null;
 const selection=field?{start:active.selectionStart,end:active.selectionEnd,scroll:active.scrollTop}:null;
 return ()=>{for(const d of root.querySelectorAll('details[data-history-key],details[data-section-key]')){const key=d.dataset.historyKey||d.dataset.sectionKey;if(open.has(key))d.open=open.get(key);}
  if(field){const target=[...root.querySelectorAll('textarea[name]')].find(x=>x.name===field);if(target&&!target.disabled){target.focus({preventScroll:true});target.setSelectionRange(selection.start,selection.end);target.scrollTop=selection.scroll;}}
 };
}

export function decorateTask(){
 const root=document.getElementById('task-content');if(!root)return;
 for(const [i,card] of [...root.children].entries()){
  if(i===0){card.classList.add('prompt');const h=card.querySelector('h2');if(h){const head=el('div','prompt-heading');head.append(el('span','number','?'),h);card.prepend(head);}}
  else if(!card.classList.contains('chart-card')){const heading=card.querySelector('h2');if(!heading)continue;const d=el('details','task-help');const summary=el('summary','',heading.textContent+' · Xem khi cần');heading.remove();d.append(summary,...card.childNodes);card.replaceWith(d);}
 }
}
export function decorateStudent(app){
 const descriptions={overview:'Chọn những đặc điểm nổi bật của biểu đồ và bảng.',outline:'Sắp xếp thông tin vào hai thân bài; gửi nhận xét chung một lần.',draft:'Tự viết Overview và Body 1, sau đó tự chỉnh bản thứ hai.'};
 for(const [i,workspace] of [...document.querySelectorAll('.section-workspace')].entries()){
  const section=workspace.dataset.section,title={overview:'Overview',outline:'Outline',draft:'Draft 1 → Draft 2'}[section];workspace.id='section-'+section;
  workspace.querySelector('.group-title').textContent=`${i+1}. ${title}`;workspace.querySelector('.group-description').textContent=descriptions[section];
  const status=app.state.sections[section].status;workspace.dataset.status=status;
  const fields=workspace.querySelector('.text-fields');if(section==='outline')fields.classList.add('field-grid');
  for(const f of workspace.querySelectorAll('.practice-field'))f.classList.add('student-field');
  if(status==='passed'){
   for(const input of workspace.querySelectorAll('.practice-field textarea')){const text=el('div','saved-text',input.value||'Chưa viết');input.replaceWith(text);}
   const grid=workspace.querySelector('.step-grid'),d=el('details','prior-step');d.dataset.sectionKey=section;d.dataset.status='passed';d.append(el('summary','',`✓ ${title} đã đạt · Xem bài và lịch sử`),grid);workspace.append(d);
  }
  const nav=document.querySelector(`#review-nav [data-target="${section}"]`);if(nav){nav.classList.toggle('done',status==='passed');nav.dataset.status=status;nav.querySelector('span').textContent=status==='passed'?'✓':String(i+1);nav.title=status==='passed'?'Đã đạt':status==='queued'?'Đang chấm':status==='revision'?'Cần sửa':status==='technical_error'?'Lỗi kỹ thuật':'Chưa gửi';}
  const guide=workspace.querySelector('.draft-guidance');if(guide){const d=el('details','task-help');d.append(el('summary','','Cách làm Draft · Xem khi cần'),guide);workspace.querySelector('.text-fields').before(d);}
 }
}

const MEMORY_KEY='izone:task1-earnings-review-20261025:identity';
export function installPreviewEntry({app,openSession,updateStudentOptions,updateAccessCode,saveRemote,studentsForClass}){
 const $=id=>document.getElementById(id),form=$('identity-form'),confirm=$('identity-confirm'),setup=$('setup-card');let busy=false;
 const read=()=>{try{return JSON.parse(localStorage.getItem(MEMORY_KEY)||'null');}catch{return null;}};
 const remember=$('remember-review'),prior=read();remember.checked=prior?.remember!==false;
 const params=new URLSearchParams(location.search),requested=params.get('class')||'TASK1-THU-A';
 const groups=app.roster.classes||[];const group=groups.find(c=>[c.classRef,c.className].includes(requested));
 if(group){$('class-id').value=group.classRef;updateStudentOptions();}
 if(prior?.classRef===$('class-id').value&&studentsForClass(prior.classRef).some(s=>(s.studentRef||s.ref)===prior.studentRef)){$('student-name').value=prior.studentRef;updateAccessCode();}
 form.addEventListener('submit',event=>{event.preventDefault();if(busy)return;const selected=$('student-name').selectedOptions[0];
  if(!$('class-id').value||!selected?.value){$('identity-error').hidden=false;$('identity-error').textContent='Hãy chọn đúng lớp và tên của bạn.';return;}
  if(!$('access-code-row').hidden&&!/^\d{4}$/.test($('access-code').value)){$('identity-error').hidden=false;$('identity-error').textContent='Hãy nhập mã 4 số trước khi tiếp tục.';return;}
  $('confirm-title').textContent=selected.textContent;$('confirm-context').textContent=$('class-id').selectedOptions[0].textContent+' · Task 1 · Thu nhập theo ngành';$('confirm-error').textContent='';setup.hidden=true;confirm.hidden=false;$('confirm-open').focus();
 });
 $('identity-back').onclick=()=>{if(busy)return;confirm.hidden=true;setup.hidden=false;$('student-name').focus();};
 $('confirm-open').onclick=async()=>{if(busy)return;busy=true;$('confirm-open').disabled=true;const chosen={remember:remember.checked,classRef:$('class-id').value,studentRef:$('student-name').value};
  try{await openSession({preventDefault(){}});if(!$('workspace').hidden){confirm.hidden=true;localStorage.setItem(MEMORY_KEY,JSON.stringify(remember.checked?chosen:{remember:false}));}else{$('confirm-error').textContent=$('identity-error').textContent||'Chưa thể mở bài. Hãy chọn lại tên và kiểm tra mã.';}}
  catch(error){$('confirm-error').textContent=error.message;}finally{busy=false;$('confirm-open').disabled=false;}
 };
 $('change-review-person').onclick=async()=>{if(app.submittingSections.size)return;if(!(await saveRemote('close'))||app.dirty)return;localStorage.removeItem(MEMORY_KEY);location.reload();};
 document.querySelectorAll('#review-nav button').forEach(button=>button.onclick=()=>{const key=button.dataset.target,target=key==='task-content'?$(key):$('section-'+key);if(!target)return;target.querySelector('.prior-step')?.setAttribute('open','');target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'});document.querySelectorAll('#review-nav button').forEach(b=>b.classList.toggle('active',b===button));});
 // Bản thử giữ ghi nhớ riêng, không gọi bộ nhận diện ERP hoặc đổi danh tính ở bài thật.
}

export function installTeacherTools(render){for(const id of ['review-search','review-filter','review-order'])document.getElementById(id).addEventListener(id==='review-search'?'input':'change',render);}
export function filterStudents(students,statusOf){
 const $=id=>document.getElementById(id);const search=($('review-search')?.value||'').trim().toLocaleLowerCase('vi'),filter=$('review-filter')?.value;
 const result=students.filter(s=>(!search||s.displayName.toLocaleLowerCase('vi').includes(search))&&(!filter||(filter==='support'?s.supportRequired:statusOf(s)===filter)));
 result.sort($('review-order')?.value==='name'?(a,b)=>a.displayName.localeCompare(b.displayName,'vi'):(a,b)=>Number(b.supportRequired)-Number(a.supportRequired)||(Date.parse(b.savedAt)||0)-(Date.parse(a.savedAt)||0));
 if($('review-count'))$('review-count').textContent=`${result.length}/${students.length} học viên · 5 ô bài viết, 3 phần nhận xét`;
 return result;
}
export function decorateTeacher(card,student,definitions){
 const steps=el('span','teacher-step-list');for(const definition of definitions){const state=student.sections?.[definition.key]?.status||'draft';const step=el('span','step-status',`${definition.key==='overview'?'Overview':definition.key==='outline'?'Outline':'Draft'}${state==='passed'?' ✓':''}`);step.dataset.state=state;steps.append(step);}
 card.append(steps);if(student.readOnly)card.append(el('span','teacher-readonly-label','Lịch sử cũ · chỉ đọc'));
}
