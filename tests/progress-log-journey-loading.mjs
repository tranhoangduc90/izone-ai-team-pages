import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

// Phiếu giả và API trì hoãn: kiểm trạng thái người học thấy, không gọi API lớp thật.
const source = await readFile(new URL('../progress-log/app.js', import.meta.url), 'utf8');
const code = source.slice(source.indexOf('function journeyText('), source.indexOf('async function openAssignment()'));
function node() {
  return { hidden: false, disabled: false, textContent: '', children: [], attrs: {},
    classList: { toggle() {} }, setAttribute(k,v) { this.attrs[k] = v; },
    append(...items) { this.children.push(...items); }, replaceChildren(...items) { this.children = items; } };
}
function fixture(request) {
  const elements = Object.fromEntries(['journeyButton','journeyResultButton','journeyLoadingView',
    'journeyLoadingStatus','journeyRetryButton','journeySpinner','journeyStudentName',
    'journeyClassName','attendedCount','submittedCount','reportCount','journeyStatus',
    'journeySessions','journeyReports','journeyReportList'].map(id => [id,node()]));
  elements.journeyButton.textContent = elements.journeyResultButton.textContent = 'Xem hành trình của em';
  const state = { assignment:{class:{id:'class-1'}}, publicToken:'token-1',
    confirmedStudent:{studentRef:'student-1'}, responses:{text:'Bài đang viết'}, journeyLoading:false };
  const views = [], timers = [];
  const context = { elements,state,AbortController,
    setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {},
    document:{createElement:node}, showView:id=>views.push(id), setNotice() {}, apiRequest:request };
  vm.createContext(context);
  vm.runInContext(code, context);
  return {state,elements,views,timers,open:()=>vm.runInContext("openIntegratedJourney('confirmView')",context),
    back:()=>vm.runInContext('backFromJourney()',context)};
}
const result = {journey:{student:{studentRef:'student-1',name:'Học viên mẫu'},class:{classId:'class-1',name:'Lớp mẫu'},
  summary:{attendedSessions:0,submittedComplete:0,availableReports:0},sessions:[],reports:[],coverage:{}}};

test('J01: bấm Journey báo chờ ngay và chỉ gửi một yêu cầu', async () => {
  let resolve, count=0;
  const ui=fixture(()=>{count++;return new Promise(done=>{resolve=done;});});
  const opening=ui.open();
  assert.match(ui.elements.journeyButton.textContent,/Đang tải hành trình/);
  assert.equal(ui.elements.journeyLoadingView.attrs['aria-busy'],'true');
  assert.equal(ui.views.at(-1),'journeyLoadingView');
  await ui.open(); assert.equal(count,1);
  resolve(result); await opening;
  assert.equal(ui.views.at(-1),'journeyView');
  assert.equal(ui.elements.journeyButton.disabled,false);
});

test('J02: hết thời gian chờ cho thử lại và giữ bài đang viết', async () => {
  const ui=fixture((_path,{signal})=>new Promise((_resolve,reject)=>{
    signal.addEventListener('abort',()=>reject(Object.assign(new Error('abort'),{name:'AbortError'})));
  }));
  const opening=ui.open(); ui.timers[0](); await opening;
  assert.match(ui.elements.journeyLoadingStatus.textContent,/Chưa tải được hành trình/);
  assert.equal(ui.elements.journeyRetryButton.hidden,false);
  assert.equal(ui.state.responses.text,'Bài đang viết');
  ui.back(); assert.equal(ui.views.at(-1),'confirmView');
});

test('J03: quay về trước response đến thì không mở Journey trở lại', async () => {
  let resolve;
  const ui=fixture(()=>new Promise(done=>{resolve=done;}));
  const opening=ui.open(); ui.back(); resolve(result); await opening;
  assert.equal(ui.views.at(-1),'confirmView');
  assert.equal(ui.elements.journeyStudentName.textContent,'');
  assert.equal(ui.state.responses.text,'Bài đang viết');
});
