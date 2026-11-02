// Luật nghiệp vụ phải tiếp tục khi trình duyệt từ chối ghi History API.
// VM chạy hàm nguồn thật với biên HTTP/DOM giả, không gọi dịch vụ thật.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=process.env.HISTORY_SOURCE_ROOT||path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
function sandbox(extra={}){
 const history={state:{owner:'fixture-owner'},replaceState(){throw new DOMException('History denied','SecurityError');},pushState(){throw new DOMException('History denied','SecurityError');}};
 const context=vm.createContext({URL,URLSearchParams,structuredClone,DOMException,console,Date,history,location:new URL('https://fixture.invalid/lesson/?scenario=review&attemptId=old#login?entry=fixture-entry'),...extra});context.window=context;return context;
}
// Hàm không export được đọc ở ranh giới nguyên hàm; cú pháp thay đổi sẽ làm harness báo lỗi.
function loadFunction(context,file,name){
 const text=read(file),at=text.search(new RegExp('(?:async )?function '+name+'\\('));assert.ok(at>=0,name+' exists');
 const firstEnd=text.indexOf('\n',at),line=text.slice(at,firstEnd);
 const end=line.endsWith('}')?firstEnd:text.indexOf('\n}',firstEnd)+2;assert.ok(end>at);
 vm.runInContext(text.slice(at,end),context,{filename:file});
}
for(const [file,key]of [['term-tests/k56-exam-order.js','K56_EXAM_ORDER'],['term-tests/shared/exam-order.js','K67_EXAM_ORDER']]){
 test(key+': phản hồi máy chủ vẫn cập nhật thứ tự, hạn và trạng thái bài',()=>{
  const c=sandbox({document:{body:{classList:{contains:()=>false}}}});vm.runInContext(read(file),c,{filename:file});
  const state={answers:{reading:{1:'A'}},notes:'Giữ nguyên',examMode:'lis_first'},response={examMode:'read_first',examDelivery:'answer_sheet',nextSection:'listening',readingSubmitted:true,listeningSubmitted:false,completed:false,readingStartedAt:'2026-11-02T04:00:00Z',readingDeadlineAt:'2026-11-02T05:00:00Z',listeningStartedAt:'',listeningDeadlineAt:'',attemptToken:'synthetic-attempt',serverNow:'2026-11-02T04:05:00Z'};
  c[key].apply(state,response);assert.equal(state.examMode,'read_first');assert.equal(state.nextSection,'listening');assert.equal(state.readingSubmitted,true);assert.equal(state.readingDeadlineAt,response.readingDeadlineAt);assert.deepEqual(state.answers,{reading:{1:'A'}});assert.equal(state.notes,'Giữ nguyên');
 });
}
test('Reading Homework: đổi về nháp vẫn nhận đúng bài và dựng màn',async()=>{
 const c=sandbox({state:{savedAt:null},originalDraft:{answers:{q1:'Bản nháp giữ lại'},status:'draft'},writable:()=>true,panePositions:{passage:99,questions:99},render(){c.rendered=true;},scrollTo(){}});
 loadFunction(c,'reading-skills67/prototype.js','changeScenario');await c.changeScenario('current');assert.equal(c.state.answers.q1,'Bản nháp giữ lại');assert.equal(c.rendered,true);assert.equal(c.panePositions.questions,0);
});
test('Reading Homework: mở Sửa bài vẫn khôi phục hành trình sau khi đọc nháp',async()=>{
 const c=sandbox({teacher:false,closeModal(){},newState:()=>({}),render(){},focusHistoryDestination(){},toast(){},serverClient:{async flush(){},async getDraft(){return {body:{answers:{q1:'Giữ nguyên'}},savedAt:null};},identity:{ownerId:'fixture'},async getHistory(){return [];}}});
 c.ReadingMaterialsExperience={async restore(){c.restored=true;},focusCurrent(){c.focused=true;}};
 loadFunction(c,'reading-skills67/prototype.js','serverAction');await c.serverAction('repair-edit');assert.equal(c.restored,true);assert.equal(c.focused,true);assert.equal(c.state.answers.q1,'Giữ nguyên');
});
for(const kind of ['reading','listening'])test(kind+' thực chiến: link entry vẫn tới bước xác minh/mở bài',async()=>{
 const requests=[],navigation=[],storage=new Map();const c=sandbox({app:{innerHTML:''},ENTRY:'fixture-entry-key',SESSION:'fixture-session',personalEntry:false,sessionToken:'',courseIdentity:{canRestoreSession:()=>false},sessionStorage:{setItem:(k,v)=>storage.set(k,v),getItem:k=>storage.get(k)},
  async request(route){requests.push(route);return {students:[{id:'fixture-student'}],lesson:{code:'fixture'}};},setLesson(){},setAuthoredLesson(){},async autoLoginRemembered(){return false;},navigate:route=>navigation.push(route),escape:v=>v,notify(){}});
 loadFunction(c,kind+'-practice/app.js','bootstrap');await c.bootstrap();assert.deepEqual(requests,['/open']);assert.deepEqual(navigation,['login']);assert.equal(c.ready,true);assert.equal(c.STUDENTS[0].id,'fixture-student');
});
test('Progress Log: chọn danh sách lớp vẫn dựng màn và giữ dữ liệu',()=>{
 const state={dashboardGeneration:1,analyticsGeneration:2,classes:[{id:'fixture'}],assignments:[{id:'assignment'}]};const c=sandbox({state,liveUpdates:{stop(){}},elements:{draftDialog:{open:false},journeyDetailDialog:{open:false}},classPortal:{},openClass(){},renderTeacherClassPortal(_host,value){c.portal=plain(value);},switchPanel:panel=>c.panel=panel});
 loadFunction(c,'progress-log/teacher.js','showClassPortal');c.showClassPortal();assert.equal(c.panel,'classes');assert.deepEqual(c.portal.classes,state.classes);assert.deepEqual(c.portal.assignments,state.assignments);
});
test('Writing Flow: chuyển thẻ vẫn tải đúng nhóm bài',()=>{
 const controls={'flow-stage-status':{value:'old'}};const c=sandbox({state:{activeView:'overview',pairs:[{id:'old'}]},$:id=>controls[id],applyDefaultDates(){},viewToHash:view=>'#'+view,refreshData(){c.refreshed=true;}});
 loadFunction(c,'writing-handouts/js/writing-flow-v2.js','selectView');c.selectView('delivered');assert.equal(c.state.activeView,'delivered');assert.deepEqual(plain(c.state.pairs),[]);assert.equal(c.refreshed,true);
});
test('Writing Flow: mở chi tiết ngày vẫn giữ đúng khoảng ngày và tải dữ liệu',()=>{
 const controls={'flow-date-from':{value:''},'flow-date-to':{value:''}};const c=sandbox({state:{pairs:[{id:'old'}]},$:id=>controls[id],normalizeWritingDay:v=>v,isTestView:()=>false,viewToHash:view=>'#'+view,refreshData(){c.refreshed=true;}});
 loadFunction(c,'writing-handouts/js/writing-flow-v2.js','openDailyDetails');c.openDailyDetails('2026-11-02');assert.equal(controls['flow-date-from'].value,'2026-11-02');assert.equal(c.state.activeView,'delivered');assert.equal(c.refreshed,true);
});
test('Tiến trình GV Reading/Listening/Speaking: không biến lỗi URL thành lỗi dữ liệu',()=>{
 const state={code:'fixture-code',classId:'fixture-class',selected:'unit-1',attemptId:'attempt-1',focusRef:'student-1'};const before=structuredClone(state),c=sandbox({state,uuid:v=>!!v,workId:v=>!!v});
 loadFunction(c,'shared/teacher-progress.js','rememberView');assert.doesNotThrow(()=>c.rememberView());assert.deepEqual(state,before);assert.equal(c.history.state.owner,'fixture-owner');
});
