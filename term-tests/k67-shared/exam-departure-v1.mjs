import {departureWarning} from '../k56-offline-shared/exam-departure-v1.mjs';

const skillLabels = {reading:'Reading',listening:'Listening',writing:'Writing'};

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

export function createK67ExamDeparture({state,lock,observe,changed}) {
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
    }
    return true;
  }

  function handlePageHide(event) {
    if(!event.isTrusted)return;
    const skill=armed;
    armed=null;
    if(!navigating&&skill&&state().skill===skill)
      void lock(skill,'native_pagehide').catch(()=>{});
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
    note.append(copy,status,reload);
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
      copy.hidden=reload.hidden=!skill;
      const rule=skill?departureWarning(finalSkill):'';
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
