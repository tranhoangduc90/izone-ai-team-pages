// Nhận nhật ký đã được API kiểm quyền lớp/phiên; trình bày cho giảng viên.
// Không nhận prompt/credential; mọi nội dung học viên/AI được escape trước hiển thị.
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const eventNames={session_opened:'Mở bài làm',responses_saved:'Lưu nội dung',content_edited:'Chỉnh nội dung đã chốt',student_attested_teacher_permission:'HV xác nhận GV đồng ý cho qua',comment_teacher:'GV góp ý trong luồng trao đổi',comment_student:'HV trả lời góp ý',comment_status_changed:'GV đổi trạng thái trao đổi',job_superseded:'Lượt xử lý cũ đã được thay thế',idea2_opened:'Mở ý 2',teacher_comment:'Góp ý của giảng viên',check_queued:'Gửi yêu cầu xử lý',processing_started:'Bắt đầu xử lý',ai_response_received:'Đã lưu phản hồi AI',job_completed:'Đã nhận kết quả',job_queued:'Chuẩn bị thử lại',job_failed:'Dừng lượt chấm'};
const statuses={processing:'Đang xử lý',response_received:'Đã giữ phản hồi',completed:'Đã nhận kết quả',queued:'Cần thử lại',failed:'Đã dừng',timed_out:'Hết thời gian của lượt này'};
const fields={idea1:'Idea 1',idea2:'Idea 2',topicSentence:'Topic Sentence',a1:'A · Ý 1',x1:'X · Ý 1',b1:'B · Ý 1',a2:'A · Ý 2',x2:'X · Ý 2',b2:'B · Ý 2'};
const date=value=>Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'Chưa có thời gian';
function eventDetail(e){
 const d=e.details||{};
 if(e.kind==='content_edited')return `<details><summary>Xem nội dung trước và sau Edit</summary>${Object.keys(d.after||{}).map(k=>`<b>${esc(fields[k]||k)}</b><p class="field-read">Trước: ${esc(d.before?.[k])}</p><p class="field-read">Sau: ${esc(d.after[k])}</p>`).join('')}</details>`;
 if(d.message)return `<details><summary>Xem lời trao đổi</summary>${d.quote?`<blockquote>${esc(d.quote)}</blockquote>`:''}<p class="field-read">${esc(d.message.authorName)}: ${esc(d.message.body)}</p></details>`;
 return '';
}
export function renderActivityList(events,nextCursor){
  const rows=events.map(e=>`<li class="activity-event ${e.kind==='job_failed'?'activity-failed':''}"><div><strong>${esc(eventNames[e.kind]||e.kind)}</strong><time>${esc(date(e.event_at))}</time></div><p>${(e.section||e.details?.section||e.details?.field)?esc(fields[e.section||e.details?.section||e.details?.field]||'Topic Sentence'):e.idea_index?'Từ vựng · Ý '+esc(e.idea_index):''}${e.attempt_index?' · Lượt '+esc(e.attempt_index):''}${e.details?.error?' · Mã lỗi: '+esc(e.details.error):''}</p>${eventDetail(e)}${e.job_ref?`<button class="text-button" data-log-job="${esc(e.job_ref)}">Xem nội dung gửi chấm và phản hồi AI</button>`:''}</li>`).join('');
  return `<ol class="activity-events">${rows||'<li class="empty">Chưa có nhật ký được lưu cho phiên này. Lượt trước khi bật tính năng có thể không còn đủ dữ liệu.</li>'}</ol>${nextCursor?'<button class="secondary" data-log-more="1">Xem sự kiện trước đó</button>':''}`;
}
export function renderActivityDetail(detail){
  if(!detail)return '<p class="empty">Chưa có bản nội dung hoặc phản hồi AI được lưu cho lượt này.</p>';
  const input=detail.input;
  const submitted=Object.entries(input.snapshot?.responses||{}).map(([key,value])=>value?`<div><b>${esc(fields[key]||key)}</b><p class="field-read">${esc(value)}</p></div>`:'').join('');
  return `<article class="activity-job"><h4>Nội dung gửi chấm</h4><p class="fine-print">Bản chụp được giữ nguyên khi gửi, lúc ${esc(date(input.created_at))}. Lượt: ${esc(input.job_ref)}.</p><details><summary>Đề bài</summary><p class="field-read">${esc(input.snapshot?.topic)}</p></details>${submitted}<h4>Các lần xử lý và phản hồi AI</h4>${detail.attempts.length?detail.attempts.map(a=>`<section class="activity-attempt"><header><strong>Lượt ${esc(a.attempt_index)} · ${esc(statuses[a.status]||a.status)}</strong><span>${esc(date(a.started_at))}</span></header>${a.model?`<p>Mô hình được ghi nhận: ${esc(a.model)}</p>`:''}${a.error_code?`<p class="error">Mã lỗi: ${esc(a.error_code)}</p>`:''}${a.response_text!==null?`<details><summary>Phản hồi AI nguyên dạng</summary><p class="fine-print">Phản hồi được giữ trước khi hệ thống đọc kết quả, để kiểm tra khi chấm gặp lỗi.</p><pre class="activity-raw">${esc(a.response_text)}</pre></details>`:'<p class="empty">Chưa lưu được phản hồi AI cho lượt này; không suy ra AI chưa xử lý.</p>'}${a.execution_ref?`<p class="fine-print">Lượt chạy n8n: ${esc(a.execution_ref)}</p>`:''}</section>`).join(''):'<p class="empty">Yêu cầu chưa có lần xử lý được ghi nhận.</p>'}</article>`;
}
