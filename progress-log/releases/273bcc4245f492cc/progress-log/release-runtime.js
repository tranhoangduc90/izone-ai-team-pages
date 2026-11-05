// Runs before application scripts in immutable release pages.
const script=document.currentScript;
const match=new URL(script.src).pathname.match(/^(.*\/progress-log)\/releases\/([a-f0-9]{16})\/progress-log\//);
if(match){
 const canonical=match[1]+'/'+location.pathname.split('/').at(-1);
 window.PROGRESS_LOG_RELEASE={version:match[2],root:match[1]+'/',entry:location.pathname.split('/').at(-1)};
 try{history.replaceState(history.state,'',canonical+location.search+location.hash);}catch{/* History failure must not stop the lesson. */}
}
