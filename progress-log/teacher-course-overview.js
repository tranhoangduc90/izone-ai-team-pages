import {contentTitle,sessionHeading} from './session-presentation.js';
import {renderSessionReview} from './session-review.js?rev=20261007-comments';
import {commentPanel} from './session-comments.js?rev=20261007-comments';
// Nhận DTO đã kiểm quyền; tạo bảng lớp và thống kê câu bằng DOM an toàn.
// Không suy điểm danh từ ô trống; lỗi đọc được caller hiện ở vùng trạng thái.
const labels={complete:'Đã nộp đủ',incomplete:'Nộp thiếu',not_submitted:'Chưa nộp',
  no_assignment:'Chưa có phiếu',not_assigned:'Chưa được gán phiếu',test_pending:'Test · chưa có kết quả',
  test_result:'Đã có điểm Test',scheduled:'Buổi sắp tới',needs_review:'Cần đối chiếu'};
function text(tag,value,className='') {
  const node=document.createElement(tag);node.textContent=String(value??'');node.className=className;return node;
}
function dateLabel(value) {
  if (!value) return 'Chưa xác nhận ngày';
  const [year,month,day]=value.split('-');
  const weekday=new Date(Date.UTC(Number(year),Number(month)-1,Number(day))).getUTCDay();
  return (weekday?'T'+(weekday+1):'CN')+' '+day+'/'+month+'/'+year;
}
function cellButton(student,cell,onOpen,session={sessionNumber:cell.sessionNumber}) {
  const button=text('button',labels[cell.status]||'Chưa xác nhận','overview-cell '+cell.status);
  button.type='button';
  button.setAttribute('aria-label',student.name+' · '+sessionHeading(session,session.assignments?.[0])+' · '+button.textContent);
  button.addEventListener('click',()=>onOpen(student,cell));
  return button;
}
export function renderCourseOverview(root,overview,{filter='',onOpen,onComment,onJourney}) {
  root.classList.add('referenceRegion');
  const students=overview.students.filter(s=>!filter||s.cells.some(c=>c.status===filter));
  const table=document.createElement('table');table.className='overview-table';
  const head=document.createElement('thead'),headRow=document.createElement('tr');
  headRow.append(text('th','Học viên'));
  for (const session of overview.sessions) {
    const cell=text('th',sessionHeading(session,session.assignments?.[0]));
    cell.append(text('small',dateLabel(session.sessionDate)));headRow.append(cell);
  }
  head.append(headRow);table.append(head);
  const body=document.createElement('tbody');
  for (const student of students) {
    const row=document.createElement('tr');
    const name=text('th',student.name+(student.discriminator?' · '+student.discriminator:'')+(student.current?'':' · roster lịch sử'));
    if(onJourney){const button=text('button','Hành trình riêng ↗','mini-action');button.type='button';button.addEventListener('click',()=>onJourney(student));name.append(button);}row.append(name);
    for (const cell of student.cells) {
      const td=document.createElement('td');td.append(cellButton(student,cell,onOpen,overview.sessions.find(s=>s.sessionNumber===cell.sessionNumber)));
      const preview=commentPanel(cell.sessionComment,{compact:true});if(preview)td.append(preview);
      if(onComment){const button=text('button',preview?'Nhận xét':'Thêm nhận xét','mini-action');button.type='button';button.addEventListener('click',()=>onComment(student,cell));td.append(button);}row.append(td);
    }
    body.append(row);
  }
  table.append(body);
  const scroll=document.createElement('div');scroll.className='overview-table-scroll';scroll.tabIndex=0;scroll.append(table);
  const mobile=document.createElement('div');mobile.className='overview-mobile-list';
  for (const student of students) {
    const card=document.createElement('details');card.append(text('summary',student.name+(student.discriminator?' · '+student.discriminator:'')+' · '+student.completeCount+' phiếu hoàn tất'));
    if(onJourney){const button=text('button','Hành trình riêng ↗','mini-action');button.type='button';button.addEventListener('click',()=>onJourney(student));card.append(button);}
    for (const [index,cell] of student.cells.entries()) {
      const row=document.createElement('div');row.className='overview-mobile-session';
      row.append(text('b',sessionHeading(overview.sessions[index],overview.sessions[index].assignments?.[0])+' · '+dateLabel(overview.sessions[index].sessionDate)),cellButton(student,cell,onOpen,overview.sessions[index]));
      const preview=commentPanel(cell.sessionComment,{compact:true});if(preview)row.append(preview);
      if(onComment){const button=text('button',preview?'Nhận xét':'Thêm nhận xét','mini-action');button.type='button';button.addEventListener('click',()=>onComment(student,cell));row.append(button);}
      card.append(row);
    }
    mobile.append(card);
  }
  root.replaceChildren(...(students.length?[scroll,mobile]:[text('p','Chưa có học viên phù hợp bộ lọc.')]));
}

export function renderQuestionAnalytics(root,analytics,{onStudent}) {
  root.classList.add('referenceRegion');
  const cards=[...analytics.items].sort((a,b)=>(b.counts.incorrect||0)-(a.counts.incorrect||0)).map(item=>{
    const card=document.createElement('details');card.className='analytics-question';
    const summary=text('summary','Câu '+item.position+'. '+item.prompt);
    const counts=item.counts;
    summary.append(text('small',item.objective
      ?counts.incorrect+'/'+counts.graded+' học viên đã chấm chọn sai · '+counts.pending+' chờ chấm · '+counts.manual+' cần chấm/kiểm tra'
      :counts.answered+'/'+counts.visible+' đã trả lời · chưa chấm đúng/sai'));
    card.append(summary,text('p','Phạm vi: '+counts.roster+' trong roster; '+counts.submitted+' nộp cuối; '
      +counts.hidden+' không hiện câu; '+counts.unanswered+' để trống.','muted'));
    if (!item.objective&&item.choices.length) card.append(text('p','Các lựa chọn dưới đây là lời tự khai của học viên, không phải kết luận lỗi.','muted'));
    for (const choice of item.choices.filter(c=>c.count)) {
      card.append(text('p',choice.label+' · '+choice.count+' học viên chọn'+(item.objective?' · '+choice.incorrect+' chọn sai':'')));
    }
    for (const student of item.students) {
      const button=text('button',student.name+(student.discriminator?' · '+student.discriminator:'')+' · '+({correct:'Đúng',incorrect:'Sai',pending:'Chờ chấm',manual_review:'Cần kiểm tra',ungraded:'Chưa chấm đúng/sai'}[student.verdict]||student.verdict),'button text-button');
      button.type='button';button.addEventListener('click',()=>onStudent(student));card.append(button);
    }
    return card;
  });
  const scores=new Map();
  for(const item of analytics.items) for(const student of item.students) {
    if(!scores.has(student.studentRef)) scores.set(student.studentRef,{...student,correct:0,incorrect:0,ungraded:0});
    const total=scores.get(student.studentRef);
    if(item.objective&&['correct','incorrect'].includes(student.verdict))total[student.verdict]++;
    else total.ungraded++;
  }
  const correct=analytics.items.reduce((n,i)=>n+(i.objective?i.counts.correct:0),0),incorrect=analytics.items.reduce((n,i)=>n+(i.objective?i.counts.incorrect:0),0);
  const summary=document.createElement('div');summary.className='basicAnalyticsSummary';
  for(const [label,value] of [['Bài nộp hiện hành',analytics.submittedCount],['Câu trả lời đúng',correct],['Câu trả lời sai',incorrect]]){
    const card=document.createElement('article');card.append(text('small',label),text('strong',value));summary.append(card);
  }
  const people=document.createElement('section');people.className='basicStudentScores';people.append(text('h3','Đúng và sai của từng học viên'));
  const table=document.createElement('table'),head=document.createElement('tr');for(const label of ['Học viên','Đúng','Sai','Chưa chấm / không áp dụng'])head.append(text('th',label));
  const thead=document.createElement('thead');thead.append(head);table.append(thead);const tbody=document.createElement('tbody');
  for(const person of scores.values()){
    const row=document.createElement('tr'),name=document.createElement('td'),button=text('button',person.name+(person.discriminator?' · '+person.discriminator:''),'button text-button');
    button.type='button';button.addEventListener('click',()=>onStudent(person));name.append(button);row.append(name);
    for(const value of [person.correct,person.incorrect,person.ungraded])row.append(text('td',value));tbody.append(row);
  }
  table.append(tbody);people.append(table);
  root.replaceChildren(summary,people,text('h3','Câu có nhiều học viên sai nhất'),text('p','Xếp theo số câu trả lời sai đã chấm; câu mở và điểm tự khai không tính đúng/sai.','muted'),...cards);
}

export function renderSessionDetail(root,detail,options={}) {
  renderSessionReview(root,detail,options);
}
