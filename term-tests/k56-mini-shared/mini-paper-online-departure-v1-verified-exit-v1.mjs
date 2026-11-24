import {createK67VerifiedExamDeparture} from '../k67-shared/exam-departure-verified-v1.mjs';

const skillLabels={listening:'Listening',reading:'Reading'};
const delays=[2000,5000,15000];
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
const canonical=answers=>JSON.stringify(Object.fromEntries(Object.entries(answers||{}).sort(([a],[b])=>a.localeCompare(b))));

function sameScope(value,scope) {
  return value?.attemptToken===scope.attemptToken && value?.examSessionToken===scope.examSessionToken &&
    value?.generation===scope.generation;
}

async function checkReceipt(data,entry) {
  const r=data?.receipt;
  if(data?.ok!==true || typeof data.persisted!=='boolean')throw Error('SUBMISSION_STATUS_UNKNOWN');
  if(!data.persisted)return null;
  if(r?.version!==1 || r.testSlug!=='mini-test-k56' || r.section!==entry.section ||
    !sameScope(r,entry.scope) || !Number.isFinite(Date.parse(r.submittedAt)))throw Error('SUBMISSION_RECEIPT_MISMATCH');
  const submitted=canonical(r.answers);
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(submitted));
  const hash=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
  if(r.snapshotHash!==hash)throw Error('SUBMISSION_RECEIPT_HASH_MISMATCH');
  if(submitted!==canonical(entry.body.answers))return {outcome:'review',response:data.response};
  return {outcome:'received',response:data.response};
}

export function mountMiniPaperOnlineDeparture({state,host,available,getSkill,getBody,save,request,onLocked,apply,observe}) {
  const changed=new EventTarget();
  let restoring=false;
  let sending=false;
  let timer;
  let attempts=0;
  let panel;

  function scope() {
    const {studentRef,examSessionToken,attemptToken,generation}=state;
    if(![studentRef,examSessionToken,attemptToken].every(uuid) || !Number.isSafeInteger(generation) || generation<0)return null;
    return {studentRef,examSessionToken,attemptToken,generation};
  }
  function departure() {
    const current=scope(),entry=state.confirmedOnlineDeparture;
    return current && entry?.scope?.studentRef===current.studentRef && sameScope(entry.scope,current)?entry:null;
  }
  const pending=()=>{const entry=departure();return entry?.outcome==='pending'?entry:null;};
  const notify=()=>changed.dispatchEvent(new Event('change'));
  const post=(path,body,entry,phase,keepalive=false)=>request('/api/term-tests/mini-test-k56/'+path,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),keepalive
  },{operationId:entry.operationId,phase});
  const guard=createK67VerifiedExamDeparture({
    changed,observe,
    async saveDraft(){if(!save())throw Error('LOCAL_PERSIST_FAILED');},
    state(){
      const section=available() && scope() && !pending()?getSkill():null;
      const entry=departure();
      return {skill:section,finalSkill:section && nextAfter(section)==='result',saving:sending,
        departed:entry?.section,received:entry?.outcome==='received',review:entry?.outcome==='review'};
    },
    async lock(section,action){
      if(!available() || getSkill()!==section || pending())return false;
      const owner=scope();
      if(!owner)return false;
      const previous=state.confirmedOnlineDeparture;
      const entry={section,scope:owner,action,operationId:crypto.randomUUID(),body:getBody(section,owner),
        outcome:'pending',next:nextAfter(section)};
      state.confirmedOnlineDeparture=entry;
      if(!save()){
        state.confirmedOnlineDeparture=previous;
        observe('exam_departure_lock_failed',{section,action,operationId:entry.operationId,errorCode:'LOCAL_PERSIST_FAILED'});
        throw Error('LOCAL_PERSIST_FAILED');
      }
      onLocked(section);
      observe('exam_departure_locked_on_device',{section,action,operationId:entry.operationId});
      notify();
      return true;
    }
  });
  guard.mount(host);

  function nextAfter(section) {
    const other=section==='reading'?'listening':'reading';
    return state[other+'Submitted']?'result':other;
  }
  function showPending() {
    const entry=pending();
    if(!entry)return false;
    if(!panel){
      panel=document.createElement('section');
      panel.className='panel transition-card';
      const heading=document.createElement('h2'), body=document.createElement('p'), button=document.createElement('button');
      body.textContent='Bản chốt được giữ trên thiết bị và sẽ gửi lại khi có mạng.';
      Object.assign(button,{type:'button',className:'button button-secondary',textContent:'Kiểm tra biên nhận'});
      button.addEventListener('click',retry);
      panel.append(heading,body,button);
      host.append(panel);
    }
    panel.hidden=false;
    panel.children[0].textContent=entry.next==='result'?'Kết thúc bài thi':'Chuẩn bị phần '+skillLabels[entry.next];
    panel.children[2].disabled=sending || !navigator.onLine;
    return true;
  }
  async function receipt(entry) {
    const {attemptToken,examSessionToken,generation}=entry.scope;
    const data=await post('submission-status',{attemptToken,examSessionToken,generation,section:entry.section},entry,'readback');
    return checkReceipt(data,entry);
  }
  async function official(entry) {
    const data=await post('attempt/active',{...entry.scope,classCode:entry.body.classCode,
      mode:state.examMode,identityConfirmed:true},entry,'readback');
    if(data.ok!==true || !sameScope(data,entry.scope) || data.attemptMode!=='answer_sheet')
      throw Error('SUBMISSION_SCOPE_CHANGED');
    return data;
  }
  async function restore() {
    const entry=pending();
    if(!restoring || !entry || sending || !navigator.onLine)return;
    sending=true;
    clearTimeout(timer);
    showPending();
    try {
      let resolution=await receipt(entry);
      let view;
      if(!resolution && !entry.conflict){
        try { await post(entry.section,entry.body,entry,'send'); }
        catch(error) {
          if(error.code==='EXAM_FIRST_SUBMISSION_ACCEPTED'){
            entry.conflict=true;
            save();
          }
          if(error.status && error.status<500 && ![409,429].includes(error.status))throw error;
        }
        resolution=await receipt(entry);
      }
      if(!resolution){
        view=await official(entry);
        if(view.officialProgress?.[entry.section]==='sealed' && view[entry.section+'Submitted']===true)
          resolution={outcome:'review',response:view};
      }
      if(!resolution)throw Error('SUBMISSION_RECEIPT_PENDING');
      if(pending()!==entry)return;
      const response=resolution.response;
      if(!sameScope(response,entry.scope) || (response.attemptMode||response.examDelivery)!=='answer_sheet' ||
        response[entry.section+'Submitted']!==true)
        throw Error('SUBMISSION_SCOPE_CHANGED');
      const previousReviews=state.onlineDepartureReviews;
      entry.outcome=resolution.outcome;
      if(entry.outcome==='review')state.onlineDepartureReviews={...previousReviews,[entry.section]:structuredClone(entry)};
      if(!save()){
        entry.outcome='pending';
        state.onlineDepartureReviews=previousReviews;
        throw Error('LOCAL_PERSIST_FAILED');
      }
      if(panel)panel.hidden=true;
      observe(resolution.outcome==='received'?'exam_departure_receipt_read':'exam_departure_needs_review',
        {section:entry.section,operationId:entry.operationId});
      const nextSection=response.completed?'result':nextAfter(entry.section);
      await apply({...response,nextSection},resolution.outcome);
    } catch(error) {
      if(pending()!==entry)return;
      observe('exam_departure_receipt_pending',{section:entry.section,operationId:entry.operationId,
        errorCode:error.code||error.message});
      if(navigator.onLine && attempts<delays.length)timer=setTimeout(()=>void restore(),delays[attempts++]);
    } finally {
      sending=false;
      if(restoring)showPending();
      notify();
    }
  }
  function retry(){attempts=0;void restore();}
  window.addEventListener('online',retry);
  window.addEventListener('offline',()=>{clearTimeout(timer);if(restoring)showPending();});
  return {...guard,notify,pending,
    reopenPending(){
      if(!showPending())return false;
      restoring=true;
      retry();
      return true;
    },
    sendOnLeave(){
      const entry=pending();
      if(entry && !entry.conflict && !sending && navigator.onLine)
        void post(entry.section,entry.body,entry,'send',true).catch(()=>{});
    }
  };
}
