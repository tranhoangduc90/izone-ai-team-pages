/* Kết nối máy chủ thử: lưu tuần tự theo revision và mutation ID bền qua retry.
   Nháp dự phòng ở thiết bị không được báo là đã lưu máy chủ. Phản hồi chỉ đọc
   đúng attempt của phiên hiện hành; đổi người hủy kết quả đang chờ ở màn cũ. */
(function(){
  'use strict';
  if(new URLSearchParams(location.search).get('server')!=='1'&&!window.READING67_API_BASE)return;
  const prefix=window.READING67_API_BASE||new URL('../api/reading-skills67',location.href).pathname;
  const observerModule=new URL('../shared/test-state-observer.mjs?v=20261101-state1',document.currentScript?.src||new URL('web-client.js',location.href)).href;
  const journalModule=new URL('../shared/reading-homework-journal.mjs?v=20261105-r1',document.currentScript?.src||new URL('web-client.js',location.href)).href;
  let revision=0,identity=null,content=null,pending=null,processing=null,timer=null,pollTimer=null,generation=0,backupKey='',submitKey='',access=null,runNo=1,initialHistory=null;
  const state={status:'loading',savedAt:null,error:null,conflict:false,completeness:null,homework:null};
  let homeworkTimer=null,homeworkRead=0;
  let observer=null,observerTimer=null,observerStarting=false,observerCleanup=null,observationGeneration=0,unsupported=false,blocked=null,watchedId=null,watchedUpdate=null,lastAttempt=null,lastVisible=null;
  const visibleAttempt=value=>JSON.stringify([value.attemptId,value.status,value.errorCode,value.snapshot,value.result,value.validationProgress,value.recovery]);
  let practiceWatch=null,practiceFrame=null;
  let journal=null,journalBinding=null,journalEpoch=0;
  function bindJournal(context){
    const epoch=++journalEpoch;journalBinding=null;
    if(!context||context.ownerId!==identity?.ownerId||context.courseId!==identity?.courseId||context.runNo!==runNo){
      journal?.stop();journal=null;return;
    }
    if(journal){journalBinding=journal.bind(context);return;}
    void import(journalModule).then(module=>{
      if(epoch!==journalEpoch)return;
      journal=module.startReadingHomeworkJournal(prefix+'/journal-events');journalBinding=journal.bind(context);
    }).catch(()=>{});
  }
  function deliverPractice(frame,id){
    practiceFrame={frame,id};const watch=practiceWatch;if(!watch)return;
    const value=watch.attemptId?(watch.attemptId===id?frame.attemptPractice:null):frame.practice;if(!value)return;
    const signature=JSON.stringify(value);if(signature===watch.last)return;watch.last=signature;watch.update(value);
  }
  function practiceFallback(){practiceFrame=null;practiceWatch?.fallback?.();}
  const usesObservation=()=>!unsupported&&!blocked&&access?.config?.capabilities?.stateStream===true;
  function closeObservation(){observationGeneration++;practiceFrame=null;clearTimeout(observerTimer);observerTimer=null;observerStarting=false;observerCleanup?.();observerCleanup=null;observer?.close();observer=null;}
  function revoke(value){if(blocked)return;blocked=value;closeObservation();generation++;homeworkRead++;clearTimeout(timer);clearTimeout(pollTimer);clearTimeout(homeworkTimer);state.accessRevoked=value;state.error=value.code;state.status='error';emit();window.dispatchEvent(new CustomEvent('reading67:access-revoked',{detail:value}));}
  function deliverAttempt(value){const next=visibleAttempt(value);if(lastVisible===next)return;lastVisible=next;watchedUpdate?.(value);}
  function restartObservation(){
    if(!usesObservation())return false;
    closeObservation();observerStarting=true;const version=observationGeneration,scope=generation,id=watchedId,callback=watchedUpdate;
    observerTimer=setTimeout(async()=>{
      observerTimer=null;
      try{
        const {createTestStateObserver}=await import(observerModule);if(version!==observationGeneration||blocked)return;
        const active=()=>version===observationGeneration&&scope===generation&&!blocked;
        const path=prefix+(access?.teacher?window.Reading67Access.teacherPath:''),query=id?'?attemptId='+encodeURIComponent(id):'';
        let desired=null,applied=null,loading=false,retryTimer=null,detailEpoch=0,acceptedAttempt=null;const attemptController=new AbortController();
        observerCleanup=()=>{clearTimeout(retryTimer);attemptController.abort();};
        async function loadAttempt(){
          if(loading||!id)return;loading=true;let readEpoch=detailEpoch;
          try{while(active()&&desired!==applied){const target=desired;readEpoch=detailEpoch;const value=await getAttempt(id,{signal:attemptController.signal});if(!active())return;if(target===desired&&readEpoch===detailEpoch){applied=target;acceptedAttempt=value;deliverAttempt(value);}}}
          catch(error){if(active()&&readEpoch===detailEpoch){if([401,403,423].includes(error.status)){revoke({code:error.code,status:error.status});return;}callback?.({status:'connection_error',errorCode:error.code});clearTimeout(retryTimer);retryTimer=setTimeout(()=>{if(active())void loadAttempt();},Math.max(4000,error.retryAfterMs||0));}}
          finally{loading=false;}
        }
        // Khi cần REST dự phòng cho bài đang chờ, đọc hai nguồn độc lập cùng lúc.
        // Vẫn trả nguyên snapshot đầy đủ; bài kết thúc chỉ còn đọc trạng thái gọn.
        async function pollState({signal}){
          const statusRead=request(path+'/status'+query,{signal},false);
          const knownAttempt=acceptedAttempt||lastAttempt;
          if(!id||knownAttempt?.attemptId===id&&!['queued','processing'].includes(knownAttempt.status))return statusRead;
          const [value,attempt]=await Promise.all([statusRead,getAttempt(id,{signal})]);
          if(attempt.attemptId!==id)throw Object.assign(Error('ATTEMPT_IDENTITY_MISMATCH'),{code:'ATTEMPT_IDENTITY_MISMATCH',status:409});
          return {...value,status:attempt.status,errorCode:attempt.errorCode,revision:JSON.stringify([value.revision,visibleAttempt(attempt)]),polledAttempt:attempt};
        }
        observer=createTestStateObserver({url:path+'/events'+query,headers:{...window.Reading67Access?.headers},poll:pollState,
          onState(value){
            if(!active())return;state.trackingError=null;
            deliverPractice(value,id);
            if(access?.config?.homeworkEnabled&&!access.teacher){const jobs=value.jobs||[],last=jobs.filter(j=>j.kind==='status').at(-1),cta=jobs.find(j=>j.kind==='cta');const next={status:last?.status||'not_started',cta:cta?.status||'pending',jobs,hasTarget:value.hasDocumentTarget};if(JSON.stringify(next)!==JSON.stringify(state.homework)){state.homework=next;emit();}}
            if(id&&value.attemptId===id){desired=JSON.stringify([id,value.status,value.errorCode,value.resultRevision,value.validationRevision,value.recoveryRevision]);if(value.polledAttempt?.attemptId===id){detailEpoch++;acceptedAttempt=value.polledAttempt;
              // Hai GET song song không cùng snapshot: không gắn revision metadata vào chi tiết.
              desired=applied=JSON.stringify(['polled',visibleAttempt(value.polledAttempt)]);deliverAttempt(value.polledAttempt);
            }else void loadAttempt();}
          },
          onUnavailable(value){if(active()){state.trackingError=value.code;if(practiceWatch){practiceWatch.last=null;practiceWatch.update({status:'unavailable',message:'Chưa đọc được trạng thái link; bài đang viết vẫn được giữ.'});}callback?.({status:'connection_error',errorCode:value.code});}},
          onRevoked(value){if(active())revoke(value);},
          onUnsupported(){if(!active())return;unsupported=true;closeObservation();practiceFallback();refreshHomework();if(watchedId&&watchedUpdate)legacyPoll(watchedId,watchedUpdate,generation);}
        });
        observerStarting=false;
      }catch{if(version!==observationGeneration)return;observerStarting=false;unsupported=true;practiceFallback();refreshHomework();if(watchedId&&watchedUpdate)legacyPoll(watchedId,watchedUpdate,generation);}
    },0);
    return true;
  }
  function emit(){window.dispatchEvent(new CustomEvent('reading67:server-state',{detail:{...state,revision}}));}
  async function request(url,options={},repeat=true,observation){
    let response;
    if(blocked)throw Object.assign(new Error(blocked.code),{code:blocked.code,status:blocked.status});
    let observe;try{observe=observation?.binding?.begin(observation);}catch{}
    const report=(...args)=>{try{observe?.(...args);}catch{}};
    try{response=await fetch(url,{credentials:'include',...options,headers:{'Content-Type':'application/json',...window.Reading67Access?.headers,...options.headers},signal:options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(30000)]):AbortSignal.timeout(30000)});}
    catch(error){report('unknown');if(options.signal?.aborted)throw error;if(repeat)return request(url,options,false,observation);throw Object.assign(new Error('Mất kết nối máy chủ. Bản đang viết được giữ trên thiết bị.'),{code:'NETWORK_ERROR'});}
    let value;try{value=await response.json();}catch(error){report('unknown',response.status);throw error;}
    report(response.ok?'confirmed':'rejected',response.status,value?.revision??value?.draftRevision);
    if(!response.ok){const error=Object.assign(new Error(value.error),{code:value.error,details:value.details,status:response.status});const retry=response.headers.get('Retry-After');if(retry)error.retryAfterMs=/^\d+$/.test(retry)?Number(retry)*1000:Math.max(0,Date.parse(retry)-Date.now());throw error;}return value;
  }
  const json=(method,body)=>({method,body:JSON.stringify(body)});
  // Chỉ đọc trạng thái SQL; Google xử lý riêng. Không đổi ACK lưu bài khi Docs lỗi.
  async function refreshHomework(){
    if(blocked)return;
    if(usesObservation()){if(!observer&&!observerStarting)restartObservation();return;}
    if(!access?.config?.homeworkEnabled||access.teacher)return;
    const current=++homeworkRead;
    clearTimeout(homeworkTimer);
    try{const value=await request(prefix+'/homework',{},false);if(current!==homeworkRead)return;state.homework=value;}catch{if(current!==homeworkRead)return;state.homework={status:'unavailable'};}
    emit();const h=state.homework;
    if(h.status!=='not_started'&&h.status!=='blocked'&&!h.jobs?.some(j=>j.status==='blocked')&&!(h.status==='verified'&&h.cta==='verified'))homeworkTimer=setTimeout(refreshHomework,4000);
  }
  function bodyOf(source){return {answers:structuredClone(source.answers||{}),annotations:structuredClone(source.annotations||[]),notes:source.notes||'',flags:[...(source.flags||[])]};}
  function saveBackup(){try{localStorage.setItem(backupKey,JSON.stringify(pending));}catch{state.error='Không lưu được bản dự phòng trên thiết bị.';}}
  function schedule(source){
    if(access?.teacher||blocked)return false;
    pending={body:bodyOf(source),mutationId:crypto.randomUUID(),baseRevision:revision};saveBackup();
    state.status='dirty';state.error=null;emit();clearTimeout(timer);timer=setTimeout(()=>flush().catch(()=>{}),500);return false;
  }
  async function flush(){
    if(blocked)throw Object.assign(new Error(blocked.code),{code:blocked.code,status:blocked.status});
    clearTimeout(timer);if(processing){await processing;return pending?flush():null;}
    if(state.conflict)throw Object.assign(new Error('Bản máy chủ đã thay đổi. Giữ bản đang viết và đối chiếu trước khi ghi tiếp.'),{code:'DRAFT_REVISION_CONFLICT'});
    if(!pending)return;
    const operation=pending;operation.baseRevision=revision;saveBackup();
    const captured=journalBinding;
    try{captured?.queued(operation.mutationId,operation.baseRevision);}catch{}
    state.status='saving';emit();
    processing=(async()=>{
      try{
        const value=await request(prefix+'/draft'+(access?.config?.capabilities?.compactDraftAck?'?ack=compact-v1':''),json('PUT',operation),true,
          {binding:captured,kind:'draft.exchange',traceId:operation.mutationId,baseRevision:operation.baseRevision});
        revision=value.revision;runNo=value.runNo||runNo;state.savedAt=value.savedAt;state.completeness=value.completeness;
        if(pending===operation){pending=null;localStorage.removeItem(backupKey);state.status='saved';}
        else{pending.baseRevision=revision;saveBackup();state.status='dirty';}
        state.error=null;emit();refreshHomework();return value;
      }catch(error){state.status='error';state.error=error.code||error.message;state.conflict=error.code==='DRAFT_REVISION_CONFLICT';emit();throw error;}
    })();
    try{await processing;}finally{processing=null;}
    if(pending)return flush();
  }
  async function initialize(){
    access=await window.Reading67Access?.open();
    if(access?.teacher){const w=access.work;identity=w.identity;content=w.content;revision=w.draft.revision;runNo=w.draft.runNo||1;state.savedAt=w.draft.savedAt;state.status='saved';initialHistory=w;refreshHomework();return {content,identity,draft:w.draft,history:w.attempts,teacher:true,config:access.config};}
    let lesson;
    try{lesson=await request(prefix+'/lesson',{},false);}catch(error){if(error.status!==401||!access?.legacy)throw error;await request('/_preview/session',json('POST',{person:'A'}));lesson=await request(prefix+'/lesson');}
    identity=lesson.identity;content=lesson.content;
    backupKey='reading67-web-backup:'+identity.ownerId+':'+(['tfng','green-roofs','matching_people','sentence_completion'].includes(content.type)?identity.courseId+':':'')+content.code+':'+content.version;
    submitKey=backupKey+':submit';
    const [draftReceipt,history]=await Promise.all([request(prefix+'/draft'),request(prefix+'/attempts')]);
    const {readingJournal,...draft}=draftReceipt;
    revision=draft.revision;runNo=draft.runNo||1;initialHistory=history;state.savedAt=draft.savedAt;state.completeness=draft.completeness;state.status='saved';
    bindJournal(readingJournal);
    let restored=false;
    try{const backup=JSON.parse(localStorage.getItem(backupKey)||'null');
      if(backup?.body&&backup.baseRevision===revision){pending=backup;draft.body=backup.body;state.status='dirty';restored=true;}
      else if(backup?.body&&JSON.stringify(backup.body)!==JSON.stringify(draft.body)){state.error='Có bản chưa lưu trên thiết bị cần đối chiếu.';}
    }catch{}
    emit();refreshHomework();return {content,identity,draft,history:history.attempts,restored,config:access?.config};
  }
  async function submit(){
    await flush();let remembered;
    try{remembered=JSON.parse(localStorage.getItem(submitKey)||'null');}catch{}
    const requestId=remembered?.revision===revision?remembered.requestId:crypto.randomUUID();
    localStorage.setItem(submitKey,JSON.stringify({revision,requestId}));
    const value=await request(prefix+'/submit',json('POST',{revision,requestId}),true,
      {binding:journalBinding,kind:'submit.exchange',traceId:requestId,revision});
    lastAttempt=value;refreshHomework();return value;
  }
  async function getAttempt(id,options={}){const scope=generation,value=await request(prefix+(access?.teacher?window.Reading67Access.teacherPath:'')+'/attempts/'+encodeURIComponent(id),options);if(scope===generation)lastAttempt=value;return value;}
  function stopPoll(){generation++;clearTimeout(pollTimer);watchedId=null;watchedUpdate=null;lastVisible=null;if(usesObservation())restartObservation();}
  function legacyPoll(id,onUpdate,scope){
    const work=async()=>{try{const value=await getAttempt(id);if(scope!==generation||blocked)return;deliverAttempt(value);refreshHomework();if(['queued','processing'].includes(value.status))pollTimer=setTimeout(work,1500);}catch(error){if(scope!==generation||blocked)return;onUpdate({status:'connection_error',errorCode:error.code});pollTimer=setTimeout(work,4000);}};work();
  }
  function poll(id,onUpdate){
    stopPoll();const scope=generation;
    watchedId=id;watchedUpdate=onUpdate;lastVisible=lastAttempt?.attemptId===id?visibleAttempt(lastAttempt):null;
    if(!restartObservation())legacyPoll(id,onUpdate,scope);
  }
  async function changePerson(person){await flush();stopPoll();closeObservation();bindJournal(null);await request('/_preview/session',json('POST',{person}));location.href=location.pathname+'?server=1';}
  async function getDraft(){
    const {readingJournal,...value}=access?.teacher?(await request(prefix+window.Reading67Access.teacherPath)).draft:await request(prefix+'/draft');
    revision=value.revision;runNo=value.runNo||runNo;state.savedAt=value.savedAt;state.completeness=value.completeness;
    if(!access?.teacher)bindJournal(readingJournal);return value;
  }
  async function getHistory(){const value=await historyDetail();initialHistory=value;return value.attempts;}
  async function historyDetail(){return access?.teacher?await request(prefix+window.Reading67Access.teacherPath):await request(prefix+'/attempts');}
  async function changeIdentity(){await flush();stopPoll();closeObservation();bindJournal(null);await window.Reading67Access.change();}
  async function reset(){if(access?.teacher)throw Error('Giảng viên chỉ xem.');await flush();const {readingJournal,...receipt}=await request(prefix+'/reset',json('POST',{baseRevision:revision,mutationId:crypto.randomUUID()}));stopPoll();revision=receipt.revision;runNo=receipt.runNo;state.savedAt=receipt.savedAt;state.completeness=receipt.completeness;bindJournal(readingJournal);refreshHomework();return receipt;}
  async function practice(attemptId){const path=access?.teacher?'/teacher/work/'+encodeURIComponent(identity.courseId)+'/'+encodeURIComponent(identity.ownerId)+'/practice':'/practice';return request(prefix+path+(attemptId?'?attemptId='+encodeURIComponent(attemptId):''),{},false);}
  async function savePractice(body){return request(prefix+'/practice',json('POST',body));}
  function watchPractice(attemptId,update,fallback){
    if(!usesObservation()||!access?.config?.capabilities?.practiceState)return null;
    const watch={attemptId,update,fallback,last:null};practiceWatch=watch;
    if(practiceFrame)deliverPractice(practiceFrame.frame,practiceFrame.id);
    if(!observer&&!observerStarting)restartObservation();
    return ()=>{if(practiceWatch===watch)practiceWatch=null;};
  }
  window.ReadingServerClient={initialize,schedule,flush,submit,getAttempt,getDraft,getHistory,historyDetail,poll,stopPoll,changePerson,changeIdentity,reset,practice,savePractice,watchPractice,state,get identity(){return identity;},get revision(){return revision;},get runNo(){return runNo;},get initialHistory(){return initialHistory;},get access(){return access;}};
}());
