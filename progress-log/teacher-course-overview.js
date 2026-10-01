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
function cellButton(student,cell,onOpen) {
  const button=text('button',labels[cell.status]||'Chưa xác nhận','overview-cell '+cell.status);
  button.type='button';
  button.setAttribute('aria-label',student.name+' · Buổi '+cell.sessionNumber+' · '+button.textContent);
  button.addEventListener('click',()=>onOpen(student,cell));
  if (cell.portalSync) {
    const portal=text('small',cell.portalSync.status==='complete'
      ?'Portal: chờ bằng chứng đọc lại':cell.portalSync.status==='queued'||cell.portalSync.status==='processing'
        ?'Portal: đang đồng bộ':'Portal: cần kiểm tra');
    button.append(portal);
  }
  return button;
}
export function renderCourseOverview(root,overview,{filter='',onOpen}) {
  const students=overview.students.filter(s=>!filter||s.cells.some(c=>c.status===filter));
  const table=document.createElement('table');table.className='overview-table';
  const head=document.createElement('thead'),headRow=document.createElement('tr');
  headRow.append(text('th','Học viên'));
  for (const session of overview.sessions) {
    const cell=text('th','Buổi '+session.sessionNumber+(session.sessionKind==='test'?' · Test':''));
    cell.append(text('small',dateLabel(session.sessionDate)));headRow.append(cell);
  }
  head.append(headRow);table.append(head);
  const body=document.createElement('tbody');
  for (const student of students) {
    const row=document.createElement('tr');
    row.append(text('th',student.name+(student.discriminator?' · '+student.discriminator:'')
      +(student.current?'':' · roster lịch sử')));
    for (const cell of student.cells) {
      const td=document.createElement('td');td.append(cellButton(student,cell,onOpen));row.append(td);
    }
    body.append(row);
  }
  table.append(body);
  const scroll=document.createElement('div');scroll.className='overview-table-scroll';scroll.tabIndex=0;scroll.append(table);
  const mobile=document.createElement('div');mobile.className='overview-mobile-list';
  for (const student of students) {
    const card=document.createElement('details');card.append(text('summary',student.name+(student.discriminator?' · '+student.discriminator:'')+' · '+student.completeCount+' phiếu hoàn tất'));
    for (const [index,cell] of student.cells.entries()) {
      const row=document.createElement('div');row.className='overview-mobile-session';
      row.append(text('b','Buổi '+cell.sessionNumber+' · '+dateLabel(overview.sessions[index].sessionDate)),cellButton(student,cell,onOpen));
      card.append(row);
    }
    mobile.append(card);
  }
  root.replaceChildren(...(students.length?[scroll,mobile]:[text('p','Chưa có học viên phù hợp bộ lọc.')]));
}

export function renderQuestionAnalytics(root,analytics,{onStudent}) {
  const cards=analytics.items.map(item=>{
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
  root.replaceChildren(...cards);
}

export function renderSessionDetail(root,detail) {
  const content=[text('h2',detail.student.name+' · Buổi '+detail.sessionNumber)];
  content.push(text('p',labels[detail.status]||'Dữ liệu hiện có','muted'));
  if (detail.testResult) {
    const result=detail.testResult;content.push(text('h3',result.title));
    for(const skill of ['listening','reading']) if(result[skill]) content.push(text('p',skill==='listening'?'Listening: '+result[skill].correct+'/'+result[skill].total:'Reading: '+result[skill].correct+'/'+result[skill].total));
    if(result.writing) content.push(text('p',result.writing.status==='ready'?'Writing: '+result.writing.score
      :result.writing.status==='pending'?'Writing: đã nộp, đang chờ điểm':'Writing: chưa có bài nộp'));
  }
  if (detail.testCoverage==='temporarily_unavailable') content.push(text('p','Chưa đọc được kết quả Test; có thể thử lại.','muted'));
  if (detail.teacherSessionFeedback) content.push(text('p','Nhận xét của giảng viên: '+detail.teacherSessionFeedback.noteText));
  for(const item of detail.definition?.blocks?.flatMap(block=>block.items)||[]) {
    const config=item.interactionConfig||{},selection=detail.responses?.[config.visibleWhenItemVersionId];
    if (config.visibleWhenItemVersionId&&!(Array.isArray(selection)?selection.includes(config.visibleWhenValue):selection===config.visibleWhenValue)) continue;
    const value=detail.responses?.[item.itemVersionId];
    const choice=item.options?.find(o=>o.id===value);
    const answer=choice?.label||(Array.isArray(value)?value.map(v=>item.options?.find(o=>o.id===v)?.label||String(v)).join(' · ')
      :value&&typeof value==='object'?'Tự khai: '+value.correct+'/'+value.total:String(value??'').trim()||'Chưa trả lời');
    const article=document.createElement('article');article.append(text('b',item.prompt),text('p',answer));
    const result=detail.gradingItems?.find(g=>g.itemVersionId===item.itemVersionId);
    if(result) article.append(text('small',{correct:'Đúng',incorrect:'Sai',pending:'Đang chờ chấm',manual_review:'Cần kiểm tra',ungraded:'Chưa chấm đúng/sai'}[result.verdict]||'Chưa có điểm'));
    content.push(article);
  }
  root.replaceChildren(...content);
}
