// Nhận đúng lớp/phiếu từ dashboard; gửi thay đổi có revision và giữ chữ đang nhập khi lỗi/đóng popup.
// Lịch sử chỉ dùng API giảng viên; xem lại không tạo bài làm hoặc đổi điểm danh.
import {bindDialogDismiss,node} from '../session-comments.js';
import {renderSessionReview} from '../session-review.js?rev=20261030-the20-v2';
const button=(label,action)=>{const b=node('button',label,'button');b.type='button';b.addEventListener('click',action);return b;};
const date=value=>value?new Date(value).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'Chưa có';
function dialog(title){
 const d=node('dialog','','thuy-management-dialog'),head=node('header','','thuy-management-head'),body=node('div','','thuy-management-body');
 head.append(node('h2',title),button('×',()=>d.close()));head.lastElementChild.setAttribute('aria-label','Đóng');d.append(head,body);document.body.append(d);bindDialogDismiss(d);
 let opener;d.addEventListener('close',()=>opener?.isConnected&&opener.focus());return {d,body,open(){opener=document.activeElement;d.showModal();}};
}
export function mountAssignmentManagement({host,getContext,request,onChanged,showHistory=true}){
 const pending=new Map(),opened=new Set();let busy=false,lifecycle=0;
 function ownDialog(title){const view=dialog(title);opened.add(view.d);return view;}
 async function edit(action){
  const run=lifecycle;
  const context=getContext();if(!context?.assignmentId)return;
  const key=context.assignmentId+':'+action;let view=pending.get(key);
  if(!view){
   view=ownDialog(action==='extend'?'Gia hạn cho cả lớp':'Thu hồi phiếu, giữ lịch sử');pending.set(key,view);
   const form=node('form'),summary=node('p',`${context.className} · Buổi ${context.sessionNumber} · ${context.title}`),notice=node('p','','notice');notice.setAttribute('role','status');
   const reason=node('textarea');reason.required=true;reason.maxLength=1000;reason.setAttribute('aria-label','Lý do');
   const label=node('label','Lý do');label.append(reason);
   const time=node('input');time.type='datetime-local';time.setAttribute('aria-label','Hạn mới (giờ Việt Nam)');
   form.append(summary,node('p',action==='extend'?'Áp dụng cho cả lớp. Chỉ phần chưa nộp và đang mở được làm tiếp; bài đã nộp giữ chỉ đọc.':'Phiếu ngừng nhận bài và học viên chuyển sang bài mới khi được giao. Nháp, bài nộp và điểm danh đã ghi được giữ; chỉ giảng viên xem lịch sử.'));
   if(action==='extend'){time.required=true;const timeLabel=node('label','Hạn mới (giờ Việt Nam)');timeLabel.append(time);form.append(timeLabel);}
   form.append(label,notice);const submit=node('button',action==='extend'?'Gia hạn cho cả lớp':'Thu hồi và giữ lịch sử','button primary');submit.type='submit';form.append(submit);view.body.append(form);
   let revision=null,operation=null;
   async function read(){submit.disabled=true;try{const reply=await request('/teacher/assignments/'+context.assignmentId+'/management');if(run!==lifecycle)return;revision=reply.management.revision;
     notice.textContent=reply.management.status==='retired'?'Phiếu đã thu hồi.':'Đang xem bản '+revision+'.';submit.disabled=reply.management.status==='retired';
    }catch(error){if(run===lifecycle)notice.textContent=error.message;}}
   form.append(button('Đọc lại trạng thái',()=>void read()));
   for(const input of [reason,time])input.addEventListener('input',()=>{operation=null;});
   form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||revision===null)return;busy=true;submit.disabled=true;operation??=crypto.randomUUID();notice.textContent='Đang lưu…';
    try{const closesAt=action==='extend'?new Date(time.value+':00+07:00').toISOString():undefined;
     const reply=await request('/teacher/assignments/'+context.assignmentId+'/management',{method:'POST',body:{action,reason:reason.value.trim(),...(closesAt?{closesAt}:{}),expectedRevision:revision,operationId:operation}});
     if(run!==lifecycle)return;
     revision=reply.management.revision;notice.textContent='Đã lưu.';view.d.close();pending.delete(key);view.d.remove();await onChanged(context,action);
    }catch(error){notice.textContent='Chưa xác nhận thay đổi: '+error.message;submit.disabled=false;}
    finally{if(run===lifecycle)busy=false;}
   });
   view.read=read;
  }
  view.open();await view.read();
 }
 async function history(){
  const run=lifecycle,context=getContext();if(!context?.classId)return;const view=ownDialog('Phiếu đã thu hồi · '+context.className);view.open();view.body.append(node('p','Đang tải…'));
  try{
   const reply=await request('/teacher/classes/'+context.classId+'/withdrawn-assignments');if(run!==lifecycle)return;view.body.replaceChildren();
   if(!reply.assignments.length)view.body.append(node('p','Chưa có phiếu đã thu hồi.'));
   for(const row of reply.assignments){const card=node('section');card.append(node('h3','Buổi '+row.sessionNumber+' · '+row.title),node('p',`${row.submissionCount} bài nộp · ${row.draftCount} lượt đang làm · ${date(row.withdrawnAt)}`),node('p',row.reason||'Phiếu lưu trữ trước đây.'));
    card.append(button('Xem bài và nháp đã giữ',async()=>{
     const detail=ownDialog('Đã thu hồi · Chỉ giảng viên xem');detail.open();detail.body.append(node('p','Đang đọc bài…'));
     try{const [d,l]=await Promise.all([request('/teacher/dashboard?assignment='+row.assignmentId),request('/teacher/live-drafts?assignment='+row.assignmentId)]);
      if(run!==lifecycle)return;
      if(d.dashboard.assignmentId!==row.assignmentId||l.live.assignmentId!==row.assignmentId)throw Error('Dữ liệu chưa khớp phiếu.');
      detail.body.replaceChildren();const live=new Map(l.live.students.map(s=>[s.studentRef,s]));
      for(const student of d.dashboard.students){const record=live.get(student.studentRef)||{},fold=node('details'),content=node('div');fold.append(node('summary',student.name+(record.submissionId?' · Đã nộp':record.attemptId?' · Nháp':' · Chưa bắt đầu')),content);
       fold.addEventListener('toggle',()=>{if(fold.open&&!content.childElementCount)renderSessionReview(content,{student,definition:d.dashboard.definition,sessionNumber:row.sessionNumber,
        responses:record.submissionId?record.finalResponses:record.draftResponses,gradingItems:record.gradingResult?.items||[],submissionId:record.submissionId,status:record.submissionId?'complete':'draft'});});detail.body.append(fold);}
     }catch(error){detail.body.replaceChildren(node('p',error.message));}
     detail.d.addEventListener('close',()=>detail.d.remove(),{once:true});
    }));view.body.append(card);
   }
  }catch(error){view.body.replaceChildren(node('p','Chưa đọc được lịch sử: '+error.message));}
  view.d.addEventListener('close',()=>view.d.remove(),{once:true});
 }
 host.append(button('Gia hạn',()=>void edit('extend')),button('Thu hồi / thay bài',()=>void edit('withdraw')));if(showHistory)host.append(button('Lịch sử thu hồi',()=>void history()));
 return {refresh(){const context=getContext();for(const [index,b]of [...host.querySelectorAll('button')].entries())b.disabled=index===2?!context?.classId:!context?.assignmentId;},dispose(){lifecycle++;for(const view of opened){view.close();view.remove();}opened.clear();pending.clear();busy=false;}};
}
