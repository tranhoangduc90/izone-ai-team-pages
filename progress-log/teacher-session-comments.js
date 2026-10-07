import {node,commentPanel,bindDialogDismiss} from './session-comments.js';
const prefix='progress-log-comment-draft-v1:';
function stored(key) {try{return JSON.parse(sessionStorage.getItem(key)||'null');}catch{return null;}}
function store(key,value) {try{value?sessionStorage.setItem(key,JSON.stringify(value)):sessionStorage.removeItem(key);}catch{/* Giữ nháp đang gõ nếu bộ nhớ trình duyệt đầy. */}}
export function clearCommentDrafts(teacherEmail) {
  for(let i=sessionStorage.length-1;i>=0;i--){const key=sessionStorage.key(i);if(key.startsWith(prefix+teacherEmail+':'))sessionStorage.removeItem(key);}
}
// Nháp theo tài khoản/lớp/người/buổi. Retry giữ operationId; đổi nội dung tạo thao tác mới.
export function commentEditor({target,studentName,comment,reviewerKey,request,current,onSaved}) {
  const key=prefix+reviewerKey+':'+target.classId+':'+target.studentRef+':'+target.sessionNumber;
  let saved=comment,draft=stored(key),operationId=draft?.operationId||crypto.randomUUID(),busy=false;
  let revision=Number(draft?.expectedRevision??comment?.revision??0),action=draft?.action||'save';
  const section=node('section','','session-comment-editor');
  section.append(node('h3','Nhận xét dành cho học viên'),node('p',`${studentName} · Buổi ${target.sessionNumber} · Tùy chọn`,'muted'));
  const input=node('textarea');input.value=draft?.noteText??(comment?.visibility==='hidden'?'':comment?.noteText||'');
  input.rows=5;input.setAttribute('aria-label','Nhận xét dành cho '+studentName);input.placeholder='Viết nhận xét cho buổi học này…';
  const count=node('small'),status=node('p','','notice');status.setAttribute('role','status');
  const actions=node('div','','comment-actions'),save=node('button','Lưu và hiển thị với học viên','button primary'),hide=node('button','Ẩn nhận xét','mini-action');
  const history=node('button','Xem lịch sử','mini-action'),historyBox=node('div');
  for(const button of [save,hide,history])button.type='button';
  hide.hidden=!saved||saved.visibility==='hidden';
  const persist=()=>store(key,{noteText:input.value,expectedRevision:revision,operationId,action});
  const recount=()=>{count.textContent=[...input.value.trim()].length+' / 1.000 ký tự';};recount();
  input.addEventListener('input',()=>{operationId=crypto.randomUUID();action='save';persist();recount();});
  async function mutate(hiding=false) {
    if(busy||!current())return;
    const text=input.value.trim();
    if(!hiding&&(!text||[...text].length>1000)){status.textContent='Nhận xét cần từ 1 đến 1.000 ký tự. Để trống không xóa nhận xét đã lưu.';return;}
    if(hiding&&!window.confirm('Ẩn nhận xét này khỏi hành trình học viên? Lịch sử vẫn được giữ.'))return;
    if(action!==(hiding?'hide':'save'))operationId=crypto.randomUUID();action=hiding?'hide':'save';persist();
    const fingerprint=JSON.stringify([text,revision,operationId]);
    busy=true;save.disabled=hide.disabled=true;status.textContent='Đang lưu…';
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),25000);
    try{
      const data=await request(hiding?'/teacher/session-comments/hide':'/teacher/session-comments',{
        method:hiding?'POST':'PUT',signal:controller.signal,body:{...target,expectedRevision:revision,operationId,...(!hiding?{noteText:text}:{})}});
      if(!current()||!section.isConnected)return;
      const note=data.comment;
      if(note.studentRef!==target.studentRef||note.sessionNumber!==target.sessionNumber||note.revision!==revision+1
        ||(!hiding&&note.noteText!==text))throw Error('Nhận xét trả về không khớp học viên/buổi/nội dung.');
      saved=note;revision=note.revision;hide.hidden=hiding;onSaved(note);
      if(fingerprint===JSON.stringify([input.value.trim(),revision-1,operationId])){store(key,null);operationId=crypto.randomUUID();}
      else persist();
      status.textContent=hiding?'Đã ẩn khỏi hành trình học viên.':'Đã lưu. Học viên đọc được khi mở hoặc làm mới hành trình.';
    }catch(error){if(current()){
      status.textContent=controller.signal.aborted?'Chưa xác định được kết quả lưu. Bản đang gõ được giữ; bấm lại để kiểm tra cùng thao tác.':error.message;
      if(error.status===409){const reload=node('button','Tải nhận xét hiện hành, giữ bản đang gõ','mini-action');reload.type='button';reload.addEventListener('click',async()=>{
        try{const data=await request('/teacher/session-comments/history?'+new URLSearchParams(target));if(!current())return;
          saved=data.history[0]||null;revision=Number(saved?.revision||0);operationId=crypto.randomUUID();action='save';persist();
          historyBox.replaceChildren(...(saved?[commentPanel({...saved,visibility:'visible'})]:[]));status.textContent='Đã đọc bản hiện hành. Kiểm tra trước khi lưu bản bạn đang gõ.';
        }catch(e){status.textContent=e.message;}
      });status.append(' ',reload);}
    }}finally{clearTimeout(timeout);busy=false;save.disabled=hide.disabled=false;}
  }
  save.addEventListener('click',()=>void mutate());hide.addEventListener('click',()=>void mutate(true));
  history.addEventListener('click',async()=>{try{const data=await request('/teacher/session-comments/history?'+new URLSearchParams(target));if(!current())return;
    historyBox.replaceChildren(...data.history.map(note=>{const box=commentPanel({...note,visibility:'visible'});box.prepend(node('small',`Bản ${note.revision} · ${note.action==='hide'?'Đã ẩn':'Đã lưu'}`));return box;}));
  }catch(error){status.textContent=error.message;}});
  actions.append(save,hide,history);section.append(input,count,actions,status,historyBox);
  return {element:section,focus(){input.focus();input.scrollIntoView({block:'center',behavior:'smooth'});}};
}
export function journeyLinkManager({request,target,studentName,current}) {
  const dialog=node('dialog','','draft-dialog journey-link-dialog'),close=node('button','Đóng','mini-action');close.type='button';
  close.addEventListener('click',()=>dialog.close());dialog.append(close,node('h2','Hành trình riêng · '+studentName));
  const status=node('p','Đang lấy link…'),input=node('input');input.readOnly=true;input.setAttribute('aria-label','Link Hành trình riêng');
  const actions=node('div','','comment-actions');let link,busy=false,operation;
  const url=token=>{const value=new URL('journey.html',location.href);value.hash=new URLSearchParams({access:token});return value.href;};
  const copy=node('button','Sao chép link','mini-action'),open=node('button','Mở hành trình ↗','mini-action'),rotate=node('button','Thay link','mini-action'),revoke=node('button','Thu hồi link','mini-action');
  for(const button of [copy,open,rotate,revoke])button.type='button';
  async function resolve(action='resolve'){
    if(busy||!current())return;busy=true;status.textContent='Đang lấy trạng thái link…';
    const body={...target,operationId:operation?.action===action?operation.id:crypto.randomUUID(),...(action==='resolve'?{}:{expectedAccessId:link?.accessId||null})};
    operation={action,id:body.operationId};const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),25000);
    try{const data=await request('/teacher/student-progress-links/'+action,{method:'POST',body,signal:controller.signal});if(!current()||!dialog.open)return;
      if(data.link.studentRef!==target.studentRef||String(data.link.classId)!==String(target.classId))throw Error('Link không khớp học viên.');
      link=data.link;input.value=link.accessToken?url(link.accessToken):'';copy.disabled=open.disabled=!input.value;
      revoke.disabled=link.status==='revoked';status.textContent=link.status==='legacy'?'Link cũ vẫn hoạt động. Server không giữ bản gốc để sao chép; dùng link đã gửi hoặc chủ động thay link rồi gửi lại.':
        link.status==='revoked'?'Link đã thu hồi. Chỉ tạo lại khi bạn chủ động chọn Thay link.':link.status==='expired'?'Link cũ đã hết hạn; chủ động Thay link để tạo link không hết hạn.':'Link không hết hạn, chỉ mất hiệu lực khi được thay hoặc thu hồi.';
      operation=null;
    }catch(error){if(current()){
      if(error.status===409){operation=null;status.textContent=error.message+' Bấm Thử lại để đọc trạng thái hiện hành, rồi chọn thao tác.';}
      else status.textContent=controller.signal.aborted?'Chưa xác định kết quả. Bấm Thử lại để kiểm tra cùng thao tác.':error.message;
    }}
    finally{clearTimeout(timeout);busy=false;}
  }
  copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(input.value);status.textContent='Đã sao chép link. Gửi đúng học viên này.';}catch{input.select();status.textContent='Chọn link rồi sao chép bằng Ctrl+C.';}});
  open.addEventListener('click',()=>{if(input.value)window.open(input.value,'_blank','noopener,noreferrer');});
  rotate.addEventListener('click',()=>{if(window.confirm('Thay link của '+studentName+'? Link đã gửi sẽ mất hiệu lực; cần gửi lại link mới.'))void resolve('rotate');});
  revoke.addEventListener('click',()=>{if(window.confirm('Thu hồi link của '+studentName+'? Học viên sẽ không mở được bằng link cũ.'))void resolve('revoke');});
  const retry=node('button','Thử lại','mini-action');retry.type='button';retry.addEventListener('click',()=>void resolve(operation?.action||'resolve'));
  actions.append(copy,open,rotate,revoke,retry);dialog.append(status,input,actions);document.body.append(dialog);bindDialogDismiss(dialog);
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();void resolve();
}
// Mở tab ngay trong thao tác bấm để trình duyệt cho phép; server lấy lại đúng link đang dùng.
export async function openStudentJourney({request,target,studentName,current}) {
  const waiting=window.open('about:blank','_blank');
  if(!waiting){journeyLinkManager({request,target,studentName,current});return;}
  waiting.opener=null;waiting.document.title='Đang mở hành trình';waiting.document.body.textContent='Đang mở hành trình của '+studentName+'…';
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),25000);
  try{
    const data=await request('/teacher/student-progress-links/resolve',{method:'POST',body:{...target,operationId:crypto.randomUUID()},signal:controller.signal});
    if(!current()){waiting.close();return;}
    if(data.link.studentRef!==target.studentRef||String(data.link.classId)!==String(target.classId))throw Error('Link không khớp học viên.');
    if(data.link.status==='active'&&data.link.accessToken){
      const url=new URL('journey.html',location.href);url.hash=new URLSearchParams({access:data.link.accessToken});if(!waiting.closed)waiting.location.replace(url.href);
    }else {waiting.close();journeyLinkManager({request,target,studentName,current});}
  }catch{waiting.close();if(current())journeyLinkManager({request,target,studentName,current});}
  finally{clearTimeout(timeout);}
}
