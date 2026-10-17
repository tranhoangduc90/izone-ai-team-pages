// Regression từ UI production: khôi phục Mini rồi Quay lại chọn tên bị kẹt roster một người.
// VM chạy chính initialize/cancel/change/confirm; API và DOM giả, không chứng minh browser.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=process.env.K56_MINI_RESELECT_ROOT||path.resolve(__dirname,'..');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',TOKEN='33333333-3333-4333-8333-333333333333',SESSION='44444444-4444-4444-8444-444444444444';
const copy=x=>JSON.parse(JSON.stringify(x));
async function harness({retained=true,rosterError=false,deferred=false,excludeRetained=false}={}){
 const source=fs.readFileSync(path.join(root,'term-tests/mini-test-k56-computer-based/bootstrap.js'),'utf8'),nodes=new Map(),calls=[],prepared=[],notices=[],removed=[];
 function element(){return{value:'',textContent:'',hidden:true,disabled:false,dataset:{},listeners:{},addEventListener(k,fn){this.listeners[k]=fn},replaceChildren(...options){this.options=options},focus(){}}}
 function node(id){if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)}
 const elements=Object.fromEntries(['bootstrapClass','bootstrapStudent','bootstrapDownloadStatus','bootstrapDownloadProgress','bootstrapDownloadStep','bootstrapPreviewStep','bootstrapPreview','bootstrapPreviewStatus','bootstrapVolume','bootstrapStartStep','bootstrapStart','bootstrapRetry','bootstrapNotice'].map(id=>[id,node(id)]));
 elements.bootstrapDownloadStatus.textContent='Đang tải danh sách lớp...';
 const original=retained?{studentRef:A,studentName:'Tên cũ',attemptToken:TOKEN,examSessionToken:SESSION,listeningStartedAt:'2026-10-14T10:00:00Z',listeningDeadlineAt:'2026-10-14T11:00:00Z',audioVolume:0.6,drafts:{listening:{1:'owned-A'}}}:{audioVolume:0.6};
 let resolveRoster;const rosterGate=new Promise(resolve=>resolveRoster=resolve);
 const context={state:copy(original),classCode:'IC2264',testConfig:{slug:'mini-test-k56'},roster:[],localDemo:false,localDemoRoster:[],demoStudentRef:'',demoAttemptToken:'',legacyListeningResume:false,confirmedCurrentTab:false,pendingStudent:null,encryptedAudio:null,preparing:false,downloadController:null,previewHeard:false,studentMemory:null,elements,crypto,
  Option:function(text,value){this.text=text;this.value=value},navigator:{onLine:true},window:{K56_EXAM_ORDER:{requested:()=> 'lis_first'}},document:{getElementById:node},
  identityDialog:{open:false,showModal(){this.open=true},close(){this.open=false},addEventListener(){}},
  previewAudio:{pause(){},removeAttribute(){}},revokePreview(){},annotationStorageKey:'annotations',uiStorageKey:'ui',
  sessionStorage:{removeItem:k=>removed.push(['session',k])},localStorage:{removeItem:k=>removed.push(['local',k])},
  isUuid:x=>typeof x==='string'&&/^[a-f0-9-]{36}$/i.test(x),showNotice:(message,error)=>{notices.push({message,error});elements.bootstrapNotice.hidden=false},
  saveState:patch=>Object.assign(context.state,patch),initializeStudentMemory:async()=>{},
  prepareSelectedStudent:async()=>{prepared.push(copy(context.state))},
  apiRequest:async(route,options={})=>{
   calls.push({route,body:options.body?JSON.parse(options.body):null});
   if(route.endsWith('/attempt/active'))return {ok:true,found:true,studentName:'Canonical A',attemptToken:TOKEN,examSessionToken:SESSION};
   if(route.includes('/roster?')){if(deferred)await rosterGate;if(rosterError)throw Error('Synthetic roster unavailable');return {class:{name:'IC2264'},students:[...(!excludeRetained?[{ref:A,name:'Canonical A'}]:[]),{ref:B,name:'Canonical B'}]};}
   throw Error('Unexpected fixture route');
  }
 };
 const initStart=source.indexOf('  let initializing = false;'),initEnd=source.indexOf("  window.addEventListener('pagehide'",initStart);
 const resetStart=source.indexOf('  function resetPreparation()'),resetEnd=source.indexOf('  function recoverFromServerReset',resetStart);
 const cancelStart=source.search(/  (?:async )?function cancelIdentity\(\)/),cancelEnd=source.indexOf('  function escapeText',cancelStart);
 const changeStart=source.indexOf("  elements.bootstrapRetry.addEventListener('click'");
 assert.ok([initStart,initEnd,resetStart,resetEnd,cancelStart,cancelEnd,changeStart].every(n=>n>0));
 vm.createContext(context);
 vm.runInContext(source.slice(resetStart,resetEnd)+source.slice(cancelStart,cancelEnd)+source.slice(changeStart,initStart)+source.slice(initStart,initEnd)+'\nglobalThis.initializeUnderTest=initialize;',context);
 await context.initializeUnderTest();
 return {context,original,calls,prepared,notices,removed,elements,resolveRoster,
  cancel:()=>node('cancelIdentity').listeners.click(),
  select:ref=>{elements.bootstrapStudent.value=ref;return elements.bootstrapStudent.listeners.change()},
  confirm:()=>node('confirmIdentity').listeners.click()};
}
test('Mini retained: quay lại nạp roster, không prepare hoặc xóa nháp/token A',async()=>{
 const h=await harness();assert.equal(h.context.roster.length,1);await h.cancel();
 assert.equal(h.context.roster.length,2,'Quay lại phải lấy danh sách lớp hiện hành');
 assert.ok(h.calls.some(c=>c.route.includes('/roster?')));assert.equal(h.prepared.length,0);
 assert.equal(h.context.state.attemptToken,TOKEN);assert.deepEqual(h.context.state.drafts,h.original.drafts);assert.deepEqual(h.removed,[]);
 assert.equal(h.elements.bootstrapStudent.value,'');assert.doesNotMatch(h.elements.bootstrapDownloadStatus.textContent,/Đang tải danh sách lớp/);
});
test('Mini retained: chọn B vẫn chờ xác nhận; xác nhận B không mang token/nháp A',async()=>{
 const h=await harness();await h.cancel();h.select(B);
 assert.equal(h.context.pendingStudent?.ref,B,'Tên B phải được chọn trước cổng xác nhận');
 assert.equal(h.prepared.length,0);assert.equal(h.context.state.studentRef,A);assert.deepEqual(h.context.state.drafts,h.original.drafts);
 h.confirm();assert.equal(h.prepared.length,1);assert.equal(h.prepared[0].studentRef,B);assert.equal(h.prepared[0].attemptToken,undefined);assert.equal(h.prepared[0].examSessionToken,undefined);assert.equal(h.prepared[0].drafts,undefined);
});
test('Mini retained: chọn lại A giữ token, nháp, deadline và chờ xác nhận',async()=>{
 const h=await harness();await h.cancel();h.select(A);assert.equal(h.prepared.length,0);h.confirm();
 assert.equal(h.prepared.length,1);assert.equal(h.prepared[0].attemptToken,TOKEN);assert.equal(h.prepared[0].examSessionToken,SESSION);
 assert.deepEqual(h.prepared[0].drafts,h.original.drafts);assert.equal(h.prepared[0].listeningDeadlineAt,h.original.listeningDeadlineAt);assert.deepEqual(h.removed,[]);
});
test('Mini retained: roster lỗi báo lỗi và vẫn chọn lại A được, không mất bài',async()=>{
 const h=await harness({rosterError:true});await h.cancel();
 assert.equal(h.notices.length,1,'Roster lỗi cần có thông báo');assert.equal(h.elements.bootstrapRetry.hidden,false);assert.equal(h.elements.bootstrapStudent.disabled,false);
 assert.equal(h.context.state.attemptToken,TOKEN);assert.deepEqual(h.context.state.drafts,h.original.drafts);h.select(A);h.confirm();assert.equal(h.prepared[0].attemptToken,TOKEN);
});
test('Mini retained: chờ roster khóa dropdown và không tự mở bài',async()=>{
 const h=await harness({deferred:true}),pending=h.cancel();
 assert.equal(h.elements.bootstrapStudent.disabled,true,'Chưa có roster mới thì chưa cho đổi lựa chọn');
 assert.equal(h.prepared.length,0);assert.equal(h.context.state.studentRef,A);h.resolveRoster();await pending;
 assert.equal(h.elements.bootstrapStudent.disabled,false);assert.equal(h.context.roster.length,2);
});
test('Mini confirmed: dropdown không đổi owner đang thi',async()=>{
 const h=await harness();h.context.confirmedCurrentTab=true;h.select(B);
 assert.equal(h.elements.bootstrapStudent.value,A);assert.equal(h.context.state.studentRef,A);assert.equal(h.context.pendingStudent?.ref,A);assert.equal(h.prepared.length,0);
});
test('Mini cold: hủy lựa chọn không gọi roster lặp hoặc prepare',async()=>{
 const h=await harness({retained:false});h.select(A);await h.cancel();
 assert.equal(h.calls.filter(c=>c.route.includes('/roster?')).length,1);assert.equal(h.prepared.length,0);assert.equal(h.context.pendingStudent,null);assert.equal(h.elements.bootstrapStudent.value,'');
});
test('Mini retained: roster không còn A vẫn giữ A canonical để tiếp tục lượt cũ',async()=>{
 const h=await harness({excludeRetained:true});await h.cancel();
 assert.deepEqual(copy(h.context.roster).map(s=>s.ref).sort(),[A,B]);
 h.select(A);h.confirm();assert.equal(h.prepared[0].attemptToken,TOKEN);assert.deepEqual(h.prepared[0].drafts,h.original.drafts);
});
