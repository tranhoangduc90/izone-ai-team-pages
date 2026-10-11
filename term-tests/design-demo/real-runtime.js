// Tách hoàn toàn endpoint lưu/nộp của renderer khỏi backend bài thi.
// Dữ liệu riêng tư không đi vào Storage thật; bảng màu vẫn được nhớ như demo trước.
(()=>{
 const ctx=window.REAL_DEMO, saved=ctx.mode==='saved', original=window.localStorage, mem=new Map();
 const memory={get length(){return mem.size;},key:i=>[...mem.keys()][i]??null,
 getItem:k=>k.startsWith('izone-demo-color-')?original.getItem(k):mem.get(k)??null,
 setItem(k,v){if(k.startsWith('izone-demo-color-'))original.setItem(k,v);else{mem.set(k,String(v));if(!saved&&k.startsWith('izone-test:')){try{const s=JSON.parse(v);Object.assign(ctx.trial,{listening:s.drafts?.listening||{},reading:s.drafts?.reading||{},task1:s.drafts?.writing?.task1||'',task2:s.drafts?.writing?.task2||''});}catch{}}}},
 removeItem:k=>mem.delete(k),clear:()=>mem.clear()};
 for(const key of ['localStorage','sessionStorage'])Object.defineProperty(window,key,{value:memory,configurable:true});
 const source=saved?ctx.snapshot:ctx.trial, screen=ctx.screen;
 const now=()=>new Date().toISOString(), later=m=>new Date(Date.now()+m*60000).toISOString();
 const ref='11111111-1111-4111-8111-111111111111',token='22222222-2222-4222-8222-222222222222';
 let completed=['writing','result'].includes(screen),listeningSubmitted=screen!=='listening',writingStarted=['writing','result'].includes(screen),writingSubmitted=screen==='result';
 const name=saved?source.name:'Bản thử riêng của bạn',deadline=later(60),baseUrl=new URL('private-demo-adapter',location.href).href;
 window.TERM_TEST_APP_CONFIG={API_BASE_URL:baseUrl,AUTH_MODE:'preview'};
 window.DESIGN_PREVIEW_SCREEN=screen;window.TERM_TEST_CONTENT=ctx.content;
 window.TERM_TEST_BOOTSTRAP={examSessionToken:token,serverNow:now(),listeningDeadlineAt:later(33),skipListeningAudio:true};
 const seed={studentRef:ref,studentName:name,examSessionToken:token,attemptToken:screen==='listening'?'':token,listeningDeadlineAt:later(33),readingDeadlineAt:screen==='reading'?deadline:'',writingDeadlineAt:deadline,completed,listeningSubmitted,writingStarted,writingSubmitted,drafts:{listening:source.listening||{},reading:source.reading||{},writing:{task1:source.task1||'',task2:source.task2||'',outline:''}}};
 mem.set('izone-test:term-test-2:DEMO67',JSON.stringify(seed));
 const base=()=>({ok:true,studentRef:ref,studentName:name,className:'IC2200 · Demo',attemptToken:token,examSessionToken:token,serverNow:now(),content:ctx.content,completed,listeningSubmitted,listeningDraft:source.listening||{},readingDraft:source.reading||{},readingDeadlineAt:screen==='reading'?deadline:null,listeningDeadlineAt:later(33),readingStartedAt:listeningSubmitted?now():null});
 const writing=()=>({started:writingStarted,submitted:writingSubmitted,accepted:true,revision:source.revision||0,task1:source.task1||'',task2:source.task2||'',deadlineAt:deadline,grading:saved?source.grading:{ready:false,status:'review_required',tasks:[]}});
 const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
 const nativeFetch=window.fetch.bind(window);
 window.fetch=async(input,init={})=>{
  const url=new URL(typeof input==='string'?input:input.url,location.href);
  if(!url.href.startsWith(baseUrl+'/')){if(url.origin!==location.origin||/\/api\//.test(url.pathname))return json({ok:false,error:'REAL_STUDENT_WRITE_BLOCKED'},403);return nativeFetch(input,init);}
  const path=url.pathname.slice(new URL(baseUrl).pathname.length);let body={};try{body=JSON.parse(init.body||'{}');}catch{}
  if(path.endsWith('/roster'))return json({ok:true,class:{name:'DEMO67'},students:[{ref,name}]});
  if(path.endsWith('/result/stream'))return json({ok:false,error:'NO_STREAM_IN_DEMO'},404);
  if(path.endsWith('/result/review'))return json({ok:true,review:{testSlug:'term-test-2',testTitle:ctx.content.title,studentName:name,content:ctx.content,answers:{listening:source.listening,reading:source.reading,writing:{task1:source.task1,task2:source.task2}}}});
  if(path.endsWith('/result'))return json({...base(),result:source.result||null,writing:writing(),portalSyncStatus:'not_applicable'});
  if(path.endsWith('/attempt/active'))return json({ok:true,active:false});
  if(path.endsWith('/client-event'))return json({ok:true,demo:true});
  if(path.endsWith('/writing/planning')){
    const task=Number(body.taskNumber);if(saved)return json({ok:true,planning:{taskNumber:task,outline:'',revision:0,startedAt:now(),deadlineAt:later(10)},serverNow:now()});
    const plan=source.plans[task]||={taskNumber:task,outline:'',revision:0,startedAt:now(),deadlineAt:later(task===1?5:10)};
    if(body.action==='save'){plan.outline=String(body.outline||'');plan.revision=body.revision;}return json({ok:true,accepted:true,planning:plan,serverNow:now()});
  }
  if(saved)return json({ok:false,error:'READ_ONLY_SAVED_ATTEMPT',message:'Bài học viên chỉ để xem.'},403);
  if(path.endsWith('/draft')){const skill=path.includes('reading')?'reading':'listening';source[skill]={...(body.answers||{})};return json({...base(),accepted:true,revision:body.revision,draft:source[skill]});}
  if(path.endsWith('/writing')){source.task1=body.task1??source.task1;source.task2=body.task2??source.task2;source.revision=body.revision||0;writingStarted=true;writingSubmitted=body.action==='submit';source.writingSubmitted=writingSubmitted;return json({...base(),writing:writing()});}
  if(path.endsWith('/reading/start'))return json({...base(),readingDeadlineAt:deadline,readingStartedAt:now()});
  if(path.endsWith('/listening')){source.listening={...body.answers};listeningSubmitted=true;return json({...base(),listeningSubmitted:true});}
  if(path.endsWith('/reading')){source.reading={...body.answers};await ctx.grade();completed=true;return json({...base(),completed:true,writing:writing()});}
  return json({ok:false,error:'UNSUPPORTED_DEMO_ACTION'},404);
 };
})();
