// Bảng giảng viên đọc dashboard/live thật. Một cột điểm danh phân biệt nhận bài và ghi Portal.
const node=(tag,text='',className='')=>{const e=document.createElement(tag);e.textContent=text;e.className=className;return e;};
export function attendancePresentation(student){
  const portal=student.portalSync;
  if(portal?.status==='complete'&&portal.readbackAt&&['synced','already_present'].includes(portal.portalStatus)&&!portal.reviewRequired)
    return {label:'Đã điểm danh',detail:'Đã ghi Có mặt và đọc lại trên Portal',kind:'green'};
  const received=Boolean(student.checkpoints?.length||student.submissionId);
  return {label:received?'Đã nhận bài':'Chưa nhận bài',detail:portal?.reviewRequired||portal?.status==='review_required'?'Portal cần đối chiếu':portal?.status==='failed'?'Portal chưa đồng bộ thành công':received?'Đã nhận ở Progress Log · Portal chưa xác nhận':'Chưa có bài nộp ở Progress Log',kind:received?'blue':''};
}
export function renderThuyRoster(root,{dashboard,liveByStudent,mode='progress',query='',filter='all',onQuery,onFilter,onOpen,onAttendance}){
  const searchFocus=root.querySelector('input')===document.activeElement;
  const caret=root.querySelector('input')?.selectionStart;
  const toolbar=node('div','','thuy-roster-tools'),title=node('h2',`${mode==='progress'?'Tiến độ học viên':'Kết quả từng học viên'} · ${dashboard.students.length}`);
  const tools=node('div','','thuy-roster-tools-inner'),input=node('input');input.type='search';input.placeholder='Tìm học viên';input.value=query;input.setAttribute('aria-label','Tìm học viên');
  input.addEventListener('input',()=>onQuery(input.value));
  const select=node('select');select.setAttribute('aria-label','Lọc trạng thái học viên');
  for(const [id,text] of [['all','Tất cả học viên'],['unfinished','Chưa nộp đủ'],['notstarted','Chưa bắt đầu'],['submitted','Đã nộp phiếu']]){const o=node('option',text);o.value=id;select.append(o);}select.value=filter;select.addEventListener('change',()=>onFilter(select.value));
  tools.append(select,input);toolbar.append(title,tools);
  const wrap=node('div','','thuy-roster-scroll');wrap.tabIndex=0;wrap.setAttribute('aria-label','Bảng kết quả học viên, cuộn ngang nếu cần');
  const table=node('table','','thuy-roster'),head=node('tr');
  const items=dashboard.definition.blocks.flatMap(b=>b.items),reportSkills=['listening','reading'].filter(skill=>items.some(i=>i.interactionType==='number_score'&&i.skillCodes?.includes(skill)));
  const columns=mode==='progress'?['Học viên',...dashboard.definition.blocks.map((b,i)=>`Phần ${i+1}`),'Điểm danh','']:
    ['Học viên',...reportSkills.map(s=>(s==='listening'?'Listening':'Reading')+' · Tự báo'),'Quiz','Nhận xét Speaking'];
  for(const label of columns){const h=node('th',label);h.scope='col';head.append(h);}const thead=node('thead');thead.append(head);table.append(thead);
  const tbody=node('tbody');const people=dashboard.students.filter(s=>{
    const live=liveByStudent.get(s.studentRef),started=Boolean(live?.attemptId||s.submissionId||s.checkpoints?.length);
    return s.name.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi'))&&(filter==='all'||filter==='submitted'&&s.submissionId||filter==='unfinished'&&!s.submissionId||filter==='notstarted'&&!started);
  });
  for(const student of people){
    const row=node('tr');row.tabIndex=0;row.dataset.student=student.studentRef;row.setAttribute('aria-label','Xem bài '+student.name);
    const name=node('td',student.name,'person-name');if(student.discriminator)name.append(node('small',student.discriminator));row.append(name);
    const live=liveByStudent.get(student.studentRef);
    if(mode==='results'){
      const responses=live?.submissionId?live.finalResponses:live?.draftResponses||{};
      for(const skill of reportSkills){const reports=items.filter(i=>i.interactionType==='number_score'&&i.skillCodes?.includes(skill)).map(i=>responses?.[i.itemVersionId]).filter(v=>Number.isInteger(v?.correct)&&Number.isInteger(v?.total)&&v.total>0&&v.correct>=0&&v.correct<=v.total);
        row.append(node('td',reports.length?reports.reduce((n,v)=>n+v.correct,0)+' / '+reports.reduce((n,v)=>n+v.total,0):'Chưa có số liệu'));
      }
      const graded=live?.gradingResult?.items?.filter(i=>i.maxScore>0&&['correct','incorrect','partial'].includes(i.verdict))||[];
      row.append(node('td',graded.length?graded.reduce((n,i)=>n+i.scoreEarned,0)+' / '+graded.reduce((n,i)=>n+i.maxScore,0):'Chưa có điểm chấm'));
      const comment=student.sessionComment?.visibility==='visible'?student.sessionComment.noteText:student.teacherSessionFeedback?.noteText;
      const feedback=node('td',comment||'Chưa có nhận xét');feedback.className='thuy-feedback-excerpt';row.append(feedback);
    }else{
    for(const block of dashboard.definition.blocks){
      const submitted=student.checkpoints?.some(c=>c.blockId===block.blockId);
      const writing=block.items.some(i=>{const value=live?.draftResponses?.[i.itemVersionId];return Array.isArray(value)?value.some(v=>String(v||'').trim()):value!==undefined&&String(value).trim();});
      const cell=node('td');cell.append(node('span',submitted?'Đã nộp':writing?'Đang làm':'Chưa bắt đầu',submitted?'badge green':writing?'badge blue':'badge'));row.append(cell);
    }
    const attendance=attendancePresentation(student),cell=node('td');cell.append(node('span',attendance.label,'badge '+attendance.kind));cell.title=attendance.detail;cell.append(node('small',attendance.detail));row.append(cell);
    const actions=node('td'),adjust=node('button','Điều chỉnh','button');adjust.type='button';adjust.addEventListener('click',()=>onAttendance(student));actions.append(adjust);row.append(actions);
    }
    row.addEventListener('click',event=>{if(event.target.closest('button,a,input,select')||window.getSelection()?.toString())return;onOpen(student);});
    row.addEventListener('keydown',event=>{if(event.target===row&&['Enter',' '].includes(event.key)){event.preventDefault();onOpen(student);}});tbody.append(row);
  }
  table.append(tbody);wrap.append(table);const hint=node('p',`Đang hiển thị ${people.length}/${dashboard.students.length} học viên · Cuộn trang để xem các hàng còn lại.`,'thuy-roster-hint');
  root.replaceChildren(toolbar,wrap,hint);
  if(searchFocus){input.focus({preventScroll:true});if(input.type!=='search')input.setSelectionRange(caret,caret);}
}

export function mountThuyTeacherLayout(elements,{onMode,onClass}){
  const workspace=document.querySelector('#teacherWorkspace'),side=document.querySelector('.thuy-side .teacher-tabs');
  const priorLabel=elements.assignmentSelect.closest('label'),priorParts=elements.blockControls.closest('section');
  const context=node('section','','thuy-class-context'),pickers=node('div','','thuy-class-pickers'),classes=node('select');classes.id='thuyClassSelect';classes.setAttribute('aria-label','Chọn lớp');classes.addEventListener('change',()=>onClass(classes.value));
  pickers.append(classes,elements.assignmentSelect);const nav=node('nav','','thuy-management-tabs');nav.setAttribute('aria-label','Quản lý lớp');nav.append(elements.dashboardTab,elements.overviewTab);context.append(pickers,nav);workspace.prepend(context);
  const home=node('button','Các lớp','tab active');home.type='button';home.addEventListener('click',()=>elements.dashboardTab.click());side.prepend(home);elements.createTab.textContent='Kho bài tập';
  const dashboard=elements.dashboardPanel,hero=node('div','','thuy-session-header'),overview=node('section','','thuy-session-overview'),parts=node('section','','thuy-session-parts');
  overview.append(elements.dashboardTitle,elements.teacherSubmissionWindow||document.querySelector('#teacherSubmissionWindow'),document.querySelector('.dashboard-share'));
  parts.append(elements.blockControls);hero.append(overview,parts);dashboard.prepend(hero);
  dashboard.querySelector('.teacherReferenceHero').hidden=true;priorLabel?.remove();priorParts?.remove();
  elements.openClassOverviewButton.hidden=true;
  const tabs=node('nav','','thuy-session-tabs');tabs.setAttribute('aria-label','Tiến độ và kết quả buổi học');
  for(const [id,label] of [['progress','Tiến độ'],['results','Kết quả']]){const button=node('button',label,'button');button.type='button';button.dataset.thuyMode=id;button.setAttribute('aria-pressed',String(id==='progress'));button.addEventListener('click',()=>onMode(id));tabs.append(button);}
  hero.after(tabs);const plan=document.querySelector('#dashboardPlanHost');dashboard.append(plan);
  const analytics=document.querySelector('#classInsightSection');
  analytics.querySelector('.library-heading').hidden=true;
  analytics.querySelector('.teacher-insight-tabs').hidden=true;
  elements.scoresPanel.hidden=true;elements.insightPanel.hidden=true;
  analytics.prepend(elements.questionAnalyticsStatus,elements.questionAnalytics);
  elements.overviewFilter.closest('label').hidden=true;
  const extras=node('details','','thuy-extra-tools');extras.append(node('summary','Thông tin và công cụ của buổi'));extras.append(elements.dashboardSummary,elements.refreshDashboardButton);dashboard.append(extras);
  return {context,classes};
}

export function showThuyDetail(dialog){
  dialog.dataset.thuyGeneration=String(Number(dialog.dataset.thuyGeneration||0)+1);
  const opener=document.activeElement;
  for(const other of document.querySelectorAll('#draftDialog,#journeyDetailDialog'))if(other!==dialog&&other.open)other.close();
  if(!dialog.open)dialog.show();document.body.classList.add('has-thuy-detail');
  dialog.addEventListener('close',()=>{if(!document.querySelector('#draftDialog[open],#journeyDetailDialog[open]')){document.body.classList.remove('has-thuy-detail');if(opener?.isConnected)opener.focus({preventScroll:true});}},{once:true});
}
