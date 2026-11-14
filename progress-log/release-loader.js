// Stable entry. No student identity, answers or auth tokens leave the URL fragment.
const script=document.currentScript||document.querySelector('script[data-progress-entry]');
const entry=script?.dataset.progressEntry;
const root=new URL('./',script.src);
const local=['localhost','127.0.0.1'].includes(location.hostname)&&!new URLSearchParams(location.search).has('release-test');
async function startLocal(){
 if(document.readyState==='loading')await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
 for(const source of document.querySelectorAll('script[type="text/progress-source"]')){
  const tag=document.createElement('script');for(const attr of source.attributes)if(!['type','defer'].includes(attr.name))tag.setAttribute(attr.name,attr.value);
  tag.async=false;await new Promise((resolve,reject)=>{tag.onload=resolve;tag.onerror=reject;document.head.append(tag);});
 }
 await import(new URL(script.dataset.app,root));
}
if(local)void startLocal();
else{
 const version=script.dataset.fallback;
 // Pages publishes the entry and its immutable package in the same deploy.
 // The running app checks the independently verified version in the background.
 if(/^[a-f0-9]{16}$/.test(version||'')){
  const target=new URL('releases/'+version+'/progress-log/'+entry,root);target.search=location.search;target.hash=location.hash;location.replace(target);
 }else void startLocal();
}
