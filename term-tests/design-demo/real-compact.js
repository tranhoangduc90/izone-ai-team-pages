// Gom thanh Listening theo thứ tự thao tác; di chuyển nút gốc để giữ sự kiện và dữ liệu.
(()=>{
 function arrange(){
  const form=document.getElementById('listeningView');
  if(!form)return;
  const title=document.getElementById('listeningTitle');
  if(title&&title.textContent!=='Listening - 40 câu')title.textContent='Listening - 40 câu';
  const heading=form.querySelector('.cbt-test-heading');
  const controls=form.querySelector('.cbt-toolbar-controls');
  const actions=form.querySelector('.cbt-heading-actions');
  if(heading&&controls&&actions&&controls.parentElement!==heading)heading.insertBefore(controls,actions);
 }
 const app=document.getElementById('app');
 if(!app)return;
 new MutationObserver(arrange).observe(app,{childList:true,subtree:true});
 arrange();
})();
