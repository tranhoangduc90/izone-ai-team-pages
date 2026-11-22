import { mountAssignmentWaiting } from './assignment-browser.mjs?v=sitting-release-20261122';

// A lost start response must not turn a persisted running attempt into a new
// admission. The server validates this token and exact identity before resume.
export async function recoverAssignmentSession({api,testId,classCode,studentRef,storage=sessionStorage}) {
  const suffix=':'+ [testId,classCode,studentRef].join(':');
  for(let i=storage.length-1;i>=0;i--){
    const key=storage.key(i);
    if(!key?.startsWith('substitute-assignment:') || !key.endsWith(suffix))continue;
    const sittingId=key.slice('substitute-assignment:'.length,-suffix.length);
    const scope={sittingId,testId,classCode,studentRef},token=storage.getItem(key);
    try{
      const status=await api('student/status',{body:scope,token});
      if(status.canStart===true && ['running','starting'].includes(status.state))return {scope,token};
    }catch(error){
      if(['WAITING_SESSION_REQUIRED','SESSION_SCOPE_MISMATCH'].includes(error.message))continue;
      throw error;
    }
  }
  return null;
}

// Native callers supply immutable testId and the roster selection they already
// use. The server independently checks class, registration and attempt.
export function createStudentEntry({api,testId,target,enabledForClass,onError=()=>{}}) {
  let stop, retry, generation=0;
  const keyFor=(c,r)=>JSON.stringify([testId,c,r]);
  const admitted=new Map();
  const states=new Map();

  async function select({classCode,studentRef,onReady,label='Chuẩn bị bài'}) {
    const current=++generation;
    stop?.();
    clearTimeout(retry);
    admitted.clear();
    states.clear();
    target.replaceChildren();
    if (!enabledForClass(classCode)) return false;
    try{
      const recovered=await recoverAssignmentSession({api,testId,classCode,studentRef});
      const entry=recovered?{managed:true,classes:[{sittingId:recovered.scope.sittingId,classCode,label:classCode}]}:
        await api('student/entry',{query:{testId,classCode}});
      if (current!==generation) return true;
      if (!entry.managed) return false;
      if (!entry.classes.length) {
        target.textContent=entry.enabled && entry.state==='closed'?'Ngoài giờ thi':'Chưa có ca phù hợp với link này.';
        if(entry.enabled)retry=setTimeout(()=>{
          if(current===generation && target.isConnected)void select({classCode,studentRef,onReady,label});
        },5000);
        return true;
      }
      async function show(sittingId) {
        const selection=++generation;
        stop?.();
        const node=document.createElement('div');
        const scope={sittingId,testId,classCode,studentRef};
        const key=keyFor(classCode,studentRef);
        admitted.delete(key);
        states.delete(key);
        controls.replaceChildren(node);
        const cancel=await mountAssignmentWaiting(node,{api,scope,label,keepMonitoring:true,onState:state=>{
          if(selection===generation)states.set(key,state);
        },start:async session=>{
          if(selection!==generation) throw new Error('ASSIGNMENT_SELECTION_CHANGED');
          admitted.set(key,session);
          try {await onReady(session);} catch(error) {admitted.delete(key);throw error;}
        }});
        if(selection===generation)stop=cancel;else cancel();
      }
      const controls=document.createElement('section');
      controls.setAttribute('aria-label','Phiên chờ');
      if(entry.classes.length===1){target.append(controls);void show(entry.classes[0].sittingId);}
      else {
        const field=document.createElement('label');
        field.textContent='Ca thi ';
        const select=document.createElement('select');
        select.append(new Option('Chọn ca thi',''),...entry.classes.map(item=>new Option(item.label,item.sittingId)));
        select.onchange=()=>{
          if(select.value) void show(select.value);
          else {++generation;stop?.();controls.replaceChildren();}
        };
        field.append(select);target.append(field,controls);
      }
      return true;
    }catch(error){
      if (current===generation) {
        target.textContent='Chưa kiểm tra được quyền thi. Vui lòng thử lại.';
        onError(error);
        retry=setTimeout(()=>{
          if(current===generation && target.isConnected)void select({classCode,studentRef,onReady,label});
        },10000);
      }
      return true;
    }
  }
  return {
    select,
    session:({classCode,studentRef})=>admitted.get(keyFor(classCode,studentRef)),
    canStart:({classCode,studentRef})=>['assigned','starting','running'].includes(states.get(keyFor(classCode,studentRef))),
    clear(){++generation;stop?.();clearTimeout(retry);admitted.clear();states.clear();target.replaceChildren();},
  };
}

export const assignmentSessionHeaders = session => session ? {'X-Izone-Assignment-Session':session.token} : {};

export function bindFullAdmission({api,session,deviceId}) {
  return api('student/full-preparation',{body:{...session.scope,deviceId},token:session.token});
}
