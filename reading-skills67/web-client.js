/* Kết nối máy chủ thử: lưu tuần tự theo revision và mutation ID bền qua retry.
   Nháp dự phòng ở thiết bị không được báo là đã lưu máy chủ. Phản hồi chỉ đọc
   đúng attempt của phiên hiện hành; đổi người hủy kết quả đang chờ ở màn cũ. */
(function(){
  'use strict';
  if(new URLSearchParams(location.search).get('server')!=='1')return;
  const prefix='/api/reading-skills67';
  let revision=0,identity=null,content=null,pending=null,processing=null,timer=null,pollTimer=null,generation=0,backupKey='',submitKey='';
  const state={status:'loading',savedAt:null,error:null,conflict:false,completeness:null};
  function emit(){window.dispatchEvent(new CustomEvent('reading67:server-state',{detail:{...state,revision}}));}
  async function request(url,options={},repeat=true){
    let response;
    try{response=await fetch(url,{...options,headers:{'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(18000)});}
    catch(error){if(repeat)return request(url,options,false);throw Object.assign(new Error('Mất kết nối máy chủ. Bản đang viết được giữ trên thiết bị.'),{code:'NETWORK_ERROR'});}
    const value=await response.json();if(!response.ok)throw Object.assign(new Error(value.error),{code:value.error,details:value.details,status:response.status});return value;
  }
  const json=(method,body)=>({method,body:JSON.stringify(body)});
  function bodyOf(source){return {answers:structuredClone(source.answers||{}),annotations:structuredClone(source.annotations||[]),notes:source.notes||'',flags:[...(source.flags||[])]};}
  function saveBackup(){try{localStorage.setItem(backupKey,JSON.stringify(pending));}catch{state.error='Không lưu được bản dự phòng trên thiết bị.';}}
  function schedule(source){
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
        revision=value.revision;state.savedAt=value.savedAt;state.completeness=value.completeness;
        if(pending===operation){pending=null;localStorage.removeItem(backupKey);state.status='saved';}
        else{pending.baseRevision=revision;saveBackup();state.status='dirty';}
        state.error=null;emit();return value;
      }catch(error){state.status='error';state.error=error.code||error.message;state.conflict=error.code==='DRAFT_REVISION_CONFLICT';emit();throw error;}
    })();
    try{await processing;}finally{processing=null;}
    if(pending)return flush();
  }
  async function initialize(){
    let lesson;
    try{lesson=await request(prefix+'/lesson',{},false);}catch(error){if(error.status!==401)throw error;await request('/_preview/session',json('POST',{person:'A'}));lesson=await request(prefix+'/lesson');}
    identity=lesson.identity;content=lesson.content;
    backupKey='reading67-web-backup:'+identity.ownerId+':'+content.code+':'+content.version;
    submitKey=backupKey+':submit';
    const [draft,history]=await Promise.all([request(prefix+'/draft'),request(prefix+'/attempts')]);
    revision=draft.revision;state.savedAt=draft.savedAt;state.completeness=draft.completeness;state.status='saved';
    let restored=false;
    try{const backup=JSON.parse(localStorage.getItem(backupKey)||'null');
      if(backup?.body&&backup.baseRevision===revision){pending=backup;draft.body=backup.body;state.status='dirty';restored=true;}
      else if(backup?.body&&JSON.stringify(backup.body)!==JSON.stringify(draft.body)){state.error='Có bản chưa lưu trên thiết bị cần đối chiếu.';}
    }catch{}
    emit();return {content,identity,draft,history:history.attempts,restored};
  }
  async function submit(){
    await flush();let remembered;
    try{remembered=JSON.parse(localStorage.getItem(submitKey)||'null');}catch{}
    const requestId=remembered?.revision===revision?remembered.requestId:crypto.randomUUID();
    localStorage.setItem(submitKey,JSON.stringify({revision,requestId}));
    return request(prefix+'/submit',json('POST',{revision,requestId}));
  }
  async function getAttempt(id){return request(prefix+'/attempts/'+encodeURIComponent(id));}
  function stopPoll(){generation++;clearTimeout(pollTimer);}
  function poll(id,onUpdate){
    stopPoll();const scope=generation;
    const work=async()=>{try{const value=await getAttempt(id);if(scope!==generation)return;onUpdate(value);if(['queued','processing'].includes(value.status))pollTimer=setTimeout(work,1500);}catch(error){if(scope!==generation)return;onUpdate({status:'connection_error',errorCode:error.code});pollTimer=setTimeout(work,4000);}};
    work();
  }
  async function changePerson(person){await flush();stopPoll();await request('/_preview/session',json('POST',{person}));location.href=location.pathname+'?server=1';}
  async function getDraft(){return request(prefix+'/draft');}
  async function getHistory(){return (await request(prefix+'/attempts')).attempts;}
  window.ReadingServerClient={initialize,schedule,flush,submit,getAttempt,getDraft,getHistory,poll,stopPoll,changePerson,state,get identity(){return identity;},get revision(){return revision;}};
}());
