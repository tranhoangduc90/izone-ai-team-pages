(function(){
  'use strict';
  // Tab khác vừa reset đúng người/bài thì dừng lượt cũ và tải lại. Không gửi yêu cầu xóa.
  const code=String(new URLSearchParams(location.search).get('class')||'').trim().toUpperCase();
  if(!['CODEXDEMO56','CODEXDEMO806'].includes(code))return;
  addEventListener('storage',async event=>{
    const slug=window.TERM_TEST_CONFIG?.slug;
    const prefix=`izone-demo-reset:student:${code}:`;
    if(!slug||!event.newValue||!event.key?.startsWith(prefix)||!event.key.endsWith(`:${slug}`))return;
    const ref=event.key.slice(prefix.length,-slug.length-1);
    let current=document.getElementById('bootstrapStudent')?.value||document.getElementById('studentSelect')?.value;
    if(!current)for(const get of [()=>sessionStorage,()=>localStorage])try{
      const state=JSON.parse(get().getItem(`izone-test:${slug}:${code}`)||'{}');if(state.studentRef){current=state.studentRef;break;}
    }catch{}
    if(current!==ref)return;
    window.K56_DEMO_RESETTING=true;window.TERM_TEST_ALLOW_NAVIGATION=true;
    const {demoContext,clearStudentStorage}=await import('./model.js?v=20261020-v1');
    const course=code==='CODEXDEMO56'?'56':'67';
    const tests=course==='56'?{term1:'term-test-1-k56',term2:'term-test-2-k56',mini:'mini-test-k56'}:{term1:'term-test-1',term2:'term-test-2',mini:'mini-test-lesson-5'};
    const key=Object.entries(tests).find(([,s])=>s===slug)?.[0];if(!key)return;
    const storages=[];for(const get of [()=>localStorage,()=>sessionStorage])try{storages.push(get());}catch{}
    clearStudentStorage(demoContext(course,key),ref,storages);
    const url=new URL(location.href);for(const name of ['demoStudent','demoAttempt','attemptToken','examSessionToken'])url.searchParams.delete(name);
    if(course==='56')url.searchParams.set('reset','1');
    location.replace(url.href);
  });
}());
