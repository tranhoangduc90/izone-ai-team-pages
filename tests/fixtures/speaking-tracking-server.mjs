import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {learners,lessons,share} from './speaking-draft-server.mjs';

// Renderer/module thật, fetch chỉ được đổi đích sang loopback. CSP của fixture
// chặn mọi kết nối ngoài máy; không có DB, AI, Docs hoặc danh tính học viên thật.
export async function startTrackingFixture(root,{port=0,journal=null,journalEnabled=false,nativeApi=null,nativeRef=null}={}){
 root=resolve(root);const records=new Map(),requests=[],streams=new Set();
 const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
 function record(number,ref=learners[0],store='independent'){
  const key=JSON.stringify([number,ref,store]);
  if(!records.has(key)){
   const lesson=lessons.find(item=>item.number===number);if(!lesson)throw Error('FIXTURE_LESSON_UNKNOWN');
   const digest=hash(key),unitId=`${digest.slice(0,8)}-${digest.slice(8,12)}-4${digest.slice(13,16)}-8${digest.slice(17,20)}-${digest.slice(20,32)}`;
   records.set(key,{number,ref,store,lesson,token:hash(['token',key]),unitId,documentId:`synthetic-doc-${number}-${ref}`,sequence:0,ticks:0,supported:true,failStatus:0,viewDelayMs:0,submitted:false,
    docsProgress:{status:'pending',sequence:'1',applied_sequence:'0'},
    links:lesson.parts.map((part,index)=>({part,share_url:share(number*10+index),check_status:index===0?'accepted':'pending',question_count:number===8?6:3,analysis_status:index===0?'done':'pending'})),
    practiceLinks:number>=4?[1,2].map(slot=>({slot,exercise_id:`exercise-${slot}`,share_url:share(number*10+slot+5),status:'accepted',analysis_status:'done'})):[]});
  }return records.get(key);
 }
 const doctor=()=>({needed:[],allNeeded:[],practiced:[],neededCount:0,personalCount:0,sharedCatalog:[1,2].map(index=>({exercise_id:`exercise-${index}`,title:`Bài giả ${index}`,exercise_url:`https://example.com/exercise-${index}`}))});
 function open(current){return{status:current.submitted?'submitted':'draft',receipt:current.submitted?{id:'synthetic-receipt'}:null,documentId:current.documentId,workUnitId:current.unitId,
  links:structuredClone(current.links),practiceLinks:structuredClone(current.practiceLinks),docsProgress:structuredClone(current.docsProgress),
  ...(current.supported?{capabilities:{studentStateStream:true,studentCombinedView:true}}:{})};}
 const contentRevision=current=>hash([current.links,current.practiceLinks,current.submitted,doctor()]);
 function state(current){return{kind:'speaking-student-state-v1',unitId:current.unitId,studentRef:current.ref,documentId:current.documentId,
  contentRevision:contentRevision(current),docsRevision:hash(current.docsProgress),revision:hash([contentRevision(current),current.docsProgress]),docsProgress:structuredClone(current.docsProgress),docsJobs:[],epoch:'synthetic-runtime-1',sequence:++current.sequence};}
 function send(entry){
  const value=state(entry.current),signature=hash({...value,sequence:0});
  if(signature!==entry.signature){entry.signature=signature;entry.res.write(`event: state\ndata: ${JSON.stringify(value)}\n\n`);}else entry.res.write(': heartbeat\n\n');
 }
 const json=(res,data,status=200)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({ok:status<400,...data}));};
 const server=createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://localhost');let raw='';if(req.method==='POST')for await(const chunk of req)raw+=chunk;
   const body=raw?JSON.parse(raw):{};
   if(url.pathname==='/__fixture/stats'){json(res,{requests,records:[...records.values()].map(({number,ref,store,ticks,sequence})=>({number,ref,store,ticks,sequence})),streams:streams.size});return;}
   if(url.pathname==='/__fixture/control'){
    const current=record(body.number,body.ref,body.store);if(body.docs)current.docsProgress={...current.docsProgress,...body.docs};
    if(body.part){const link=current.links.find(item=>item.part===body.part);Object.assign(link,body.patch);}
    for(const key of ['supported','failStatus','viewDelayMs'])if(Object.hasOwn(body,key))current[key]=body[key];
    if(body.allAccepted)for(const link of current.links){link.check_status='accepted';link.analysis_status='done';link.question_count=100;}
    for(const entry of streams)if(entry.current===current)send(entry);json(res,{});return;
   }
   if(url.pathname==='/__fixture/bootstrap.js'){
    const target=typeof nativeApi==='function'?nativeApi():nativeApi;
    if(target&&!/^http:\/\/127\.0\.0\.1:\d+\/api\/speaking-homework-independent$/.test(target))throw Error('FIXTURE_NATIVE_ENDPOINT_INVALID');
    res.writeHead(200,{'content-type':'text/javascript','cache-control':'no-store'});res.end(`{
     const nativeFetch=window.fetch.bind(window);window.__fixtureErrors=[];
     window.addEventListener('error',event=>window.__fixtureErrors.push(event.message));
     window.addEventListener('unhandledrejection',event=>window.__fixtureErrors.push(String(event.reason)));
     window.fetch=(input,options)=>{
      const source=typeof input==='string'?input:input instanceof URL?input.href:null;
      if(!source)return nativeFetch(input,options);
      const url=new URL(source,location.href),prefix='https://ducizone.ddns.net/mapping-api';
      if(url.href.startsWith(prefix+'/api/speaking-homework-independent'))return nativeFetch((${JSON.stringify(target)}||'/__api/independent')+url.href.slice((prefix+'/api/speaking-homework-independent').length),options);
      if(url.href.startsWith(prefix+'/api/speaking-homework'))return nativeFetch('/__api/legacy'+url.href.slice((prefix+'/api/speaking-homework').length),options);
      if(url.href.startsWith(prefix+'/'))return nativeFetch('/__api/identity'+url.href.slice(prefix.length),options);
      return nativeFetch(input,options);
     };
    }`);return;
   }
   if(url.pathname.startsWith('/__api/')){
    const [, ,store,...rest]=url.pathname.split('/'),path='/'+rest.join('/');
    const referer=new URL(req.headers.referer||'http://localhost'),intake=referer.searchParams.get('fixtureIntake')==='legacy'?'legacy':'independent';
    const selected=[...records.values()].find(current=>current.token===body.accessToken);
    const lesson=lessons.find(item=>item.code===body.assignmentCode)||selected?.lesson||lessons.find(item=>item.number===8);
    const current=selected||record(lesson.number,body.studentRef||learners[0],intake);
    requests.push({at:Date.now(),path,store,number:current.number,ref:current.ref});
    const requestId=req.headers['x-exam-journal-request-id'];
    if(typeof requestId==='string'&&/^[a-f0-9-]{36}$/i.test(requestId)){requests.at(-1).requestId=requestId;res.setHeader('x-exam-journal-request-id',requestId);}
    if(path==='/journal-events'&&journal){
     const reply=await journal.collect(body,req.headers.origin);json(res,reply.body,reply.status);return;
    }
    if(path==='/api/student-identity/resolve'){
     const fixed=typeof nativeRef==='function'?nativeRef():nativeRef;
     const index=body.studentRef?body.studentRef===fixed?0:learners.indexOf(body.studentRef):body.identity?.id==='67890'?1:0;if(index<0)throw Error('FIXTURE_LEARNER_UNKNOWN');
     json(res,{status:'unique',identity:{authority:'erp-contact',id:index?'67890':'12345'},aliases:[{classId:fixed?'1293':'111',classCode:'IC2304',studentRef:fixed&&index===0?fixed:learners[index],studentName:`Hồ sơ thử ${index+1}`}]});return;
    }
    if(path==='/classes'){json(res,{classes:[{classCode:'IC2304',ready:true,assignmentStatus:'open'}]});return;}
    if(path==='/identity/resolve'){json(res,{status:'unique',classCode:'IC2304',studentRef:current.ref});return;}
    if(path==='/assignment/roster'){json(res,{assignment:{title:'Speaking · KIỂM THỬ CỤC BỘ',assignmentCode:lesson.code,classCode:'IC2304',assignmentStatus:'open',
     students:learners.map((student_ref,index)=>({student_ref,name:`Hồ sơ thử ${index+1}`})),parts:lesson.parts.map((part_key,index)=>({part_key,min_questions:lesson.number===8?[6,6,1][index]:3})),
     requiredPracticeCount:lesson.number>=4?2:0,doctorEnabled:lesson.number!==3}});return;}
    if(path==='/session/start-selected'){json(res,{session:{accessToken:current.token,classCode:'IC2304',studentRef:current.ref,documentId:current.documentId,
     ...(intake==='legacy'?{intakeMode:'legacy'}:{workUnitId:current.unitId})}});return;}
    if(!selected||selected.store!==store){json(res,{error:'SESSION_INVALID',message:'Phiên giả không hợp lệ'},403);return;}
    if(path==='/journal-context'&&journal){
     if(journal.contextUnavailable){json(res,{error:'FIXTURE_JOURNAL_UNAVAILABLE'},503);return;}
     if(journal.contextDelayMs)setTimeout(()=>{if(!res.destroyed)json(res,{journalContext:journal.context(current)});},journal.contextDelayMs);
     else json(res,{journalContext:journal.context(current)});return;
    }
    if(current.failStatus){json(res,{error:'FIXTURE_READ_ERROR',message:'Lỗi đọc thử nghiệm'},current.failStatus);return;}
    if(path==='/open'){json(res,open(current));return;}
    if(path==='/doctor/list'){json(res,doctor());return;}
    if(path==='/finish'){current.submitted=true;json(res,{receipt:{id:'synthetic-receipt'}});return;}
    if(path==='/checks/request'){
     const link=current.links.find(row=>row.part===body.part);if(!link)throw Error('FIXTURE_PART_UNKNOWN');
     link.share_url=body.url;link.check_status='pending';link.linkId=current.unitId;
     json(res,{check:{id:link.linkId,status:'pending'}},202);return;
    }
    if(path==='/observation/student/status'){json(res,{state:state(current)});return;}
    if(path==='/observation/student/view'){
     const view={kind:'speaking-student-view-v1',unitId:current.unitId,contentRevision:contentRevision(current),open:open(current),doctor:doctor()};
     if(current.viewDelayMs){setTimeout(()=>{if(!res.destroyed)json(res,{view});},current.viewDelayMs);return;}json(res,{view});return;
    }
    if(path==='/observation/student/events'){
     res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache','x-accel-buffering':'no'});res.flushHeaders();
     const entry={res,current};streams.add(entry);send(entry);
     const lifetime=setTimeout(()=>res.end(),30000);
     res.on('close',()=>{clearTimeout(lifetime);streams.delete(entry);});return;
    }
    throw Error(`FIXTURE_ROUTE_UNKNOWN ${path}`);
   }
   const file=resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+sep))throw Error('FIXTURE_PATH_OUTSIDE_ROOT');
   let content=await readFile(file);
   if(file.endsWith(sep+'shared'+sep+'speaking-homework-journal.mjs')&&journalEnabled)
    content=content.toString().replace('export const speakingJournalEnabled=false;','export const speakingJournalEnabled=true;');
   const target=typeof nativeApi==='function'?nativeApi():nativeApi;
   if(target&&!/^http:\/\/127\.0\.0\.1:\d+\/api\/speaking-homework-independent$/.test(target))throw Error('FIXTURE_NATIVE_ENDPOINT_INVALID');
   if(extname(file)==='.html')content=content.toString().replace("connect-src 'self' https://ducizone.ddns.net","connect-src 'self'"+(target?' '+new URL(target).origin:''))
    .replace('<head>','<head><script src="/__fixture/bootstrap.js"></script>');
   res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'})[extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(content);
  }catch(error){json(res,{error:'FIXTURE_ERROR',message:error.message},400);}
 });
 const tick=setInterval(()=>{for(const current of new Set([...streams].map(entry=>entry.current)))current.ticks++;for(const entry of streams)send(entry);},15000);
 tick.unref();
 await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
 return{origin:`http://127.0.0.1:${server.address().port}`,record,requests,close:()=>{clearInterval(tick);for(const {res}of streams)res.end();server.closeAllConnections();return new Promise(resolve=>server.close(resolve));}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const fixture=await startTrackingFixture(process.argv[2],{port:Number(process.argv[3])||0});console.log(JSON.stringify({origin:fixture.origin,pid:process.pid}));
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await fixture.close();process.exit(0);});
}
