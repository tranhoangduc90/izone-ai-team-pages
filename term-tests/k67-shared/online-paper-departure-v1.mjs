import {createK67VerifiedExamDeparture} from './exam-departure-verified-v1.mjs';

const label={reading:'Reading',listening:'Listening',writing:'Writing'};
const canonical=answers=>JSON.stringify(Object.fromEntries(Object.entries(answers||{}).sort(([left],[right])=>left.localeCompare(right))));
const retryDelays=[2000,5000,15000];
const finalStateError=()=>Object.assign(new Error('Không đối chiếu được bản chốt.'),{code:'RECEIPT_CONFLICT'});

export function mountOnlinePaperDeparture({slug,host,scope,activeSkill,body,next,saveDraft,post,onLocked,onReceived,observe}) {
  const changed=new EventTarget();
  let timer, attempts=0, sending=false, panel;
  const identity=current=>current?.clientSubmissionId||current?.examSessionToken||current?.attemptToken;
  const key=current=>identity(current)?JSON.stringify(['k67-paper-departure-v1',slug,current.studentRef,current.classCode,
    current.generation,identity(current)]):null;
  function read() {
    const address=key(scope());
    if(!address)return null;
    try {return JSON.parse(localStorage.getItem(address)||'null');} catch {return null;}
  }
  const pending=()=>{const entry=read();return entry?.outcome==='received'?null:entry;};
  const notify=()=>changed.dispatchEvent(new Event('change'));

  const guard=createK67VerifiedExamDeparture({
    changed,observe,
    async saveDraft(){if(!saveDraft())throw Error('DRAFT_NOT_SAVED');},
    state(){
      const entry=read();
      const skill=pending()?null:activeSkill();
      return {skill,saving:sending,finalSkill:skill&&next(skill)==='result',
        departed:entry?.section,received:entry?.outcome==='received',review:entry?.outcome==='review'};
    },
    async lock(section,action){
      const current=scope(), address=key(current);
      if(!address||activeSkill()!==section||pending())return false;
      if(!saveDraft())throw Error('DRAFT_NOT_SAVED');
      const operationId=crypto.randomUUID();
      const snapshot=body(section,operationId);
      const entry={current,operationId,section,action,next:next(section),snapshot,outcome:'pending'};
      const persisted=JSON.stringify(entry);
      localStorage.setItem(address,persisted);
      if(localStorage.getItem(address)!==persisted)throw Error('DEPARTURE_NOT_SAVED');
      observe('exam_departure_locked_on_device',{section,action,operationId});
      onLocked(section);
      notify();
      void synchronize();
      return true;
    }
  });
  guard.mount(host);

  function showWaiting(entry) {
    if(!entry){if(panel)panel.hidden=true;return;}
    if(!panel){
      panel=document.createElement('section');
      panel.className='panel transition-card';
      panel.id='k67PaperOnlineDepartureWaiting';
      const heading=document.createElement('h2'), message=document.createElement('p'), retry=document.createElement('button');
      message.setAttribute('role','status');
      Object.assign(retry,{type:'button',className:'button button-secondary',textContent:'Kiểm tra biên nhận'});
      retry.addEventListener('click',retryNow);
      panel.append(heading,message,retry);
      host.prepend(panel);
    }
    const [heading,message,retry]=panel.children;
    heading.textContent=entry.next==='result'?'Kết thúc bài thi':'Chuẩn bị phần '+label[entry.next];
    message.textContent=entry.outcome==='review'?'Bản chốt được giữ trên thiết bị. Hãy báo giảng viên để đối soát.'
      :'Bản chốt đang chờ máy chủ xác nhận. Bạn có thể tiếp tục khi có kết nối.';
    retry.disabled=sending||!navigator.onLine||entry.outcome==='review';
    panel.hidden=false;
  }

  async function readReceipt(entry) {
    const {examSessionToken,attemptToken,clientSubmissionId,generation}=entry.current;
    const status={section:entry.section,generation,examSessionToken:examSessionToken||undefined,
      attemptToken:attemptToken||undefined,
      clientSubmissionId:!examSessionToken&&!attemptToken?clientSubmissionId:undefined};
    let data;
    try{data=await post('submission-status',status);}
    catch(error){
      if(status.clientSubmissionId&&error?.status===404&&error?.code==='SUBMISSION_NOT_FOUND')return null;
      throw error;
    }
    if(data?.ok!==true||typeof data.persisted!=='boolean')throw Error('RECEIPT_PENDING');
    if(!data.persisted)return null;
    const receipt=data.receipt;
    if(receipt?.version!==1||receipt.testSlug!==slug||receipt.section!==entry.section||receipt.generation!==generation||
       examSessionToken&&receipt.examSessionToken!==examSessionToken||attemptToken&&receipt.attemptToken!==attemptToken||
       !Number.isFinite(Date.parse(receipt.submittedAt)))throw finalStateError();
    const answers=canonical(receipt.answers);
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(answers));
    const hash=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
    if(hash!==receipt.snapshotHash||answers!==canonical(entry.snapshot.answers)||
       entry.snapshot.clientSubmissionId&&entry.snapshot.clientSubmissionId!==receipt.clientSubmissionId)
      throw finalStateError();
    return receipt;
  }

  async function synchronize() {
    const entry=pending(), address=key(scope());
    if(sending||!entry||entry.outcome!=='pending'||!navigator.onLine)return;
    const stillOwns=()=>key(scope())===address&&pending()?.operationId===entry.operationId;
    sending=true;
    clearTimeout(timer);
    showWaiting(entry);
    try{
      let receipt=await readReceipt(entry);
      if(!stillOwns())return;
      if(!receipt){
        try{await post(entry.section,entry.snapshot);}catch{ /* Read authoritative status even after a lost response. */ }
        receipt=await readReceipt(entry);
      }
      if(!stillOwns()||!receipt)return;
      localStorage.setItem(address,JSON.stringify({...entry,outcome:'received'}));
      observe('exam_departure_server_received',{section:entry.section,operationId:entry.operationId});
      notify();
      onReceived();
    }catch(error){
      if(!stillOwns())return;
      if(error?.code==='RECEIPT_CONFLICT')localStorage.setItem(address,JSON.stringify({...entry,outcome:'review'}));
      observe('exam_departure_receipt_pending',{section:entry.section,operationId:entry.operationId,
        errorCode:error?.code||'RECEIPT_PENDING'});
    }finally{
      sending=false;
      const latest=pending();
      showWaiting(latest);
      notify();
      if(latest?.outcome==='pending'&&navigator.onLine&&attempts<retryDelays.length)
        timer=setTimeout(()=>void synchronize(),retryDelays[attempts++]);
    }
  }

  function retryNow(){attempts=0;void synchronize();}
  window.addEventListener('online',retryNow);
  window.addEventListener('offline',()=>{clearTimeout(timer);showWaiting(pending());});

  function refresh(){
    const entry=pending();
    if(entry)onLocked(entry.section);
    showWaiting(entry);
    notify();
    if(entry&&!timer)void synchronize();
  }

  return {...guard,refresh,ownsStage:()=>Boolean(activeSkill()||pending())};
}
