(function () {
  const range = (start,end,kind='text',options) => Array.from({length:end-start+1},(_,i)=>({number:start+i,kind,...(options?{options}:{})}));
  window.TERM_TEST_CONFIG = Object.freeze({
    slug:'mini-test-k56', title:'Mini Test · Khóa 56', intro:'Làm bài trực tiếp trên đề; bài làm của Mini Test được lưu riêng.',
    listening:{title:'Listening · 10 câu',durationSeconds:446,totalQuestions:10,
      description:['Preston Park Run · 10 câu.','Audio Section 1 từ nguồn Notion do người dùng cung cấp.'],controls:range(1,10)},
    reading:{title:'Reading · 1 passage · 13 câu',durationMinutes:25,totalQuestions:13,
      description:['Bạn có 25 phút để hoàn thành 13 câu.'],controls:[...range(1,5),...range(6,9,'select',['TRUE','FALSE','NOT GIVEN']),...range(10,13)]},
    writing:{durationMinutes:15,planningMinutes:3,totalQuestions:1}
  });
}());
// BEGIN GENERATED EXAM JOURNAL STARTUP v1
// Install synchronously before the app. Observation only; no identity or exam writes.
(function () {
  'use strict';
  try {
  if(typeof window==='undefined'||typeof document==='undefined')return;
  const win=window,doc=document,cfg=win.TERM_TEST_APP_CONFIG,slug=win.TERM_TEST_CONFIG?.slug;
  if(cfg?.EXAM_JOURNAL_ENABLED!==true||typeof slug!=='string'||win.EXAM_JOURNAL_STARTUP)return;
  const script=doc.currentScript,standalone=new URL(script.src).pathname.endsWith('/exam-journal/lobby-capture.js');
  const bridgeUrl=new URL((standalone?'./':'../shared/exam-journal/')+'bridge.mjs?v=20261024-startup-v1',script.src).href;
  const endpoint=cfg.EXAM_JOURNAL_BASE_URL||(slug.startsWith('substitute-')
    ?new URL(cfg.API_BASE_URL,win.location.href).origin+'/substitute-journal-api/'+slug
    :cfg.API_BASE_URL+'/api/term-tests/'+slug);
  const controls=['bootstrapStudent','studentSelect','studentName','classCode','bootstrapClass'];
  const changes=new Set(['bootstrap-change-remembered-student','change-remembered-student','termTestChangeStudent','bootstrapChangeStudent','miniPaperChange','changeStudent','changeStudentButton']);
  const lobbyActions=new Set(['confirmIdentity','bootstrapConfirm','bootstrapConfirmPrefilled','bootstrapStart','bootstrapPreview','bootstrapRetry','bootstrapContinue','miniPaperEnter']);
  const queue=[],last=new Map(),listeners=[];
  let bridge=null,loading=false,busy=false,stopped=false,bytes=0,lost=0,ordinal=0,nextTry=0;
  const classCode=()=>{
    const value=doc.getElementById('classCode')?.value||doc.getElementById('bootstrapClass')?.value
      ||new URL(win.location.href).searchParams.get('class')||'';
    const code=String(value).trim().toUpperCase();return /^[A-Z0-9_-]{1,60}$/.test(code)?code:'';
  };
  function enqueue(type,data,capturedClass=classCode()){
    try{
      if(stopped)return;
      const row={type,data:{...data,stage:'initialization',checkpointState:{...data.checkpointState,
        observedAt:new Date().toISOString(),captureOrdinal:++ordinal,attribution:'unconfirmed',classCodeAtObservation:capturedClass,
        captureVersion:'20261024-startup-v1'}},classCode:capturedClass};
      const size=JSON.stringify(row).length*2;
      // Includes the in-flight batch. An unavailable journal cannot grow this queue.
      if(queue.length>=128||bytes+size>64*1024){lost++;return;}
      queue.push({row,size});bytes+=size;void drain();
    }catch{}
  }
  function selection(element){
    return {value:String(element.value||'').slice(0,160),
      label:element.tagName==='SELECT'?String(element.selectedOptions?.[0]?.textContent||'').trim().slice(0,160):''};
  }
  function scan(cause,event){
    try{
      for(const id of controls){
        const el=doc.getElementById(id);if(!el||!el.matches('input,select,textarea')||el.type==='password')continue;
        const selected=selection(el),state={...selected,disabled:!!el.disabled,count:el.options?.length||0},old=last.get(id);
        if(old&&JSON.stringify(old)===JSON.stringify(state))continue;
        last.set(id,state);
        const selectedChanged=old&&old.value!==state.value;
        enqueue('identity_observed',{fieldId:'identity:'+id,action:selectedChanged?'selection_changed':'selection_observed',
          identityConfirmed:false,trusted:event?.isTrusted===true,disabled:state.disabled,cause,
          checkpointState:{source:event?(event.isTrusted?'user_event':'synthetic_event'):'programmatic_or_initial',
            selected,previous:old?{value:old.value,label:old.label}:null,optionCount:state.count}});
      }
    }catch{}
  }
  async function drain(){
    if(stopped||busy||Date.now()<nextTry||!queue.length)return;
    const code=queue[0].row.classCode||classCode();
    if(!code)return; // Wait for a class hint; do not send an invalid/imagined class proof.
    if(!bridge){
      if(loading)return;loading=true;
      try{
        const {connectExamJournal}=await import(bridgeUrl);
        if(stopped)return;
        bridge=connectExamJournal({enabled:true,endpoint,testSlug:slug,build:cfg.EXAM_JOURNAL_BUILD||'unknown',adoptExistingState:false,
          getState:()=>({stage:'initialization',classCode:classCode(),generation:0,drafts:{}})});
      }catch{nextTry=Date.now()+5000;}finally{loading=false;}
      if(!bridge||stopped)return;
    }
    busy=true;
    // Class is captured at observation time. Never move old rows onto a later student/class.
    const batch=queue.filter(item=>!item.row.classCode||item.row.classCode===code).slice(0,32),lostAtStart=lost;
    try{
      await bridge.recordInitialization(batch.map(({row})=>row.classCode?row:{...row,data:{...row.data,
        checkpointState:{...row.data.checkpointState,scopeClassSource:'later_page_hint'}}}),{classCode:code,lostCount:lostAtStart});
      for(const item of batch){const index=queue.indexOf(item);if(index>=0){queue.splice(index,1);bytes-=item.size;}}
      lost-=lostAtStart;
    }catch{nextTry=Date.now()+5000;}finally{busy=false;}
  }
  function listen(target,type,fn){const safe=event=>{try{fn(event);}catch{}};target.addEventListener(type,safe,true);listeners.push(()=>target.removeEventListener(type,safe,true));}
  const lifecycle=event=>{scan(event.type);enqueue('state_observed',{action:event.type,checkpointState:{readyState:doc.readyState}});};
  for(const type of ['DOMContentLoaded','load','pageshow'])listen(type==='DOMContentLoaded'?doc:win,type,lifecycle);
  for(const type of ['focusin','focusout','click'])listen(doc,type,event=>{
    const el=event.target;if(!controls.includes(el?.id))return;
    scan(type,event);enqueue(type==='click'?'field_clicked':type==='focusin'?'field_focused':'field_blurred',
      {fieldId:'identity:'+el.id,action:type,trusted:event.isTrusted===true,identityConfirmed:false,checkpointState:{selected:selection(el)}});
  });
  listen(doc,'change',event=>{if(controls.includes(event.target?.id))scan('change',event);});
  listen(doc,'click',event=>{
    const el=event.target?.closest?.('button');if(!el||(!changes.has(el.id)&&!lobbyActions.has(el.id)))return;
    scan('before_lobby_action',event);enqueue('button_clicked',{action:changes.has(el.id)?'change_learner_requested':el.id,label:String(el.textContent||'').trim().slice(0,160),
      disabled:!!el.disabled,trusted:event.isTrusted===true,identityConfirmed:false,checkpointState:{controlId:el.id}});
  });
  listen(win,'pagehide',event=>{scan('pagehide');enqueue('page_hidden',{persisted:!!event.persisted});void bridge?.recorder.flush({keepalive:true});});
  const mutation=new MutationObserver(()=>scan('dom_updated'));
  mutation.observe(doc.body||doc.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','selected']});
  // A programmatic .value restore need not emit a DOM mutation or change event.
  const timer=win.setInterval(()=>{scan('periodic_snapshot');void drain();},1000);
  win.EXAM_JOURNAL_STARTUP={
    snapshot:scan,
    startRequest(route,options={}){
      try{
        const url=new URL(route,win.location.href),safe=url.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi,':id').slice(0,240);
        const requestId=crypto.randomUUID(),began=performance.now(),capturedClass=classCode();
        enqueue('request_started',{requestId,route:safe,method:String(options.method||'GET').slice(0,12)},capturedClass);
        let done=false;return {done(result,error,status){if(done)return;done=true;
          enqueue(error?'request_failed':'request_finished',{requestId,route:safe,durationMs:performance.now()-began,
            ...(Number.isInteger(status)?{status}:{}),operationStatus:error?'client_handler_failed':'client_handler_returned',
            errorCode:error?String(error.name||'Error').slice(0,80):''},capturedClass);scan('request_finished');}};
      }catch{return null;}
    },
    status:()=>({queued:queue.length,bytes,lostCount:lost}),
    stop(){stopped=true;clearInterval(timer);mutation.disconnect();for(const remove of listeners)remove();queue.length=0;bytes=0;}
  };
  enqueue('state_observed',{action:'capture_started',checkpointState:{readyState:doc.readyState}});scan('capture_started');
  } catch {} // An observer initialization failure must not escape into the host script.
}());
// END GENERATED EXAM JOURNAL STARTUP v1
