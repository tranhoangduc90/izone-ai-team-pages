// Bảng giảng viên đọc dashboard/live thật. Một cột điểm danh phân biệt nhận bài và ghi Portal.
const node=(tag,text='',className='')=>{const e=document.createElement(tag);e.textContent=text;e.className=className;return e;};
const scrollCues=new Map();
const rosterViews=new WeakMap();
window.addEventListener('scroll',()=>{for(const [root,update]of scrollCues){if(root.isConnected)update();else scrollCues.delete(root);}},{passive:true});
window.addEventListener('resize',()=>{for(const update of scrollCues.values())update();},{passive:true});
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
  const columns=mode==='progress'?['Học viên',...dashboard.definition.blocks.map((b,i)=>`Phần ${i+1}`),'Điểm danh']:
    ['Học viên',...reportSkills.map(s=>(s==='listening'?'Listening':'Reading')+' · Tự báo'),'Quiz','Nhận xét Speaking'];
  for(const label of columns){const h=node('th',label);h.scope='col';head.append(h);}const thead=node('thead');thead.append(head);table.append(thead);
  const tbody=node('tbody');const people=dashboard.students.filter(s=>{
    const live=liveByStudent.get(s.studentRef),started=Boolean(live?.attemptId||s.submissionId||s.checkpoints?.length);
    return s.name.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi'))&&(filter==='all'||filter==='submitted'&&s.submissionId||filter==='unfinished'&&!s.submissionId||filter==='notstarted'&&!started);
  });
  for(const student of people){
    const row=node('tr');row.dataset.student=student.studentRef;row._student=student;row._open=mode==='results'?onOpen:()=>{};
    if(mode==='results'){row.tabIndex=0;row.setAttribute('aria-label','Xem bài '+student.name);}
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
      const feedback=node('td',comment||'Bấm để nhận xét');feedback.className='thuy-feedback-excerpt';row.append(feedback);
    }else{
    for(const block of dashboard.definition.blocks){
      const submitted=student.checkpoints?.some(c=>c.blockId===block.blockId);
      const writing=block.items.some(i=>{const value=live?.draftResponses?.[i.itemVersionId];return Array.isArray(value)?value.some(v=>String(v||'').trim()):value!==undefined&&String(value).trim();});
      const cell=node('td');cell.append(node('span',submitted?'Đã nộp':writing?'Đang làm':'Chưa bắt đầu',submitted?'badge green':writing?'badge blue':'badge'));row.append(cell);
    }
    const attendance=attendancePresentation(student),cell=node('td');cell.append(node('span',attendance.label,'badge '+attendance.kind));cell.title=attendance.detail;row.append(cell);
    }
    row.addEventListener('click',event=>{if(event.target.closest('button,a,input,select')||window.getSelection()?.toString())return;row._open(row._student);});
    row.addEventListener('keydown',event=>{if(event.target===row&&['Enter',' '].includes(event.key)){event.preventDefault();row._open(row._student);}});tbody.append(row);
  }
  table.append(tbody);wrap.append(table);const hint=node('p',`Đang hiển thị ${people.length}/${dashboard.students.length} học viên.`,'thuy-roster-hint');
  const cue=node('button','','button thuy-roster-cue');cue.type='button';const remaining=()=>[...tbody.rows].filter(row=>row.getBoundingClientRect().top>=innerHeight-48);
  cue.addEventListener('click',()=>remaining()[0]?.scrollIntoView({behavior:'smooth',block:'center'}));
  const update=()=>{const count=remaining().length;cue.hidden=!count||root.hidden;cue.textContent=count?'Còn '+count+' học viên phía dưới ↓':'';};
  const layout=JSON.stringify([dashboard.assignmentId,mode,columns]),previous=rosterViews.get(root);
  if(previous?.toolbar.isConnected&&previous.layout===layout){
    // Dữ liệu nền thay đúng hàng; các hàng không đổi giữ node, bôi chọn và vùng đang đọc.
    const oldRows=new Map([...previous.tbody.rows].map(row=>[row.dataset.student,row])),desired=[...tbody.rows];
    for(const [index,next]of desired.entries()){
      const old=oldRows.get(next.dataset.student);oldRows.delete(next.dataset.student);
      const current=old&&old.innerHTML===next.innerHTML?old:next;
      if(old&&current!==old)old.replaceWith(current);
      current._student=next._student;current._open=next._open;
      if(previous.tbody.rows[index]!==current)previous.tbody.insertBefore(current,previous.tbody.rows[index]||null);
    }
    for(const row of oldRows.values())row.remove();
    if(previous.title.textContent!==title.textContent)previous.title.textContent=title.textContent;
    if(previous.input.value!==query)previous.input.value=query;if(previous.select.value!==filter)previous.select.value=filter;
    if(previous.hint.textContent!==hint.textContent)previous.hint.textContent=hint.textContent;
    scrollCues.get(root)?.();return;
  }
  root.replaceChildren(toolbar,wrap,hint,cue);rosterViews.set(root,{layout,toolbar,tbody,title,input,select,hint});scrollCues.set(root,update);update();
  if(searchFocus){input.focus({preventScroll:true});if(input.type!=='search')input.setSelectionRange(caret,caret);}
}

export function mountThuyTeacherLayout(elements,{onMode,onClass,onHome}){
  const workspace=document.querySelector('#teacherWorkspace'),side=document.querySelector('.thuy-side .teacher-tabs');
  const priorLabel=elements.assignmentSelect.closest('label'),priorParts=elements.blockControls.closest('section');
  const context=node('section','','thuy-class-context'),pickers=node('div','','thuy-class-pickers'),classes=node('select');classes.id='thuyClassSelect';classes.setAttribute('aria-label','Chọn lớp');classes.addEventListener('change',()=>onClass(classes.value));
  pickers.append(classes,elements.assignmentSelect);const nav=node('nav','','thuy-management-tabs');nav.setAttribute('aria-label','Quản lý lớp');nav.append(elements.dashboardTab,elements.overviewTab);context.append(pickers,nav);workspace.prepend(context);
  const home=node('button','Quản lý lớp','tab active');home.type='button';home.addEventListener('click',()=>onHome?onHome():elements.dashboardTab.click());side.prepend(home);elements.createTab.textContent='Quản lý bài tập';
  elements.dashboardTab.textContent='Theo dõi buổi học';
  elements.assignmentSelect.setAttribute('aria-label','Chọn buổi học');
  const brand=document.querySelector('.thuy-side .brand');brand.replaceChildren(node('b','IZONE'),node('small','IELTS CHIẾN LƯỢC'));
  brand.after(node('div','PROGRESS LOG','thuy-nav-label'));
  const foot=node('div','','thuy-side-foot');foot.append(node('small','Không gian giảng viên'));document.querySelector('.thuy-side').append(foot);
  const top=document.querySelector('.teacher-header'),actions=node('div','','thuy-header-actions'),connection=node('span','','thuy-connection');
  connection.id='teacherConnectionStatus';connection.setAttribute('aria-label','Trạng thái cập nhật');connection.textContent='Chọn lớp để theo dõi';
  elements.refreshDashboardButton.textContent='Làm mới';actions.append(connection,elements.refreshDashboardButton,elements.teacherName);
  top.replaceChildren(node('span','Quản lý lớp','thuy-breadcrumb'),actions);
  foot.append(document.querySelector('#teacherLogoutButton'));
  const learner=node('a','Cổng học viên ↗','tab');learner.id='thuyStudentPortal';learner.target='_blank';learner.rel='noopener';learner.href='./';side.append(learner);
  const dashboard=elements.dashboardPanel,hero=node('div','','thuy-session-header'),overview=node('section','','thuy-session-overview'),parts=node('section','','thuy-session-parts');
  overview.append(elements.dashboardTitle,elements.teacherSubmissionWindow||document.querySelector('#teacherSubmissionWindow'),document.querySelector('.dashboard-share'));
  overview.querySelector('.dashboard-share').hidden=true;
  parts.append(elements.blockControls);hero.append(overview,parts);dashboard.prepend(hero);
  dashboard.querySelector('.teacherReferenceHero').hidden=true;priorLabel?.remove();priorParts?.remove();
  elements.openClassOverviewButton.hidden=true;
  const tabs=node('nav','','thuy-session-tabs');tabs.setAttribute('aria-label','Tiến độ và kết quả buổi học');
  for(const [id,label] of [['progress','Tiến độ'],['results','Kết quả']]){const button=node('button',label,'button');button.type='button';button.dataset.thuyMode=id;button.setAttribute('aria-pressed',String(id==='progress'));button.addEventListener('click',()=>onMode(id));tabs.append(button);}
  hero.after(tabs);const plan=document.querySelector('#dashboardPlanHost');dashboard.append(plan);
  const analytics=document.querySelector('#classInsightSection');
  const results=node('div','','thuy-student-results');results.id='thuyStudentResults';elements.studentList.before(results);results.append(elements.studentList);
  const resultNav=document.querySelector('.thuy-result-jumps');resultNav.setAttribute('role','tablist');resultNav.setAttribute('aria-label','Kết quả buổi học');
  resultNav.replaceChildren();let resultTab='overview',mode='progress';const resultTabs=new Map();
  function applyResultTab(){
    analytics.hidden=mode!=='results'||resultTab!=='overview';results.hidden=mode==='results'&&resultTab!=='students';resultNav.hidden=mode!=='results';
    for(const [key,tab]of resultTabs){tab.setAttribute('aria-selected',String(key===resultTab));tab.tabIndex=key===resultTab?0:-1;}
    if(mode!=='results'||resultTab!=='students')for(const dialog of results.querySelectorAll('dialog[open]'))dialog.close();
  }
  analytics.setAttribute('role','tabpanel');analytics.setAttribute('aria-labelledby','thuyResultsOverview');results.setAttribute('role','tabpanel');results.setAttribute('aria-labelledby','thuyResultsStudents');
  for(const [key,label,id,panelId]of [['overview','Tổng quan lớp','thuyResultsOverview','classInsightSection'],['students','Nhận xét cá nhân','thuyResultsStudents','thuyStudentResults']]){
    const tab=node('button',label,'button');tab.id=id;tab.type='button';tab.setAttribute('role','tab');tab.setAttribute('aria-controls',panelId);tab.addEventListener('click',()=>{resultTab=key;applyResultTab();});resultTabs.set(key,tab);resultNav.append(tab);
  }
  resultNav.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();resultTab=event.key==='Home'?'overview':event.key==='End'?'students':resultTab==='overview'?'students':'overview';applyResultTab();resultTabs.get(resultTab).focus();});applyResultTab();
  analytics.querySelector('.library-heading').hidden=true;
  analytics.querySelector('.teacher-insight-tabs').hidden=true;
  elements.scoresPanel.hidden=true;elements.insightPanel.hidden=true;
  analytics.prepend(elements.questionAnalyticsStatus,elements.questionAnalytics);
  elements.overviewFilter.closest('label').hidden=true;
  elements.overviewClassSelect.closest('.field-grid').hidden=true;
  elements.overviewPanel.querySelector('.section-heading').hidden=true;
  elements.overviewPanel.querySelector('#showAllJourneyClasses').closest('label').hidden=true;
  for(const text of elements.overviewPanel.querySelectorAll(':scope>p.muted'))text.hidden=true;
  const extras=node('details','','thuy-extra-tools');extras.append(node('summary','Thông tin và công cụ của buổi'));extras.append(elements.dashboardSummary);dashboard.append(extras);
  const count=node('span','','thuy-class-count');pickers.append(count);
  return {context,classes,home,count,learner,setMode(value){mode=value;applyResultTab();},setPanel(panel){
    context.hidden=['create','classes'].includes(panel);home.classList.toggle('active',panel!=='create');
    document.querySelector('.thuy-breadcrumb').textContent=panel==='create'?'Quản lý bài tập':panel==='classes'?'Quản lý lớp':'Quản lý lớp / '+(classes.selectedOptions[0]?.textContent||'');
  }};
}

export function showThuyDetail(dialog){
  dialog.dataset.thuyGeneration=String(Number(dialog.dataset.thuyGeneration||0)+1);
  const opener=document.activeElement;
  for(const other of document.querySelectorAll('#draftDialog,#journeyDetailDialog'))if(other!==dialog&&other.open)other.close();
  const results=dialog.id==='draftDialog'?document.querySelector('#thuyStudentResults'):null;
  if(results){document.body.classList.remove('has-thuy-detail');results.append(dialog);results.classList.add('has-inline-detail');dialog.classList.add('thuy-inline-detail');}
  if(!dialog.open)dialog.show();if(!results)document.body.classList.add('has-thuy-detail');
  if(matchMedia('(max-width:650px)').matches){dialog.scrollIntoView({block:'start'});dialog.querySelector('button[aria-label]')?.focus({preventScroll:true});}
  dialog.addEventListener('close',()=>{results?.classList.remove('has-inline-detail');if(!document.querySelector('#draftDialog[open],#journeyDetailDialog[open]'))document.body.classList.remove('has-thuy-detail');if(opener?.isConnected)opener.focus({preventScroll:true});},{once:true});
}
