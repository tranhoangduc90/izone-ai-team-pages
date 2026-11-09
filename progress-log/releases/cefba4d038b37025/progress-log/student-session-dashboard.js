import {contentTitle,sessionState,startsAt,vietnamDate} from '/izone-ai-team-pages/progress-log/releases/cefba4d038b37025/progress-log/session-presentation.js';
import {commentPanel,node} from '/izone-ai-team-pages/progress-log/releases/cefba4d038b37025/progress-log/session-comments.js';

// Chỉ dùng ngày đã xác nhận và phiếu thuộc roster của học viên.
export function visibleStudentSessions(sessions,now=Date.now()){
  const today=vietnamDate(now);
  return sessions.filter(s=>s.assignmentId&&s.attemptStatus!=='not_assigned'&&startsAt(s.sessionDate)!==null&&s.sessionDate<=today);
}
export function latestAssignedSession(sessions,now=Date.now()){
  const visible=visibleStudentSessions(sessions,now);
  const latestDate=visible.reduce((date,session)=>session.sessionDate>date?session.sessionDate:date,'');
  const latest=visible.filter(session=>session.sessionDate===latestDate);
  const knownTimes=latest.every(session=>/^\d{2}:\d{2}:\d{2}$/u.test(session.sessionStartTime||''));
  return latest.sort((a,b)=>(knownTimes?b.sessionStartTime.localeCompare(a.sessionStartTime):0)
    ||Number(b.sessionNumber)-Number(a.sessionNumber)||String(a.assignmentId).localeCompare(String(b.assignmentId)))[0]||null;
}
// Nhịp đọc trạng thái phiếu có thể trả sau nhịp đọc nhận xét. Chỉ giữ nhận xét
// đã hiển thị cho đúng lớp, người, số buổi và phiếu cho tới lần đọc nhận xét kế tiếp.
export function preserveSessionComments(previous,journey){
  if(previous?.class.classId!==journey.class.classId||previous?.student.studentRef!==journey.student.studentRef)return journey;
  const key=session=>JSON.stringify([session.sessionNumber,session.assignmentId]);
  const comments=new Map(previous.sessions.filter(session=>session.sessionComment!==undefined)
    .map(session=>[key(session),session.sessionComment]));
  return {...journey,sessions:journey.sessions.map(session=>comments.has(key(session))
    ?{...session,sessionComment:comments.get(key(session))}:session)};
}
export function dashboardSessionState(session,now=Date.now()){
  const saved=['complete','incomplete'].includes(session.completeness);
  if(saved)return {kind:'complete',label:session.completeness==='complete'?'Đã nộp':'Đã nộp · còn câu trống',action:'Xem bài đã nộp',readOnly:true};
  const status=sessionState(session,{assignmentId:session.assignmentId,status:session.testResult?'test_result':session.conflict?'needs_review':session.attemptStatus==='not_assigned'?'not_assigned':'not_submitted'},
    session.assignmentId?{title:session.title,status:session.assignmentStatus}:null,now);
  if(session.assignmentId&&status.kind!=='review'&&session.submissionWindow?.canSubmit===false){
    const reason=session.submissionWindow.reason;
    return {...status,canLearn:false,kind:'locked',label:reason==='not_open'?'Chưa đến giờ mở phiếu':reason==='deadline_invalid'?'Hạn nhận bài cần được kiểm tra':'Phiếu đã đóng nhận bài',action:session.sessionComment||session.testResult?'Xem kết quả và nhận xét':null,readOnly:true};
  }
  return {...status,action:status.canLearn?'Mở phiếu':session.sessionComment||session.testResult?'Xem kết quả và nhận xét':null,readOnly:!status.canLearn};
}
export function studentEntryState(session,now=Date.now(),available=true){
  const state=dashboardSessionState(session,now);
  if(['complete','incomplete'].includes(session.completeness))return state;
  const submissionWindow=session.submissionWindow;
  const closesAt=Date.parse(submissionWindow?.effectiveClosesAt);
  const canLearn=available&&state.kind!=='review'&&session.attemptStatus!=='not_assigned'
    &&session.assignmentStatus==='published'&&session.firstBlockStatus==='open'
    &&submissionWindow?.canSubmit===true&&(!Number.isFinite(closesAt)||now<closesAt)
    &&/^[0-9a-f-]{36}$/iu.test(session.publicToken||'');
  if(canLearn)return {kind:'active',label:'Mở Progress Log của buổi học',canLearn:true,action:'Mở phiếu',readOnly:false};
  const label=submissionWindow?.canSubmit===false||session.assignmentStatus!=='published'||state.kind==='review'
    ?state.label:!available||!submissionWindow?'Chưa kiểm tra được quyền mở phiếu'
      :session.firstBlockStatus==='open'?'Phiếu đã đóng nhận bài':'Chưa mở phần đầu';
  return {...state,kind:state.kind==='review'?'review':'locked',label,canLearn:false,
    action:session.sessionComment||session.testResult?'Xem kết quả và nhận xét':null,readOnly:true};
}
export function assignmentAllowsEntry(assignment,session,{studentRef,classId}){
  const first=assignment?.definition?.blocks?.[0];
  return Boolean(first&&assignment.assignmentId===session.assignmentId
    &&String(assignment.class?.id)===String(classId)&&Number(assignment.sessionNumber)===Number(session.sessionNumber)
    &&assignment.roster?.some(student=>student.studentRef===studentRef)
    &&assignment.submissionWindow?.canSubmit===true
    &&assignment.blockReleases?.some(release=>release.blockId===first.blockId&&release.status==='open'));
}
const latestViews=new WeakMap();
export function renderLatestSession(host,sessions,{now=Date.now(),onOpen,available=true,show=true}={}){
  const session=show?latestAssignedSession(sessions,now):null;
  host.hidden=!session;
  if(!session){delete host.dataset.sessionNumber;latestViews.delete(host);if(host.childElementCount)host.replaceChildren();return;}
  const state=studentEntryState(session,now,available);
  const fingerprint=JSON.stringify([session.assignmentId,session.publicToken,session.sessionNumber,session.title,state.canLearn]);
  if(latestViews.get(host)===fingerprint)return;
  latestViews.set(host,fingerprint);host.classList.add('student-upcoming');
  const copy=node('div','','student-upcoming-copy');copy.append(node('p','BUỔI HỌC GẦN NHẤT','eyebrow'));
  host.dataset.sessionNumber=String(session.sessionNumber);
  const title=contentTitle(session,{title:session.title});
  copy.append(node('h2','Buổi '+session.sessionNumber+' · '+title));
  const button=node('button','Nhấn vào đây để làm bài','button primary');button.type='button';
  button.disabled=!state.canLearn;
  button.addEventListener('click',()=>onOpen?.(session,state));host.replaceChildren(copy,button);
}
const signature=session=>JSON.stringify({...session,submissionWindow:session.submissionWindow?{
  canSubmit:session.submissionWindow.canSubmit,reason:session.submissionWindow.reason,effectiveClosesAt:session.submissionWindow.effectiveClosesAt}:null});
export function createStudentSessionDashboard({before,after,onOpen,onJourney,onRetry}){
  const latest=node('section','','student-dashboard-latest'),status=node('p','','muted'),retry=node('button','Thử lại','button');
  status.setAttribute('role','status');retry.type='button';retry.hidden=true;retry.addEventListener('click',onRetry);
  latest.append(status,retry);before.append(latest);
  const latestHost=node('div');latestHost.hidden=true;latest.append(latestHost);
  const section=node('section','','student-dashboard-sessions'),head=node('div','','student-dashboard-heading'),journey=node('button','Kết quả học tập và nhận xét','button');
  journey.type='button';journey.addEventListener('click',onJourney);head.append(node('h2','Các buổi học'),journey);
  const list=node('div','','studentSessionGrid'),empty=node('p','Chưa có buổi học để hiển thị.','muted');empty.hidden=true;
  section.append(head,empty,list);after.append(section);
  let owner='',cards=new Map();
  function card(session,currentId,state){
    const box=node('article','','studentSessionCard session-'+state.kind);box.dataset.sessionNumber=String(session.sessionNumber);
    const top=node('div','','studentSessionTop'),date=startsAt(session.sessionDate)!==null?session.sessionDate.split('-').reverse().join('/'):'Chưa xác nhận ngày';
    top.append(node('b','BUỔI '+String(session.sessionNumber).padStart(2,'0')),node('span',date));
    box.append(top,node('h3',contentTitle(session,{title:session.assignmentId||session.sessionKind==='test'?session.title:''})),node('p',state.label));
    if(session.submissionWindow?.effectiveClosesAt){const time=Date.parse(session.submissionWindow.effectiveClosesAt);if(Number.isFinite(time))box.append(node('small','Hạn: '+new Date(time).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})));}
    if(session.assignmentId===currentId)box.append(node('small','Đang xem','badge blue'));
    const comment=commentPanel(session.sessionComment,{compact:true});if(comment)box.append(comment);
    if(state.action){const action=node('button',session.assignmentId===currentId&&!state.readOnly?'Đến các phần đang xem':state.action,'button');action.type='button';action.addEventListener('click',()=>onOpen(session,state));box.append(action);}
    return box;
  }
  return {
    clear(){owner='';cards.clear();renderLatestSession(latestHost,[]);list.replaceChildren();empty.hidden=true;status.textContent='';retry.hidden=true;},
    loading(){status.textContent='Đang đọc các buổi học…';retry.hidden=true;},
    error(message){status.textContent='Chưa tải được danh sách: '+message;retry.hidden=false;},
    render(journey,{currentId,now=Date.now(),showLatest=false,available=true}={}){
      const key=journey.class.classId+':'+journey.student.studentRef;if(owner!==key){this.clear();owner=key;}
      const sessions=visibleStudentSessions(journey.sessions||[],now).sort((a,b)=>Number(a.sessionNumber)-Number(b.sessionNumber));
      empty.hidden=Boolean(sessions.length);retry.hidden=true;status.textContent='';
      renderLatestSession(latestHost,sessions,{now,onOpen,available,show:showLatest});
      const keep=new Set();
      for(const session of sessions){
        const state=studentEntryState(session,now,available);
        const id=String(session.sessionNumber)+':'+session.assignmentId,sig=signature(session)+':'+JSON.stringify(state)+':'+currentId;keep.add(id);
        let record=cards.get(id);if(!record||record.signature!==sig){const element=card(session,currentId,state);if(record)record.element.replaceWith(element);record={element,signature:sig};cards.set(id,record);}
      }
      for(const [id,record]of cards)if(!keep.has(id)){record.element.remove();cards.delete(id);}
      const ordered=sessions.map(s=>cards.get(String(s.sessionNumber)+':'+s.assignmentId).element);
      for(let i=0;i<ordered.length;i++)if(list.children[i]!==ordered[i])list.insertBefore(ordered[i],list.children[i]||null);
    }
  };
}
