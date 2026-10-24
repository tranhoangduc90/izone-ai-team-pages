// Chạy loader/handler V2 thật; API và DOM giả chỉ nằm ở biên, không mô phỏng cache/commit.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import * as ui from '../js/writing-flow-ui.js';
import * as overview from '../js/writing-flow-overview.js';
import { teacherAuthFailure } from '../js/teacher-auth-ui.js';
import { createWritingReadCache } from '../js/writing-flow-read-cache.js';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes,no) => { resolve=yes; reject=no; });
  return { promise,resolve,reject };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

class Element {
  constructor(tag='div') {
    this.tagName=tag.toUpperCase(); this.children=[]; this.value='';
    this.hidden=false; this.dataset={}; this.style={}; this.listeners={};
    this.classList={ add(){},remove(){},toggle(){} };
  }
  set textContent(value) { this.text=String(value); this.children=[]; }
  get textContent() { return (this.text||'')+this.children.map(n=>n.textContent??String(n)).join(''); }
  append(...nodes) { this.children.push(...nodes); }
  prepend(...nodes) { this.children.unshift(...nodes); }
  replaceChildren(...nodes) { this.text=''; this.children=[...nodes]; }
  get childElementCount() { return this.children.length; }
  setAttribute(key,value) { this[key]=String(value); }
  removeAttribute(key) { delete this[key]; }
  addEventListener(event,handler) { this.listeners[event]=handler; }
  closest() { return this; }
  focus() {}
  close() {}
  showModal() {}
}

async function harness(overrides={}) {
  const elements=new Map(), calls=[], timers=new Map();
  const node=id => { if(!elements.has(id))elements.set(id,new Element()); return elements.get(id); };
  const storage={ getItem(){return null;},setItem(){} };
  const apiDefaults={
    writingCounts:async()=>({data:{counts:{stages:[{stage_key:'main',pair_count:1}]}}}),
    writingClasses:async()=>({data:{classes:[]}}),
    writingFilterOptions:async()=>({data:{filters:{classes:[],teachers:[]}}}),
    writingPairsPage:async filters=>({data:{pairs:[{pair_id:filters.classCode||filters.sourceKind+'-'+filters.stageKey,
      stage_key:filters.stageKey,student_name:'Học viên giả',status:'running'}],nextCursor:null}}),
    writingSourceIssues:async()=>({data:{issues:[]}}),
    writingDailyStats:async()=>({data:{days:[]}}),
    skipWritingPair:async()=>({data:{}}),
    restoreWritingPair:async()=>({data:{}}),
    retryWritingPairStage:async()=>({data:{}}),
    writingPairDetail:async id=>({data:{detail:{source:{topic:'Đề giả',essay:'Bài giả'},
      pair:{pair_id:id,student_name:id,source_type:'homework'},stages:[]}}}),
    writingPairHistory:async()=>({data:{history:{events:[]}}}),
  };
  const api=Object.fromEntries(Object.entries({...apiDefaults,...overrides}).map(([method,fn])=>
    [method,(...args)=>{calls.push({method,args});return fn(...args);}]));
  const session={async restore(){return true;},async login(){},async logout(){}};
  const context=vm.createContext({
    ...ui,...overview,teacherAuthFailure,createWritingReadCache,
    createTeacherApi:()=>api,createTeacherSessionClient:()=>session,
    createTeacherLoginPreference:()=>({read:()=>false,set:()=>true}),
    createRequestId:()=> '11111111-1111-4111-8111-111111111111',
    document:{getElementById:node,querySelector:node,querySelectorAll:()=>[],
      createElement:tag=>new Element(tag),createTextNode:text=>({textContent:text}),body:new Element()},
    Option:class extends Element {constructor(label,value){super('option');this.textContent=label;this.value=value;}},
    Node:Element,localStorage:storage,window:{localStorage:storage},
    location:{hash:'#stage/homework/main'},history:{replaceState(){}},
    google:{accounts:{id:{initialize(){},renderButton(){},disableAutoSelect(){}}}},
    fetch:async()=>({ok:true,json:async()=>({apiBase:'https://example.invalid',googleClientId:'fixture'})}),
    setTimeout:(fn,ms)=>{const id=Symbol();timers.set(id,{fn,ms});return id;},
    clearTimeout:id=>timers.delete(id),prompt:()=> 'Lý do giả',Date,console,
  });
  const source=await readFile(new URL('../js/writing-flow-v2.js',import.meta.url),'utf8');
  const boundary=source.lastIndexOf('\nsetupV2Filters();');
  assert.ok(boundary>0);
  const executable=source.slice(0,boundary).replace(/^import[\s\S]*?from ['"][^'"]+['"];[ \t]*\r?\n/gm,'');
  vm.runInContext(executable+'\nglobalThis.subject={state,init,refreshData,selectView,clearLogin,loadSourceIssues,skipPair,restorePair,openDetail};',context);
  const subject=context.subject;
  const boot=subject.init();
  await tick(); await tick();
  return {subject,boot,calls,node,timers};
}

test('tab có dữ liệu khi danh mục lớp vẫn chưa trả, không chờ loadCommon',async()=>{
  const classes=deferred();
  const app=await harness({writingClasses:()=>classes.promise});
  try {
    assert.equal(app.calls.filter(c=>c.method==='writingPairsPage').length,1);
    assert.equal(app.subject.state.pairs[0]?.pair_id,'homework-main');
    assert.equal(app.node('flow-dashboard').hidden,false);
    assert.match(app.node('flow-view-title').textContent,/Chấm chính/u);
  } finally {classes.resolve({data:{classes:[]}});await app.boot;}
});

test('quay lại tab cùng bộ lọc giữ cache và không đọc lại danh mục lớp',async()=>{
  const app=await harness(); await app.boot;
  app.subject.selectView('critic');await tick();await tick();
  app.subject.selectView('main');await tick();await tick();
  assert.equal(app.calls.filter(c=>c.method==='writingClasses').length,2);
  assert.equal(app.calls.filter(c=>c.method==='writingPairsPage'&&c.args[0].stageKey==='main').length,1);
});

test('đổi filter/loại bài khi request chưa xong không commit phản hồi cũ',async()=>{
  const first=deferred(), second=deferred();
  const app=await harness({writingPairsPage:filters=>filters.sourceKind==='homework'?first.promise:second.promise});
  app.subject.selectView('test_main');await tick();await tick();
  second.resolve({data:{pairs:[{pair_id:'test-new'}]}});await tick();await tick();
  first.resolve({data:{pairs:[{pair_id:'homework-old'}]}});await app.boot;await tick();
  assert.equal(app.subject.state.pairs[0]?.pair_id,'test-new');
});

test('phản hồi nguồn về sau logout không khôi phục dữ liệu phiên cũ',async()=>{
  const issues=deferred();
  const app=await harness({writingSourceIssues:()=>issues.promise});await app.boot;
  const loading=app.subject.loadSourceIssues();
  app.subject.clearLogin();
  issues.resolve({data:{issues:[{issue_key:'old',student_name:'Tên giả'}]}});
  await loading;
  assert.equal(app.subject.state.issues.length,0);
  assert.equal(app.subject.state.pairs.length,0);
  assert.equal(app.node('flow-dashboard').hidden,true);
});

test('lỗi danh mục không bỏ dữ liệu tab đã thành công',async()=>{
  const app=await harness({writingClasses:async()=>{throw new Error('classes fixture');}});
  await app.boot;await tick();
  assert.equal(app.subject.state.pairs[0]?.pair_id,'homework-main');
  assert.equal(app.node('flow-dashboard').hidden,false);
});

test('401 khóa giao diện và không để phản hồi đang tải của phiên cũ commit',async()=>{
  const late=deferred();
  const app=await harness({writingCounts:async()=>{throw Object.assign(new Error('auth'),{status:401});},
    writingPairsPage:()=>late.promise});
  await tick();
  late.resolve({data:{pairs:[{pair_id:'old'}]}});await app.boot;await tick();
  assert.equal(app.subject.state.authenticated,false);
  assert.equal(app.subject.state.pairs.length,0);
});

test('Cập nhật và mutation thành công/thất bại đều bỏ cache liên quan',async()=>{
  const app=await harness();await app.boot;
  const count=()=>app.calls.filter(c=>c.method==='writingPairsPage').length;
  assert.equal(count(),1);
  await app.subject.refreshData({force:true});assert.equal(count(),2);
  await app.subject.skipPair({pair_id:'fake'});assert.equal(count(),3);
});

test('cache gộp pending theo đầy đủ khóa, TTL và epoch ngăn cache phiên cũ',async()=>{
  let clock=0,requests=0;
  const slow=deferred();
  const api={writingPairsPage:()=>{requests++;return slow.promise;}};
  const cache=createWritingReadCache(api,{now:()=>clock});
  const a=cache.api.writingPairsPage({sourceKind:'homework',classCode:'A',offset:0});
  const b=cache.api.writingPairsPage({offset:0,classCode:'A',sourceKind:'homework'});
  await tick();assert.equal(requests,1);
  slow.resolve({data:{pairs:[]}});await Promise.all([a,b]);
  await cache.api.writingPairsPage({sourceKind:'homework',classCode:'A',offset:0});assert.equal(requests,1);
  clock=30_001;await cache.api.writingPairsPage({sourceKind:'homework',classCode:'A',offset:0});assert.equal(requests,2);
  cache.clear();await cache.api.writingPairsPage({sourceKind:'homework',classCode:'A',offset:0});assert.equal(requests,3);
});

test('cache phân biệt mọi bộ lọc, sort, nhóm lỗi và phân trang',async()=>{
  let calls=0;
  const cache=createWritingReadCache({writingPairsPage:async()=>{calls++;return {data:{pairs:[]}};}});
  const base={view:'review',sourceKind:'homework',classCode:'A',teacherName:'T',taskType:'task1',
    stageKey:'main',stageStatus:'running',search:'one',searchScope:'all',dateFrom:'2026-10-01',
    dateTo:'2026-10-02',sort:'updated:desc',warningGroup:'review',offset:0,limit:50};
  await cache.api.writingPairsPage(base);
  for(const key of Object.keys(base))await cache.api.writingPairsPage({...base,[key]:String(base[key])+'different'});
  assert.equal(calls,Object.keys(base).length+1);
});

test('Cập nhật đọc lại danh mục bộ lọc sau lần đầu',async()=>{
  const app=await harness();await app.boot;
  await app.subject.refreshData({force:true});await tick();
  assert.equal(app.calls.filter(c=>c.method==='writingFilterOptions').length,2);
});

test('ngày không hợp lệ vô hiệu hóa request cũ trước early return',async()=>{
  const late=deferred();
  const app=await harness({writingPairsPage:()=>late.promise});
  app.node('flow-date-from').value='2026-10-03';
  app.node('flow-date-to').value='2026-10-01';
  await app.subject.refreshData();
  late.resolve({data:{pairs:[{pair_id:'old-valid-filter'}]}});await app.boot;await tick();
  assert.equal(app.subject.state.pairs.length,0);
});

test('thống kê đang tải không hiển thị thành không có hoạt động',async()=>{
  const daily=deferred();
  const app=await harness({writingDailyStats:()=>daily.promise});await app.boot;
  app.subject.selectView('daily');await tick();await tick();
  assert.doesNotMatch(app.node('flow-daily-chart').textContent,/Chưa có hoạt động/u);
  assert.equal(app.subject.state.viewLoaded,false);
  daily.resolve({data:{days:[]}});await tick();
});

test('detail cũ về muộn không thay nội dung detail trong phiên mới',async()=>{
  const old=deferred();
  const detail=id=>({data:{detail:{source:{topic:'Đề giả',essay:'Bài giả'},
    pair:{pair_id:id,student_name:id,source_type:'homework'},stages:[]}}});
  const app=await harness({writingPairDetail:id=>id==='old-detail'?old.promise:Promise.resolve(detail(id))});
  await app.boot;
  const pending=app.subject.openDetail({pair_id:'old-detail'});
  app.subject.clearLogin();app.subject.state.authenticated=true;
  await app.subject.openDetail({pair_id:'new-detail'});
  old.resolve(detail('old-detail'));await pending;
  assert.match(app.node('flow-detail-content').textContent,/new-detail/u);
  assert.doesNotMatch(app.node('flow-detail-content').textContent,/old-detail/u);
});

test('read đang chạy trước mutation không commit snapshot cũ khi mutation đang chờ',async()=>{
  const old=deferred(), mutation=deferred();let requests=0;
  const app=await harness({writingPairsPage:()=>++requests===1?old.promise:Promise.resolve({data:{pairs:[{pair_id:'after-write'}]}}),
    skipWritingPair:()=>mutation.promise});
  const saving=app.subject.skipPair({pair_id:'fake'});await tick();
  old.resolve({data:{pairs:[{pair_id:'before-write'}]}});await tick();await tick();
  assert.equal(app.subject.state.pairs.length,0);
  mutation.resolve({data:{}});await saving;await app.boot;
  assert.equal(app.subject.state.pairs[0]?.pair_id,'after-write');
});

test('mutation lỗi mở lại Xem thêm sau khi vô hiệu hóa page đang tải',async()=>{
  const page=deferred();let requests=0;
  const app=await harness({writingPairsPage:()=>++requests===2?page.promise:
    Promise.resolve({data:{pairs:[{pair_id:'page-'+requests}],nextOffset:50}}),
    skipWritingPair:async()=>{throw new Error('Lỗi giả');}});
  await app.boot;
  const pending=app.node('flow-more').listeners.click();await tick();
  assert.equal(app.subject.state.loadingMore,true);
  await app.subject.skipPair({pair_id:'fake'});
  assert.equal(app.subject.state.loadingMore,false);
  await app.node('flow-more').listeners.click();
  assert.equal(requests,3);
  page.resolve({data:{pairs:[{pair_id:'page-stale'}]}});await pending;
  assert.equal(app.subject.state.loadingMore,false);
  assert.equal(app.subject.state.pairs.some(p=>p.pair_id==='page-stale'),false);
});

for(const status of [401,403])test('chi tiết trả '+status+' khóa phiên và xóa cache đọc ngay',async()=>{
  const app=await harness({writingPairDetail:async()=>{throw Object.assign(new Error('Auth giả'),{status});}});
  await app.boot;
  const countsArgs=app.calls.find(c=>c.method==='writingCounts').args;
  await app.subject.openDetail({pair_id:'fake'});
  assert.equal(app.subject.state.authenticated,false);
  assert.equal(app.subject.state.pairs.length,0);
  assert.equal(app.node('flow-dashboard').hidden,true);
  await app.subject.state.api.writingCounts(...countsArgs);
  assert.equal(app.calls.filter(c=>c.method==='writingCounts').length,2);
});

test('mutation trả 403 khóa phiên dù invalidation làm refresh context cũ',async()=>{
  const app=await harness({skipWritingPair:async()=>{throw Object.assign(new Error('Auth giả'),{status:403});}});
  await app.boot;await app.subject.skipPair({pair_id:'fake'});
  assert.equal(app.subject.state.authenticated,false);
  assert.equal(app.subject.state.pairs.length,0);
  assert.equal(app.node('flow-dashboard').hidden,true);
});

test('401 chi tiết cũ sau đổi phiên không khóa tài khoản mới',async()=>{
  const old=deferred();
  const detail=id=>({data:{detail:{source:{topic:'Đề giả',essay:'Bài giả'},
    pair:{pair_id:id,student_name:id,source_type:'homework'},stages:[]}}});
  const app=await harness({writingPairDetail:id=>id==='old'?old.promise:Promise.resolve(detail(id))});
  await app.boot;
  const pending=app.subject.openDetail({pair_id:'old'});
  app.subject.clearLogin();app.subject.state.authenticated=true;
  await app.subject.openDetail({pair_id:'new'});
  old.reject(Object.assign(new Error('Auth cũ'),{status:401}));await pending;
  assert.equal(app.subject.state.authenticated,true);
  assert.match(app.node('flow-detail-content').textContent,/new/u);
});
