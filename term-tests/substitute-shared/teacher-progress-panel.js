// Nhận bộ gọi GET đã đăng nhập của dashboard; không đọc bộ nhớ hoặc gọi API học viên.
const when=value=>value?new Date(value).toLocaleString('vi-VN'):'Chưa có bản lưu';
const label={not_started:'Chưa có lượt trên máy chủ',opened:'Đã mở lượt · chưa nộp kỹ năng',
 sections_submitted:'Đã nộp một phần',submitted:'Đã gửi Writing'};
const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};

export function createProgressPanel({host,request,isCurrent,onAuthError}){
 const panel=node('section',undefined,'panel substitute-progress');panel.hidden=true;host.before(panel);
 let serial=0,detailSerial=0,scope=null,controller=null,selected=null,selectedView=null,pageOffset=0;
 const heading=node('h2','Tiến trình đã lưu'),refresh=node('button','Cập nhật tiến trình','button button-secondary');refresh.type='button';
 const status=node('p'),list=node('div',undefined,'progress-students'),detail=node('section',undefined,'progress-detail');status.setAttribute('role','status');
 panel.append(heading,node('p','Nháp đang gõ được giữ trên máy học viên. Ở đây chỉ xem lượt đã mở và nội dung máy chủ đã nhận khi nộp kỹ năng hoặc gửi Writing.'),refresh,status,list,detail);
 const current=id=>id===serial&&scope&&isCurrent(scope);
 function clear(){serial++;detailSerial++;controller?.abort();controller=null;scope=null;selected=null;selectedView=null;pageOffset=0;panel.hidden=true;list.replaceChildren();detail.replaceChildren();status.textContent='';}
 function fail(error,id){
  if(!current(id))return;
  if(error.status===401||error.status===403){clear();onAuthError(error);return;}
  status.textContent='Chưa cập nhật được tiến trình. Dữ liệu đang hiện là bản đọc trước; hãy thử lại.';
 }
 async function open(student,view){
  selected=student.studentRef;selectedView=view;const id=serial,requestId=++detailSerial;
  detail.replaceChildren(node('h3',student.studentName));
  if(!student.progress.length){detail.append(node('p','Chưa có lượt hoặc nội dung lưu trên máy chủ.'));return;}
  const select=node('select');select.setAttribute('aria-label','Lượt Substitute');
  for(const row of student.progress){const option=node('option',(row.historical?'Lượt lịch sử · ':'')+when(row.startedAt)+' · '+label[row.status]);option.value=row.viewId;select.append(option);}
  selectedView=view||student.progress[0].viewId;select.value=selectedView;
  select.addEventListener('change',()=>open(student,select.value));detail.append(select);
  const content=node('div');content.append(node('p','Đang đọc nội dung máy chủ đã nhận…'));detail.append(content);
  try{
   const data=await request('/teacher/progress/detail',{test:scope.test,class:scope.class,student:student.studentRef,view:selectedView},controller?.signal);
   if(!current(id)||requestId!==detailSerial)return;
   if(data.testSlug!==scope.test||data.classCode!==scope.class||data.studentRef!==selected||data.progress?.viewId!==selectedView)throw new Error('Không khớp lượt đã chọn.');
   const value=data.progress;content.replaceChildren(node('p',label[value.status]+' · Nội dung đọc lúc '+when(new Date().toISOString())));
   for(const [skill,title]of [['listening','Listening'],['reading','Reading'],['writing','Writing']]){
    const part=node('section');part.append(node('h4',title));const saved=value[skill];
    if(saved?.availability!=='available')part.append(node('p',saved?.availability==='local_only'?'Máy chủ chưa nhận nội dung này. Nháp đang gõ chỉ ở trình duyệt học viên.':'Lượt cũ chưa lưu nội dung từng câu trên máy chủ.'));
    else{
     part.append(node('p','Nộp lúc '+when(saved.submittedAt)));
     if(skill==='writing')for(const task of saved.tasks||[])part.append(node('h5','Task '+task.taskNumber),node('pre',task.essay||'Phần này chưa có bài viết.','progress-essay'));
     else{const answers=node('dl',undefined,'progress-answers');for(const answer of saved.answers||[])answers.append(node('dt','Câu '+answer.number),node('dd',answer.answer||'Chưa nhập'));part.append(answers);}
    }
    content.append(part);
   }
  }catch(error){if(requestId===detailSerial){if(error.status!==401&&error.status!==403)content.replaceChildren(node('p','Chưa đọc được nội dung. Hãy cập nhật lại tiến trình.'));fail(error,id);}}
 }
 async function load(){
  if(!scope||!isCurrent(scope))return clear();
  const id=++serial;detailSerial++;controller?.abort();controller=new AbortController();status.textContent='Đang đọc tiến trình…';refresh.disabled=true;
  try{
   const data=await request('/teacher/progress/students',{test:scope.test,class:scope.class,limit:100,offset:pageOffset},controller.signal);
   if(!current(id))return;
   if(data.testSlug!==scope.test||data.classCode!==scope.class||!Array.isArray(data.students))throw new Error('Không khớp phạm vi.');
   list.replaceChildren();
   for(const student of data.students){const button=node('button',student.studentName+' · '+(label[student.status]||'Chưa xác nhận'),'progress-student');button.type='button';button.addEventListener('click',()=>open(student));list.append(button);}
   status.textContent=(data.students.length?'Học viên '+(pageOffset+1)+'–'+(pageOffset+data.students.length)+' · ':'Chưa có học viên trong danh sách · ')+'Đọc lúc '+when(new Date().toISOString());
   if(pageOffset>0){const previous=node('button','Trang học viên trước','button button-secondary');previous.type='button';previous.addEventListener('click',()=>loadPage(Math.max(0,pageOffset-100)));list.append(previous);}
   if(data.hasMore){const more=node('button','Xem trang học viên tiếp theo','button button-secondary');more.type='button';more.addEventListener('click',()=>loadPage(data.offset+data.limit));list.append(more);}
   const chosen=data.students.find(student=>student.studentRef===selected);
   if(chosen)await open(chosen,chosen.progress.some(row=>row.viewId===selectedView)?selectedView:undefined);
   else{selected=null;selectedView=null;detail.replaceChildren();}
  }catch(error){fail(error,id);}finally{if(current(id))refresh.disabled=false;}
 }
 // Cập nhật định kỳ vẫn giữ trang học viên đang xem.
 function loadPage(offset){pageOffset=offset;selected=null;selectedView=null;detail.replaceChildren();return load();}
 refresh.addEventListener('click',load);
 const timer=setInterval(()=>{if(!document.hidden&&!panel.hidden)load();},30000);
 window.addEventListener('pagehide',()=>{clearInterval(timer);clear();},{once:true});
 return {clear,show(value){clear();panel.hidden=false;if(value.class==='ALL'){status.textContent='Chọn một lớp ở bộ lọc rồi mở lại tiến trình.';return;}scope={...value};load();}};
}
