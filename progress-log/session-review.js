// Dữ liệu nhận: bài public đã được API lọc theo người/lớp/buổi, không có khóa đáp án.
// Dựng hero, điểm khách quan và toàn bộ câu trả lời chỉ đọc; không ghi bài hoặc điểm danh.
import {contentTitle,skillsLabel} from './session-presentation.js';
import {reviewItems} from './answer-review.js';
import {commentPanel} from './session-comments.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderSessionReview(root,detail,{session={}}={}){
 const title=contentTitle(session,detail.definition||session),items=(detail.gradingItems||[]).filter(i=>i.maxScore>0&&['correct','incorrect'].includes(i.verdict));
 const correct=items.filter(i=>i.verdict==='correct').length,complete=detail.status==='complete';
 const date=String(detail.sessionDate||session.sessionDate||'').split('-'),when=date.length===3?date.reverse().join('/'):'Chưa xác nhận ngày';
 root.classList.add('referenceRegion');
 root.innerHTML='<div class="studentDetailPage"><header class="studentDetailHeader"><div><span class="studentPortalEyebrow">PROGRESS LOG '+(complete?'ĐÃ HOÀN THÀNH':'CỦA BUỔI HỌC')+' · BUỔI '+esc(String(detail.sessionNumber).padStart(2,'0'))+'</span><h1>'+esc(title)+'</h1><p>'+esc([when,skillsLabel(title)].filter(Boolean).join(' · '))+'</p></div><span class="portalCompleteBadge">'+(complete?'✓ Đã hoàn thành':'Dữ liệu hiện có')+'</span></header><p class="reviewPerson">'+esc(detail.student.name+(detail.student.discriminator?' · '+detail.student.discriminator:''))+'</p>'
  +(items.length?'<section class="studentDetailScore"><small>KẾT QUẢ CÂU ĐÃ CHẤM</small><strong>'+correct+'/'+items.length+'</strong><span>'+correct+' câu đúng · '+(items.length-correct)+' câu sai</span><p>Câu mở, điểm tự khai và câu chưa chấm được hiển thị riêng trong bài.</p></section>':'')
  +(detail.definition?reviewItems(detail):'<p>Buổi này chưa có bài Progress Log hoàn tất để xem lại.</p>')+'</div>';
 const comment=commentPanel(detail.sessionComment);if(comment)root.append(comment);
 if(detail.teacherSessionFeedback?.noteText){const box=document.createElement('section');box.className='studentAnswerReview';const h=document.createElement('h2');h.textContent='Nhận xét Speaking từ giảng viên';const p=document.createElement('p');p.className='reviewAnswer';p.textContent=detail.teacherSessionFeedback.noteText;box.append(h,p);root.append(box);}
 if(detail.testResult){const box=document.createElement('section');box.className='studentAnswerReview';const h=document.createElement('h2');h.textContent=detail.testResult.title||'Kết quả Test';box.append(h);
  for(const skill of ['listening','reading','writing']){const value=detail.testResult[skill];if(!value)continue;const p=document.createElement('p');p.textContent=skill==='writing'?'Writing: '+(value.status==='ready'?value.score:value.status==='pending'?'đã nộp, đang chờ điểm':'chưa có bài'):skill[0].toUpperCase()+skill.slice(1)+': '+value.correct+'/'+value.total;box.append(p);}root.append(box);}
 if(detail.testCoverage==='temporarily_unavailable'){const p=document.createElement('p');p.textContent='Chưa đọc được kết quả Test; có thể thử lại.';root.append(p);}
 if(detail.attendanceStatus||detail.portalSync){const p=document.createElement('p');p.className='reviewPerson';p.textContent=(['self_confirmed','teacher_confirmed'].includes(detail.attendanceStatus)?'Đã xác nhận điểm danh trong Progress Log. ':'Progress Log hiện chưa xác nhận. ')
  +(detail.portalSync?.status==='complete'?'Luồng Portal đã xử lý; kết quả cần đối chiếu trên Portal.':detail.portalSync?.status==='review_required'?'Portal cần giảng viên kiểm tra.':['queued','processing','retry_wait'].includes(detail.portalSync?.status)?'Yêu cầu điểm danh đang chờ đồng bộ sang Portal.':detail.portalSync?.status==='failed'?'Đồng bộ Portal chưa thành công.':'Chưa có trạng thái Portal để đối chiếu.');root.append(p);}
}
