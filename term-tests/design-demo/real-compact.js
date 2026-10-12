// Gom thanh Listening và Reading; di chuyển nút gốc để giữ sự kiện, đồng hồ và dữ liệu.
(()=>{
 function arrange(){
  for(const [skill,label] of [['listening','Listening'],['reading','Reading']]){
   const form=document.getElementById(skill+'View');
   if(!form)continue;
   const title=document.getElementById(skill+'Title');
   if(title&&title.textContent!==label+' - 40 câu')title.textContent=label+' - 40 câu';
   const heading=form.querySelector('.cbt-test-heading');
   const controls=form.querySelector('.cbt-toolbar-controls');
   const actions=form.querySelector('.cbt-heading-actions');
   if(heading&&controls&&actions&&controls.parentElement!==heading)heading.insertBefore(controls,actions);
  }
 }
 const app=document.getElementById('app');
 if(!app)return;
 new MutationObserver(arrange).observe(app,{childList:true,subtree:true});
 arrange();
})();
