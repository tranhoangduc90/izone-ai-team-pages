// Đọc aggregate hiện hành đã kiểm quyền; hiển thị đúng/sai cơ bản của cả lớp, không chấm lại/AI.
import {summarizeClass,percent,sessionLabel} from './course-analytics.js';
import {sessionHeading} from './session-presentation.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const heading=(course,n)=>sessionHeading(course.overview.sessions.find(s=>s.sessionNumber===n),course.assignments.find(a=>a.sessionNumber===n));
export function renderClassAnalytics(root,course,{onOpen,onSummary}){
 const data=summarizeClass(course);root.classList.add('referenceRegion');
 root.innerHTML='<div class="teacherMetrics">'+[['Bài nộp hiện hành',data.totals.submitted],['Câu trả lời đúng',data.totals.correct],['Câu trả lời sai',data.totals.incorrect],['Tỷ lệ đúng',data.graded?percent(data.totals.correct/data.graded):'—']].map(([label,value])=>'<article class="teacherMetric"><small>'+label+'</small><strong>'+value+'</strong></article>').join('')+'</div>'
 +'<section class="previewAnalysis"><div class="previewAnalysisHeader"><div><p class="studentPortalEyebrow">PHÂN TÍCH TỪ BÀI ĐÃ CÓ</p><h2>Câu có nhiều học viên sai nhất</h2></div><span class="classInsightCount">'+data.questions.filter(q=>q.counts.incorrect).length+' câu có trả lời sai</span></div><p class="previewMuted">Chỉ tính câu có kết quả chấm khách quan; câu mở, tự khai và câu ẩn được tách riêng.</p><div class="classInsightList">'
 +data.questions.filter(q=>q.counts.incorrect).map(q=>'<article class="classInsightItem"><small>'+esc(heading(course,q.sessionNumber))+' · Câu '+esc(q.position)+'</small><h3>'+esc(q.prompt)+'</h3><p>'+q.counts.incorrect+'/'+q.counts.graded+' học viên đã chấm trả lời sai</p><div class="previewErrorBar"><i style="width:'+Math.round(q.counts.incorrect/q.counts.graded*100)+'%"></i></div><div class="insightStudents">'+q.students.filter(p=>p.verdict==='incorrect').map(p=>'<button data-student="'+esc(p.studentRef)+'" data-session="'+q.sessionNumber+'">'+esc(p.name)+'</button>').join('')+'</div></article>').join('')+'</div>'+(data.questions.some(q=>q.counts.incorrect)?'':'<p>Chưa có câu trả lời sai đã chấm trong các phiếu đang đọc.</p>')+'</section>'
 +'<section class="previewTablePanel"><p class="studentPortalEyebrow">TỪNG HỌC VIÊN</p><h2>Đúng và sai từ các Progress Log đã có</h2><p class="previewMuted">Một bài hiện hành cho mỗi học viên trong mỗi phiếu. Thiếu phiếu so với kế hoạch khóa học là bình thường.</p><div class="previewScroll"><table class="previewTable"><thead><tr><th>Học viên</th><th>Đã nộp</th><th>Đúng</th><th>Sai</th><th>Chờ chấm / không chấm</th></tr></thead><tbody>'+data.students.map(p=>'<tr><td><button data-summary="'+esc(p.studentRef)+'">'+esc(p.name+(p.discriminator?' · '+p.discriminator:''))+'</button></td><td>'+p.submitted+'</td><td class="previewCorrect">'+p.correct+'</td><td class="previewIncorrect">'+p.incorrect+'</td><td>'+(p.pending+p.manual+p.ungraded)+'</td></tr>').join('')+'</tbody></table></div></section>';
 for(const panel of root.querySelectorAll('.previewAnalysis,.previewTablePanel')){
  const disclosure=document.createElement('details');disclosure.className='comment-disclosure';const summary=document.createElement('summary');
  const header=panel.querySelector('.previewAnalysisHeader');
  if(header)summary.append(header);else summary.append(panel.querySelector('.studentPortalEyebrow'),panel.querySelector('h2'));
  disclosure.append(summary,...panel.childNodes);panel.append(disclosure);
 }
 root.querySelectorAll('[data-session]').forEach(b=>b.addEventListener('click',()=>onOpen(b.dataset.student,Number(b.dataset.session))));
 root.querySelectorAll('[data-summary]').forEach(b=>b.addEventListener('click',()=>onSummary(data.students.find(p=>p.studentRef===b.dataset.summary))));
}
export function renderStudentClassSummary(root,course,person,{onOpen}){
 root.classList.add('referenceRegion');const forms=course.assignments;
 root.innerHTML='<h2>'+esc(person.name)+'</h2><p>'+person.correct+' câu đúng · '+person.incorrect+' câu sai trong '+person.graded+' câu đã chấm.</p><div class="previewScroll"><table class="previewTable"><thead><tr><th>Buổi học</th><th>Tình trạng</th><th>Đúng</th><th>Sai</th></tr></thead><tbody>'+forms.map(form=>{
  const cell=person.cells.find(c=>c.assignmentId===form.id),values=form.analytics.items.filter(i=>i.objective).flatMap(i=>i.students.filter(s=>s.studentRef===person.studentRef));
  return '<tr><td><button data-session="'+form.sessionNumber+'">'+esc(heading(course,form.sessionNumber))+'</button></td><td>'+esc(sessionLabel(cell||{status:'not_assigned'}))+'</td><td>'+values.filter(v=>v.verdict==='correct').length+'</td><td>'+values.filter(v=>v.verdict==='incorrect').length+'</td></tr>';
 }).join('')+'</tbody></table></div>';
 root.querySelectorAll('[data-session]').forEach(b=>b.addEventListener('click',()=>onOpen(person.studentRef,Number(b.dataset.session))));
}
