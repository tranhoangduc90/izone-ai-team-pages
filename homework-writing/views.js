import { assignmentStatus, lesson3Status, lesson3StatusNames, statusNames, statusLabel, statusColor, statusDetail } from './assignment-status.js';
import {feedbackBlockHtml,overallFeedback} from './feedback-format.js';
import {alignmentPanelHtml} from './handout-alignment.js';
import {handoutLinkHtml,handoutReadOnlyHtml} from './handout-view.js';
// Lớp trình bày thuần HTML. Quyền, phiên bản và thao tác ghi vẫn do app.js/API quản lý.
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const date = value => value ? new Date(Number(value)).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '—';
const className = id => ({ 'c-01': 'DEMO 1', 'c-02': 'DEMO 2', 'c-03': 'DEMO 3' })[id] || id || 'Chưa rõ lớp';
export const accountIdentity = person => person.role === 'student' ? `${person.classLabel||className(person.classId)} - ${person.label}` : person.role === 'teacher' ? 'GV. ' + person.label.replace(/^(?:GV\.?|Giảng viên)\s+/i, '') : person.label;
const prompt = a => `<div class="question-text" lang="en">${esc(a.question)}</div>${a.image ? `<img class="task-image" src="${esc(a.image.startsWith('/assets/')?new URL('.'+a.image,import.meta.url).href:a.image)}" alt="Dữ liệu của đề bài Task 1">` : ''}`;
const meta = text => `<p class="context-line">${text}</p>`;

export function loginViewHtml() {
  return `<div class="login-layout compact-login"><section class="card login-card"><h1>Đăng nhập</h1>
    <label class="field"><span>Vai trò</span><select id="role-select"><option value="student">Học viên</option><option value="teacher">Giảng viên</option><option value="operator">Vận hành</option></select></label>
    <label class="field" id="class-field"><span>Lớp học</span><select id="class-select"></select></label>
    <label class="field" id="profile-field"><span id="profile-label">Tên học viên</span><select id="profile" disabled><option value="">Chọn tên học viên</option></select></label>
    <button id="login" class="primary" disabled>Đăng nhập</button><div id="login-error" role="alert"></div>
    <p class="local-note">Đăng nhập thử trên bản local. Chưa phải đăng nhập thật.</p>
  </section></div>`;
}

export function studentLessonsHtml(rows, {filtered=false,compactStatus=false} = {}) {
  const timestamp = value => value ? new Date(Number(value)).toLocaleString('vi-VN', {timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : 'Chưa có thời gian giao';
  return rows.length ? rows.map(row => `<article class="lesson-row" data-home-assignment="${esc(row.id)}"><div class="lesson-information"><h3>${esc(row.title)}</h3><p>Giao lúc <time datetime="${row.assignedAt ? new Date(Number(row.assignedAt)).toISOString() : ''}">${esc(timestamp(row.assignedAt))}</time></p></div><div class="assignment-state">${compactStatus?lesson3Badge(lesson3Status(row)):`<span class="badge ${statusColor(row)}">${statusLabel(row)}</span>${statusDetail(row) ? `<small>${esc(statusDetail(row))}</small>` : ''}`}</div><button data-open-lesson="${esc(row.id)}" ${['returned', 'revised', 'not_submitted'].includes(assignmentStatus(row)) ? 'class="primary"' : ''}>${['returned','revised'].includes(assignmentStatus(row)) ? 'Xem nhận xét' : row.status === 'not_started' ? 'Viết bài' : 'Mở bài'}</button></article>`).join('') : `<div class="empty-state"><strong>${filtered ? 'Không có bài khớp bộ lọc' : 'Chưa có bài được giao'}</strong><p>${filtered ? 'Đổi điều kiện hoặc xóa bộ lọc để xem lại bài.' : 'Các bài được giao cho lớp của em sẽ xuất hiện tại đây.'}</p></div>`;
}
export function studentHomeHtml(rows, me, {compactStatus=false} = {}) {
  return `<div class="page-heading"><div><h1>Homework Writing</h1></div><button id="refresh-home" class="quiet">Cập nhật</button></div>
  <section class="student-home-controls" aria-label="Tìm và lọc bài của em">
    <label class="field"><span>Tìm bài</span><input id="student-search" type="search" placeholder="Nhập tên bài hoặc chủ đề…"></label>
    <div class="teacher-filter-grid student-filter-grid">
      <label class="field"><span>Giao từ ngày</span><input id="student-date-from" type="date"></label>
      <label class="field"><span>Đến ngày</span><input id="student-date-to" type="date"></label>
      <label class="field"><span>Bài học</span><select id="student-lesson"><option value="">Tất cả bài</option>${rows.map(row=>`<option value="${esc(row.id)}">${esc(row.title)}</option>`).join('')}</select></label>
      <label class="field"><span>Trạng thái</span><select id="student-status"><option value="">Tất cả trạng thái</option>${Object.entries(compactStatus?lesson3StatusNames:statusNames).map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></label>
    </div>
    <p id="student-filter-error" class="error-text" role="alert"></p>
    <div class="teacher-filter-footer"><p id="student-filter-result" role="status"></p><button id="student-clear" class="text-button">Xóa bộ lọc</button></div>
  </section>
  <section class="card student-lessons"><h2>Bài được giao</h2><div id="student-lesson-list">${studentLessonsHtml(rows,{compactStatus})}</div></section>`;
}

function publicationHistoryHtml(data, includeLatest=false){
  const rows=data.publicationHistory||[];if(rows.length<(includeLatest?1:2))return '';
  return '<details class="history-panel block"><summary>Lịch sử trả bài · '+rows.length+' bản</summary><label class="field"><span>Bản nhận xét đã trả</span><select id="publication-history"><option value="">Chọn bản đã trả</option>'+rows.map(p=>'<option value="'+esc(p.id)+'">Bản '+p.publication_version+' · '+date(p.created_ms)+'</option>').join('')+'</select></label><div id="publication-history-content"></div></details>';
}
const compactLessonTitle = title => title.replace(/ · Viết mở bài$/u,'');
const lesson3Badge = (status,id='') => status
  ? `<span ${id?`id="${id}"`:''} class="badge ${status==='returned'?'success':'attention'}">${lesson3StatusNames[status]}</span>`
  : '';
export function studentViewHtml({ me, model, assignments, isLocked, feedback, delivery, compactStatus=false }) {
  const { state, text } = model, a = state.assignment;
  const introduction=a.writingPart==='introduction';
  const saveLabel = model.backupError ? 'Chưa lưu được dự phòng trên thiết bị' : model.text !== model.lastSavedText ? 'Đã khôi phục bản trên thiết bị · chưa đồng bộ' : model.baseRevision ? 'Đã lưu nháp trên hệ thống · bản ' + model.baseRevision : 'Chưa có bản lưu';
  const status = state.publication?'returned':lesson3Status(state.submission);
  return `${compactStatus?'':'<button id="student-home" class="text-button back">← Bài được giao</button>'}<div class="page-heading${compactStatus?' compact-lesson-heading':''}"><div><h1>${esc(compactStatus?compactLessonTitle(a.title):a.title)}</h1></div><div class="heading-tools">${compactStatus?lesson3Badge(status,'processing-status'):''}<button id="refresh" class="quiet">Cập nhật trạng thái</button></div></div>


    <div class="student-workspace-tools"><button type="button" id="toggle-handout" aria-expanded="false" aria-controls="handout-preview">Xem handout Writing</button>${handoutLinkHtml({assignmentId:a.id})}${state.publication ? '<button type="button" id="show-feedback" class="quiet" aria-pressed="true">Nhận xét đã trả</button>' : ''}</div>
    <div class="student-layout ${state.publication ? 'has-feedback' : ''}">
      <aside class="study-context" aria-label="Handout và phản hồi" ${state.publication ? '' : 'hidden'}><section id="handout-preview" class="handout-preview" hidden></section>${state.publication ? `<section class="feedback-section" id="approved-feedback" tabindex="-1"><header class="feedback-heading"><h2>Nhận xét đã duyệt</h2>${meta(`Bản ${state.publication.publication_version||state.publication.review_version} · ${date(state.publication.created_ms)}`)}</header><a class="mobile-jump" href="#essay">Đến ô viết bản sửa ↓</a>${feedback}${publicationHistoryHtml(state)}<details class="block original-disclosure"><summary>Đọc toàn bộ bài gốc đã nộp</summary><p class="feedback-text" lang="en">${esc(state.submission.text)}</p></details></section>` : ''}</aside>
      <section class="card editor-card">${compactStatus?'':`<div class="editor-head"><div><h2>${esc(a.title)}</h2></div><span id="processing-status" class="badge ${statusColor(state.submission)}">${statusLabel(state.submission)}</span></div>`}
        ${!compactStatus&&state.submission?.status==='grading_failed'?'<section class="error-panel grading-failure" role="alert"><strong>Chấm bài đang gặp lỗi</strong><p>Bài của em đã được lưu. Cần người phụ trách kiểm tra để tiếp tục chấm; em không cần nộp lại.</p></section>':''}
        <section class="prompt-disclosure writing-prompt"><h2>Đề bài</h2>${prompt(a)}</section>
        ${state.publication ? `${compactStatus&&isLocked&&state.revision?'':`<p class="revision-hint">${isLocked&&state.revision ? 'Bản sửa đã được nhận. Bản này chưa được AI chấm lại hoặc xác nhận đạt.' : 'Đọc nhận xét đã duyệt rồi tự viết bản sửa tại đây. Nộp bản sửa chưa đồng nghĩa bài đã đạt.'}</p>`}<a class="mobile-jump" href="#approved-feedback">↑ Đọc lại nhận xét</a>` : ''}
        <label class="editor-label" for="essay">${model.kind === 'revision' ? 'Bản sửa của em'+(model.revisionRound>1?' · Lượt '+model.revisionRound:'') : introduction?'Phần mở bài của em':'Bài viết bằng tiếng Anh'}<small>${isLocked ? 'Bản đã nhận · chỉ đọc' : 'Em tự diễn đạt ý của mình'}</small></label>
        <textarea id="essay" class="writing-area" lang="en" spellcheck="false" aria-describedby="save-status editor-error" ${isLocked ? 'readonly' : ''} placeholder="Bắt đầu viết tại đây…">${esc(text)}</textarea>
        <div class="editor-status"><span id="save-status">${esc(saveLabel)}</span><span id="word-count">${text.trim() ? text.trim().split(/\s+/).length : 0} từ</span></div>
        <div id="conflict"></div><div id="editor-error" role="alert"></div>${!isLocked?alignmentPanelHtml(model.kind==='revision'?state.revisionHandoutCheck:state.handoutCheck,a.handoutRequired):''}
        ${!isLocked ? `<div class="editor-bottom"><span id="submit-progress" role="status"></span><p class="save-hint">Lưu nháp chưa phải nộp bài.</p><div class="actions"><button id="save">Lưu nháp</button><button id="submit" class="primary">${model.kind === 'revision' ? 'Nộp bản sửa cho GV' : introduction?'Nộp mở bài':'Nộp bài'}</button></div></div><div class="demo-tool"><button id="sample" class="text-button">${introduction?'Điền mở bài mẫu':'Điền bài giả để thử luồng'}</button></div>` : `<section class="notice-panel receipt-panel"><strong>✓ ${model.kind === 'revision' ? 'Đã nhận bản sửa của em' : 'Bài đã được nhận trên hệ thống'}</strong>${compactStatus&&model.kind==='revision'?'':`<p class="receipt">Biên nhận: ${esc(state.revision?.id || state.submission?.id)}</p>`}${compactStatus?'':`<small>${model.kind === 'revision' ? 'GV phụ trách sẽ nhận thông báo mô phỏng.' : 'Bản nộp được giữ nguyên; em có thể quay lại để xem trạng thái.'}</small>`}</section>`}
        ${!compactStatus&&state.submission ? delivery : ''}
      </section></div>`;
}

export function teacherQueueHtml(rows, { filtered = false } = {}) {
  return `<section class="card queue-card"><div class="section-heading"><h2>Danh sách được phân công</h2><span class="muted">${rows.length} bài</span></div>${rows.length ? `<p class="table-hint">Cuộn ngang bảng để xem trạng thái và thao tác →</p><div class="table-scroll" tabindex="0" role="region" aria-label="Bảng dữ liệu, cuộn ngang để xem đủ cột"><table><thead><tr><th>Học viên / bài</th><th>Trạng thái</th><th>Nhận lúc</th><th class="action-cell">Thao tác</th></tr></thead><tbody>${rows.map(r => `<tr data-review-row="${esc(r.id || JSON.stringify([r.class_id,r.assignment_id,r.student_id]))}"><td class="table-link">${esc(r.label)}<small>${esc(className(r.class_id))} · ${esc(r.title)}</small></td><td><span class="badge ${statusColor(r)}">${statusLabel(r)}</span>${statusDetail(r) ? `<small class="status-detail">${esc(statusDetail(r))}</small>` : ''}</td><td class="date-cell">${date(r.created_ms)}</td><td class="action-cell">${r.id ? `<button data-review="${esc(r.id)}">${r.revised ? 'Xem bản sửa' : 'Mở bài'}</button>` : '<span class="muted">Chưa có bài nộp</span>'}</td></tr>`).join('')}</tbody></table></div>` : `<div class="empty-state"><strong>${filtered ? 'Không có bài khớp bộ lọc' : 'Chưa có bài được giao'}</strong><p>${filtered ? 'Đổi từ tìm kiếm hoặc xóa bộ lọc để xem lại danh sách.' : 'Chỉ những bài được phân công cho tài khoản này mới hiện ở đây.'}</p></div>`}</section>`;
}

export function teacherListHtml(rows, me, assignments = []) {
  const classes = [...new Set(assignments.map(a => a.classId))];
  return `<div class="page-heading"><div>${meta(`Giảng viên · ${classes.length ? classes.length + ' lớp được phân công' : esc(className(me.classId))}`)}<h1>Bài học viên</h1><p class="muted">Duyệt phản hồi và đọc bản sửa của những bài được giao.</p></div><button id="refresh-teacher">Cập nhật danh sách</button></div>
    ${reviewFiltersHtml()}<div id="teacher-queue">${teacherQueueHtml(rows)}</div>`;
}

export function docsViewHtml(states, me, events) {
  return `<div class="page-heading"><div>${meta(`Tài liệu mô phỏng · ${esc(className(me.classId))}`)}<h1>Homework trên Docs giả</h1><p class="muted">Mỗi vùng Writing mở đúng bài. Chưa ghi vào Google Docs thật.</p></div><button id="docs-refresh">Cập nhật Docs giả</button></div><section class="card docs-list"><h2>Các bài Writing của em</h2>${states.map(s => {
    const last = s.deliveries.filter(x => x.channel === 'docs' && x.status === 'delivered').at(-1);
    return `<article class="docs-row"><div><h3>${esc(s.assignment.title)}</h3><p><span class="badge ${last?.event === 'returned' ? 'success' : 'neutral'}">${last ? esc(events[last.event]) : 'Docs chưa có cập nhật nhận bài'}</span></p><p class="section-note">${s.submission ? 'Webapp đã nhận bài. Trạng thái Docs có thể cập nhật sau.' : 'Mở bài để viết, lưu nháp và nộp.'}</p></div><button data-open="${esc(s.assignment.id)}">${s.publication ? 'Xem nhận xét và sửa bài' : 'Mở bài Writing'}</button></article>`;
  }).join('')}</section>`;
}

function teacherSourceHtml(data){
  return `<aside class="source-column"><section class="card source-paper">
    <div class="teacher-handout-link">${handoutLinkHtml({submissionId:data.submission.id})}</div>
    <div class="source-version-tabs" data-source-tablist role="tablist" aria-label="Bài viết và handout của học viên">
      <button type="button" id="source-tab-original" role="tab" data-source-version="original" aria-selected="true" aria-controls="source-panel-original">Bài làm gốc</button>
      <button type="button" id="source-tab-revision" role="tab" data-source-version="revision" aria-selected="false" aria-controls="source-panel-revision" tabindex="-1" ${data.revision?'':'disabled title="Học viên chưa nộp bản sửa"'}>Bản sửa${data.revision?'':'<small>Chưa có</small>'}</button>
      <button type="button" id="source-tab-handout" role="tab" data-source-version="handout" aria-selected="false" aria-controls="source-panel-handout" tabindex="-1">Handout Writing</button>
    </div>
    <section class="prompt-disclosure" data-source-prompt><h2>Đề bài</h2>${prompt(data.assignment)}</section>
    <section id="source-panel-original" role="tabpanel" aria-labelledby="source-tab-original" data-source-panel="original">
      <div class="section-heading"><h2>Bài làm</h2><span class="badge neutral">Chỉ đọc</span></div><p class="feedback-text student-original" lang="en">${esc(data.submission.text)}</p><p class="source-note">Nhận lúc ${date(data.submission.created_ms)} · ${data.submission.text.trim().split(/\s+/).length} từ</p>
    </section>
    <section id="source-panel-revision" role="tabpanel" aria-labelledby="source-tab-revision" data-source-panel="revision" hidden>
      ${data.revision?`<div class="section-heading"><h2>Bản sửa của học viên</h2><span class="badge neutral">Chỉ đọc</span></div>${data.revisionHistory?.length>1?`<label class="field"><span>Lượt sửa đã nộp</span><select id="revision-history">${data.revisionHistory.map(r=>`<option value="${esc(r.id)}">Lượt ${r.round_number} · ${date(r.created_ms)}</option>`).join('')}</select></label>`:''}<p class="feedback-text student-revision" lang="en">${esc(data.revision.text)}</p><p class="source-note" id="revision-source-note">Lượt ${data.revision.round_number||1} · Nhận lúc ${date(data.revision.created_ms)} · ${data.revision.text.trim().split(/\s+/).length} từ</p><p class="section-note">Chưa tự chấm lại hoặc xác nhận đạt.</p>`:'<p class="section-note">Học viên chưa nộp bản sửa.</p>'}
    </section>
    <section id="source-panel-handout" role="tabpanel" aria-labelledby="source-tab-handout" data-source-panel="handout" hidden>${handoutReadOnlyHtml()}</section>
  </section></aside>`;
}

export function teacherReviewHtml(data, feedback, editableFeedback = '', { directEdit = false } = {}) {
  const published=data.publication&&!data.editingReview;
  const roundTools=data.features?.revisionRounds&&data.publication&&(!data.editingReview||directEdit)?
    (data.revisionRound?.revision_id?'<button type="button" id="open-revision-round">Mở lại quyền nộp sửa</button>':'<span class="section-note">Đang mở lượt sửa '+(data.revisionRound?.number||1)+'</span>'):'';
  const readOnly=`<section class="card published-review"><div class="section-heading"><h2>Phản hồi đã trả</h2><span class="badge success">Bản ${data.publication?.publication_version||data.publication?.review_version}</span></div><p class="section-note">Học viên đang đọc đúng bản đã duyệt này.</p><div class="actions">${data.features?.publicationHistory?'<button type="button" id="edit-published-review">Chỉnh nhận xét</button>':''}${roundTools}</div>${feedback}</section>`;
  const form=`<section class="card review-form"><div class="review-toolbar"><div class="section-heading"><h2>Duyệt phản hồi</h2>${directEdit&&data.publication?'<span class="badge success">Đã trả bản '+data.publication.publication_version+'</span>':'<span class="badge attention">HV chưa thấy</span>'}</div><div class="review-submit"><p id="review-status" class="section-note">${data.publication?'HV vẫn xem bản đã trả '+data.publication.publication_version+(directEdit?'. Chỉ cập nhật khi GV trả bài.':'. Chỉnh sửa này chưa được công bố.'):'Đang xem bản nhận xét '+data.review?.version+' · chưa trả cho HV.'}</p><div class="actions"><button id="save-review">Lưu chỉnh sửa</button><button id="approve" class="primary">Lưu và trả bài</button>${data.publication&&!directEdit?'<button type="button" id="cancel-published-edit">Xem bản đã trả</button>':''}${directEdit?roundTools:''}</div></div></div>${editableFeedback}${!directEdit?'<section class="teacher-comments-editor"><button type="button" id="add-teacher-comment">+ Thêm nhận xét</button><div id="teacher-comments-list"></div></section>':''}<div id="review-error" role="alert"></div></section>`;
  return `${directEdit?'':'<button id="back-teacher" class="text-button back">← Danh sách bài</button>'}<div class="page-heading${directEdit?' compact-lesson-heading':''}"><div><h1>${esc(directEdit?compactLessonTitle(data.assignment.title):data.assignment.title)}</h1></div><span class="badge ${statusColor(data.submission)}">${statusLabel(data.submission)}</span></div>
    <div class="review-layout">${teacherSourceHtml(data)}<div class="review-column">${data.review?(published?readOnly:form):(data.submission.status==='grading_failed'?'<section class="card grading-failure" role="alert"><h2>Chấm bài đang gặp lỗi</h2><p>Bài gốc đã được lưu. Cần phục hồi đúng bước bị lỗi trước khi có phản hồi để duyệt.</p><button id="reload-review">Cập nhật bài</button></section>':'<section class="card"><h2>Đang chờ kết quả AI</h2><p>Bộ chấm chưa trả kết quả hoặc có bước cần phục hồi. Bài gốc vẫn được giữ.</p><button id="reload-review">Cập nhật bài</button></section>')}
    ${publicationHistoryHtml(data,directEdit)}${data.review?.history?.length?`<details class="history-panel block"><summary>Lịch sử chỉnh sửa · ${data.review.history.length} bản trước</summary>${data.review.history.map(h=>`<h3 class="block">Bản ${h.version}</h3>${feedbackBlockHtml(overallFeedback(h.result.feedback))}`).join('')}</details>`:''}</div></div>`;
}

export function operatorViewHtml(data, events) {
  const stateLabel = { pending: 'Đang chờ',waiting:'Chờ tài liệu hoặc nguồn',blocked:'Cần kiểm tra', processing: 'Đang xử lý', running: 'Đang xử lý', failed: 'Lỗi · cần phục hồi', delivered: 'Đã giao', completed: 'Đã xử lý', succeeded: 'Đã xử lý', leased: 'Đang xử lý', done: 'Đã xử lý' };
  const personJob=type=>['jobs','handout-checks','cta-registrations'].includes(type);
  const table = (rows, type) => rows.length ? `<p class="table-hint">Cuộn ngang bảng để xem trạng thái và thao tác →</p><div class="table-scroll" tabindex="0" role="region" aria-label="Bảng dữ liệu, cuộn ngang để xem đủ cột"><table><thead><tr><th>Bài / bước xử lý</th><th>Trạng thái / lượt</th><th>Lỗi</th><th class="action-cell">Phục hồi</th></tr></thead><tbody>${rows.map(r => `<tr><td class="table-link">${esc(personJob(type) ? r.student_id + ' · ' + r.assignment_id : events[r.event] + ' · ' + r.channel)}<small>${personJob(type) ? 'Bước ' + esc(r.step||r.phase||'') + ' · ' : ''}Bản nộp ${esc(r.submission_id?.slice(0, 8)||r.assignment_id||'')}</small></td><td><span class="badge ${['failed','blocked'].includes(r.status) ? 'error' : ['delivered', 'completed', 'succeeded', 'done'].includes(r.status) ? 'success' : ''}">${esc(stateLabel[r.status] || r.status)}</span><small class="table-meta">${r.attempts} lượt xử lý</small><small class="table-meta">Bắt đầu ${date(r.created_ms)} · ${Math.max(0,Math.round(((data.now||Date.now())-Number(r.created_ms||data.now))/60000))} phút · Thử gần nhất ${date(r.last_attempt_ms||r.updated_ms)}</small></td><td class="error-code">${esc(r.error_code || '—')}</td><td class="action-cell">${r.status === 'failed'||type==='handout-checks'&&r.status==='unavailable'||type==='cta-registrations'&&r.status==='blocked' ? `<button data-retry="${esc(r.id)}" data-type="${type}">Thử lại đúng bước</button>` : '<span class="muted">—</span>'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty-inline">Chưa có công việc trong hàng này.</p>';
  return `<div class="page-heading"><div>${meta('Vận hành · Bản local')}<h1>Hàng xử lý Writing</h1><p class="muted">Theo dõi lỗi và phục hồi đúng bước của bản local.</p></div><button id="ops-refresh">Cập nhật</button></div><div class="queue-summary">${[['Bài đã nhận', data.metrics.submissions], ['Lời gọi AI đã lưu', data.metrics.ai_calls], ['Bản đã trả', data.metrics.publications], ['HV đã sửa', data.metrics.revisions]].map(([name, value]) => `<span><strong>${value}</strong> ${name}</span>`).join('')}</div>
    <section class="card queue-card"><div class="section-heading"><h2>Hàng chấm</h2><span class="badge neutral">${data.jobs.length} công việc</span></div>${table(data.jobs, 'jobs')}</section><section class="card queue-card block"><h2>Kiểm bám handout</h2>${table(data.handoutJobs||[], 'handout-checks')}</section>${data.ctaEnabled||data.ctaRegistrations?.length?`<section class="card queue-card block" id="cta-queue"><h2>Đăng ký link Docs</h2>${table(data.ctaRegistrations||[],'cta-registrations')}</section>`:''}<section class="card queue-card block"><div class="section-heading"><h2>Giao trạng thái và email</h2><span class="badge neutral">${data.deliveries.length} sự kiện</span></div>${table(data.deliveries, 'deliveries')}</section>
    <section class="fault-section block"><h2>Thử lỗi có kiểm soát</h2><p class="section-note">Chỉ áp dụng cho lượt xử lý tiếp theo trong bản giả. Kết quả các bước đã lưu vẫn được giữ.</p><div class="toolbar"><label class="field"><span>Bước thử lỗi</span><select id="fault-name">${['precheck', 'main', 'critic', 'arbiter', 'render', 'docs', 'email', 'docs_ack', 'email_ack'].map(n => `<option>${n}</option>`).join('')}</select></label><label class="field"><span>Số lượt</span><select id="fault-count"><option value="1">Lỗi 1 lượt</option><option value="3">Lỗi 3 lượt</option><option value="0">Tắt lỗi</option></select></label><button id="set-fault">Áp dụng lỗi giả</button></div><p id="fault-feedback" class="section-note" role="status"></p></section><details class="source-note"><summary>Nguồn tham chiếu và giới hạn bản local</summary><p>Source: ${esc(data.source.revision.slice(0, 12))} · Fashion v${data.source.fashionVersion} · ${data.source.routeCount} tuyến. Chưa đối chiếu exact runtime. PGlite không chứng minh quyền PostgreSQL server. Handout/outline chưa triển khai.</p></details>`;
}

function reviewFiltersHtml() {
  return `<section class="teacher-controls" aria-label="Tìm và lọc bài học viên"><label class="field teacher-search-field"><span>Tìm học viên hoặc bài</span><input id="teacher-search" type="search" placeholder="Nhập tên, mã học viên hoặc tên bài…"></label><div class="teacher-filter-grid"><label class="field"><span>Lớp</span><select id="teacher-class"></select></label><label class="field"><span>Học viên</span><select id="teacher-student"></select></label><label class="field"><span>Bài</span><select id="teacher-lesson"></select></label><label class="field"><span>Trạng thái</span><select id="teacher-status"><option value="">Tất cả trạng thái</option>${Object.entries(statusNames).map(([value,label]) => `<option value="${value}">${label}</option>`).join('')}</select></label></div><div class="teacher-filter-footer"><p id="teacher-filter-result" role="status"></p><button id="teacher-clear" class="text-button">Xóa bộ lọc</button></div></section>
    <div class="queue-summary">${Object.entries(statusNames).map(([key,label]) => `<span><strong data-teacher-metric="${key}">0</strong> ${label.toLowerCase()}</span>`).join('')}</div>`;
}

export function operatorLibraryHtml(data) {
  return `<div class="page-heading"><div>${meta('Vận hành · Toàn bộ lớp')}<h1>Tất cả bài học viên</h1><p class="muted">Xem bài và phản hồi ở mọi lớp. GV được phân công thực hiện chỉnh sửa và duyệt.</p></div><div class="heading-tools"><button id="refresh-operator-library">Cập nhật</button><button id="open-ops">Vận hành hệ thống</button></div></div>${reviewFiltersHtml()}<div id="teacher-queue">${teacherQueueHtml(data.submissions)}</div>`;
}

export function operatorReviewHtml(data, feedback, ai) {
  return `<button id="operator-back" class="text-button back">← Tất cả bài học viên</button><div class="page-heading"><div>${meta(`Vận hành · ${esc(className(data.assignment.classId))}`)}<h1>${esc(data.assignment.title)}</h1><p class="muted">${esc(data.student)}</p></div><span class="badge neutral">Chỉ xem</span></div>
  <div class="review-layout"><aside class="source-column"><section class="card"><h2>Bài gốc của học viên</h2><p class="feedback-text" lang="en">${esc(data.submission.text)}</p></section>${data.revision ? `<section class="card block"><h2>Bản sửa của học viên</h2><p class="feedback-text" lang="en">${esc(data.revision.text)}</p></section>` : ''}</aside><div class="review-column"><section class="card"><h2>${data.publication ? 'Phản hồi đã công bố' : 'Phản hồi đang chờ GV duyệt'}</h2>${feedback || '<p>Chưa có kết quả chấm.</p>'}</section>${ai ? `<details class="card block"><summary>Bản AI tham chiếu</summary>${ai}</details>` : ''}${data.review?.history?.length ? `<details class="card block"><summary>Lịch sử phản hồi GV</summary>${data.review.history.map(h => `<h3>Bản ${h.version}</h3>${feedbackBlockHtml(overallFeedback(h.result.feedback))}`).join('')}</details>` : ''}</div></div>`;
}
