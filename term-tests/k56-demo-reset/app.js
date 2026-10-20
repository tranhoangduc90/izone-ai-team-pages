(async function () {
  'use strict';
  // Xác minh học viên qua roster trước khi reset một bài của lớp giả.
  // Lỗi hoặc mất phản hồi hiện thông báo; không reset cả lớp hoặc tự retry.
  const classCode=String(new URLSearchParams(location.search).get('class')||'').trim().toUpperCase();
  const config=window.TERM_TEST_CONFIG,root=document.getElementById('app');
  if(classCode!=='CODEXDEMO56'||!config||!root)return;
  const {demoContext,loadStudents,resetStudent,clearStudentStorage,resetSignal}=await import('../demo/model.js?v=20261020-v1');
  const key=Object.entries({term1:'term-test-1-k56',term2:'term-test-2-k56',mini:'mini-test-k56'}).find(([,slug])=>slug===config.slug)?.[0];
  if(!key)return;
  const context=demoContext('56',key),button=document.createElement('button');
  button.type='button';button.className='k56-reset-button';button.textContent='Reset học viên đang chọn';
  let busy=false;
  function selected(){return document.getElementById('bootstrapStudent')?.value||document.getElementById('studentSelect')?.value||'';}
  function update(){
    const header=root.querySelector('.topbar')||root.querySelector('header');
    if(header&&button.parentElement!==header){header.classList.add('k56-reset-header');header.append(button);}
    button.disabled=busy||!selected();
  }
  button.addEventListener('click',async()=>{
    if(busy)return;
    const ref=selected();if(!ref)return;
    busy=true;update();
    try{
      const students=await loadStudents(context),student=students.find(s=>s.ref===ref);
      if(!student)throw new Error('Hãy chọn lại đúng học viên demo.');
      if(!confirm(`Reset ${config.title||'bài đang mở'} của ${student.name}? Dữ liệu học viên khác được giữ nguyên.`))return;
      window.K56_DEMO_RESETTING=true;button.textContent='Đang reset…';
      await resetStudent(context,ref);
      const storages=[];for(const get of [()=>localStorage,()=>sessionStorage])try{storages.push(get());}catch{}
      clearStudentStorage(context,ref,storages);
      try{localStorage.setItem(resetSignal(context,ref),crypto.randomUUID());}catch{}
      window.TERM_TEST_ALLOW_NAVIGATION=true;
      const url=new URL(location.href);url.searchParams.set('reset','1');
      for(const name of ['demoStudent','demoAttempt','attemptToken','examSessionToken'])url.searchParams.delete(name);
      location.replace(url.href);
    }catch(error){window.K56_DEMO_RESETTING=false;alert(`Chưa xác nhận reset: ${error.message}`);}
    finally{busy=false;button.textContent='Reset học viên đang chọn';update();}
  });
  new MutationObserver(update).observe(root,{childList:true,subtree:true});
  root.addEventListener('change',update);update();
}());
