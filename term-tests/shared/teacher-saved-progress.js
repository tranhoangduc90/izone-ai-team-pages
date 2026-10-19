// Chỉ dựng bản đã lưu do API giảng viên trả về; không mở phiên hoặc lấy audio.
// Mỗi lượt giữ riêng; đổi người/lớp/đăng xuất loại phản hồi cũ và xóa nội dung hộp xem.
let active=null,serial=0;
const node=(tag,text='',className='')=>{const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el;};
const stamp=value=>value&&Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('vi-VN'):'Chưa có';

export function clearTeacherSavedProgress(){
 serial++;if(!active)return;clearTimeout(active.timer);document.removeEventListener('visibilitychange',active.visibility);
 active.dialog.close();active.dialog.replaceChildren();active.dialog.remove();active=null;
}

export function openTeacherSavedProgress({student,className,testSlug,testTitle=testSlug,request,isCurrent}){
 clearTeacherSavedProgress();const generation=serial;
 const dialog=node('dialog','','teacher-saved-progress-dialog');
 const header=node('header'),title=node('h2',student.name),close=node('button','Đóng','button button-secondary');close.type='button';
 const context=node('p',className+' · '+testTitle,'muted'),notice=node('p','','muted'),body=node('div'),refresh=node('button','Cập nhật bản đã lưu','button button-secondary');refresh.type='button';
 header.append(title,close);dialog.append(header,context,node('p','Chỉ hiện nội dung đã lưu lên hệ thống. Phần học viên còn đang gõ trên thiết bị có thể chưa xuất hiện.','muted'),refresh,notice,body);
 const current={dialog,timer:null,sequence:0,chosen:'',visibility(){clearTimeout(current.timer);if(!document.hidden)void load();}};active=current;
 const valid=()=>active===current&&serial===generation&&isCurrent();
 const schedule=()=>{clearTimeout(current.timer);if(valid()&&!document.hidden)current.timer=setTimeout(()=>void load(),30000);};
 function render(data){
  body.replaceChildren();
  if(!data.attempts.length){body.append(node('p','Chưa có lượt làm hoặc bản lưu trên hệ thống. Việc xem không tạo lượt mới.'));return;}
  const latest=data.attempts.filter(a=>!a.superseded).at(-1)||data.attempts.at(-1);
  const selected=data.attempts.find(a=>a.viewId===current.chosen)||latest;current.chosen=selected.viewId;
  const label=node('label','Lượt làm'),select=node('select');select.setAttribute('aria-label','Lượt làm');
  data.attempts.forEach((a,i)=>{const option=node('option',`Lượt ${i+1} · ${stamp(a.createdAt)}${a.superseded?' · Đã được thay thế':''}`);option.value=a.viewId;option.selected=a.viewId===selected.viewId;select.append(option);});
  label.append(select);body.append(label);select.addEventListener('change',()=>{current.chosen=select.value;render(data);});
  body.append(node('p',`${selected.order==='read_first'?'Reading trước':'Listening trước'} · ${selected.delivery==='answer_sheet'?'Làm trên giấy':'Làm trên máy'} · Đề phiên bản ${selected.definitionVersion}`,'muted'));
  for(const [key,title] of [['listening','Listening'],['reading','Reading']]){
   const section=node('section'),part=selected[key]||{},entries=Object.entries(part.answers||{}).sort((a,b)=>Number(a[0])-Number(b[0]));
   section.append(node('h3',title),node('p',part.submittedAt?'Đã nộp · '+stamp(part.submittedAt):part.startedAt||entries.length?'Chưa nộp · Bản lưu '+stamp(part.savedAt):'Chưa bắt đầu','muted'));
   if(!entries.length)section.append(node('p','Chưa có câu trả lời đã lưu.'));
   else{const table=node('table'),head=node('tr');head.append(node('th','Câu'),node('th','Câu trả lời đã lưu'));table.append(head);
    for(const [number,answer] of entries){const row=node('tr');row.append(node('td',number),node('td',String(answer||'Chưa nhập')));table.append(row);}section.append(table);}
   body.append(section);
  }
  const writing=selected.writing||{},section=node('section');section.append(node('h3','Writing'),node('p',writing.submittedAt?'Đã nộp · '+stamp(writing.submittedAt):writing.startedAt?'Chưa nộp · Bản lưu '+stamp(writing.savedAt):'Chưa bắt đầu','muted'));
  for(const [key,title] of [['task1','Task 1'],['task2','Task 2']])if(writing[key])section.append(node('h4',title),node('pre',writing[key]));
  if(!writing.task1&&!writing.task2)section.append(node('p','Chưa có nội dung Writing đã lưu.'));body.append(section);
 }
 async function load(){
  if(!valid()){if(active===current)clearTeacherSavedProgress();return;}const sequence=++current.sequence;clearTimeout(current.timer);notice.textContent='Đang đọc lại bản đã lưu…';
  try{
   const data=await request('/api/term-tests/teacher/saved-progress?'+new URLSearchParams({class:className,test:testSlug,student:student.ref}));
   if(!valid()||sequence!==current.sequence)return;
   if(data.student?.ref!==student.ref)throw new Error('Dữ liệu trả về chưa khớp học viên đang chọn.');
   render(data);notice.textContent='Đã đọc lúc '+new Date().toLocaleTimeString('vi-VN')+' · Tự đọc lại sau 30 giây khi trang đang mở.';schedule();
  }catch(error){
   if(!valid()||sequence!==current.sequence)return;
   if(error.status===401||error.status===403)body.replaceChildren();
   notice.textContent='Chưa cập nhật được: '+error.message;schedule();
  }
 }
 close.addEventListener('click',clearTeacherSavedProgress);dialog.addEventListener('cancel',event=>{event.preventDefault();clearTeacherSavedProgress();});
 refresh.addEventListener('click',()=>void load());document.addEventListener('visibilitychange',current.visibility);
 document.body.append(dialog);dialog.showModal();void load();return dialog;
}
