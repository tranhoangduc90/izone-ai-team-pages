// Runs before application scripts in immutable release pages.
const script=document.currentScript;
const match=new URL(script.src||script.dataset.releaseSource,location.origin).pathname.match(/^(.*\/progress-log)\/releases\/([a-f0-9]{16})\/progress-log\//);
if(match){
 const canonical=match[1]+'/'+location.pathname.split('/').at(-1);
 window.PROGRESS_LOG_RELEASE={version:match[2],root:match[1]+'/',entry:location.pathname.split('/').at(-1)};
 const worksheet=['index.html','thuy.html'].includes(window.PROGRESS_LOG_RELEASE.entry);
 if(worksheet){
  const appPath=new URL('/izone-ai-team-pages/progress-log/releases/9a9d8dc581494d24/progress-log/app.js',new URL(script.src||script.dataset.releaseSource,location.origin)).pathname;
  function reportStartupFailure(event){
   const target=event.target;
   if(target?.tagName!=='SCRIPT'||target.type!=='module'||new URL(target.src).pathname!==appPath)return;
   window.removeEventListener('error',reportStartupFailure,true);
   const showRetry=()=>{
    const notice=document.getElementById('notice');
    if(!notice||!document.body.classList.contains('progress-starting'))return;
    const retry=document.createElement('a');
    retry.textContent='Tải lại Phiếu';
    retry.href=canonical+location.search+location.hash;
    retry.addEventListener('click',event=>{
     if(retry.href!==location.href)return;
     event.preventDefault();
     location.reload();
    });
    notice.textContent='Chưa tải được giao diện Phiếu. Kiểm tra kết nối rồi thử lại.';
    notice.after(retry);
   };
   if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',showRetry,{once:true});
   else showRetry();
  }
  window.addEventListener('error',reportStartupFailure,true);
 }
 const publicToken=new URLSearchParams(location.hash.slice(1)).get('assignment');
 const api=window.PROGRESS_LOG_CONFIG?.API_BASE_URL;
 if(api&&worksheet&&
    /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(publicToken||'')){
  const request=fetch(api+'/api/learning/assignments/open',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({publicToken}),cache:'no-store',referrerPolicy:'no-referrer',
   signal:AbortSignal.timeout(5000)
  }).then(async response=>({status:response.status,ok:response.ok,payload:await response.json()})).catch(()=>null);
  window.progressLogOpeningRead={publicToken,request};
 }
 try{history.replaceState(history.state,'',canonical+location.search+location.hash);}catch{/* History failure must not stop the lesson. */}
}
