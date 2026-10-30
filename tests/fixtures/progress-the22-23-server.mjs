// Server loopback với dữ liệu giả, dùng HTML/module thật; không chuyển tiếp bất kỳ API production nào.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {newEditorPayload} from '../../progress-log/teacher-form-editor.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
export const uid=n=>`c0000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const A=uid(1),B=uid(2),rootDraft=uid(90);
const students=[{studentRef:A,name:'Học viên giả A',current:true},{studentRef:B,name:'Học viên giả B',current:true}];
const testResult={testSlug:'term-test-1',title:'Term Test 1',completedAt:'2026-10-29T12:00:00Z',resultRef:'a'.repeat(64),
 listening:{correct:7,total:10,completedAt:'2026-10-29T12:00:00Z',analysis:{status:'available',needsImprovement:[{label:'Multiple choice'}]}},
 reading:{correct:8,total:10,completedAt:'2026-10-29T12:00:00Z',analysis:{status:'available',needsImprovement:[{label:'Matching headings'}]}},
 writing:{status:'ready',score:6,tasks:{1:{score:5.5,status:'ready'},2:{score:6.5,status:'ready'}}}};
const definition={schemaVersion:'FormDefinitionV1',formVersionId:uid(20),title:'Phiếu giả để kiểm giao diện',kind:'mixed',answerReleasePolicy:'hidden',blocks:[{blockId:uid(21),checkpoint:1,title:'Bài học',items:[
 {itemVersionId:uid(22),itemFamilyId:uid(32),position:1,prompt:'Listening',skillCodes:['listening'],interactionType:'number_score',layoutType:'score_fraction',graderType:'none',maxScore:0,options:[],interactionConfig:{max:10}},
 {itemVersionId:uid(23),itemFamilyId:uid(33),position:2,prompt:'Reading',skillCodes:['reading'],interactionType:'number_score',layoutType:'score_fraction',graderType:'none',maxScore:0,options:[],interactionConfig:{max:10}},
 {itemVersionId:uid(24),itemFamilyId:uid(34),position:3,prompt:'Khó khăn Speaking',skillCodes:['speaking'],interactionType:'multi_choice_group',layoutType:'speaking_issue_checklist',graderType:'none',maxScore:0,options:[{id:'vocab',label:'Thiếu từ vựng để diễn đạt ý'},{id:'pause',label:'Còn ngập ngừng'}],interactionConfig:{maxSelections:2}},
]}]};
export async function startThe22Server({port=0}={}){
 const calls=[],faults={},overviewWarnings={},longComment='Nhận xét dài đã công bố, đọc đầy đủ ngay trong bảng. '.repeat(12);
 const assignments=[1,2,3].map(n=>({assignment_id:uid(100+n),public_token:uid(100+n),class_id:'1294',class_name:'Lớp giả Thẻ 22–23',session_number:n,title:'Buổi '+n+' · Listening + Speaking',status:'published',origin_scope:n===1?'izone':'personal'}));
 const payload=newEditorPayload('Phiếu kiểm thử — KHÔNG GIAO LỚP');payload.definition.courseCode='56';payload.definition.blocks[0].items[0].skillCodes=['general'];
 let draft={...payload,id:rootDraft,classId:'1294',sessionNumber:1,revision:1,status:'approved',contentHash:'a'.repeat(64),worksheetId:rootDraft};
 let publication={id:uid(91),draftId:rootDraft,revision:1,formVersionId:draft.definition.formVersionId};const publications=[publication];
 const note=(ref,n)=>ref===A&&n!==2?{visibility:'visible',noteText:'Buổi '+n+' — '+(n===3?longComment:'Nhận xét đầu khóa.'),revision:1}:null;
 const people=n=>students.map((s,i)=>({...s,submissionId:uid(300+n*10+i),checkpoints:[{blockId:uid(21)}],attendanceStatus:'self_confirmed',sessionComment:note(s.studentRef,n)}));
 const overview=()=>({classId:'1294',className:'Lớp giả Thẻ 22–23',totalSessions:3,counts:{currentStudents:2,complete:6},testCoverage:'connected',portalTestCoverage:'connected',journeyCommentsEnabled:true,...overviewWarnings,
  sessions:[1,2,3].map(n=>({sessionNumber:n,sessionDate:'2026-10-0'+n,assignmentId:uid(100+n),title:'Buổi '+n})),
  students:students.map(s=>({...s,externalTests:[testResult],cells:[1,2,3].map(n=>({sessionNumber:n,status:'complete',assignmentId:uid(100+n),sessionComment:note(s.studentRef,n)}))}))});
 const plan={classId:'1294',className:'Lớp giả Thẻ 22–23',totalSessions:3,highestKnownSession:3,revision:1,testSessionNumbers:[],testSources:[],sessionDates:[1,2,3].map(n=>({sessionNumber:n,date:'2026-10-0'+n,erpSessionId:String(1000+n)}))};
 const server=createServer(async(req,res)=>{
  const u=new URL(req.url,'http://local');
  const send=(value,status=200)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value));};
  try{
   if(u.pathname==='/progress-log/config.js'){res.setHeader('content-type','text/javascript');return res.end(`window.PROGRESS_LOG_CONFIG={API_BASE_URL:location.origin,THUY_PILOT_CLASS_IDS:['1294'],STUDENT_MEMORY:{enabled:false}};`);}
   if(u.pathname.startsWith('/api/')){
    let raw='';for await(const part of req)raw+=part;const body=raw?JSON.parse(raw):{};calls.push({path:u.pathname,method:req.method,body});
    if(u.pathname==='/api/auth/session')return send({ok:true,reviewer:{email:'teacher@example.test'}});
    const p=u.pathname.replace('/api/learning','');
    if(faults[p])return send({ok:false,message:'Lỗi nguồn giả để kiểm',error:'FIXTURE_ERROR'},503);
    if(p==='/teacher/options')return send({ok:true,reviewer:{name:'Giảng viên giả',email:'teacher@example.test'},classes:[{class_id:'1294',class_name:plan.className,student_count:2}],assignments});
    if(p==='/teacher/question-library')return send({ok:true,items:[]});
    if(p==='/teacher/journey-plan')return send({ok:true,plan});
    if(p==='/teacher/classes/1294/overview')return send({ok:true,overview:overview()});
    if(p==='/teacher/dashboard'||p==='/teacher/live-drafts'){
     const assignment=assignments.find(a=>a.assignment_id===u.searchParams.get('assignment'));if(!assignment)return send({ok:false,message:'Sai phiếu fixture'},400);const n=assignment.session_number;
     if(p.endsWith('/dashboard'))return send({ok:true,dashboard:{assignmentId:assignment.assignment_id,publicToken:assignment.public_token,classId:'1294',className:plan.className,title:assignment.title,sessionNumber:n,definition,journeyCommentsEnabled:true,students:people(n),blockReleases:[{blockId:uid(21),checkpoint:1,status:'open'}],classInsights:[]}});
     return send({ok:true,live:{assignmentId:assignment.assignment_id,generatedAt:new Date().toISOString(),students:people(n).map((s,i)=>({...s,attemptId:uid(400+n*10+i),draftRevision:1,finalResponses:{[uid(22)]:{correct:n+3,total:10},[uid(23)]:{correct:n+4,total:10},[uid(24)]:s.studentRef===A?(n===3?['vocab']:['vocab','pause']):[]}}))}});
    }
    if(p.endsWith('/question-analytics'))return send({ok:true,analytics:{assignmentId:u.searchParams.get('assignment')||uid(103),submittedCount:2,rosterCount:2,items:[]}});
    if(p==='/teacher/form-library')return send({ok:true,entries:[]});
    if(p==='/teacher/form-publications')return send({ok:true,publications});
    if(p==='/teacher/form-drafts/review-queue')return send({ok:true,drafts:[]});
    if(p==='/teacher/form-drafts'&&req.method==='GET')return send({ok:true,drafts:[{...draft,title:draft.definition.title}]});
    if(p==='/teacher/form-drafts'&&req.method==='POST'){draft={...body,id:randomUUID(),classId:body.classId,revision:1,status:'draft',contentHash:'b'.repeat(64)};return send({ok:true,draft});}
    if(p.endsWith('/edit')){if(publications.some(p=>p.draftId===draft.id)){draft=structuredClone(draft);draft.id=randomUUID();draft.definition.formVersionId=randomUUID();draft.gradingKey.formVersionId=draft.definition.formVersionId;draft.status='draft';draft.revision=1;draft.worksheetId=rootDraft;}return send({ok:true,draft});}
    if(p.startsWith('/teacher/form-drafts/')){
     if(p.endsWith('/approve')){draft.status='approved';return send({ok:true,draft});}
     if(p.endsWith('/publish-library')){publication={id:randomUUID(),draftId:draft.id,formVersionId:draft.definition.formVersionId,revision:draft.revision};publications.push(publication);return send({ok:true,publication});}
     if(req.method==='PUT')draft={...draft,...body,revision:draft.revision+1,status:'draft'};
     return send({ok:true,draft});
    }
    if(p==='/teacher/writing-test-result')return send({ok:true,result:{readOnly:true,testSlug:'term-test-1',title:'Term Test 1',resultRef:'a'.repeat(64),class:{classId:'1294',name:plan.className},student:students.find(s=>s.studentRef===body.studentRef),tasks:[1,2].map(taskNumber=>({taskNumber,score:taskNumber===1?5.5:6.5,wordCount:120,prompt:'Đề Writing giả',essay:'The saved essay in an isolated fixture.',report:'Nhận xét giả',criteria:[]}))}});
    return send({ok:false,message:'Ngoài fixture: '+p},404);
   }
   const file=resolve(root,'.'+decodeURIComponent(u.pathname)+(u.pathname.endsWith('/')?'index.html':''));if(!file.startsWith(resolve(root)+sep))throw Error('Denied');res.setHeader('content-type',{'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.woff2':'font/woff2'}[extname(file)]||'application/octet-stream');res.end(await readFile(file));
  }catch(e){if(!res.headersSent)res.writeHead(500);res.end(String(e.message));}
 });
 await new Promise(done=>server.listen(port,'127.0.0.1',done));
 return {server,origin:'http://127.0.0.1:'+server.address().port,calls,faults,overviewWarnings,longComment,overview,close:()=>new Promise(done=>server.close(done))};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const fixture=await startThe22Server({port:Number(process.env.PORT||18623)});process.stdout.write(fixture.origin+'\n');}
