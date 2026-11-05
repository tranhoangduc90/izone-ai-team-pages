// Substitute's native panel has a fixed 680px minimum below a variable header.
// Measure available room only; keep forms, handlers and both reading panes.
export function installSubstituteLayout(root=document.body){
 if(root?.dataset.izoneConsumer!=='substitute-k67')return ()=>{};
 let frame=0;
 const maps=new WeakMap();
 const reveal=nav=>{
  const button=nav.contains(document.activeElement)?document.activeElement.closest('.cbt-question-button'):nav.querySelector('.cbt-question-button.is-active');
  if(!button)return;
  const n=nav.getBoundingClientRect(),b=button.getBoundingClientRect();
  if(n.width<=0||n.height<=0)return;
  if(b.left<n.left)nav.scrollLeft-=n.left-b.left+2;
  else if(b.right>n.right)nav.scrollLeft+=b.right-n.right+2;
 };
 const navResize=new ResizeObserver(entries=>{
  for(const {target:nav}of entries){const old=maps.get(nav),width=nav.clientWidth;maps.set(nav,width);if(old!==undefined&&old!==width)reveal(nav);}
 });
 const measure=()=>{
  frame=0;
  for(const form of root.querySelectorAll('#readingView:not([hidden]),#listeningView:not([hidden])')){
   const top=form.getBoundingClientRect().top+window.scrollY;
   const value=Math.max(240,Math.floor(window.innerHeight-top-12))+'px';
   if(form.style.getPropertyValue('--m170-substitute-panel-height')!==value)form.style.setProperty('--m170-substitute-panel-height',value);
  }
  for(const nav of root.querySelectorAll('#listeningView .cbt-question-nav'))if(!maps.has(nav)){maps.set(nav,nav.clientWidth);navResize.observe(nav);}
 };
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(measure);};
 // Header/identity/notice size and visible stage may change. Equal measurements
 // cause no style write, focus change or scrolling of passage/question panes.
 const size=new ResizeObserver(schedule);size.observe(root);
 const stages=new MutationObserver(schedule);stages.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
 const focus=event=>{const nav=event.target.closest?.('#listeningView .cbt-question-nav');if(nav)reveal(nav);};
 root.addEventListener('focusin',focus);window.addEventListener('resize',schedule);schedule();
 return ()=>{cancelAnimationFrame(frame);size.disconnect();stages.disconnect();navResize.disconnect();root.removeEventListener('focusin',focus);window.removeEventListener('resize',schedule);};
}
installSubstituteLayout();
