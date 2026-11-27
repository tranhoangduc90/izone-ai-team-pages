// One budget for pre-start work. A timed-out operation may finish in the browser,
// but its caller cannot continue to adopt state or unlock Start after wait().
export function preparationBudget(ms=10000){
  const controller=new AbortController();
  const error=()=>Object.assign(Error('ASSIGNMENT_PREPARATION_TIMEOUT'),{code:'ASSIGNMENT_PREPARATION_TIMEOUT'});
  const timer=setTimeout(()=>controller.abort(error()),ms);
  const check=()=>controller.signal.throwIfAborted();
  return {
    signal:controller.signal,check,
    wait(value){
      return new Promise((resolve,reject)=>{
        const aborted=()=>reject(controller.signal.reason);
        controller.signal.addEventListener('abort',aborted,{once:true});
        if(controller.signal.aborted)aborted();
        Promise.resolve(value).then(result=>{try{check();resolve(result);}catch(e){reject(e);}},reject)
          .finally(()=>controller.signal.removeEventListener('abort',aborted));
      });
    },
    close(){clearTimeout(timer);},
    cancel(){clearTimeout(timer);controller.abort(error());},
  };
}
