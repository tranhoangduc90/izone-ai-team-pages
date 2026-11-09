// Stable entry. No student identity, answers or auth tokens leave the URL fragment.
const script=document.querySelector('script[data-progress-entry]');
const entry=script?.dataset.progressEntry;
const root=new URL('./',script.src);
const local=['localhost','127.0.0.1'].includes(location.hostname)&&!new URLSearchParams(location.search).has('release-test');
async function startLocal(){
 for(const source of document.querySelectorAll('script[type="text/progress-source"]')){
  const tag=document.createElement('script');for(const attr of source.attributes)if(!['type','defer'].includes(attr.name))tag.setAttribute(attr.name,attr.value);
  tag.async=false;await new Promise((resolve,reject)=>{tag.onload=resolve;tag.onerror=reject;document.head.append(tag);});
 }
 await import(new URL(script.dataset.app,root));
}
if(local)await startLocal();
else{
 let version=script.dataset.fallback;
 try{const response=await fetch('https://ducizone.ddns.net/mapping-api/api/learning/frontend-release',{cache:'no-store',signal:AbortSignal.timeout(5000),referrerPolicy:'no-referrer'});
  const payload=await response.json();if(response.ok&&payload.ok&&/^[a-f0-9]{16}$/.test(payload.version))version=payload.version;
 }catch{/* Offline: use the last complete package embedded in this entry. */}
 if(/^[a-f0-9]{16}$/.test(version||'')){
  const target=new URL('releases/'+version+'/progress-log/'+entry,root);target.search=location.search;target.hash=location.hash;location.replace(target);
 }else await startLocal();
}
