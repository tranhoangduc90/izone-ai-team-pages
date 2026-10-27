let active=null;
const node=(tag,text='',className='')=>{const n=document.createElement(tag);n.textContent=text;n.className=className;return n;};
export function clearTeacherAudioRecovery(){if(active){active.close();active.remove();active=null;}}
export function openTeacherAudioRecovery({student,className,testSlug,testTitle=testSlug,request,isCurrent}){
  clearTeacherAudioRecovery();
  if(!document.getElementById('teacherAudioRecoveryStyle')){const link=document.createElement('link');link.id='teacherAudioRecoveryStyle';link.rel='stylesheet';link.href=new URL('./teacher-audio-recovery.css?v=20261026-v1&resilience=20261027-v1',import.meta.url).href;document.head.append(link);}
  const dialog=node('dialog','','teacher-audio-recovery'),title=node('h2','Hỗ trợ Listening · '+student.name),close=node('button','Đóng','button button-secondary');close.type='button';
  const notice=node('p','Đang đọc trạng thái đã lưu…'),details=node('p'),reason=node('textarea'),label=node('label','Lý do hỗ trợ'),stopped=document.createElement('input');
  reason.id='audioRecoveryReason';reason.maxLength=500;reason.rows=3;label.htmlFor=reason.id;
  stopped.type='checkbox';stopped.id='audioRecoveryStopped';const stoppedLabel=node('label','Tôi đã xác nhận tab hoặc thiết bị cũ đã dừng/đóng.');stoppedLabel.htmlFor=stopped.id;
  const confirmation=node('div','','teacher-audio-confirm');confirmation.append(stopped,stoppedLabel);
  const refresh=node('button','Cập nhật trạng thái','button button-secondary'),release=node('button','Gỡ khóa chuẩn bị','button'),transfer=node('button','Hỗ trợ chuyển thiết bị','button'),retry=node('button','Kiểm tra lại thao tác vừa gửi','button');
  for(const b of [refresh,release,transfer,retry])b.type='button';
  const actions=node('div','','teacher-audio-actions');actions.append(refresh,release,transfer,retry);release.hidden=transfer.hidden=retry.hidden=true;
  dialog.append(title,node('p',className+' · '+testTitle),node('p','Thao tác giữ nguyên bài làm và thời gian. Với bài đang nghe, xác nhận nơi cũ đã dừng trước khi chuyển.'),notice,details,label,reason,confirmation,actions,close);
  active=dialog;document.body.append(dialog);const valid=()=>active===dialog&&isCurrent();let state=null,pending=null,busy=false;
  close.addEventListener('click',clearTeacherAudioRecovery);dialog.addEventListener('cancel',event=>{event.preventDefault();clearTeacherAudioRecovery();});
  const scope={class:className,test:testSlug,student:student.ref};
  function render(value){
    state=value;release.hidden=!value.canReleasePreparation;transfer.hidden=!value.canTransferActive;
    details.textContent=!value.found?'Học viên chưa có phiên thi phù hợp.':
      `Đã lưu ${value.answeredCount} câu · Nháp phiên bản ${value.draftRevision} · Mốc nghe ${Math.floor(value.checkpointSeconds)} giây. `+
      (value.submittedAt?'Listening đã nộp.':value.startedAt?'Listening đã bắt đầu.':'Listening chưa bắt đầu.')+
      (!value.occupied?' Hiện không có khóa audio cần gỡ.':'');
  }
  async function load(){if(!valid()||busy||pending)return;busy=true;refresh.disabled=true;try{
    const result=await request('/api/term-tests/teacher/audio-recovery?'+new URLSearchParams(scope));
    if(valid()){render(result.state);notice.textContent='Trạng thái vừa được xác minh với máy chủ.';}
  }catch(error){if(valid())notice.textContent=error.message;}finally{busy=false;refresh.disabled=false;}}
  async function send(){if(!valid()||busy||!pending)return;busy=true;for(const b of [refresh,release,transfer,retry])b.disabled=true;
    try{
      const result=await request('/api/term-tests/teacher/audio-recovery',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(pending)});
      if(!valid())return;
      if(result?.ok!==true||result.recovered!==true||!result.state)throw Error('Máy chủ chưa xác nhận thao tác.');
      pending=null;retry.hidden=true;render(result.state);notice.textContent='Đã lưu thao tác hỗ trợ. Học viên có thể thử mở lại cùng bài; nháp và thời gian được giữ nguyên.';
    }catch(error){if(valid()){
      if([400,404,409].includes(error.status)){pending=null;retry.hidden=true;notice.textContent=error.message+' Hãy cập nhật trạng thái trước khi hỗ trợ lại.';}
      else{retry.hidden=false;notice.textContent='Chưa xác nhận được kết quả. '+error.message+' Bấm kiểm tra lại để đối chiếu cùng thao tác.';}
    }}
    finally{busy=false;for(const b of [refresh,release,transfer,retry])b.disabled=false;}
  }
  function begin(action){if(!valid()||busy||pending||!state)return;
    if(reason.value.trim().length<5){notice.textContent='Hãy ghi lý do hỗ trợ (ít nhất 5 ký tự).';reason.focus();return;}
    if(action==='transfer-active'&&!stopped.checked){notice.textContent='Cần xác nhận nơi cũ đã dừng hoặc đóng trước.';stopped.focus();return;}
    if(!window.confirm(`Xác nhận hỗ trợ Listening cho ${student.name}, lớp ${className}?`))return;
    pending={...scope,requestId:crypto.randomUUID(),expectedVersion:state.version,action,oldDeviceStopped:stopped.checked,reason:reason.value.trim()};void send();
  }
  release.addEventListener('click',()=>begin('release-preparation'));transfer.addEventListener('click',()=>begin('transfer-active'));retry.addEventListener('click',()=>void send());refresh.addEventListener('click',()=>void load());
  dialog.showModal();void load();
}
