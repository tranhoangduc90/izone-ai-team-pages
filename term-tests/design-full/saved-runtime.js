// Chỉ cung cấp bài lịch sử cho renderer gốc. Mọi đường ghi/API ngoài đều bị chặn.
// Không lưu bài thật vào bộ nhớ trình duyệt; không tạo phiên thi hoặc hạn thi có hiệu lực.
(()=>{
 const ctx=window.REAL_DEMO;if(ctx.mode!=='saved')throw Error('Bộ đọc chỉ dùng cho bài đã chấm.');
 const source=ctx.snapshot,mem=new Map(),memory={get length(){return mem.size;},key:i=>[...mem.keys()][i]??null,getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,String(v)),removeItem:k=>mem.delete(k),clear:()=>mem.clear()};
 for(const key of ['localStorage','sessionStorage'])Object.defineProperty(window,key,{value:memory,configurable:true});
 const ref='11111111-1111-4111-8111-111111111111',token='22222222-2222-4222-8222-222222222222',baseUrl=new URL('private-demo-adapter',location.href).href;
 window.TERM_TEST_APP_CONFIG={API_BASE_URL:baseUrl,AUTH_MODE:'preview'};window.DESIGN_PREVIEW_SCREEN='result';window.TERM_TEST_CONTENT=ctx.content;
 window.TERM_TEST_BOOTSTRAP={examSessionToken:token,skipListeningAudio:true};
 mem.set('izone-test:'+window.TERM_TEST_CONFIG.slug+':DEMO67',JSON.stringify({studentRef:ref,studentName:source.name,examSessionToken:token,attemptToken:token,completed:true,listeningSubmitted:true,writingStarted:true,writingSubmitted:true,drafts:{listening:source.listening||{},reading:source.reading||{},writing:{task1:source.task1||'',task2:source.task2||''}}}));
 const base=()=>({ok:true,studentRef:ref,studentName:source.name,className:'IC2200 · Demo',attemptToken:token,examSessionToken:token,content:ctx.content,completed:true,listeningSubmitted:true,listeningDraft:source.listening||{},readingDraft:source.reading||{}});
 const writing=()=>({started:true,submitted:true,revision:source.revision||0,task1:source.task1||'',task2:source.task2||'',grading:source.grading});
 const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}}),nativeFetch=window.fetch.bind(window);
 window.fetch=async(input,init={})=>{
  const url=new URL(typeof input==='string'?input:input.url,location.href);
  if(!url.href.startsWith(baseUrl+'/')){if(url.origin!==location.origin||/\/api\//.test(url.pathname))return json({ok:false,error:'REAL_STUDENT_WRITE_BLOCKED'},403);return nativeFetch(input,init);}
  const path=url.pathname.slice(new URL(baseUrl).pathname.length);
  if(path.endsWith('/roster'))return json({ok:true,class:{name:'DEMO67'},students:[{ref,name:source.name}]});
  if(path.endsWith('/result/review'))return json({ok:true,review:{testSlug:window.TERM_TEST_CONFIG.slug,testTitle:ctx.content.title,studentName:source.name,content:ctx.content,answers:{listening:source.listening,reading:source.reading,writing:{task1:source.task1,task2:source.task2}}}});
  if(path.endsWith('/result'))return json({...base(),result:source.result||null,writing:writing(),portalSyncStatus:'not_applicable'});
  if(path.endsWith('/attempt/active'))return json({ok:true,active:false});
  if(path.endsWith('/client-event'))return json({ok:true,readonly:true});
  return json({ok:false,error:'READ_ONLY_SAVED_ATTEMPT',message:'Bài học viên chỉ để xem.'},403);
 };
})();
