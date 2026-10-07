// Nhận projection đã xác thực của lớp; dựng thẻ và vùng đọc riêng, không tạo dữ liệu mẫu.
export const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const order=['topic','b1','a1','x1','b2','a2','x2'];
export const names={topic:'Topic sentence',b1:'Điểm B · Ý 1',a1:'Điểm A · Ý 1',x1:'Cầu nối X · Ý 1',b2:'Điểm B · Ý 2',a2:'Điểm A · Ý 2',x2:'Cầu nối X · Ý 2',idea1:'Chốt idea · Ý 1',idea2:'Chốt idea · Ý 2',topicSentence:'Topic sentence'};
export const states={support:'Cần hỗ trợ',attention:'Đáng chú ý',not_started:'Chưa bắt đầu',working:'Đang làm',revision:'Cần sửa',pending:'Đang chấm',complete:'Đã thông qua'};
export const stamp=v=>v?new Date(v).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'}):'';
export const rowState=r=>r.sessionRef?(r.dashboard?.state||'working'):'not_started';
export function ordered(rows,mode='recent'){
  return [...rows].sort((a,b)=>{
    const priority=r=>r.sessionRef?r.dashboard?.priority??3:5;
    return priority(a)-priority(b)||(mode==='progress'?(a.dashboard?.filled||0)-(b.dashboard?.filled||0):(b.dashboard?.activity.lastAt||0)-(a.dashboard?.activity.lastAt||0))||String(a.studentRef).localeCompare(String(b.studentRef));
  });
}
export function approval(step){return step.status!=='passed'?'':step.approval?.source==='student_attested_teacher_permission'?'HV xác nhận đã được GV đồng ý':step.approval?.source==='ai'?'AI chấm đạt':'';}
export function jobText(key,j){
 const label=j.status==='failed'?'Lỗi xử lý':j.status==='leased'?'Đang xử lý':j.tries?'Đang chờ thử lại':'Đang xếp hàng';
 const seconds=Math.max(0,Math.floor((Date.now()-j.createdAt)/1000));
 return `${names[key]||'Từ vựng · Ý '+key.slice(-1)}: ${label} · ${j.tries}/${j.maxTries} lần xử lý · đã chờ ${seconds<60?seconds+' giây':Math.floor(seconds/60)+' phút'}${j.overdue?' · quá hạn xử lý tổng':''}`;
}
export function stepLabel(step){return !step?.available&&step?.status!=='passed'?'Chưa mở':({passed:'Đã thông qua',revision:'Cần sửa',pending:'Đang chấm',technical_error:'Gặp lỗi',draft:'Chưa Check'})[step?.status]||'Chưa Check';}
export function card(r){
 const d=r.dashboard,s=rowState(r);
 return `<button type="button" class="teacher-student-card" data-student="${esc(r.studentRef)}" data-state="${s}" data-support="${!!d?.supportLevel}"><div class="teacher-student-header"><span class="student-name">${esc(r.displayName)}</span><span class="status" data-state="${s}">${states[s]}</span></div><div class="teacher-student-meta">${d?esc(d.current?names[d.current]:d.currentLabel||'7/7 phần đã thông qua'):'Chưa mở bài'}${d?.activity.studentAt?' · '+stamp(d.activity.studentAt):''}</div>${d?.supportLevel?`<span class="teacher-support-warning">${d.negativeStreak} lần AI yêu cầu sửa liên tiếp · cần hỗ trợ</span>`:''}<div class="progress-line"><progress value="${d?.filled||0}" max="9" aria-label="Ô đã có nội dung"></progress><strong>${Math.round((d?.filled||0)/9*100)}%</strong></div><div class="metrics"><span><strong>${d?.filled||0}/9</strong> ô đã viết</span><span><strong>${d?.passed||0}/7</strong> phần thông qua</span><span><strong>${d?.checks||0}</strong> Check</span><span><strong>${d?.aiComments||0}</strong> nhận xét AI</span><span><strong>${d?.openThreads||0}</strong> trao đổi mở</span></div><div class="steps">${order.map(k=>`<span class="step" data-state="${d?.stepStates[k]?.available||d?.stepStates[k]?.status==='passed'?d.stepStates[k].status:'locked'}" title="${esc(stepLabel(d?.stepStates[k]))}">${k==='topic'?'Topic':k.toUpperCase()} ${d?.stepStates[k]?.status==='passed'?'✓':''}</span>`).join('')}</div>${d?.edited?'<p class="attention-line">Đã sửa sau khi thông qua · nhận xét cũ thuộc bản trước</p>':''}${d?.attested?`<p class="approval-note">${d.attested} phần: HV xác nhận đã được GV đồng ý</p>`:''}${d?.waitingReplyAt?`<p class="attention-line">HV đã trả lời trong trao đổi đang mở · ${stamp(d.waitingReplyAt)}</p>`:''}${Object.entries(d?.processing||{}).map(([k,j])=>`<p class="job-line">${esc(jobText(k,j))}</p>`).join('')}</button>`;
}

// Chỉ thay vùng đọc thực sự đổi; giữ selection, phần mở, focus và mọi form đang nhập/gửi.
export function patchHTML(el,html){
 if(!el)return;
 const selection=window.getSelection();
 if(selection&&!selection.isCollapsed&&(el.contains(selection.anchorNode)||el.contains(selection.focusNode)))return;
 if(el.dataset.readHtml===html)return;
 const opens=new Set([...el.querySelectorAll('details[open][data-history]')].map(n=>n.dataset.history));
 el.innerHTML=html;el.dataset.readHtml=html;
 for(const n of el.querySelectorAll('details[data-history]'))if(opens.has(n.dataset.history))n.open=true;
}
export function patchThreads(container,html){
 const template=document.createElement('template');template.innerHTML=html;
 for(const incoming of [...template.content.children]){
  if(!incoming.id){if(!container.children.length)container.append(incoming);continue;}
  let current=container.querySelector('#'+CSS.escape(incoming.id));
  if(!current){container.querySelector('.empty')?.remove();container.append(incoming);continue;}
  const selection=window.getSelection();
  if(selection&&!selection.isCollapsed&&current.contains(selection.anchorNode))continue;
  const focused=document.activeElement,caret=focused?.tagName==='TEXTAREA'?[focused.selectionStart,focused.selectionEnd]:null;
  const opened=[...current.querySelectorAll('details[open]')].map(n=>n.className);
  const liveForm=current.querySelector('[data-thread-reply]'),freshForm=incoming.querySelector('[data-thread-reply]');
  const button=current.querySelector('[data-thread-status]'),freshButton=incoming.querySelector('[data-thread-status]');
  // Form node được giữ nguyên: textarea, requestId và trạng thái gửi không bị reset.
  const read=[...incoming.childNodes].filter(n=>n!==freshForm).map(n=>n.outerHTML||n.textContent).join('');
  if(current.dataset.threadRead===read)continue;
  if(liveForm&&freshForm)freshForm.replaceWith(liveForm);
  if(button&&freshButton){button.dataset.status=freshButton.dataset.status;button.textContent=freshButton.textContent;freshButton.replaceWith(button);}
  current.replaceChildren(...incoming.childNodes);current.dataset.threadRead=read;
  for(const n of current.querySelectorAll('details'))if(opened.includes(n.className))n.open=true;
  if(focused?.isConnected&&document.activeElement!==focused)focused.focus({preventScroll:true});
  if(caret&&focused.isConnected)focused.setSelectionRange(...caret);
 }
}
