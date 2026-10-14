// Đọc frontend nguyên bản local/online; API và phiên đã hoàn tất là fixture giả.
// Chỉ cho tài nguyên trong base đi qua; API bị mock trước khi gửi, không nộp/reset bài thật.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
export const routes=['term-test-1-k56','term-test-1-k56-computer-based','term-test-2-k56','term-test-2-k56-computer-based','mini-test-k56','mini-test-k56-computer-based',...['1-k56','2-k56','1-k67','2-k67'].map(s=>'substitute-test-'+s+'-computer-based')];
const id='11111111-1111-4111-8111-111111111111',token='22222222-2222-4222-8222-222222222222',epoch='33333333-3333-4333-8333-333333333333',run='44444444-4444-4444-8444-444444444444';
export async function serve(root=new URL('../../',import.meta.url)){
 const sourceRoot=typeof root==='string'?resolve(root):fileURLToPath(root);
 const server=createServer(async(req,res)=>{
  const u=new URL(req.url,'http://localhost'),p=resolve(sourceRoot,'.'+decodeURIComponent(u.pathname)+(u.pathname.endsWith('/')?'index.html':''));
  if(!p.startsWith(sourceRoot.replace(/[\\/]$/,'')+sep))return res.writeHead(403).end();
  try{const body=await readFile(p);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ttf':'font/ttf'})[extname(p)]||'application/octet-stream');res.end(body);}catch{res.writeHead(404).end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 return {base:`http://127.0.0.1:${server.address().port}/`,close:()=>new Promise(r=>server.close(r))};
}
export async function completedPage(browser,base,routeName){
 const substitute=routeName.startsWith('substitute'),slug=routeName.replace('-computer-based',''),cbt=routeName.endsWith('-computer-based'),paperMini=slug==='mini-test-k56'&&!cbt;
 const classCode='IC9999',now=new Date().toISOString(),row={number:1,studentAnswer:'OLD-RUN',correctAnswer:'A',result:'incorrect'};
 const section=()=>({correct:0,total:40,details:Array.from({length:40},(_,i)=>({...row,number:i+1})),typeStats:[]});
 const writing={submitted:true,started:true,revision:1,outline:'',task1:'Bài giả Task 1',task2:'Bài giả Task 2',grading:{ready:false,status:'processing',tasks:[]}};
 const payload={studentRef:id,studentName:'Học viên giả A',className:classCode,attemptToken:token,completed:true,portalSyncStatus:'not_applicable',exam:{serverNow:now},writing,result:{listening:section(),reading:section(),typeStats:[],performance:{best:[],needsImprovement:[],other:[]}}};
 if(paperMini)delete payload.writing;
 const session={classCode,className:classCode,studentRef:id,studentName:payload.studentName,attemptToken:token,clientRunId:run,identityConfirmed:true,listeningStartedAt:now,completed:true,writingStarted:!paperMini,writingSubmitted:!paperMini,writingDirty:false,drafts:{listening:{},reading:{},writing:{task1:'Bài giả Task 1',task2:'Bài giả Task 2',outline:''}},testGrades:{listening:section(),reading:section(),writing:{grading:writing.grading}}};
 if(substitute)session._substitute={version:2,testSlug:slug,historyEpoch:epoch,classCode,studentRef:id,clientRunId:run,attemptToken:token};
 const keys=substitute?[`izone-test:${slug}:RETAKE-LOBBY:server-grade:state-v2:${epoch}:lobby`,`izone-test:${slug}:${classCode}:server-grade:state-v2:${epoch}:${id}:${run}`]:[`izone-test:${slug}:${classCode}`,`izone-test:${slug}:${classCode}:cbt`];
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:900}}),errors=[],requests=[];
 let polls=0,phase='pending';
 await context.addInitScript(({keys,session})=>{if(sessionStorage.getItem('result-details-seeded'))return;sessionStorage.setItem('result-details-seeded','1');for(const key of keys){sessionStorage.setItem(key,JSON.stringify(session));localStorage.setItem(key,JSON.stringify(session));}},{keys,session});
 await context.route('**/*',async r=>{
  const req=r.request(),u=new URL(req.url());let route=u.pathname,body;try{body=JSON.parse(req.postData()||'{}');}catch{}
  if(body?.route)route=body.route;else if(route.includes('/api/'))route=route.slice(route.indexOf('/api/'));
  if(route.startsWith('/api/')){
   const headers={'access-control-allow-origin':'*','access-control-allow-headers':'Content-Type','access-control-allow-methods':'POST,GET,OPTIONS'};
   if(req.method()==='OPTIONS')return r.fulfill({status:204,headers,body:''});
   requests.push(route);let data,status=200;
   if(route==='/api/test/history')data={testSlug:slug,stateVersion:2,historyEpoch:epoch,classes:[{code:'DEMO',name:'Lớp giả DEMO'},{code:'IC9999',name:'Lớp giả A'},{code:'IC9998',name:'Lớp giả B'}]};
   else if(route.includes('roster'))data={class:{name:payload.className,code:payload.className},students:[{ref:payload.studentRef,name:payload.studentName}]};
   else if(route.endsWith('/attempt/prepare')||route.endsWith('/session/resume-attempt'))data={...payload,attemptMode:paperMini?'answer_sheet':'cbt',generation:1,policy:{timed:cbt,autoSubmit:cbt},nextSection:'complete',examMode:body?.mode||'lis_first',listeningSubmitted:true,readingSubmitted:true,writingStartedAt:paperMini?'':now,writingSubmittedAt:paperMini?'':now,serverNow:now,content:{variant:'semantic-html',timing:{},listening:{sections:[]},reading:{passages:[]},writing:{tasks:[{id:slug==='term-test-2-k56'?'task1':'task2',label:'Writing giả',prompt:'Đề giả',minimumWords:0}]}}};
   else if(route==='/api/term-tests/result/stream'){status=404;data={};}
   else if(route==='/api/term-tests/result'){polls++;data=structuredClone(payload);if(data.writing)data.writing.grading=phase==='ready'?{ready:true,status:'ready',writingScore:7,tasks:[]}:payload.writing.grading;}
   else if(route==='/api/test/writing/status'){polls++;data={grading:phase==='ready'?{ready:true,status:'ready',writingScore:7,tasks:[]}:writing.grading};}
   else {errors.push('API ngoài fixture: '+route);status=400;data={};}
   return r.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(data)}).catch(()=>{});
  }
  if(u.href.startsWith(base))return r.continue();
  return r.abort();
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 const url=base+'term-tests/'+routeName+'/?class='+classCode+(substitute?'&demo=exam&grading=server':'');
 async function waitForDetails(){
  // Đợi DOM kết quả hoặc nút sẵn sàng; không click nút đang tải rồi bị ẩn.
  await page.waitForFunction(()=>{
   const detail=document.querySelector('#questionDetails > details');
   const button=document.querySelector('#viewResult');
   return Boolean(detail?.getClientRects().length || (button?.getClientRects().length && !button.disabled));
  },null,{timeout:60000});
  const details=page.locator('#questionDetails > details');
  if(!(await details.first().isVisible()))await page.evaluate(()=>{
   const button=document.querySelector('#viewResult');
   if(button?.getClientRects().length && !button.disabled)button.click();
  });
  await details.first().waitFor({state:'visible',timeout:60000});return details;
 }
 async function enter(){
  await page.goto(url,{waitUntil:'domcontentloaded'});
  if(paperMini){await page.locator('#studentSelect').selectOption(payload.studentRef);await page.locator('#miniPaperEnter').click();}
  else if(slug==='mini-test-k56'&&cbt){await page.locator('#confirmIdentity').waitFor({state:'visible'});await page.locator('#confirmIdentity').click();}
  const details=await waitForDetails();
  await page.evaluate(()=>document.fonts.ready);return details;
 }
 const details=await enter();
 async function switchSession({student=true,group=true,attempt=true,marker='NEW-RUN'}={}){
  const nextId=student?'55555555-5555-4555-8555-555555555555':payload.studentRef,nextToken=attempt?'66666666-6666-4666-8666-666666666666':payload.attemptToken,nextRun=attempt?'77777777-7777-4777-8777-777777777777':session.clientRunId,nextClass=group?'IC9998':payload.className;
  payload.studentRef=nextId;payload.studentName=student?'Học viên giả B':payload.studentName;payload.attemptToken=nextToken;payload.className=nextClass;
  payload.result.listening.details=payload.result.listening.details.map(d=>({...d,studentAnswer:marker}));payload.result.reading.details=payload.result.reading.details.map(d=>({...d,studentAnswer:marker}));
  const next={...session,classCode:nextClass,className:nextClass,studentRef:nextId,studentName:payload.studentName,attemptToken:nextToken,clientRunId:nextRun,testGrades:{listening:structuredClone(payload.result.listening),reading:structuredClone(payload.result.reading),writing:{grading:{ready:true,status:'ready',tasks:[]}}}};
  if(substitute)next._substitute={...session._substitute,classCode:nextClass,studentRef:nextId,attemptToken:nextToken,clientRunId:nextRun};
  const nextKeys=substitute?[keys[0],`izone-test:${slug}:${nextClass}:server-grade:state-v2:${epoch}:${nextId}:${nextRun}`]:[`izone-test:${slug}:${nextClass}`,`izone-test:${slug}:${nextClass}:cbt`];
  // Chuẩn bị một phiên server giả khác, giữ nguyên các namespace cũ để phát hiện trộn.
  await context.addInitScript(({nextKeys,next})=>{for(const k of nextKeys){sessionStorage.setItem(k,JSON.stringify(next));localStorage.setItem(k,JSON.stringify(next));}},{nextKeys,next});
  phase='ready';
  await page.goto(url.replace('class='+classCode,'class='+nextClass),{waitUntil:'domcontentloaded'});
  if(paperMini){await page.locator('#studentSelect').selectOption(nextId);await page.locator('#miniPaperEnter').click();}
  else if(slug==='mini-test-k56'&&cbt){await page.locator('#confirmIdentity').waitFor({state:'visible'});await page.locator('#confirmIdentity').click();}
  await waitForDetails();
 }
 return {context,page,details,paperMini,payload,errors,requests,polls:()=>polls,ready:()=>{phase='ready';},switchSession,close:()=>context.close()};
}
