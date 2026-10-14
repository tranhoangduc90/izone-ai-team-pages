// Lớp vỏ demo: nạp trước bootstrap, chỉ gom node gốc; không thay API/Storage/đồng hồ.
(()=>{
 const params=new URLSearchParams(location.search);
 const original=window.TERM_TEST_APP_CONFIG;
 if(params.get('mode')!=='saved')window.TERM_TEST_APP_CONFIG=Object.freeze({...original,API_BASE_URL:original.API_BASE_URL+'/api/term-tests/teacher/design-demo/trial'+(document.body.dataset.demoPaper==='true'?'/paper':'')});
 if(!params.has('class')){params.set('class','CODEXDEMO806');history.replaceState(null,'',location.pathname+'?'+params);}
 const root=document.getElementById('app');let queued=false;
 function arrange(){
  queued=false;
  for(const form of root.querySelectorAll('#bootstrapTemporaryStudentForm,#temporaryStudentForm')){
   const hint=form.querySelector('p'),prefix=document.body.dataset.demoPaper==='true'?'DESIGNP':'DESIGNC';
   const text='Người thử riêng của demo. Đặt mã tạm bắt đầu bằng '+prefix+', ví dụ '+prefix+'01. Dùng lại cùng mã để tiếp tục bài.';
   if(hint&&hint.textContent!==text)hint.textContent=text;
  }
  for(const skill of ['listening','reading']){
   const form=document.getElementById(skill+'View');if(!form)continue;
   const heading=form.querySelector('.cbt-test-heading'),controls=form.querySelector('.cbt-toolbar-controls'),actions=form.querySelector('.cbt-heading-actions');
   if(heading&&controls&&actions&&controls.parentElement!==heading)heading.insertBefore(controls,actions);
   const count=window.TERM_TEST_CONFIG?.[skill]?.controls?.length;
   const title=document.getElementById(skill+'Title'),label=skill==='listening'?'Listening':'Reading';
   if(title&&count&&title.textContent!==label+' – '+count+' câu')title.textContent=label+' – '+count+' câu';
   if(skill==='listening'&&heading){
    const card=form.querySelector('.cbt-audio-card');
    if(card&&card.parentElement!==heading)heading.insertBefore(card,controls||actions);
   }
  }
  for(const topbar of root.querySelectorAll('.topbar')){
   if(topbar.querySelector('.full-demo-links'))continue;
   const links=document.createElement('nav');links.className='full-demo-links';links.setAttribute('aria-label','Các bài demo');
   for(const [href,label]of [['../term-test-1-design-demo/','Term 1'],['../design-demo/','Term 2'],['../mini-test-lesson-5-design-demo/','Mini'],['../mini-test-lesson-5-paper-design-demo/','Phiếu Mini']]){const a=document.createElement('a');a.href=href;a.textContent=label;links.append(a);}
   const saved=document.createElement('a');saved.href=location.pathname+'?mode=saved';saved.textContent='Bài đã chấm';links.append(saved);topbar.append(links);
  }
 }
 new MutationObserver(()=>{if(!queued){queued=true;requestAnimationFrame(arrange);}}).observe(root,{subtree:true,childList:true});arrange();
})();
