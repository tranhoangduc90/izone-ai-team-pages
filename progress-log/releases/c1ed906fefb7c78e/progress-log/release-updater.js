export function createReleaseUpdater({version,readVersion,navigate,canApply=()=>false,canAutoApply=canApply,visible=()=>!document.hidden,notify=()=>{},interval=60000}){
 let target=null,pending=null,stopped=false,timer;
 async function apply(){if(!target||!canApply())return false;await navigate(target);return true;}
 async function check(){
  if(stopped||!visible())return;
  if(pending)return pending;
  pending=(async()=>{try{const next=await readVersion();if(stopped)return;if(next!==version&&/^[a-f0-9]{16}$/.test(next)){target=next;notify({available:true,apply});if(canAutoApply())await apply();}
   else if(next===version){target=null;notify({available:false,apply});}}catch{/* Keep the working page and drafts on network errors. */}finally{pending=null;}})();return pending;
 }
 function schedule(){clearTimeout(timer);if(!stopped)timer=setTimeout(async()=>{await check();schedule();},interval+Math.floor(Math.random()*3000));}
 schedule();return {check,apply,stop(){stopped=true;clearTimeout(timer);}};
}
if(typeof window!=='undefined'&&window.PROGRESS_LOG_RELEASE){
 const release=window.PROGRESS_LOG_RELEASE;let bar;
 let lastInteraction=Date.now();for(const event of ['pointerdown','keydown','scroll'])window.addEventListener(event,()=>{lastInteraction=Date.now();},{passive:true});
 const safe=()=>Date.now()-lastInteraction>15000&&Boolean(window.progressLogUpdateGuard?.());
 const routeKey=async()=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(release.entry+location.search+location.hash)))).map(n=>n.toString(16).padStart(2,'0')).join('');
 try{const stored=JSON.parse(sessionStorage.getItem('progress-log:update-position')||'null');
  if(stored&&stored.route===await routeKey()&&Date.now()-stored.at<120000){
   window.progressLogUpdatePresentation=stored.presentation;
   const restore=setInterval(()=>{if(!window.progressLogUpdateGuard?.())return;clearInterval(restore);sessionStorage.removeItem('progress-log:update-position');
    for(const id of stored.details||[]){const el=document.getElementById(id);if(el?.tagName==='DETAILS')el.open=true;}window.scrollTo(stored.x,stored.y);document.getElementById(stored.focus)?.focus({preventScroll:true});},100);
   setTimeout(()=>clearInterval(restore),15000);
  }
 }catch{/* Blocked storage does not erase or prevent the current workflow. */}
 const updater=createReleaseUpdater({version:release.version,canApply:()=>Boolean(window.progressLogUpdateGuard?.()),canAutoApply:safe,
  readVersion:async()=>{const r=await fetch('https://ducizone.ddns.net/mapping-api/api/learning/frontend-release',{cache:'no-store',signal:AbortSignal.timeout(5000),referrerPolicy:'no-referrer'});const p=await r.json();if(!r.ok||!p.ok)throw Error('Unavailable');return p.version;},
  navigate:async version=>{
   try{sessionStorage.setItem('progress-log:update-position',JSON.stringify({route:await routeKey(),at:Date.now(),x:scrollX,y:scrollY,focus:document.activeElement?.id,
    details:[...document.querySelectorAll('details[id][open]')].map(el=>el.id),presentation:window.progressLogCapturePresentation?.()}));}catch{}
   const url=new URL(release.root+'releases/'+version+'/progress-log/'+release.entry,location.origin);url.search=location.search;url.hash=location.hash;location.replace(url);
  },
  notify:({available,apply})=>{
   if(!available){bar?.remove();bar=null;return;}
   if(bar)return;bar=document.createElement('aside');bar.className='progress-release-notice';bar.setAttribute('role','status');
   const text=document.createElement('span');text.textContent='Có bản cập nhật mới. Nội dung đang làm vẫn được giữ.';
   const button=document.createElement('button');button.type='button';button.className='button';button.textContent='Cập nhật';
   button.addEventListener('click',async()=>{if(!await apply())text.textContent='Hãy lưu xong và quay về trang chủ hoặc Quản lý bài tập để cập nhật.';});bar.append(text,button);document.body.append(bar);
  }});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void updater.check();});window.addEventListener('online',()=>void updater.check());
 window.progressLogCheckUpdate=()=>updater.check();void updater.check();
}
