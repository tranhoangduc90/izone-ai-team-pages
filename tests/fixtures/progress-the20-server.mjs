// Dữ liệu giả và API chỉ nằm trong tiến trình thử; không kết nối dịch vụ, lớp hoặc bài thật.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
export const root=fileURLToPath(new URL('../../',import.meta.url));
export const a='10000000-0000-4000-8000-000000000001',b='10000000-0000-4000-8000-000000000002',token='30000000-0000-4000-8000-000000000001';
const q1='50000000-0000-4000-8000-000000000001',q2='50000000-0000-4000-8000-000000000002',block='50000000-0000-4000-8000-000000000003';
const student=ref=>({studentRef:ref,name:ref===a?'Học viên A có tên rất dài để kiểm bố cục':'Học viên B',discriminator:null});
const analysis=type=>({status:'available',needsImprovement:[{type,correct:0,total:3}]});
export const tests=[{testSlug:'term-test-1',title:'Term Test 1',resultRef:'a'.repeat(64),completedAt:'2026-10-01T10:00:00Z',
 listening:{correct:0,total:10,analysis:analysis('Gap fill')},reading:{correct:4,total:10,analysis:analysis('Old Reading')},writing:{status:'ready',score:4,tasks:{1:{score:0,status:'ready'},2:{score:6,status:'ready'}}}},
 {testSlug:'term-test-2',title:'Term Test 2',completedAt:'2026-10-25T10:00:00Z',reading:{correct:7,total:10,analysis:analysis('TFNG')},writing:{status:'pending'}},
 {testSlug:'mini-test-erp-56',title:'Mini Test',completedAt:null,observedAt:'2026-10-30T10:00:00Z',source:'erp_56_mini_test',listening:{correct:5,total:10},reading:{correct:8,total:13}}];
export const definition={schemaVersion:'FormDefinitionV1',title:'Listening 2 + Speaking 5',instructions:'',blocks:[{blockId:block,checkpoint:1,title:'Phần 1',items:[
 {itemVersionId:q1,itemFamilyId:q1,position:1,prompt:'Chọn một câu trả lời',interactionType:'single_choice',maxScore:1,skillCodes:['listening'],options:[{id:'A',label:'Answer A'},{id:'B',label:'Answer B'}]},
 {itemVersionId:q2,itemFamilyId:q2,position:2,prompt:'Số câu đúng của em',interactionType:'number_score',maxScore:0,skillCodes:['listening'],interactionConfig:{max:7}}
]}]};
export function journey(ref=a){return {schemaVersion:'StudentCourseJourneyV1',class:{classId:'1294',name:'IC_TEST20'},student:student(ref),
 coverage:{schedule:'teacher_confirmed',plannedSessions:4,testResults:'connected',portalTests:'connected'},summary:{totalSessions:4,submittedComplete:2,attendedSessions:2,availableReports:0},reports:[],externalTests:tests,
 sessions:[1,2,3,4].map(n=>({sessionNumber:n,sessionDate:'2026-10-0'+n,title:'Listening 2 + Speaking 5',assignmentId:n<=2?token:null,publicToken:n<=2?token:null,
 completeness:n<=2?'complete':null,sessionKind:'lesson',quizSummary:n<=2?{correct:1,incorrect:0,graded:1}:null,
 sessionComment:n===2&&ref===a?{sessionNumber:2,visibility:'visible',noteText:'Nhận xét giảng viên đã công bố'}:null}))};}
export function detail(ref=a,n=1){return {classId:'1294',student:student(ref),sessionNumber:n,sessionDate:'2026-10-0'+n,status:'complete',submissionId:token,definition,
 responses:{[q1]:'A',[q2]:{correct:2,total:7}},gradingItems:[{itemVersionId:q1,verdict:'correct',maxScore:1,score:1}],
 sessionComment:n===2?{visibility:'visible',noteText:'Nhận xét giảng viên đã công bố'}:null};}
export function courseData(){const person={...student(a),externalTests:tests,cells:[]};return {person,overview:{classId:'1294',sessions:journey().sessions,students:[person]},
 forms:[1,2,3].map(number=>({sessionNumber:number,definition:{blocks:[{items:[{itemVersionId:'speaking',interactionType:'multi_choice_group',graderType:'none',skillCodes:['speaking'],options:[{id:'p',label:'Cần luyện phát âm'}]}]}]},
 dashboard:{students:[{...person,submissionId:'s'+number,sessionComment:{visibility:'visible',noteText:'Nhận xét giảng viên đã công bố'}}]},
 live:{students:[{studentRef:a,submissionId:'s'+number,finalResponses:{speaking:['p']}}]}}))};}
export const writingResult={readOnly:true,testSlug:'term-test-1',title:'Term Test 1',resultRef:'a'.repeat(64),class:{classId:'1294',name:'IC_TEST20'},student:student(a),tasks:[1,2].map(n=>({
 taskNumber:n,score:n===1?0:6,wordCount:n===1?0:120,prompt:'Đề Task '+n,essay:n===1?'':'The saved essay of student A.',gradingMethod:n===1?'blank_rule':'rubric',
 report:'<p>Nhận xét đầy đủ <strong>cho Task '+n+'</strong>.</p><script>window.unsafeWritingFeedback=true</script>',criteria:[{code:n===1?'TA':'TR',name:'Task response',bandScore:n===1?0:6,feedback:'<p>Nhận xét tiêu chí.</p>',components:[{name:'Ideas',summary:'Tóm tắt',feedback:'Phân tích chi tiết'}]}]}))};
export async function startThe20Server({port=0,revision=process.env.PROGRESS_THE20_BASE}={}){
 const calls=[],faults={};
 const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://local');
  try{
   if(url.pathname==='/fixture/data'){res.setHeader('content-type','application/json');return res.end(JSON.stringify(courseData()));}
   if(url.pathname==='/fixture/skills.html'){
    res.setHeader('content-type','text/html; charset=utf-8');return res.end(`<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/progress-log/styles.css"><link rel="stylesheet" href="/progress-log/reference-components.css"><link rel="stylesheet" href="/progress-log/thuy-live/styles.css"><link rel="stylesheet" href="/progress-log/student-the20.css"></head><body class="thuy-live thuy-student"><main class="shell"><p>Dữ liệu giả để kiểm Thẻ 20</p><div id="student"></div><div id="detail"></div><div id="teacher"></div></main><script type="module">import{buildSkillCourse,renderPersonSkills}from'/progress-log/thuy-live/course-skills.js';import{renderSessionReview}from'/progress-log/session-review.js';const data=await(await fetch('/fixture/data')).json();window.fixture=data;window.paint=()=>renderPersonSkills(document.querySelector('#student'),buildSkillCourse(data.overview,data.forms),data.person,{history:false,studentView:true,writingResultUrl:(r,t)=>'/term-tests/writing-result/#test=term-test-1&result='+r.resultRef+'&task='+t+'&assignment=${token}&student=${a}'});window.teacher=()=>renderPersonSkills(document.querySelector('#teacher'),buildSkillCourse(data.overview,data.forms),data.person,{history:false});window.detail=d=>renderSessionReview(document.querySelector('#detail'),d,{studentView:true});window.paint();window.teacher();</script></body></html>`);
   }
   if(url.pathname==='/progress-log/config.js'){
    res.setHeader('content-type','text/javascript');return res.end(`window.PROGRESS_LOG_CONFIG={API_BASE_URL:location.origin,THUY_PILOT_CLASS_IDS:['1294'],STUDENT_MEMORY:{enabled:true,allClasses:true}};`);
   }
   if(url.pathname.startsWith('/api/')){
    let raw='';for await(const chunk of req)raw+=chunk;const body=raw?JSON.parse(raw):{};calls.push({path:url.pathname,method:req.method,body});
    const send=(value,status=200)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value));};
    if(faults[url.pathname])return send({ok:false,message:'Lỗi nguồn giả để kiểm'},503);
    const path=url.pathname.replace('/api/learning',''),ref=body.studentRef||a;
    if(url.pathname==='/api/student-identity/resolve'){
     const s=body.studentRef?student(body.studentRef):student(body.identity?.id==='900002'?b:a);
     return send({ok:true,status:'unique',identity:{authority:'erp-contact',id:s.studentRef===a?'900001':'900002'},aliases:[{classId:'1294',classCode:'IC_TEST20',studentRef:s.studentRef,studentName:s.name}]});
    }
    if(path==='/student/portal-classes')return send({ok:true,classes:[{classId:'1294',name:'IC_TEST20'}]});
    if(path==='/student/portal-context')return send({ok:true,class:{classId:'1294',name:'IC_TEST20'},students:[a,b].map(ref=>({...student(ref),publicToken:token}))});
    if(path==='/student/course-journey')return send({ok:true,journey:journey(ref)});
    if(path==='/student/course-session-detail')return send({ok:true,detail:detail(ref,body.sessionNumber)});
    if(path==='/student/session-comments')return send({ok:true,classId:'1294',studentRef:ref,comments:journey(ref).sessions.map(s=>s.sessionComment).filter(Boolean)});
    if(path==='/assignments/open')return send({ok:true,assignment:{assignmentId:token,class:{id:'1294',name:'IC_TEST20'},courseCode:'56',sessionNumber:2,title:definition.title,definitionHash:'d'.repeat(64),definition,roster:[a,b].map(student),submissionWindow:{canSubmit:false,reason:'closed'},blockReleases:[]}});
    if(path==='/student/writing-test-result')return body.studentRef&&body.studentRef!==a?send({ok:false,message:'Không khớp học viên.'},403):send({ok:true,result:writingResult});
    return send({ok:false,message:'API không thuộc phép thử.'},404);
   }
   const pathname=url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname;
   const file=resolve(root,'.'+decodeURIComponent(pathname));if(!file.startsWith(resolve(root)+sep))throw Error('Denied');
   let data;if(revision&&file.startsWith(resolve(root,'progress-log')+sep))try{data=execFileSync('git',['-C',root,'show',revision+':'+file.slice(root.length).replaceAll('\\','/').replace(/^\//u,'')],{stdio:['ignore','pipe','ignore']});}catch{data=await readFile(file);}else data=await readFile(file);
   res.setHeader('content-type',{'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.html':'text/html; charset=utf-8','.woff2':'font/woff2'}[extname(file)]||'application/octet-stream');res.end(data);
  }catch(error){res.writeHead(404);res.end('Not found');}
 });
 await new Promise(done=>server.listen(port,'127.0.0.1',done));return {server,calls,faults,origin:'http://127.0.0.1:'+server.address().port,close:()=>new Promise(done=>server.close(done))};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const fixture=await startThe20Server({port:Number(process.env.THE20_PORT||0)});console.log(JSON.stringify({origin:fixture.origin,fakeData:true}));}
