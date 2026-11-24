import {departureWarning} from '../k56-offline-shared/exam-departure-v1.mjs';

const skillLabels = {reading:'Reading',listening:'Listening',writing:'Writing'};
const departureInstruction='Muốn nộp phần đang làm khi rời bài, hãy dùng nút Tải lại trang hoặc Rời trang ngay trong bài thi rồi xác nhận. Khi hệ thống chưa nhận được xác nhận, nháp và lượt thi của bạn được giữ.';

function ask(action,finalSkill) {
  const dialog=document.createElement('dialog');
  dialog.className='panel exam-departure-dialog';
  dialog.setAttribute('aria-label','Xác nhận rời bài thi');
  const heading=document.createElement('h2');
  heading.textContent=action==='reload'?'Tải lại bài thi':'Rời trang bài thi';
  const copy=document.createElement('p');
  copy.textContent=departureWarning(finalSkill);
  const form=document.createElement('form');
  form.method='dialog';
  form.className='exam-departure-actions';
  const stay=document.createElement('button');
  stay.className='button button-secondary';
  stay.value='stay';
  stay.autofocus=true;
  stay.textContent='Ở lại làm bài';
  const confirm=document.createElement('button');
  confirm.className='button button-primary';
  confirm.value='confirm';
  confirm.textContent=action==='reload'?'Tải lại và nộp phần này':'Rời trang và nộp phần này';
  form.append(stay,confirm);
  dialog.append(heading,copy,form);
  document.body.append(dialog);
  return new Promise(resolve=>{
    dialog.addEventListener('close',()=>{
      const accepted=dialog.returnValue==='confirm';
      dialog.remove();
      resolve(accepted);
    },{once:true});
    dialog.showModal();
  });
}

export function createK67VerifiedExamDeparture({state,lock,saveDraft,observe,changed}) {
  let armed, dialogOpen=false, navigating=false, mountHost;
  const disarm=event=>{if(event.isTrusted)armed=null;};

  function arm(event) {
    const {skill,saving}=state();
    if(navigating||!skill&&!saving)return false;
    event.preventDefault();
    event.returnValue=true;
    if(event.isTrusted&&skill){
      armed=skill;
      observe('exam_departure_guard_requested',{section:skill,action:'native'});
      preserveDraft(skill);
    }
    return true;
  }

  function preserveDraft(skill) {
    void saveDraft().catch(()=>observe('exam_departure_draft_save_failed',{section:skill,action:'native'}));
  }

  function handlePageHide(event) {
    if(!event.isTrusted)return;
    const {skill}=state();
    const nativePromptRequested=Boolean(armed&&armed===skill);
    armed=null;
    if(navigating||!skill)return;
    // Browser lifecycle events do not tell the application which prompt button was pressed.
    observe('exam_departure_unconfirmed',{section:skill,action:'native_pagehide',nativePromptRequested,choice:'unknown'});
    preserveDraft(skill);
  }

  async function request(action,navigate) {
    const {skill,finalSkill,saving}=state();
    if(dialogOpen||saving)return false;
    if(!skill){await navigate();return true;}
    dialogOpen=true;
    changed.dispatchEvent(new Event('departure-start'));
    try{
      observe('exam_departure_guard_requested',{section:skill,action});
      if(!await ask(action,finalSkill)){
        observe('exam_departure_stayed',{section:skill,action});
        return false;
      }
      if(!await lock(skill,action))return false;
      navigating=true;
      if((await navigate())===false){navigating=false;return false;}
      return true;
    }catch{
      navigating=false;
      changed.dispatchEvent(new Event('departure-error'));
      return false;
    }finally{dialogOpen=false;}
  }

  function mount(host) {
    if(!host||mountHost)return;
    mountHost=host;
    const note=document.createElement('aside');
    note.className='writing-save-status exam-departure-note';
    note.setAttribute('aria-label','Quy tắc rời trang');
    const copy=document.createElement('p');
    const status=document.createElement('p');
    status.setAttribute('role','status');
    const reload=document.createElement('button');
    reload.type='button';
    reload.className='button button-secondary';
    reload.textContent='Tải lại trang';
    reload.addEventListener('click',()=>void request('reload',()=>location.reload()));
    const leave=document.createElement('button');
    leave.type='button';
    leave.className='button button-secondary';
    leave.textContent='Rời trang';
    leave.addEventListener('click',()=>void request('leave',()=>location.assign(new URL('../',document.baseURI))));
    const actions=document.createElement('div');
    actions.className='exam-departure-actions';
    actions.append(reload,leave);
    note.append(copy,actions,status);
    host.prepend(note);
    document.addEventListener('pointerdown',disarm,true);
    document.addEventListener('keydown',disarm,true);
    host.addEventListener('click',event=>{
      if(event.defaultPrevented||event.button||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||!state().skill)return;
      const link=event.target.closest?.('a[href]');
      if(!link||link.hasAttribute('download')||(link.target&&link.target!=='_self'))return;
      const target=new URL(link.href);
      if(!['http:','https:'].includes(target.protocol)||
        target.origin===location.origin&&target.pathname===location.pathname&&target.search===location.search)return;
      event.preventDefault();
      void request('leave',()=>location.assign(target.href));
    });
    let failed=false;
    function render(){
      const {skill,finalSkill,departed,received,review}=state();
      note.hidden=!skill&&!departed&&!failed;
      copy.hidden=actions.hidden=!skill;
      const rule=skill?departureInstruction+' '+(finalSkill
        ?'Nếu đã nộp phần này, lần mở lại sẽ hiện màn hình kết thúc bài thi.'
        :'Sau khi nộp phần này, lần mở lại sẽ chuyển sang phần tiếp theo.'):'';
      if(copy.textContent!==rule)copy.textContent=rule;
      const label=skillLabels[departed];
      const message=failed?'Chưa khóa được phần thi trên thiết bị. Bài vẫn đang mở để bạn giữ câu trả lời.'
        : !label?''
        : received?'Máy chủ đã nhận phần '+label+'.'
        : review?'Phần '+label+' đã khóa trên thiết bị. Hãy báo giảng viên để đối soát.'
        : 'Phần '+label+' đã khóa trên thiết bị. Đang chờ máy chủ xác nhận.';
      status.hidden=!message;
      if(status.textContent!==message)status.textContent=message;
    }
    changed.addEventListener('change',render);
    changed.addEventListener('departure-start',()=>{failed=false;render();});
    changed.addEventListener('departure-error',()=>{failed=true;render();});
    render();
  }

  return {arm,handlePageHide,request,mount,state,reopen:()=>{navigating=true;}};
}
