import {handoutTablesHtml} from './handout-tables.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Link chỉ mở bảng kết quả trong Homework; không mở/tạo phiên hoặc gửi lệnh sang K67.
export function handoutLinkHtml({assignmentId,submissionId}) {
  return '';
}

export function handoutReadOnlyHtml() {
  return `<section class="handout-reader" aria-label="Kết quả Handout Writing chỉ đọc">
    <div class="section-heading"><h2>Handout Writing</h2><span class="badge neutral">Chỉ đọc</span></div>
    <p class="handout-owner"></p><div class="handout-actions"><button type="button" data-handout-reload>Xem lại kết quả</button><span data-handout-status role="status"></span></div>
    <div data-handout-content></div></section>`;
}

export function setupReadOnlyHandout(root,{assignmentId,submissionId,loadHandout,isCurrent=()=>root.isConnected}) {
  let request=0;
  const button=root.querySelector('[data-handout-reload]'), status=root.querySelector('[data-handout-status]'), content=root.querySelector('[data-handout-content]');
  const current=id=>id===request&&root.isConnected&&isCurrent();
  async function reload(){
    const id=++request;status.textContent='Đang đọc kết quả handout…';root.setAttribute('aria-busy','true');content.innerHTML='';
    try{
      const result=await loadHandout();if(!current(id))return;
      if((assignmentId&&result.assignmentId!==assignmentId)||(submissionId&&result.submissionId!==submissionId)||!Array.isArray(result.tables))throw Error('Kết quả handout không khớp học viên hoặc bài đang xem.');
      root.querySelector('.handout-owner').textContent=[result.studentLabel,result.assignmentTitle].filter(Boolean).join(' · ');
      const snapshot=result.readMode==='snapshot';button.textContent=snapshot?'Xem lại bản đã lấy':'Tải lại handout';
      status.textContent=result.readAt?(snapshot?'Bản đọc K67 lúc ':'Đã đọc lúc ')+new Date(result.readAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
      content.innerHTML=`<p class="section-note">${esc(result.message||'')}</p>`+(result.tables.length?`<div class="handout-summary-title"><h3>Bảng tổng hợp trên lớp</h3><span class="badge neutral">${result.tables.length} bảng</span></div>${handoutTablesHtml(result.tables,esc)}`:'<p class="empty-inline">Chưa có bảng tổng hợp để xem. Có thể thử lại sau.</p>');
    }catch(e){if(current(id)){status.textContent='Chưa tải được handout';content.innerHTML=`<p class="error-panel" role="alert">${esc(e.message)}</p><p class="section-note">Bấm Tải lại handout để thử lại. Nội dung bài và nhận xét vẫn được giữ.</p>`;button.textContent='Tải lại handout';}}
    finally{if(current(id))root.removeAttribute('aria-busy');}
  }
  button.onclick=reload;
  return {reload};
}
