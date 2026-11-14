// Runs before application scripts in immutable release pages.
const script=document.currentScript;
const match=new URL(script.src||script.dataset.releaseSource,location.origin).pathname.match(/^(.*\/progress-log)\/releases\/([a-f0-9]{16})\/progress-log\//);
if(match){
 const canonical=match[1]+'/'+location.pathname.split('/').at(-1);
 window.PROGRESS_LOG_RELEASE={version:match[2],root:match[1]+'/',entry:location.pathname.split('/').at(-1)};
 const publicToken=new URLSearchParams(location.hash.slice(1)).get('assignment');
 const api=window.PROGRESS_LOG_CONFIG?.API_BASE_URL;
 if(api&&['index.html','thuy.html'].includes(window.PROGRESS_LOG_RELEASE.entry)&&
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
