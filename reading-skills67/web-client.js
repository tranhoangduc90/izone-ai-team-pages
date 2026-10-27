/* Kết nối máy chủ thử: lưu tuần tự theo revision và mutation ID bền qua retry.
   Nháp dự phòng ở thiết bị không được báo là đã lưu máy chủ. Phản hồi chỉ đọc
   đúng attempt của phiên hiện hành; đổi người hủy kết quả đang chờ ở màn cũ. */
(function(){
  'use strict';
  if(new URLSearchParams(location.search).get('server')!=='1'&&!window.READING67_API_BASE)return;
  const prefix=window.READING67_API_BASE||new URL('../api/reading-skills67',location.href).pathname;
  let revision=0,identity=null,content=null,pending=null,processing=null,timer=null,pollTimer=null,generation=0,backupKey='',submitKey='',access=null,runNo=1,initialHistory=null;
  const state={status:'loading',savedAt:null,error:null,conflict:false,completeness:null,homework:null};
  let homeworkTimer=null,homeworkRead=0;
  function emit(){window.dispatchEvent(new CustomEvent('reading67:server-state',{detail:{...state,revision}}));}
  async function request(url,options={},repeat=true){
    let response;
    try{response=await fetch(url,{credentials:'include',...options,headers:{'Content-Type':'application/json',...window.Reading67Access?.headers,...options.headers},signal:AbortSignal.timeout(30000)});}
    catch(error){if(repeat)return request(url,options,false);throw Object.assign(new Error('Mất kết nối máy chủ. Bản đang viết được giữ trên thiết bị.'),{code:'NETWORK_ERROR'});}
    const value=await response.json();if(!response.ok)throw Object.assign(new Error(value.error),{code:value.error,details:value.details,status:response.status});return value;
  }
  const json=(method,body)=>({method,body:JSON.stringify(body)});
  // Chỉ đọc trạng thái SQL; Google xử lý riêng. Không đổi ACK lưu bài khi Docs lỗi.
  async function refreshHomework(){
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
    if(access?.teacher)return false;
    pending={body:bodyOf(source),mutationId:crypto.randomUUID(),baseRevision:revision};saveBackup();
    state.status='dirty';state.error=null;emit();clearTimeout(timer);timer=setTimeout(()=>flush().catch(()=>{}),500);return false;
  }
  async function flush(){
    clearTimeout(timer);if(processing){await processing;return pending?flush():null;}
    if(state.conflict)throw Object.assign(new Error('Bản máy chủ đã thay đổi. Giữ bản đang viết và đối chiếu trước khi ghi tiếp.'),{code:'DRAFT_REVISION_CONFLICT'});
    if(!pending)return;
    const operation=pending;operation.baseRevision=revision;saveBackup();
    state.status='saving';emit();
    processing=(async()=>{
      try{
        const value=await request(prefix+'/draft',json('PUT',operation));
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
    if(access?.teacher){const w=access.work;identity=w.identity;content=w.content;revision=w.draft.revision;runNo=w.draft.runNo||1;state.savedAt=w.draft.savedAt;state.status='saved';initialHistory=w;return {content,identity,draft:w.draft,history:w.attempts,teacher:true,config:access.config};}
    let lesson;
    try{lesson=await request(prefix+'/lesson',{},false);}catch(error){if(error.status!==401||!access?.legacy)throw error;await request('/_preview/session',json('POST',{person:'A'}));lesson=await request(prefix+'/lesson');}
    identity=lesson.identity;content=lesson.content;
    backupKey='reading67-web-backup:'+identity.ownerId+':'+(content.type==='tfng'?identity.courseId+':':'')+content.code+':'+content.version;
    submitKey=backupKey+':submit';
    const [draft,history]=await Promise.all([request(prefix+'/draft'),request(prefix+'/attempts')]);
    revision=draft.revision;runNo=draft.runNo||1;initialHistory=history;state.savedAt=draft.savedAt;state.completeness=draft.completeness;state.status='saved';
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
    const value=await request(prefix+'/submit',json('POST',{revision,requestId}));refreshHomework();return value;
  }
  async function getAttempt(id){return request(prefix+(access?.teacher?window.Reading67Access.teacherPath:'')+'/attempts/'+encodeURIComponent(id));}
  function stopPoll(){generation++;clearTimeout(pollTimer);}
  function poll(id,onUpdate){
    stopPoll();const scope=generation;
    const work=async()=>{try{const value=await getAttempt(id);if(scope!==generation)return;onUpdate(value);refreshHomework();if(['queued','processing'].includes(value.status))pollTimer=setTimeout(work,1500);}catch(error){if(scope!==generation)return;onUpdate({status:'connection_error',errorCode:error.code});pollTimer=setTimeout(work,4000);}};
    work();
  }
  async function changePerson(person){await flush();stopPoll();await request('/_preview/session',json('POST',{person}));location.href=location.pathname+'?server=1';}
  async function getDraft(){
    const value=access?.teacher?(await request(prefix+window.Reading67Access.teacherPath)).draft:await request(prefix+'/draft');
    revision=value.revision;runNo=value.runNo||runNo;state.savedAt=value.savedAt;state.completeness=value.completeness;return value;
  }
  async function getHistory(){const value=await historyDetail();initialHistory=value;return value.attempts;}
  async function historyDetail(){return access?.teacher?await request(prefix+window.Reading67Access.teacherPath):await request(prefix+'/attempts');}
  async function changeIdentity(){await flush();stopPoll();await window.Reading67Access.change();}
  async function reset(){if(access?.teacher)throw Error('Giảng viên chỉ xem.');await flush();const receipt=await request(prefix+'/reset',json('POST',{baseRevision:revision,mutationId:crypto.randomUUID()}));revision=receipt.revision;runNo=receipt.runNo;state.savedAt=receipt.savedAt;state.completeness=receipt.completeness;refreshHomework();return receipt;}
  window.ReadingServerClient={initialize,schedule,flush,submit,getAttempt,getDraft,getHistory,historyDetail,poll,stopPoll,changePerson,changeIdentity,reset,state,get identity(){return identity;},get revision(){return revision;},get runNo(){return runNo;},get initialHistory(){return initialHistory;},get access(){return access;}};
}());
