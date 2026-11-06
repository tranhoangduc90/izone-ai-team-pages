// Chuyển bản đang đọc ngay trong cột trái; không render lại phản hồi hoặc gọi API ghi.
export function setupSourceVersions(root,{storageKey,onSelect}={}){
  const tabs=[...(root?.querySelectorAll('[data-source-version]')||[])];
  if(!tabs.length)return;
  const panels=[...root.querySelectorAll('[data-source-panel]')],pane=root.querySelector('.source-column');
  let selected='original';
  if(storageKey){try{selected=sessionStorage.getItem(storageKey)||selected;}catch{/* Vẫn đọc được khi storage bị chặn. */}}
  function select(value,focus=false,resetScroll=true){
    const active=tabs.find(t=>t.dataset.sourceVersion===value&&!t.disabled)||tabs[0];
    tabs.forEach(tab=>{const on=tab===active;tab.setAttribute('aria-selected',String(on));tab.tabIndex=on?0:-1;});
    panels.forEach(panel=>{panel.hidden=panel.dataset.sourcePanel!==active.dataset.sourceVersion;});
    const prompt=root.querySelector('[data-source-prompt]');if(prompt)prompt.hidden=active.dataset.sourceVersion==='handout';
    if(resetScroll&&pane)pane.scrollTop=0;
    if(storageKey){try{sessionStorage.setItem(storageKey,active.dataset.sourceVersion);}catch{/* Lựa chọn vẫn hoạt động trong phiên. */}}
    if(focus)active.focus({preventScroll:true});
    onSelect?.(active.dataset.sourceVersion);
  }
  tabs.forEach(tab=>{tab.onclick=()=>{if(!tab.disabled)select(tab.dataset.sourceVersion);};});
  root.querySelector('[data-source-tablist]').addEventListener('keydown',event=>{
    if(event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
    const available=tabs.filter(t=>!t.disabled),at=available.indexOf(event.target);if(at<0)return;
    const target={ArrowRight:(at+1)%available.length,ArrowLeft:(at+available.length-1)%available.length,Home:0,End:available.length-1}[event.key];
    if(target===undefined)return;
    event.preventDefault();select(available[target].dataset.sourceVersion,true);
  });
  select(selected,false,false);
}
