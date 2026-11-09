import {node,commentPanel,bindDialogDismiss} from '/izone-ai-team-pages/progress-log/releases/cefba4d038b37025/progress-log/session-comments.js';
const prefix='progress-log-comment-draft-v1:';
const draftStorage=()=>globalThis.location?.pathname?.endsWith('/teacher-thuy.html')?localStorage:sessionStorage;
function stored(key) {try{return JSON.parse(draftStorage().getItem(key)||'null');}catch{return null;}}
function store(key,value) {try{const storage=draftStorage();value?storage.setItem(key,JSON.stringify(value)):storage.removeItem(key);return true;}catch{return false;}}
export function clearCommentDrafts(teacherEmail) {
  const storage=draftStorage();for(let i=storage.length-1;i>=0;i--){const key=storage.key(i);if(key.startsWith(prefix+teacherEmail+':'))storage.removeItem(key);}
}
// Nháp máy chủ theo tài khoản/lớp/người/buổi; bộ đệm trình duyệt giữ chữ khi lỗi mạng.
export function commentEditor({target,studentName,comment,reviewerKey,request,current,onSaved,compact=false}) {
  const key=prefix+reviewerKey+':'+target.classId+':'+target.studentRef+':'+target.sessionNumber;
  const local=stored(key);
  let saved=comment,revision=Number(comment?.revision||0),draftRevision=0,ready=false,busy=false;
  let pending=local?.pending||null,editing=Boolean(local),focusWhenReady=false;
  const section=node('section','','session-comment-editor');
  section.append(node('h3','Nhận xét dành cho học viên'),node('p',`${studentName} · Buổi ${target.sessionNumber} · Tùy chọn`,'muted'));
  const input=node('textarea');input.value=local?.noteText??(comment?.visibility==='hidden'?'':comment?.noteText||'');input.disabled=true;
  input.rows=5;input.setAttribute('aria-label','Nhận xét dành cho '+studentName);input.placeholder='Viết nhận xét cho buổi học này…';
  const count=node('small'),status=node('p','','notice');status.setAttribute('role','status');
  const hint=node('p','','comment-published-hint');
  const actions=node('div','','comment-actions'),save=node('button','Lưu nháp','button'),send=node('button','Gửi cho học viên','button primary');
  const more=node('button','⋮','mini-action comment-more');more.title='Lựa chọn khác';more.setAttribute('aria-label','Lựa chọn khác');more.setAttribute('aria-expanded','false');
  const menu=node('div','','comment-menu');menu.hidden=true;menu.setAttribute('role','group');menu.setAttribute('aria-label','Tùy chọn nhận xét đã gửi');
  const edit=node('button','Chỉnh sửa','mini-action'),remove=node('button','Xóa','mini-action comment-delete');menu.append(edit,remove);
  const history=node('button','Xem lịch sử','mini-action'),historyBox=node('div');
  for(const button of [save,send,more,edit,remove,history])button.type='button';
  const visible=()=>saved?.visibility==='visible';
  const active=()=>current()&&section.isConnected;
  const persist=()=>{const ok=store(key,{noteText:input.value,expectedRevision:revision,expectedDraftRevision:draftRevision,pending});if(!ok)status.textContent='Chưa giữ được bộ đệm trên trình duyệt. Giữ trang đang mở hoặc sao chép nội dung trước khi chuyển người.';return ok;};
  const recount=()=>{count.textContent=[...input.value.trim()].length+' / 1.000 ký tự';};recount();
  function buttons(){
    save.disabled=send.disabled=!ready||busy||!editing;more.disabled=!ready||busy;more.hidden=!visible();
    edit.disabled=remove.disabled=!ready||busy;input.readOnly=!editing;
    hint.textContent=visible()?(editing?'Học viên vẫn đang thấy nhận xét đã gửi trước đó cho đến khi bạn gửi lại.':'Nhận xét này đã gửi cho học viên. Chọn Chỉnh sửa trong Lựa chọn khác để sửa.'):'Nháp chỉ có giảng viên đang soạn đọc được.';
  }
  const closeMenu=()=>{menu.hidden=true;more.setAttribute('aria-expanded','false');};
  more.addEventListener('click',()=>{menu.hidden=!menu.hidden;more.setAttribute('aria-expanded',String(!menu.hidden));if(!menu.hidden)edit.focus();});
  section.addEventListener('keydown',event=>{if(event.key==='Escape'&&!menu.hidden){event.stopPropagation();closeMenu();more.focus();}});
  section.addEventListener('focusout',event=>{if(!section.contains(event.relatedTarget))closeMenu();});
  const outside=event=>{if(!section.isConnected){document.removeEventListener('pointerdown',outside);return;}if(!actions.contains(event.target))closeMenu();};
  document.addEventListener('pointerdown',outside);
  edit.addEventListener('click',()=>{closeMenu();editing=true;buttons();input.focus();});
  input.addEventListener('input',()=>{pending=null;editing=true;persist();recount();status.textContent='Chưa lưu thay đổi này vào tài khoản.';});
  async function load({preserve=false}={}){
    if(busy||!current())return;busy=true;buttons();status.textContent='Đang đọc nhận xét và nháp riêng…';
    const before=input.value,controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),25000);
    try{
      const data=await request('/teacher/session-comments/editor?'+new URLSearchParams(target),{signal:controller.signal});
      if(!active())return;
      if(String(data.classId)!==String(target.classId)||data.studentRef!==target.studentRef||data.sessionNumber!==target.sessionNumber
        ||data.draft&&(data.draft.studentRef!==target.studentRef||data.draft.sessionNumber!==target.sessionNumber))throw Error('Nháp trả về không khớp học viên/buổi.');
      saved=data.comment;draftRevision=Number(data.draft?.revision||0);revision=Number(saved?.revision||0);
      if(!preserve&&local){
        revision=Number(local.expectedRevision??data.draft?.baseCommentRevision??revision);
        draftRevision=Number(local.expectedDraftRevision??draftRevision);editing=true;
        status.textContent='Đã khôi phục nội dung trên thiết bị này. Bấm Lưu nháp để lưu vào tài khoản hoặc Gửi cho học viên.';
      }else if(preserve){input.value=before;pending=null;editing=true;persist();status.textContent='Đã đọc bản hiện hành, giữ nội dung đang gõ. Kiểm tra trước khi lưu hoặc gửi.';}
      else{
        const hasDraft=data.draft?.noteText!=null;input.value=hasDraft?data.draft.noteText:visible()?saved.noteText:'';editing=hasDraft||!visible();
        if(hasDraft)revision=Number(data.draft.baseCommentRevision);
        status.textContent=hasDraft?'Đã mở nháp riêng trong tài khoản. Học viên chưa thấy bản này.':visible()?'Đã đọc nhận xét đã gửi.':'Chưa có nhận xét.';
      }
      ready=true;input.disabled=false;recount();if(focusWhenReady&&editing)input.focus();
    }catch(error){if(active()){
      ready=false;status.textContent=controller.signal.aborted?'Chưa đọc được nháp trong thời gian chờ. Nội dung trên thiết bị vẫn được giữ.':error.message;
      const retry=node('button','Thử đọc lại nháp','mini-action');retry.type='button';retry.addEventListener('click',()=>void load({preserve}));status.append(' ',retry);
    }}finally{clearTimeout(timeout);busy=false;buttons();}
  }
  async function mutate(action) {
    if(busy||!ready||!active())return;
    const text=input.value.trim();
    if(action!=='delete'&&(!text||[...text].length>1000)){status.textContent='Nhận xét cần từ 1 đến 1.000 ký tự. Để trống không xóa nhận xét đã gửi.';return;}
    if(action==='delete'&&!window.confirm(`Xóa nhận xét đã gửi cho ${studentName} · Buổi ${target.sessionNumber}? Học viên sẽ không còn thấy bản này; lịch sử vẫn được giữ.`))return;
    closeMenu();
    // Xóa bản đã gửi đang đọc; revision của nháp có thể vẫn dựa trên một bản gửi cũ.
    const expectedRevision=action==='delete'?Number(saved?.revision||0):revision;
    const fingerprint=JSON.stringify([action,text,expectedRevision,draftRevision]);
    if(pending?.fingerprint!==fingerprint)pending={fingerprint,action,body:{...target,expectedRevision,operationId:crypto.randomUUID(),
      ...(action!=='delete'?{noteText:text,expectedDraftRevision:draftRevision}:{})}};
    const operation=pending;persist();busy=true;buttons();status.textContent=action==='draft'?'Đang lưu nháp vào tài khoản…':action==='send'?'Đang gửi cho học viên…':'Đang xóa nhận xét đã gửi…';
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),25000);
    try{
      const data=await request('/teacher/session-comments/'+action,{method:action==='draft'?'PUT':'POST',signal:controller.signal,body:operation.body});
      if(!active())return;
      const note=action==='draft'?data.draft:data.comment;
      if(!note||note.studentRef!==target.studentRef||note.sessionNumber!==target.sessionNumber
        ||note.revision!==(action==='draft'?operation.body.expectedDraftRevision:operation.body.expectedRevision)+1
        ||action!=='delete'&&note.noteText!==text||action==='delete'&&note.visibility!=='hidden')throw Error('Nhận xét trả về không khớp học viên/buổi/nội dung.');
      if(note.replayed){
        const latest=await request('/teacher/session-comments/editor?'+new URLSearchParams(target),{signal:controller.signal});
        if(!active())return;
        if(String(latest.classId)!==String(target.classId)||latest.studentRef!==target.studentRef||latest.sessionNumber!==target.sessionNumber)throw Error('Bản hiện hành không khớp học viên/buổi.');
        if(action==='draft'?latest.draft?.revision!==note.revision:
          latest.comment?.revision!==note.revision||action==='send'&&Number(latest.draft?.revision||0)!==note.draftRevision){
          saved=latest.comment;revision=Number(saved?.revision||0);draftRevision=Number(latest.draft?.revision||0);
          pending=null;editing=true;persist();if(saved)onSaved(saved);
          status.textContent='Thao tác trước đã thành công, nhưng bản hiện hành đã thay đổi sau đó. Nội dung đang gõ được giữ; kiểm tra trước khi lưu hoặc gửi lại.';
          return;
        }
      }
      if(action==='draft')draftRevision=note.revision;
      else{saved=note;revision=note.revision;if(action==='send')draftRevision=note.draftRevision;onSaved(note);}
      const unchanged=input.value.trim()===text;
      pending=null;
      if(unchanged){store(key,null);if(action==='send')editing=false;}
      else{editing=true;persist();}
      status.textContent=action==='draft'?'Đã lưu nháp vào tài khoản. Có thể mở trên thiết bị khác; học viên chưa thấy bản này.':
        action==='send'?'Đã gửi. Học viên đọc được khi mở hoặc làm mới Progress log.':'Đã xóa nhận xét đã gửi. Lịch sử và các bản nháp riêng được giữ.';
      if(!unchanged)status.textContent+=' Phần vừa gõ thêm chưa được lưu.';
      if(action==='delete'&&unchanged){editing=true;persist();}
    }catch(error){if(active()){
      status.textContent=controller.signal.aborted?'Chưa xác định được kết quả. Nội dung được giữ; bấm lại cùng nút để kiểm tra thao tác.':error.message;
      if(error.status===409){const reload=node('button','Tải bản hiện hành, giữ nội dung đang gõ','mini-action');reload.type='button';reload.addEventListener('click',()=>void load({preserve:true}));status.append(' ',reload);}
    }}finally{clearTimeout(timeout);busy=false;buttons();}
  }
  save.addEventListener('click',()=>void mutate('draft'));send.addEventListener('click',()=>void mutate('send'));remove.addEventListener('click',()=>void mutate('delete'));
  history.addEventListener('click',async()=>{try{const data=await request('/teacher/session-comments/history?'+new URLSearchParams(target));if(!current())return;
    historyBox.replaceChildren(...data.history.map(note=>{const box=commentPanel({...note,visibility:'visible'});box.prepend(node('small',`Bản ${note.revision} · ${note.action==='hide'?'Đã ẩn':'Đã lưu'}`));return box;}));
  }catch(error){status.textContent=error.message;}});
  actions.append(save,send,more,menu);if(!compact)actions.append(history);section.append(hint,input,count,actions,status,historyBox);buttons();
  queueMicrotask(()=>void load());
  return {element:section,focus(){focusWhenReady=true;if(ready&&editing)input.focus();input.scrollIntoView({block:'center',behavior:'smooth'});}};
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
