// Real Listening app, store, identity and observation hub; synthetic work on isolated PGlite.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {encodeBody} from '../../listening-homework/answer-codec.mjs';
import {ASSETS} from '../../shared/audio/catalog.mjs';
const backend=process.env.HOMEWORK_TEST_BACKEND;
if(!backend||!path.isAbsolute(backend))throw Error('ISOLATED_BACKEND_SOURCE_REQUIRED');
const require=createRequire(path.join(backend,'package.json')),express=require('express'),{PGlite}=require('@electric-sql/pglite');
const load=name=>import(pathToFileURL(path.join(backend,'src',name)).href);
const [{createListeningHomeworkApp},{createReading67WebIdentity},{createWebObservationHub},{createReading67Homework}]=await Promise.all(['listening-homework67/app.js','reading-listening67/web-identity.js','reading-listening67/web-observation-hub.js','reading-listening67/web-homework.js'].map(load));
export const lessons=[['scandinavian-studies','interactive-content.json','homework-listening-02-scandinavian'],['horton-castle','horton-castle-content.json','homework-listening-horton-castle'],['origami','origami-content.json','homework-listening-origami'],['natural-dyes','natural-dyes-content.json','homework-listening-natural-dyes']];

export async function createListeningObservationApp({root,name,stream=true,journalFactory=null}){
 const definition=lessons.find(row=>row[0]===name);if(!definition)throw Error('UNKNOWN_LISTENING_FIXTURE');
 const data=JSON.parse(await fs.readFile(path.join(root,'listening-homework',definition[1]),'utf8'));
 const fields={};for(const item of data.items){fields[item.id]='Synthetic '+item.id;for(const slot of item.ui?.slots||[])fields[slot.key]='Synthetic '+slot.key;for(const suffix of ['a','b','c','quote'])fields[item.id+suffix]='Synthetic '+item.id+suffix;}
 Object.assign(fields,{S1:'Ý kiến riêng của một người',S5:'Có',S8choice:'Có',S17choice:'Có',S19choice:'C'});
 const initialBody=encodeBody({fields,legacy:{},flags:[],notes:'Synthetic native note'},data.items);
 const lesson={code:data.code,version:data.runtimeVersion,title:data.title,homeworkLesson:2,minimumCompletion:.8,audioId:definition[2],groups:[],questions:[],items:data.items.map(({id,group,question})=>({id,group,question,answer:initialBody.answers[id],core:'Synthetic meaning '+id,accept:'Synthetic fixture',reject:'Contradiction',units:[{id:id+'.u1',meaning:'Synthetic unit '+id}]}))};
 const db=new PGlite();await db.exec(await fs.readFile(path.join(backend,'ops/listening-homework67/schema.sql'),'utf8'));
 const ownerId=randomUUID(),otherId=randomUUID(),scope={ownerId,courseId:'1293',code:lesson.code,version:lesson.version};
 const people=[ownerId,otherId].map((public_id,n)=>({public_id,erp_course_class_id:'1293',erp_student_contact_id:String(91+n),erp_student_name_snapshot:'Synthetic '+n,status:'approved'}));
 let teacherAllowed=true;
 const context={snapshot:async()=>({classes:[{erp_course_class_id:'1293',erp_class_name_snapshot:'IC-FIXTURE'}],students:people,memberships:people.map(p=>({...p,source_state:'active'}))}),classes:async()=>[{id:'1293',classCode:'IC-FIXTURE'}],roster:async()=>people.map(p=>({studentRef:p.public_id,name:p.erp_student_name_snapshot})),teacher:async()=>teacherAllowed};
 const identity=createReading67WebIdentity({db,context,allowedClassIds:['1293'],cookieName:'listening_homework_teacher',cookiePath:'/api/listening-homework67',verifyGoogle:async()=>({email:'teacher@example.test',sub:'fixture-subject',email_verified:true})});
 const hub=createWebObservationHub({db});if(stream)db.webObservations=hub;
 const homework=createReading67Homework({db,metadata:lesson,pageBase:'https://synthetic.invalid/listening',owner:{resolve(){throw Error('EXTERNAL_OWNER_FORBIDDEN');}},docs:{read(){throw Error('EXTERNAL_DOCS_FORBIDDEN');}}});
 const origins=[],journal=journalFactory?.({db,lesson,origins}),runtime=createListeningHomeworkApp({db,lesson,identity,journal,homeworkRuntime:{homework},audio:ASSETS[definition[2]],studentsOpen:true,fixture:true,origins,provider:async()=>{throw Error('EXTERNAL_AI_FORBIDDEN');}});
 await runtime.store.save(scope,{baseRevision:0,mutationId:randomUUID(),body:initialBody});
 const initial=await runtime.store.submit(scope,{revision:1,requestId:randomUUID()});await runtime.worker.tick();
 if((await runtime.store.attempt(scope,initial.attemptId)).status!=='done')throw Error('SYNTHETIC_SEED_GRADING_FAILED');
 await db.query("UPDATE reading_listening67.web_homework_job SET status='verified'");
 const app=express(),requests=[],streams=new Set(),controls={offline:false,failReads:0,dropSaveReply:false,holdAttempt:null,holding:0};
 app.use('/api/listening-homework67',(q,r,next)=>{
  const record={method:q.method,path:q.path,compact:q.query.ack==='compact-v1'};requests.push(record);r.on('close',()=>{record.status=r.statusCode;record.completed=r.writableFinished;if(q.body?.mutationId)record.mutationId=q.body.mutationId;if(q.body?.requestId)record.requestId=q.body.requestId;});
  if(q.path.endsWith('/events')){if(controls.offline)return r.status(503).json({error:'SYNTHETIC_STREAM_OFFLINE'});streams.add(r);r.on('close',()=>streams.delete(r));}
  if(q.path.includes('/attempts/')&&controls.failReads>0){controls.failReads--;return r.status(503).json({error:'SYNTHETIC_READ_FAILURE'});}
  if(controls.holdAttempt&&q.path.endsWith('/attempts/'+controls.holdAttempt.id)){controls.holding++;controls.holdAttempt.wait.then(()=>{if(!r.destroyed)next();});return;}
  if(q.method==='PUT'&&controls.dropSaveReply){controls.dropSaveReply=false;const json=r.json.bind(r);r.json=value=>{if(value.ok){r.destroy();return r;}return json(value);};}
  next();
 });
 app.use(runtime.app);
 if(process.env.LISTENING_STATE_BASE_REVISION){const revision=process.env.LISTENING_STATE_BASE_REVISION;if(!/^[a-f0-9]{7,40}$/.test(revision))throw Error('FIXTURE_REVISION_INVALID');app.get(/^\/listening-homework\/(?:app\.mjs|interactive-workspace\.mjs|scandinavian-studies\.html|horton-castle\.html|origami\.html|natural-dyes\.html)$/, (q,r)=>r.type(q.path.endsWith('.mjs')?'text/javascript':'text/html').send(execFileSync('git',['show',revision+':'+q.path.slice(1)],{cwd:root})));}
 app.use(express.static(root));const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const origin='http://127.0.0.1:'+server.address().port;origins.push(origin);
 return {origin,scope,otherId,data,lesson,db,hub,store:runtime.store,requests,controls,initial,initialBody,asset:ASSETS[definition[2]],
  disconnect(){for(const response of streams)response.end();},revokeTeacher(){teacherAllowed=false;},
  async updateFeedback(id,reason,attemptId=initial.attemptId){const result=(await db.query('SELECT data FROM reading_listening67.web_result WHERE attempt_id=$1',[attemptId])).rows[0].data;result.feedback[id].reason=reason;await db.query('UPDATE reading_listening67.web_result SET data=$2 WHERE attempt_id=$1',[attemptId,result]);},
  async completePending(){await runtime.worker.tick();},
  async teacherCookie(){const response=await fetch(origin+'/api/listening-homework67/teacher/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({credential:'synthetic-authorized-google',remember:true})});if(!response.ok)throw Error('FIXTURE_TEACHER_LOGIN_FAILED');const cookie=response.headers.get('set-cookie').split(';')[0],at=cookie.indexOf('=');return {name:cookie.slice(0,at),value:cookie.slice(at+1),url:origin+'/api/listening-homework67',httpOnly:true,sameSite:'Lax'};},
  async close(){for(const response of streams)response.end();await hub.close();await runtime.worker.close();await new Promise(resolve=>server.close(resolve));await db.close();globalThis.gc?.();}
 };
}
