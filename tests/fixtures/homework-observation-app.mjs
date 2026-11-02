// Router/store/identity/hub thật trên PGlite và HTTP local. Nội dung đề được cấp riêng;
// câu trả lời/góp ý/danh tính đều giả. Không có đường gọi AI, Google, Docs hoặc Portal.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
const backend=process.env.HOMEWORK_TEST_BACKEND;
if(!backend||!path.isAbsolute(backend))throw Error('ISOLATED_BACKEND_SOURCE_REQUIRED');
const require=createRequire(path.join(backend,'package.json')),express=require('express'),{PGlite}=require('@electric-sql/pglite');
const moduleOf=name=>import(pathToFileURL(path.join(backend,'src/reading-listening67',name)).href);
const [{createReading67WebStore},{createReading67WebIdentity},{createReading67WebRouter},{createWebObservationHub},{createReading67Homework},{createReadingSharePractice}]=await Promise.all(['web-store.js','web-identity.js','web-routes.js','web-observation-hub.js','web-homework.js','web-share-practice.js'].map(moduleOf));

export const lessons=[
 ['materials','materials-beyond-concrete'],['lesson12','butterflies-britain-tfng'],['green-roofs','green-roofs'],
 ['the-desolenator','the-desolenator'],['materials-beyond-concrete-matching-people','materials-beyond-concrete-matching-people'],['athletes-and-stress','athletes-and-stress']
];
function answerFor(target,content){
 if(['chunk_label','conclusion'].includes(target.kind))return 'TRUE';
 if(target.kind==='section')return content.type==='matching_headings'?'ii':'A';
 if(target.kind==='choice')return target.question%2?'B':'A';
 if(['location','paragraph_location'].includes(target.kind))return 'A';
 if(target.kind==='matching_sentence')return 'Câu '+content.questions[0].number;
 if(target.kind==='answer')return content.type==='matching_people'?content.people[0].id+' '+content.people[0].name:'synthetic';
 return 'Nội dung tự viết để kiểm việc lưu và giữ nguyên vùng đang đọc.';
}
function summaryFor(content,result){
 const targets=content.targets,feedback=result.feedback,ids=predicate=>targets.filter(predicate).map(t=>t.id),correct=list=>list.filter(id=>feedback[id]?.status==='correct').length;
 const needsRepair=targets.filter(t=>feedback[t.id]?.status!=='correct').map(t=>t.id),base={version:1,kind:content.type,total:targets.length,remainingCount:needsRepair.length,needsRepair,allCorrect:!needsRepair.length};
 if(content.type==='tfng'){const evidence=ids(t=>t.kind==='evidence'),labels=ids(t=>t.kind==='chunk_label'),conclusions=ids(t=>t.kind==='conclusion');return {...base,evidenceCorrect:correct(evidence),evidenceTotal:evidence.length,labelCorrect:correct(labels),labelTotal:labels.length,conclusionCorrect:correct(conclusions),conclusionTotal:conclusions.length};}
 const matching=ids(t=>['section','choice','answer','paragraph_location','matching_sentence'].includes(t.kind)),compression=targets.filter(t=>!matching.includes(t.id)).map(t=>t.id);
 return {...base,matchingCorrect:correct(matching),matchingTotal:matching.length,compressionCorrect:correct(compression),compressionTotal:compression.length,analysisCorrect:correct(ids(t=>['leader','supporter','location','leader_evidence','supporter_evidence'].includes(t.kind))),paragraphCorrect:correct(ids(t=>['level1','level2'].includes(t.kind)))};
}

export async function createHomeworkObservationApp({root,fixtureName,stream=true}){
 const publicRoot=process.env.READING67_PUBLIC_FIXTURES;if(!publicRoot||!path.isAbsolute(publicRoot))throw Error('PUBLIC_LESSON_FIXTURES_REQUIRED');
 const content=JSON.parse(await fs.readFile(path.join(publicRoot,fixtureName,'content.private.json'),'utf8'));
 const db=new PGlite();await db.exec(await fs.readFile(path.join(backend,'ops/listening-homework67/schema.sql'),'utf8'));
 const ownerId=randomUUID(),scope={ownerId,courseId:'1124',code:content.code,version:content.version},person={public_id:ownerId,erp_course_class_id:'1124',erp_student_contact_id:'91',erp_student_name_snapshot:'Người học kiểm thử',status:'approved'};
 const context={snapshot:async()=>({classes:[{erp_course_class_id:'1124',erp_class_name_snapshot:'LỚP KIỂM THỬ'}],students:[person],memberships:[{erp_course_class_id:'1124',erp_student_contact_id:'91',source_state:'active'}]}),classes:async()=>[{id:'1124',classCode:'LỚP KIỂM THỬ'}],roster:async()=>[{studentRef:ownerId,name:person.erp_student_name_snapshot}],teacher:async(_id,email,subject)=>email==='teacher@example.test'&&subject==='fixture-subject'};
 const identity=createReading67WebIdentity({db,context,allowedClassIds:['1124'],cookiePath:'/api/reading-skills67',verifyGoogle:async()=>({email:'teacher@example.test',sub:'fixture-subject',email_verified:true})});
 const hub=createWebObservationHub({db});if(stream)db.webObservations=hub;
 const grader={pins:{sha256:'synthetic-browser-pin',workflowVersion:'fixture'},profile:{expected_target_ids:content.targets.map(t=>t.id)},inspectWeb:answers=>({parsed:{targets:content.targets.map(t=>({target_id:t.id,source_text:answers[t.id]||''}))},completeness:{filled_cells:content.targets.length,eligible_for_grading:true}})};
 let practice;
 if(content.practice){
  await db.exec(await fs.readFile(path.join(backend,'../docs/migrations/2026-10-29-reading67-share-practice.sql'),'utf8'));
  practice=createReadingSharePractice({db,content,readShare:async()=>({messages:[{role:'user',text:'Nội dung giả dùng kiểm hàng chờ.'}]}),verify:async()=>({status:'accepted',policy:'reading-skimming-l1-share-20261029-v1',message:'Đã công nhận · dữ liệu kiểm thử'})});
  await practice.save(scope,{url:'https://chatgpt.com/share/'+randomUUID(),requestId:randomUUID()});await practice.once();
 }
 const store=createReading67WebStore({db,grader,jobScope:content,resultSummary:result=>summaryFor(content,result),...(practice?{beforeWrite:practice.requireAccepted,beforeSubmit:practice.requireAccepted,afterSubmit:practice.attachAttempt}:{})});
 const initialBody={answers:Object.fromEntries(content.targets.map(t=>[t.id,answerFor(t,content)])),notes:'Ghi chú riêng của bản kiểm thử',annotations:[],flags:[]};
 const reasons='Nhận xét giả: cần giữ đúng quan hệ và điều kiện của câu gốc. '.repeat(3);
 function resultFor(job,allCorrect=false){return {pins:grader.pins,context:{operationId:job.jobId,sourceDigest:job.inputHash},grading:{target_results:content.targets.map((t,n)=>({target_id:t.id,verdict:allCorrect||n>1?'correct':'partial'})),question_explanations:content.questions.map(q=>({...q,answer:'TRUE',explanation:'Giải thích kiểm thử',chunks:(q.chunks||[]).map(c=>({...c,expectedEvidence:'Nội dung kiểm thử',label:'TRUE'}))}))},feedback:Object.fromEntries(content.targets.map((t,n)=>[t.id,{status:allCorrect||n>1?'correct':'partial',reason:reasons,modelAnswer:answerFor(t,content),nextStep:'Tự đối chiếu rồi sửa lại.',sourceMeaning:'Ý nghĩa dùng trong kiểm thử.',raw:{source_paragraphs:[String(content.paragraphs[0].id)]}}]))};}
 await store.save(scope,{baseRevision:0,mutationId:randomUUID(),body:initialBody});const initial=await store.submit(scope,{revision:1,requestId:randomUUID()}),job=await store.claim();await store.finish(job,resultFor(job));
 const binding=randomUUID(),cta=randomUUID(),status=randomUUID();await db.query('INSERT INTO reading_listening67.web_homework_binding(id,owner_id,course_id,assignment_code,content_version,sequence,last_doc_sequence) VALUES($1,$2,$3,$4,$5,1,1)',[binding,ownerId,scope.courseId,scope.code,scope.version]);
 for(const [id,sequence,kind] of [[cta,0,'cta'],[status,1,'status']])await db.query("INSERT INTO reading_listening67.web_homework_job(id,binding_id,event_key,sequence,kind,payload,status) VALUES($1,$2,$3,$4,$5,'{}','verified')",[id,binding,'seed-'+sequence,sequence,kind]);
 const homework=createReading67Homework({db,metadata:content,pageBase:'https://synthetic.invalid/homework',owner:{resolve(){throw Error('EXTERNAL_OWNER_FORBIDDEN');}},docs:{read(){throw Error('EXTERNAL_DOCS_FORBIDDEN');}}});
 const app=express(),requests=[],streams=new Set(),controls={offline:false,failReads:0,dropSaveReply:false,holdAttempt:null,holding:0};let origin;
 app.use('/api/reading-skills67',(q,r,next)=>{
  const record={method:q.method,path:q.path,compact:q.query.ack==='compact-v1'};requests.push(record);r.on('close',()=>{record.status=r.statusCode;record.bytes=Number(r.getHeader('content-length')||0);record.completed=r.writableFinished;});
  if(q.path.endsWith('/events')){if(controls.offline)return r.status(503).json({error:'SYNTHETIC_STREAM_OFFLINE'});streams.add(r);r.on('close',()=>streams.delete(r));}
  if(q.path.includes('/attempts/')&&controls.failReads>0){controls.failReads--;return r.status(503).json({error:'SYNTHETIC_READ_FAILURE'});}
  if(controls.holdAttempt&&q.path.endsWith('/attempts/'+controls.holdAttempt.id)){controls.holding++;controls.holdAttempt.wait.then(()=>{if(!r.destroyed)next();});return;}
  if(q.method==='PUT'&&controls.dropSaveReply){controls.dropSaveReply=false;const json=r.json.bind(r);r.json=value=>{if(value.ok){r.destroy();return r;}return json(value);};}
  next();
 });
 app.use('/api/reading-skills67',createReading67WebRouter({store,content,grader,identity,authenticate:identity.authenticate,homework,practice,config:{demo:true,studentsOpen:true,homeworkEnabled:true,googleClientId:'synthetic.apps.googleusercontent.com'}}));
 app.get(/\/api-config\.js$/,(_q,r)=>r.type('text/javascript').send('window.READING67_API_BASE='+JSON.stringify(origin+'/api/reading-skills67')+';'));
 app.use(express.static(root));const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));origin='http://127.0.0.1:'+server.address().port;
 return {origin,content,scope,store,db,hub,practice,requests,controls,initial,initialBody,
  disconnect(){for(const response of streams)response.end();},
  async updateFeedback(id,reason,allCorrect=false,attemptId=initial.attemptId){const old=(await db.query('SELECT data FROM reading_listening67.web_result WHERE attempt_id=$1',[attemptId])).rows[0].data;old.feedback[id].reason=reason;if(allCorrect){for(const f of Object.values(old.feedback))f.status='correct';for(const row of old.grading.target_results)row.verdict='correct';}await db.query('UPDATE reading_listening67.web_result SET data=$2 WHERE attempt_id=$1',[attemptId,old]);},
  async completePending(allCorrect=true){const pending=await store.claim();if(pending)await store.finish(pending,resultFor(pending,allCorrect));},
  async teacherCookie(){const response=await fetch(origin+'/api/reading-skills67/teacher/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({credential:'synthetic-authorized-google',remember:true})});if(!response.ok)throw Error('FIXTURE_TEACHER_LOGIN_FAILED');const cookie=response.headers.get('set-cookie').split(';')[0],at=cookie.indexOf('=');return {name:cookie.slice(0,at),value:cookie.slice(at+1),url:origin+'/api/reading-skills67',httpOnly:true,sameSite:'Lax'};},
  async close(){for(const response of streams)response.end();await hub.close();await new Promise(resolve=>server.close(resolve));await db.close();globalThis.gc?.();}
 };
}
