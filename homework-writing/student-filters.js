import { studentLessonsHtml } from './views.js';
import { assignmentStatus, lesson3Status } from './assignment-status.js';

const normalized = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase();
export function assignedDay(value) {
  if (!value) return '';
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(Number(value)));
  const get = type => parts.find(p => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function setupStudentFilters(root,{rows,state,onOpen,compactStatus=false}) {
  const fields = {search:'#student-search',from:'#student-date-from',to:'#student-date-to',assignmentId:'#student-lesson',status:'#student-status'};
  const list = root.querySelector('#student-lesson-list');
  const apply = () => {
    const query = normalized(state.search).trim();
    const invalid = state.from && state.to && state.from > state.to;
    root.querySelector('#student-filter-error').textContent = invalid ? 'Ngày kết thúc cần bằng hoặc sau ngày bắt đầu.' : '';
    const visible = rows.filter(row => {
      const day=assignedDay(row.assignedAt);
      return !invalid && (!query || normalized(row.title).includes(query)) && (!state.assignmentId || row.id === state.assignmentId) &&
        (!state.status || (compactStatus?lesson3Status(row):assignmentStatus(row)) === state.status) && (!state.from || day >= state.from) && (!state.to || (day && day <= state.to));
    });
    list.innerHTML=studentLessonsHtml(visible,{filtered:rows.length>0,compactStatus});
    root.querySelector('#student-filter-result').textContent=`Đang hiển thị ${visible.length} / ${rows.length} bài`;
  };
  for(const [key,selector] of Object.entries(fields)) {
    const field=root.querySelector(selector); field.value=state[key] || '';
    if(field.tagName === 'SELECT' && !field.value) state[key]='';
    const update=()=>{state[key]=field.value;apply();};
    field.addEventListener(field.tagName === 'SELECT' ? 'change' : 'input',update);
  }
  root.querySelector('#student-clear').onclick=()=>{for(const [key,selector] of Object.entries(fields)){state[key]='';root.querySelector(selector).value='';}apply();};
  list.onclick=e=>{const button=e.target.closest('[data-open-lesson]');if(button)onOpen(button.dataset.openLesson);};
  apply();
}
