// Share in-flight reads only. Cancellation belongs to each caller; no stale result cache.
export function createReadCoordinator(){
 const pending=new Map();
 return function read(key,load,{signal}={}){
  if(signal?.aborted)return Promise.reject(signal.reason||new DOMException('Aborted','AbortError'));
  let task=pending.get(key);
  if(!task){const controller=new AbortController();task={controller,users:0};pending.set(key,task);
   task.promise=Promise.resolve().then(()=>load(controller.signal)).finally(()=>{if(pending.get(key)===task)pending.delete(key);});}
  task.users++;
  return new Promise((resolve,reject)=>{let done=false;
   const finish=(fn,value)=>{if(done)return;done=true;signal?.removeEventListener('abort',abort);task.users--;if(!task.users&&pending.get(key)===task){pending.delete(key);task.controller.abort();}fn(value);};
   const abort=()=>finish(reject,signal.reason||new DOMException('Aborted','AbortError'));
   signal?.addEventListener('abort',abort,{once:true});task.promise.then(value=>finish(resolve,value),error=>finish(reject,error));
  });
 };
}
