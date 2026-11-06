import {handoutTablesHtml} from './handout-tables.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stateNames={covered:'Đã thể hiện',missing:'Cần bổ sung ý',contradicts:'Cần xem lại ý',uncertain:'Chưa đủ căn cứ'};
function itemsHtml(check){
 const items=check?.items||[],issueIds=new Set(check?.issues||[]);
 const row=i=>`<article class="alignment-item"><strong>${esc(i.label)} · ${esc(stateNames[i.state])}</strong><p class="feedback-text">Ý trong handout: ${esc(i.content)}</p><p class="feedback-text"><strong>Tình trạng trong bài:</strong> ${esc(i.explanation)}</p>${i.evidence?.map(e=>`<blockquote class="feedback-text" lang="en">${esc(e.quote)}</blockquote>`).join('')||''}</article>`;
 const relevant=items.filter(i=>issueIds.has(i.id)||i.state==='uncertain');
 return relevant.map(row).join('')+(items.length?`<details><summary>Xem đối chiếu ${items.length} ý</summary>${items.map(row).join('')}</details>`:'');
}
export function alignmentPanelHtml(check,required){return required?`<section id="handout-check-panel" class="alignment-panel" aria-live="polite" tabindex="-1">${alignmentStatusHtml(check)}</section>`:'';}
export function alignmentStatusHtml(check){
 if(!check||['passed','not_required','queued','running'].includes(check.status))return '';
 const color=check.status==='passed'?'success':check.status==='blocked'?'attention':'neutral';
 return `<h3>Kiểm tra bám handout <span class="badge ${color}">${esc({queued:'Đang chờ',running:'Đang kiểm',passed:check.teacherConfirmed?'GV đã xác nhận':'Đủ ý',blocked:'Cần xem lại',uncertain:'Chờ GV xem',unavailable:'Chưa kiểm được',stale:'Cần kiểm lại',handout_missing:'Chờ handout'}[check.status]||'Đang kiểm')}</span></h3><p role="status">${esc(check.message)}</p>${check.teacherMessage?`<p class="feedback-text"><strong>GV nhắn:</strong> ${esc(check.teacherMessage)}</p>`:''}${itemsHtml(check)}
 ${check.id&&['blocked','uncertain','unavailable'].includes(check.status)?`<button type="button" id="handout-request-review" ${check.reviewRequested?'disabled':''}>${check.reviewRequested?'Đã gửi GV phụ trách xem lại':'Nhờ GV phụ trách xem lại'}</button>`:''}
 ${check.id&&!['queued','running'].includes(check.status)?'<button type="button" id="handout-refresh-check" class="quiet">Cập nhật kết quả kiểm</button>':''}`;
}
export function setupStudentAlignment({panel,api,assignmentId,kind,revisionRound=1,isCurrent,onResult}){
 const prefix='/student/assignments/'+encodeURIComponent(assignmentId);
 let current;
 function draw(check,focus=false){if(!isCurrent()||!panel?.isConnected)return;current=check;onResult?.(check);panel.innerHTML=alignmentStatusHtml(check);panel.hidden=!panel.innerHTML;
  const progress=document.querySelector('#submit-progress');if(progress)progress.textContent=['queued','running'].includes(check?.status)?'Đang kiểm tra bài…':'';
  const essay=document.querySelector('#essay');if(essay){if(check?.status==='blocked')essay.setAttribute('aria-invalid','true');else essay.removeAttribute('aria-invalid');}
  if(focus&&!panel.hidden){panel.focus({preventScroll:true});panel.scrollIntoView({block:'start'});}
  const request=panel.querySelector('#handout-request-review');if(request&&!request.disabled)request.onclick=async()=>{request.disabled=true;try{draw(await api(prefix+'/handout-check/'+encodeURIComponent(check.id)+'/review-request',{}));}catch(e){if(isCurrent())request.disabled=false;draw({...check,message:e.message},true);}};
  const refresh=panel.querySelector('#handout-refresh-check');if(refresh)refresh.onclick=async()=>{try{draw(await api(prefix+'/handout-check/'+encodeURIComponent(check.id)),true);}catch(e){draw({...check,message:e.message},true);}};
 }
 return {draw,async run({draftRevision,text,unchanged}){
  let check=await api(prefix+'/handout-check',{draftRevision,kind,revisionRound,retry:current?.status==='unavailable'});draw(check);
  for(let attempt=0;['queued','running'].includes(check.status)&&attempt<120;attempt++){
   if(!isCurrent())return null;if(!unchanged()){draw({status:'stale',message:'Nội dung đã đổi. Hãy lưu rồi kiểm tra lại bản đang viết.'},true);return null;}
   await new Promise(resolve=>setTimeout(resolve,1000));if(!isCurrent())return null;
   check=await api(prefix+'/handout-check/'+encodeURIComponent(check.id));draw(check);
  }
  if(!isCurrent())return null;if(!unchanged()){draw({status:'stale',message:'Nội dung đã đổi. Hãy lưu rồi kiểm tra lại bản đang viết.'},true);return null;}
  if(['queued','running'].includes(check.status))draw({...check,message:'Hệ thống vẫn đang kiểm tra. Nháp được giữ; em có thể bấm Nộp để xem tiếp kết quả sau.'},true);
  else draw(check,check.status!=='passed');
  return check.status==='passed'?check:null;
 }};
}
export function alignmentTeacherQueueHtml(rows){return rows.length?`<section class="card alignment-teacher-queue"><h2>Handout cần GV xem lại <span class="badge neutral">${rows.length}</span></h2><p>Các bài này đang ở bước đối chiếu, chưa được nhận để chấm.</p>${rows.map(r=>`<article class="lesson-row"><div><strong>${esc(r.label)}</strong><p>${esc(r.class_id)} · ${esc(r.title)} · ${r.kind==='revision'?'Bản sửa':'Bài gốc'}</p></div><button data-alignment-review="${esc(r.id)}">Xem đối chiếu</button></article>`).join('')}</section>`:'';}
export function alignmentTeacherViewHtml(data){return `<button id="back-alignment-list" class="text-button back">← Danh sách bài</button><div class="page-heading"><div><h1>Xem lại bám handout</h1><p>${esc(data.classId)} - ${esc(data.student)} · ${esc(data.title)} · ${data.check.kind==='revision'?'Bản sửa':'Bài gốc'}</p></div></div>
 <div class="alignment-review-grid"><section class="card"><h2>Handout đã dùng để đối chiếu</h2>${handoutTablesHtml(data.handout.tables,esc)}</section><section class="card"><h2>Bài viết đang chờ nộp</h2><p class="feedback-text" lang="en">${esc(data.text)}</p><div id="alignment-teacher-result">${alignmentStatusHtml(data.check)}</div>
 <label class="field"><span>Lý do xác nhận hoặc hướng dẫn học viên</span><textarea id="alignment-teacher-message" rows="4"></textarea></label><div class="actions"><button id="alignment-revise" ${['uncertain','blocked','unavailable'].includes(data.check.status)?'':'disabled'}>Yêu cầu xem lại ý</button><button class="primary" id="alignment-allow" ${['uncertain','blocked','unavailable'].includes(data.check.status)?'':'disabled'}>Xác nhận đủ ý</button></div><p>Thao tác này xác nhận bước bám handout. Học viên vẫn cần bấm Nộp; GV duyệt trả bài sau khi chấm ở bước riêng.</p><div id="alignment-teacher-error" role="alert"></div>
 ${data.history.length?`<details><summary>Lịch sử xác nhận</summary>${data.history.map(h=>`<p class="feedback-text">${esc(h.message)}</p>`).join('')}</details>`:''}</section></div>`;}
