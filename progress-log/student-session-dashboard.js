import {contentTitle,sessionState,startsAt} from './session-presentation.js';
import {commentPanel,node} from './session-comments.js';

// Chỉ đọc danh sách đã được API giới hạn đúng người/lớp. Không tạo lượt làm hay điểm danh.
export function latestAssignedSession(sessions){
  const assigned=sessions.filter(s=>s.assignmentId);
  const dated=assigned.every(s=>startsAt(s.sessionDate)!==null);
  return [...assigned].sort((a,b)=>(dated?startsAt(b.sessionDate)-startsAt(a.sessionDate):0)
    ||Number(b.sessionNumber)-Number(a.sessionNumber)||String(a.assignmentId).localeCompare(String(b.assignmentId)))[0]||null;
}
export function dashboardSessionState(session,now=Date.now()){
  const saved=['complete','incomplete'].includes(session.completeness);
  if(saved)return {kind:'complete',label:session.completeness==='complete'?'Đã nộp':'Đã nộp · còn câu trống',action:'Xem bài đã nộp',readOnly:true};
  const status=sessionState(session,{assignmentId:session.assignmentId,status:session.testResult?'test_result':session.conflict?'needs_review':session.attemptStatus==='not_assigned'?'not_assigned':'not_submitted'},
    session.assignmentId?{title:session.title,status:session.assignmentStatus}:null,now);
  if(session.submissionWindow?.canSubmit===false){
    const reason=session.submissionWindow.reason;
    return {...status,canLearn:false,kind:'locked',label:reason==='not_open'?'Chưa đến giờ mở phiếu':reason==='deadline_invalid'?'Hạn nhận bài cần được kiểm tra':'Phiếu đã đóng nhận bài',action:session.sessionComment||session.testResult?'Xem kết quả và nhận xét':null,readOnly:true};
  }
  return {...status,action:status.canLearn?'Mở phiếu':session.sessionComment||session.testResult?'Xem kết quả và nhận xét':null,readOnly:!status.canLearn};
}
const signature=session=>JSON.stringify({...session,submissionWindow:session.submissionWindow?{
  canSubmit:session.submissionWindow.canSubmit,reason:session.submissionWindow.reason,effectiveClosesAt:session.submissionWindow.effectiveClosesAt}:null});
export function createStudentSessionDashboard({before,after,onOpen,onJourney,onRetry}){
  const latest=node('section','','student-dashboard-latest'),status=node('p','','muted'),retry=node('button','Thử lại','button');
  status.setAttribute('role','status');retry.type='button';retry.hidden=true;retry.addEventListener('click',onRetry);
  latest.append(node('p','BUỔI GẦN NHẤT ĐÃ GIAO','eyebrow'),status,retry);before.append(latest);
  const latestHost=node('div');latest.append(latestHost);
  const section=node('section','','student-dashboard-sessions'),head=node('div','','student-dashboard-heading'),journey=node('button','Kết quả học tập và nhận xét','button');
  journey.type='button';journey.addEventListener('click',onJourney);head.append(node('h2','Tất cả buổi học'),journey);
  const list=node('div','','studentSessionGrid');section.append(head,node('p','Buổi chưa có phiếu vẫn nằm trong kế hoạch lớp; chưa có điểm hoặc kết luận vắng.','muted'),list);after.append(section);
  let owner='',latestSignature='',cards=new Map();
  function card(session,currentId,now){
    const state=dashboardSessionState(session,now),box=node('article','','studentSessionCard session-'+state.kind);box.dataset.sessionNumber=String(session.sessionNumber);
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
    clear(){owner='';latestSignature='';cards.clear();latestHost.replaceChildren();list.replaceChildren();status.textContent='';retry.hidden=true;},
    loading(){status.textContent='Đang đọc các buổi học…';retry.hidden=true;},
    error(message){status.textContent='Chưa tải được danh sách: '+message;retry.hidden=false;},
    render(journey,{currentId,now=Date.now()}={}){
      const key=journey.class.classId+':'+journey.student.studentRef;if(owner!==key){this.clear();owner=key;}
      const sessions=journey.sessions||[],newest=latestAssignedSession(sessions);retry.hidden=true;status.textContent=newest?'':'Chưa có phiếu nào được giao.';
      const fingerprint=session=>signature(session)+':'+JSON.stringify(dashboardSessionState(session,now))+':'+currentId;
      const nextLatest=newest?fingerprint(newest):'empty';
      if(latestSignature!==nextLatest){latestHost.replaceChildren(...(newest?[card(newest,currentId,now)]:[]));latestSignature=nextLatest;}
      const keep=new Set();
      for(const session of [...sessions].sort((a,b)=>Number(a.sessionNumber)-Number(b.sessionNumber))){
        const id=String(session.sessionNumber)+':'+(session.assignmentId||''),sig=fingerprint(session);keep.add(id);
        let record=cards.get(id);if(!record||record.signature!==sig){const element=card(session,currentId,now);if(record)record.element.replaceWith(element);record={element,signature:sig};cards.set(id,record);}
      }
      for(const [id,record]of cards)if(!keep.has(id)){record.element.remove();cards.delete(id);}
      const ordered=[...sessions].sort((a,b)=>Number(a.sessionNumber)-Number(b.sessionNumber)).map(s=>cards.get(String(s.sessionNumber)+':'+(s.assignmentId||'')).element);
      for(let i=0;i<ordered.length;i++)if(list.children[i]!==ordered[i])list.insertBefore(ordered[i],list.children[i]||null);
      if(!sessions.length)list.textContent='Chưa có dữ liệu buổi học.';
      else for(const child of [...list.childNodes])if(child.nodeType===3)child.remove();
    }
  };
}
