import {setupHandoutEditor} from './handout-editor.js';
import { handoutTablesHtml } from './handout-tables.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function handoutPreviewHtml(assignment, person, result = {tables:[]}) {
  return `<header class="handout-heading"><div><h2>Handout Writing</h2><p>${esc(assignment.title)}</p></div><button type="button" id="close-handout" aria-label="Đóng handout">×</button></header>
    <div class="handout-sheet"><div class="handout-person"><strong>${esc(person.label)}</strong><span class="badge neutral">Kết quả K67 · chỉ đọc</span></div>
    <div class="handout-actions"><button type="button" id="reload-handout">Tải lại handout</button><span id="handout-status" role="status"></span></div>
    <div id="handout-content"><p class="section-note">${esc(result.message || '')}</p><div class="handout-summary-title"><h3>Bảng tổng hợp trên lớp</h3><span class="badge neutral">${result.tables.length} bảng</span></div>
    ${handoutTablesHtml(result.tables,esc)}</div></div>`;
}

export function setupHandoutPreview(root,{assignment,person,initialMode='handout',onModeChange,loadHandout,saveHandout,onHandoutChange,isCurrent = () => root.isConnected}) {
  const layout=root.querySelector('.student-layout'), side=root.querySelector('.study-context');
  const handout=root.querySelector('#handout-preview'), feedback=root.querySelector('#approved-feedback');
  const toggle=root.querySelector('#toggle-handout'), showFeedback=root.querySelector('#show-feedback');
  let mode=feedback ? 'feedback' : 'closed', request=0,copyEditor;
  handout.innerHTML=handoutPreviewHtml(assignment,person);
  copyEditor=setupHandoutEditor(handout,{person,assignment,save:saveHandout,isCurrent,onChange:onHandoutChange});
  const positions={feedback:0,handout:0};
  const current = id => id === request && mode === 'handout' && isCurrent() && handout.isConnected;
  async function reload() {
    const id=++request, status=handout.querySelector('#handout-status'), content=handout.querySelector('#handout-content');
    status.textContent='Đang mở kết quả handout…'; handout.setAttribute('aria-busy','true'); if(!copyEditor.isDirty())content.innerHTML='';
    try {
      const result=await loadHandout();
      if(!current(id))return;
      if(result.assignmentId !== assignment.id || !Array.isArray(result.tables))throw Error('Kết quả handout không khớp bài đang mở.');
      const snapshot=result.readMode==='snapshot';
      handout.querySelector('#reload-handout').textContent=snapshot?'Xem lại bản đã lấy':'Tải lại handout';
      status.textContent=result.readAt ? (snapshot?'Bản đọc K67 lúc ':'Đã đọc bản mới nhất · ')+new Date(result.readAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';
      await copyEditor.receive(result);
    } catch(e) { if(current(id)){ status.textContent='Chưa tải được handout';content.innerHTML=`<p class="error-panel">${esc(e.message)}</p><p>Em vẫn có thể viết và lưu bài. Bấm Tải lại handout để thử lại.</p>`; } }
    finally {if(current(id))handout.removeAttribute('aria-busy');}
  }
  const select=(next,focus=false)=>{
    if(mode !== 'closed') positions[mode]=side.scrollTop;
    request++; mode=next;
    if(mode === 'handout') {

      handout.querySelector('#close-handout').onclick=()=>{void copyEditor.backup();select(feedback?'feedback':'closed',true);};
      handout.querySelector('#reload-handout').onclick=reload;
    }
    handout.hidden=mode !== 'handout';
    if(feedback) feedback.hidden=mode !== 'feedback';
    side.hidden=mode === 'closed'; layout.classList.toggle('handout-open',mode === 'handout');
    toggle.setAttribute('aria-expanded',String(mode === 'handout'));
    toggle.textContent=mode === 'handout' ? 'Đóng handout Writing' : 'Xem handout Writing';
    if(showFeedback) showFeedback.setAttribute('aria-pressed',String(mode === 'feedback'));
    side.setAttribute('aria-label',mode === 'handout'?'Handout Writing trên lớp':'Nhận xét đã duyệt');
    side.tabIndex=0; side.scrollTop=positions[mode] || 0;
    onModeChange?.(mode);
    if(focus) (mode === 'handout' ? handout.querySelector('#close-handout') : toggle).focus({preventScroll:true});
    if(mode === 'handout')void reload();
  };
  toggle.onclick=()=>select(mode==='handout'?(feedback?'feedback':'closed'):'handout',true);
  if(showFeedback) showFeedback.onclick=()=>select('feedback');
  root.querySelectorAll('a[href="#approved-feedback"]').forEach(link=>link.addEventListener('click',()=>select('feedback')));
  handout.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();select(feedback?'feedback':'closed',true);}});
  const editor=root.querySelector('.editor-card'); editor.tabIndex=0;editor.setAttribute('aria-label','Đề bài và bài làm của em');
  // Vào bài mới/reload luôn mở handout; cập nhật trạng thái trong cùng lượt
  // xem giữ lựa chọn đóng/đọc phản hồi của HV, không tự bật lại khi đang viết.
  select(['handout','closed',...(feedback?['feedback']:[])].includes(initialMode)?initialMode:'handout');
  return copyEditor;
}
