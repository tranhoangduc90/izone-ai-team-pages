// Native VM của chính hàm initialize: kiểm thứ tự gọi và identity gate, không phải browser proof.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=process.env.K56_RESUME_PAGES_ROOT||path.resolve(__dirname,'..');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',token='33333333-3333-4333-8333-333333333333',session='44444444-4444-4444-8444-444444444444';
async function run(slug,scenario,skill='reading'){
 const filename=path.join(root,'term-tests',slug+'-computer-based/bootstrap.js'),source=fs.readFileSync(filename,'utf8');
 const start=source.indexOf('  let initializing = false;'),end=source.indexOf("  window.addEventListener('pagehide'",start);assert.ok(start>0&&end>start,'Không xác định đúng hàm initialize hiện hành');
 const calls=[],prepared=[],notices=[],dialogs=[],nodes=new Map(),clone=v=>JSON.parse(JSON.stringify(v));
 const element=()=>({value:'',textContent:'',hidden:true,dataset:{},replaceChildren(...items){this.options=items},focus(){}});
 const names=['bootstrapClass','bootstrapStudent','bootstrapDownloadStatus','bootstrapDownloadStep','bootstrapPreviewStep','bootstrapStartStep','bootstrapRetry','bootstrapNotice','bootstrapConfirmPrefilled'];
 const elements=Object.fromEntries(names.map(name=>[name,element()]));
 const state=scenario==='cold'?{drafts:{listening:{},reading:{}}}:{studentRef:A,studentName:'Tên cũ trên máy',attemptToken:token,examSessionToken:session,examMode:skill==='reading'?'read_first':'lis_first',drafts:{reading:{1:'own-saved-draft'}},[skill+'StartedAt']:'2026-10-14T19:00:00Z',[skill+'DeadlineAt']:'2026-10-14T20:00:00Z'};
 if(scenario==='prepared')delete state[skill+'StartedAt'];
 if(scenario==='session-only')state.attemptToken='';
 const original=clone(state);
 const context={state,roster:[],classCode:'IC2264',testConfig:{slug},localDemo:false,localDemoRoster:[],demoStudentRef:'',demoAttemptToken:'',legacyListeningResume:false,encryptedAudio:null,preparing:false,studentMemory:null,pendingStudent:null,confirmedCurrentTab:false,elements,
  Option:function(text,value){this.text=text;this.value=value},navigator:{onLine:scenario!=='offline'},window:{K56_EXAM_ORDER:{requested:()=>state.examMode||'lis_first'}},
  document:{getElementById(id){if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)}},identityDialog:{showModal(){dialogs.push(true)}},
  isUuid:value=>typeof value==='string'&&/^[a-f0-9-]{36}$/i.test(value),showNotice:(...args)=>notices.push(args),saveState:patch=>Object.assign(state,patch),initializeStudentMemory:async()=>{},
  prepareSelectedStudent:async()=>{prepared.push({state:clone(state),roster:clone(context.roster),selected:elements.bootstrapStudent.value});},
  apiRequest:async(route,options={})=>{
   const body=options.body?JSON.parse(options.body):null;calls.push({route,body});
   if(scenario==='offline')throw Error('Synthetic offline');
   if(route.endsWith('/attempt/active')){
    if(scenario==='invalid'){const error=Error('Token giả đã reset');error.status=404;error.code='ATTEMPT_NOT_FOUND';throw error;}
    if(scenario==='session-only'){assert.equal(body.attemptToken,undefined);assert.equal(body.examSessionToken,session)}else assert.equal(body.attemptToken,token);assert.equal(body.studentRef,A);assert.equal(body.classCode,'IC2264');assert.equal(body.identityOnly,true);
    if(scenario==='session-raced')state.examSessionToken=B;
    if(scenario==='raced'){state.studentRef=B;state.attemptToken=B;state.studentName='Người mới trên tab';state.drafts={reading:{1:'new-owner-draft'}};}
    return {ok:true,found:true,attemptToken:scenario==='identity-mismatch'?B:token,examSessionToken:scenario==='session-mismatch'?B:session,studentName:'Tên canonical từ máy chủ'};
   }
   if(route.includes('/roster?')){
    if(['closed','invalid','prepared'].includes(scenario)){const error=Error('Lớp không mở lượt mới');error.status=404;throw error;}
    return {class:{name:'IC2264'},students:scenario==='excluded'?[{ref:B,name:'Other'}]:[{ref:A,name:'Canonical roster A'},{ref:B,name:'Other'}]};
   }
   throw Error('Unexpected native fixture route');
  }
 };
 vm.createContext(context);vm.runInContext(source.slice(start,end)+'\nglobalThis.initializeUnderTest=initialize;',context,{filename});await context.initializeUnderTest();
 return {calls,prepared,notices,dialogs,state:clone(state),original,roster:clone(context.roster),selected:elements.bootstrapStudent.value,pending:clone(context.pendingStudent)};
}
for(const slug of ['term-test-1-k56','term-test-2-k56','mini-test-k56']){
 for(const skill of ['listening','reading'])for(const scenario of ['closed','excluded'])test(`Bootstrap resume ${slug} ${skill} ${scenario}: token khôi phục trước roster, tên canonical và Mini vẫn xác nhận`,async()=>{
  const r=await run(slug,scenario,skill);assert.ok(r.calls[0]?.route.endsWith('/attempt/active'),'Phải xác minh token đã bắt đầu trước public roster');assert.equal(r.calls.length,1);assert.equal(r.state.studentRef,A);assert.equal(r.state.attemptToken,token);assert.equal(r.state[skill+'DeadlineAt'],r.original[skill+'DeadlineAt']);assert.deepEqual(r.state.drafts,r.original.drafts);assert.equal(r.selected,A);assert.equal(r.roster.length,1);assert.equal(r.roster[0].name,'Tên canonical từ máy chủ');
  if(slug==='mini-test-k56'){assert.equal(r.dialogs.length,1);assert.equal(r.prepared.length,0,'Mini không prepare trước xác nhận mới');assert.equal(r.pending.ref,A);}
  else{assert.equal(r.prepared.length,1);assert.equal(r.prepared[0].state.studentName,'Tên canonical từ máy chủ');assert.equal(r.dialogs.length,0);}
 });
 test(`Bootstrap resume ${slug}: phiên Listening chỉ lưu session token khôi phục đúng attempt liên kết`,async()=>{const r=await run(slug,'session-only','listening');assert.equal(r.calls.length,1);assert.ok(r.calls[0].route.endsWith('/attempt/active'));assert.equal(r.state.attemptToken,token);assert.equal(r.state.examSessionToken,session);assert.equal(r.state.listeningDeadlineAt,r.original.listeningDeadlineAt);assert.deepEqual(r.state.drafts,r.original.drafts);assert.equal(r.selected,A);if(slug==='mini-test-k56'){assert.equal(r.dialogs.length,1);assert.equal(r.prepared.length,0)}else assert.equal(r.prepared.length,1)});
 test(`Bootstrap resume ${slug}: metadata session khác không đổi tên/bài`,async()=>{const r=await run(slug,'session-mismatch');assert.deepEqual(r.state,r.original);assert.equal(r.prepared.length,0);assert.equal(r.dialogs.length,0);assert.equal(r.notices.length,1)});
 test(`Bootstrap resume ${slug}: phản hồi cũ sau đổi session không ghi đè phiên mới`,async()=>{const r=await run(slug,'session-raced');assert.equal(r.state.examSessionToken,B);assert.equal(r.state.studentName,r.original.studentName);assert.deepEqual(r.state.drafts,r.original.drafts);assert.equal(r.prepared.length,0);assert.equal(r.dialogs.length,0);assert.equal(r.roster.length,0)});
 test(`Bootstrap resume ${slug}: metadata của token khác không đổi tên/bài đang lưu`,async()=>{const r=await run(slug,'identity-mismatch');assert.deepEqual(r.state,r.original);assert.equal(r.prepared.length,0);assert.equal(r.dialogs.length,0);assert.equal(r.notices.length,1);assert.equal(r.roster.length,0)});
 test(`Bootstrap resume ${slug}: phản hồi tới muộn sau đổi người không ghi đè ngữ cảnh mới`,async()=>{const r=await run(slug,'raced');assert.equal(r.state.studentRef,B);assert.equal(r.state.attemptToken,B);assert.equal(r.state.studentName,'Người mới trên tab');assert.deepEqual(r.state.drafts,{reading:{1:'new-owner-draft'}});assert.equal(r.prepared.length,0);assert.equal(r.dialogs.length,0);assert.equal(r.roster.length,0)});
 test(`Bootstrap resume ${slug}: offline giữ draft/token/deadline và không mở lượt khác`,async()=>{const r=await run(slug,'offline');assert.deepEqual(r.state,r.original);assert.equal(r.prepared.length,0);assert.equal(r.dialogs.length,0);assert.equal(r.notices.length,1);assert.match(r.notices[0][0],/Chưa có kết nối/)});
 test(`Bootstrap resume ${slug}: token bị reset không mở bài hay thay nháp`,async()=>{const r=await run(slug,'invalid');assert.deepEqual(r.state,r.original);assert.equal(r.prepared.length,0);assert.equal(r.dialogs.length,0);assert.equal(r.notices.length,1);assert.ok(r.calls[0].route.endsWith('/attempt/active'))});
 test(`Bootstrap resume ${slug}: lượt chỉ prepare chưa bắt đầu không bypass roster đã đóng`,async()=>{const r=await run(slug,'prepared');assert.equal(r.calls.length,1);assert.ok(r.calls[0].route.includes('/roster?'));assert.equal(r.prepared.length,0);assert.equal(r.dialogs.length,0);assert.deepEqual(r.state,r.original)});
 test(`Bootstrap resume ${slug}: mở trang mới không tự prepare`,async()=>{const r=await run(slug,'cold');assert.equal(r.calls.length,1);assert.ok(r.calls[0].route.includes('/roster?'));assert.equal(r.prepared.length,0);assert.equal(r.dialogs.length,0)});
}
