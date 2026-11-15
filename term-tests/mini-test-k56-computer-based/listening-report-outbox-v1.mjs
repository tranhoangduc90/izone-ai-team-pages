import {captureListeningEvidence,renderListeningEvidence} from './listening-report-evidence-v1.mjs';

let connection;
const expiryMs=24*60*60*1000;
const retryMs=[1000,3000,10000,30000,60000];

function database(){
  if(!connection)connection=new Promise((resolve,reject)=>{
    const open=indexedDB.open('izone-mini-k56-listening-reports-v1',1);
    open.onupgradeneeded=()=>open.result.createObjectStore('reports');
    open.onsuccess=()=>resolve(open.result);
    open.onerror=()=>reject(open.error);
  }).catch(error=>{connection=undefined;throw error;});
  return connection;
}
async function stored(mode,callback){
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('reports',mode);
    const request=callback(tx.objectStore('reports'));
    tx.oncomplete=()=>resolve(request.result);
    tx.onabort=tx.onerror=()=>reject(tx.error||Error('LISTENING_REPORT_LOCAL_STORE'));
  });
}
async function keyFor(scope){
  const material=new TextEncoder().encode(JSON.stringify([scope.attemptToken,scope.generation,scope.ownerId]));
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',material));
  return Array.from(digest,x=>x.toString(16).padStart(2,'0')).join('');
}

const activeOutboxes=new WeakMap();
export function attachOfflineListeningReportOutbox(runtime){
  if(!runtime.active || runtime.record?.prepared?.offline?.listeningReportsEnabled!==true) return null;
  const run=runtime.record;
  if(activeOutboxes.has(run))return activeOutboxes.get(run);
  const scope={...runtime.scope};
  const active=()=>runtime.active && runtime.record===run && runtime.owned;
  const key=keyFor(scope);
  let busy=false;

  async function drain(){
    if(busy || !active() || navigator.onLine===false)return;
    busy=true;
    try{
      const id=await key;
      const row=await stored('readonly',store=>store.get(id));
      if(!row || !active())return;
      const now=Date.now();
      const receipt=run.receipts?.[row.operationId];
      if(row.expiresAt<=now || receipt?.status==='review_required'){
        await stored('readwrite',store=>store.delete(id));
        return;
      }
      if(row.nextAt>now || receipt?.status!=='accepted')return;
      const {operationId,positionSeconds,reportedAt,pngBase64,assetHash}=row;
      try{
        const response=await runtime.post('/listening/report',{...scope,mode:'offline',operationId,
          positionSeconds,reportedAt,audioHash:assetHash,...(pngBase64?{pngBase64}:{})});
        if(!response.incidentId)throw Error('LISTENING_REPORT_ACK_INVALID');
        await stored('readwrite',store=>store.delete(id));
      }catch(error){
        if([400,401,403,404,410].includes(error?.status)){
          await stored('readwrite',store=>store.delete(id));
          return;
        }
        const nextAt=Date.now()+retryMs[Math.min(row.failures,retryMs.length-1)];
        await stored('readwrite',store=>store.put({...row,failures:row.failures+1,nextAt},id));
      }
    }catch{/* The main exam remains independent of evidence storage. */}
    finally{busy=false;}
  }
  let timer;
  function stop(){
    clearInterval(timer);
    timer=undefined;
    window.removeEventListener('online',drain);
  }
  function start(){
    if(timer!==undefined || runtime.record!==run)return;
    timer=window.setInterval(()=>{
      if(runtime.record!==run){stop();return;}
      void drain();
    },3000);
    window.addEventListener('online',drain);
    void drain();
  }
  window.addEventListener('pagehide',stop);
  window.addEventListener('pageshow',event=>{if(event.persisted)start();});
  start();
  const outbox={
    watch({form,player,assetHash}){
      let evidence=null;
      form.addEventListener('term-test:listening-interrupted',()=>{
        if(!evidence || !active())return;
        const operationId=run.sections.listening?.operationId;
        if(!operationId)return;
        const view=evidence;
        evidence=null;
        // Enqueue after the native interrupt has been saved locally. Rendering and
        // journal/Telegram failures cannot hold the dialog, player or submission.
        window.setTimeout(async()=>{
          try{
            let pngBase64;
            try{pngBase64=renderListeningEvidence(view);}catch{}
            const id=await key;
            const {reportedAt,positionSeconds}=view;
            await stored('readwrite',store=>store.put({operationId,reportedAt,positionSeconds,assetHash,
              pngBase64,expiresAt:Date.now()+expiryMs,failures:0,nextAt:0},id));
            void drain();
          }catch{}
        },0);
      });
      return positionSeconds=>{
        try{
          evidence=captureListeningEvidence({player,form,
            reportedAt:new Date(runtime.now()).toISOString(),positionSeconds});
        }catch{ evidence=null; }
      };
    },
  };
  activeOutboxes.set(run,outbox);
  return outbox;
}

export function watchOnlineListeningReports({apiBase,attemptToken,examSessionToken,generation,active,form,player,assetHash}){
  let evidence, ownerId, prefix, timer, busy=false;
  const details={attemptToken,examSessionToken,generation};
  const sameRun=grant=>grant?.ownerId===ownerId&&Object.keys(details).every(key=>grant[key]===details[key]);
  async function drain(){
    if(busy||!prefix||!active()||navigator.onLine===false)return;
    busy=true;
    try{
      const id=await prefix;
      const rows=await stored('readonly',store=>store.getAll(IDBKeyRange.bound(id+':',id+':\uffff')));
      for(const row of rows){
        if(!active())break;
        const now=Date.now();
        if(now>=row.expiresAt||!sameRun(row.grant)){
          await stored('readwrite',store=>store.delete(row.id));
          continue;
        }
        if(row.nextAt>now)continue;
        let status;
        try{
          const {capability,...scope}=row.grant;
          const response=await fetch(apiBase+'/api/term-tests/mini-test-k56/listening/report',{
            method:'POST',headers:{'content-type':'application/json','x-term2-permit':capability},
            body:JSON.stringify({...scope,...row.position,mode:'online',...(row.pngBase64?{pngBase64:row.pngBase64}:{})}),
            signal:AbortSignal.timeout(8000),
          });
          status=response.status;
          if(response.ok&&!(await response.json()).incidentId)status=0;
        }catch{}
        if(status===202||[400,401,403,404,409,410].includes(status)){
          await stored('readwrite',store=>store.delete(row.id));
        }else{
          const nextAt=Date.now()+retryMs[Math.min(row.failures,retryMs.length-1)];
          await stored('readwrite',store=>store.put({...row,failures:row.failures+1,nextAt},row.id));
        }
      }
    }catch{/* Evidence storage must not block the exam. */}
    finally{busy=false;}
  }
  function stop(){
    clearInterval(timer);
    timer=undefined;
    window.removeEventListener('online',drain);
  }
  function start(){
    if(timer!==undefined||!prefix||!active())return;
    timer=window.setInterval(()=>{if(active())void drain();else stop();},3000);
    window.addEventListener('online',drain);
    void drain();
  }
  window.addEventListener('pagehide',stop);
  window.addEventListener('pageshow',event=>{if(event.persisted)start();});
  return {
    owner(id){
      if(!attemptToken||!examSessionToken)return;
      ownerId=id;
      prefix=keyFor({...details,ownerId});
      start();
    },
    capture(positionSeconds){
      evidence=undefined;
      if(!active()||!prefix)return;
      evidence=captureListeningEvidence({player,form,positionSeconds});
    },
    take(now){
      const view=evidence;
      evidence=undefined;
      if(!view||!active()||!prefix)return null;
      const reportedAt=new Date(Number.isFinite(now)?now:Date.now()).toISOString();
      return {view:{...view,reportedAt},position:{reportedAt,positionSeconds:view.positionSeconds,audioHash:assetHash}};
    },
    accepted(report,grant){
      if(!prefix||!active()||!sameRun(grant)||typeof grant.capability!=='string')return;
      window.setTimeout(async()=>{
        try{
          let pngBase64;
          try{pngBase64=renderListeningEvidence(report.view);}catch{}
          const id=(await prefix)+':'+grant.operationId;
          const row={id,grant,position:report.position,pngBase64,
            expiresAt:Date.now()+19*60*1000,failures:0,nextAt:0};
          await stored('readwrite',store=>store.put(row,id));
          void drain();
        }catch{}
      },0);
    },
  };
}
