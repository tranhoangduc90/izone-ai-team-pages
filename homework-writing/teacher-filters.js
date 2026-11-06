import { teacherQueueHtml } from './views.js';
import { assignmentStatus, statusNames } from './assignment-status.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const normalized = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
const classLabel = id => ({ 'c-01': 'DEMO 1', 'c-02': 'DEMO 2', 'c-03': 'DEMO 3' })[id] || id;

export function setupTeacherFilters(root, { rows, assignments, classIds, state, onOpen }) {
  const search = root.querySelector('#teacher-search'), classes = root.querySelector('#teacher-class');
  const student = root.querySelector('#teacher-student'), lesson = root.querySelector('#teacher-lesson'), status = root.querySelector('#teacher-status');
  const queue = root.querySelector('#teacher-queue');
  const assignmentById = new Map(assignments.map(a => [a.id,a]));
  classes.innerHTML = '<option value="">Tất cả lớp</option>' + [...new Set(classIds || assignments.map(a => a.classId))].sort().map(id => `<option value="${escape(id)}">${escape(classLabel(id))}</option>`).join('');
  const refreshOptions = () => {
    const roster = [...new Map(rows.filter(r => !state.classId || r.class_id === state.classId).map(r => [r.student_id, r])).values()];
    student.innerHTML = '<option value="">Tất cả học viên</option>' + roster.map(r => `<option value="${escape(r.student_id)}">${escape(r.label)}</option>`).join('');
    const lessons = assignments.filter(a => !state.classId || a.classId === state.classId);
    const previousKey = state.assignmentId?.startsWith('lesson:') ? state.assignmentId.slice(7) : assignmentById.get(state.assignmentId)?.lessonKey;
    const choices = state.classId ? lessons : [...new Map(lessons.map(a => [a.lessonKey || a.id, {...a,id:a.lessonKey ? 'lesson:' + a.lessonKey : a.id}])).values()];
    lesson.innerHTML = '<option value="">Tất cả bài</option>' + choices.map(a => `<option value="${escape(a.id)}">${escape(a.title)}</option>`).join('');
    student.value = state.studentId || ''; if (!student.value) state.studentId = '';
    lesson.value = state.assignmentId || '';
    if (!lesson.value && previousKey) lesson.value = choices.find(a => a.lessonKey === previousKey)?.id || '';
    state.assignmentId = lesson.value;
  };
  const apply = () => {
    const query = normalized(state.search).trim();
    const visible = rows.filter(r => (!state.classId || r.class_id === state.classId) && (!state.studentId || r.student_id === state.studentId) && (!state.assignmentId || (state.assignmentId.startsWith('lesson:') ? assignmentById.get(r.assignment_id)?.lessonKey === state.assignmentId.slice(7) : r.assignment_id === state.assignmentId)) && (!state.status || assignmentStatus(r) === state.status) && (!query || normalized(`${r.label} ${r.student_id} ${r.title} ${classLabel(r.class_id)}`).includes(query)));
    queue.innerHTML = teacherQueueHtml(visible, { filtered: rows.length > 0 });
    root.querySelector('#teacher-filter-result').textContent = `Đang hiển thị ${visible.length} / ${rows.length} bài được phân công`;
    for (const key of Object.keys(statusNames)) root.querySelector(`[data-teacher-metric="${key}"]`).textContent = visible.filter(r => assignmentStatus(r) === key).length;
  };
  search.value = state.search || ''; classes.value = state.classId || ''; if (!classes.value) state.classId = '';
  status.value = state.status || ''; refreshOptions(); apply();
  search.oninput = () => { state.search = search.value; apply(); };
  classes.onchange = () => { state.classId = classes.value; refreshOptions(); apply(); };
  student.onchange = () => { state.studentId = student.value; apply(); };
  lesson.onchange = () => { state.assignmentId = lesson.value; apply(); };
  status.onchange = () => { state.status = status.value; apply(); };
  root.querySelector('#teacher-clear').onclick = () => { Object.assign(state, { search: '', classId: '', studentId: '', assignmentId: '', status: '' }); search.value = ''; classes.value = ''; status.value = ''; refreshOptions(); apply(); };
  queue.onclick = event => { const button = event.target.closest('[data-review]'); if (button) onOpen(button.dataset.review); };
}
