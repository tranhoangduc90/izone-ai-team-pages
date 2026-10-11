import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {ORDER,FIELDS,createState} from '../lesson5-demo/core.mjs';
import {renderJourney,renderProcessing,renderRecap} from './recovery-ui.mjs';
import {renderActivityList,renderActivityDetail} from '../lesson5/activity-ui.mjs';
import {savedContent,threadsView,approvalLabel,selectionOffsets,fieldHash} from './features.mjs';
const featureGlobals={savedContent,threadsView,approvalLabel,selectionOffsets,fieldHash,installStyles(){}};

// Dùng dữ liệu giả để kiểm nội dung người học nhìn thấy và chống phản hồi muộn.
// Không gọi lớp thật; lỗi assertion trả trạng thái hỏng cho bộ kiểm Node.
function complete(){
 const s=createState();s.idea2Open=true;s.vocabulary={};
 for(const k of ORDER)s.steps[k].status='passed';
 s.responses.topicSentence='Both ideas explain the environmental consequences.';
 for(const n of [1,2]){
  const groups={};
  for(const p of ['A','X','B']){
   s.responses[p.toLowerCase()+n]=`Nội dung đã chốt ${p} ý ${n}`;
   groups[p]=[1,2].map(i=>({phrase:`keyword-${n}-${p}-${i}`,meaningVi:`Nghĩa ${n}-${p}-${i}`}));
  }
  s.vocabulary[n]={status:'ready',groups};
 }
 return s;
}
test('V-CHAIN · nhắc đủ Đề A X B và đánh dấu phần đang làm',()=>{
 const s=complete();s.responses.a1='';s.responses.x1='';s.steps.a1.status='draft';s.steps.x1.status='draft';
 for(const k of ['a1','x1']){
  const html=renderJourney(s,k,'','Mua đồ không cần thiết'),point=k[0].toUpperCase();
  assert.match(html,/Mua đồ không cần thiết/);
  assert.ok(html.indexOf('data-point="A"')<html.indexOf('data-point="X"'));
  assert.ok(html.indexOf('data-point="X"')<html.indexOf('data-point="B"'));
  assert.match(html,new RegExp(`data-point="${point}"[^>]+aria-current="step"`));
  assert.match(html,/Đang làm/);assert.match(html,/Chưa có nội dung/);
  assert.ok(html.includes(s.responses.b1));assert.ok(!html.includes(s.responses.b2));
 }
 s.responses.a1='<img src=x onerror=alert(1)>';
 assert.match(renderJourney(s,'x1'),/&lt;img/);assert.ok(!renderJourney(s,'x1').includes('<img'));
});
test('V-RECAP · hai hàng A X B gồm nội dung và từ vựng đúng ý',()=>{
 const s=complete(),html=renderRecap(s);
 assert.ok(html.includes(s.responses.topicSentence));assert.equal((html.match(/<tr data-idea=/g)||[]).length,2);
 for(const n of [1,2]){
  const row=html.match(new RegExp(`<tr data-idea="${n}">([\\s\\S]*?)</tr>`))[1];
  for(const p of ['A','X','B']){
   assert.ok(row.includes(s.responses[p.toLowerCase()+n]));
   for(const i of [1,2]){assert.ok(row.includes(`keyword-${n}-${p}-${i}`));assert.ok(row.includes(`Nghĩa ${n}-${p}-${i}`));}
  }
  assert.ok(row.indexOf('data-point="A"')<row.indexOf('data-point="X"'));
  assert.ok(row.indexOf('data-point="X"')<row.indexOf('data-point="B"'));
  assert.ok(!row.includes(s.responses['a'+(3-n)]));
 }
 s.steps.x2.status='pending';assert.equal(renderRecap(s),'');
 s.steps.x2.status='passed';s.vocabulary[1].status='failed';
 const failed=renderRecap(s);assert.ok(failed.includes(s.responses.a1));assert.match(failed,/data-vocab-retry="1"/);assert.match(failed,/keyword-2-A-1/);
});
test('V-PROCESSING · chờ retry và lỗi giữ bài có thông báo rõ',()=>{
 const s=createState();s.steps.topic.status='pending';s.responses.topicSentence='Bài đang viết';
 s.processing={topic:{status:'queued',tries:1,maxTries:3,deadlineAt:Date.parse('2026-10-06T01:00:00Z')}};
 const before=JSON.stringify(s),html=renderProcessing(s,'topic');
 assert.match(html,/Lượt 2\/3/);assert.match(html,/Bạn không cần bấm lại/);assert.equal(JSON.stringify(s),before);
 s.processing.topic.status='leased';s.processing.topic.tries=2;assert.match(renderProcessing(s,'topic'),/Lượt thử 2\/3/);
 s.steps.topic.status='technical_error';s.steps.topic.error='AI_TIMEOUT';
 const failed=renderProcessing(s,'topic');assert.match(failed,/Nhấn nút Check để thử lại/);assert.match(failed,/AI_TIMEOUT/);assert.match(failed,/Nội dung bạn nhập vẫn được giữ/);assert.equal(s.responses.topicSentence,'Bài đang viết');
});
test('V-AUDIT · nhật ký giảng viên giữ đúng phiên và trạng thái lỗi',async()=>{
 const nodes=new Map();const get=id=>{if(!nodes.has(id))nodes.set(id,{addEventListener(){},insertAdjacentHTML(){},textContent:'',innerHTML:'',value:'',hidden:false,dataset:{}});return nodes.get(id);};
 let resolve;const pending=new Promise(r=>resolve=r);
 const context=vm.createContext({...featureGlobals,ORDER,FIELDS,renderActivityList,renderActivityDetail,fetch:async()=>({ok:true,status:200,json:()=>pending}),document:{addEventListener(){},getElementById:get,querySelectorAll:()=>[]},AbortSignal,URLSearchParams,JSON,String,Object,Number,Date,crypto,Error,Promise,setTimeout,clearTimeout,clearInterval,setInterval,window:{}});
 const source=fs.readFileSync(new URL('../lesson5/teacher.js',import.meta.url),'utf8').replace(/^import .*\r?\n/gm,'').replace('void boot();','');vm.runInContext(source,context);
 vm.runInContext("selected={ref:'A'};",context);const read=vm.runInContext("readActivity('A')",context);
 vm.runInContext("selected={ref:'B'};",context);resolve({ok:true,events:[{kind:'session_opened',event_at:'2026-10-06T00:00:00Z'}],nextCursor:null});await read;
 assert.equal(get('activity-list').innerHTML,'');
 context.fetch=async()=>({ok:false,status:403,json:async()=>({ok:false,error:'FORBIDDEN'})});await vm.runInContext("readActivity('B')",context);
 assert.match(get('activity-state').textContent,/chưa có quyền/);assert.match(get('activity-state').textContent,/chưa được tải/);
 const detail=renderActivityDetail({input:{snapshot:{responses:{a1:'<script>alert(1)</script>'}},created_at:'2026-10-06T00:00:00Z',job_ref:'own-job'},attempts:[{attempt_index:1,status:'failed',started_at:'2026-10-06T00:00:00Z',response_text:null,error_code:'AI_TIMEOUT'}]});
 assert.match(detail,/&lt;script&gt;/);assert.ok(!detail.includes('<script>'));assert.match(detail,/Chưa lưu được phản hồi AI/);assert.match(detail,/AI_TIMEOUT/);
});

test('V-COMMENT · góp ý được lưu và nhật ký vẫn hiện sau ACK',async()=>{
 const session=complete();session.ref='fixture-session';session.version=2;
 const nodes=new Map();const get=id=>{if(!nodes.has(id))nodes.set(id,{handlers:{},addEventListener(k,f){this.handlers[k]=f;},textContent:'',innerHTML:'',value:'',hidden:false,dataset:{}});return nodes.get(id);};
 let activityCalls=0;
 const context=vm.createContext({...featureGlobals,ORDER,FIELDS,renderActivityList,renderActivityDetail,fetch:async url=>({ok:true,status:200,json:async()=>url.includes('/activity?')?(activityCalls++,{ok:true,events:[],nextCursor:null}):url.includes('/students?')?{ok:true,students:[]}:{ok:true,session}}),document:{addEventListener(){},getElementById:get,querySelectorAll:()=>[],hidden:false},AbortSignal,URLSearchParams,JSON,String,Object,Number,Date,crypto,Error,Promise,setTimeout,clearTimeout,clearInterval,setInterval,window:{}});
 vm.runInContext(fs.readFileSync(new URL('../lesson5/teacher.js',import.meta.url),'utf8').replace(/^import .*\r?\n/gm,'').replace('void boot();',''),context);
 vm.runInContext("selected={ref:'fixture-session'};detailVersion=1;actorEmail='fixture@example.edu';renderDetail=s=>{detailSession=s;detailVersion=s.version;$('detail-content').innerHTML='<div id=\"activity-list\"></div>';};refresh=async()=>{};",context);
 get('comment-text').value='Góp ý fixture';get('comment-section').value='topic';get('class-select').value='IC2304';
 await get('comment-form').handlers.submit({preventDefault(){}});
 assert.match(get('comment-status').textContent,/Đã lưu góp ý/);
 assert.match(get('detail-content').innerHTML,/id="activity-list"/);assert.equal(activityCalls,1);assert.equal(get('comment-text').value,'');
});

test('V-AUDIT-REOPEN · mở lại cùng bài bỏ phản hồi nhật ký trước khi DOM được dựng lại',async()=>{
 const session=complete();session.ref='fixture-session';session.version=2;
 let activityAlive=true,resolveOld,resolveDetail,activityCalls=0;
 const oldResponse=new Promise(r=>resolveOld=r),detailResponse=new Promise(r=>resolveDetail=r);
 const nodes=new Map();
 const get=id=>{
  if(id.startsWith('activity-')&&!activityAlive)return null;
  if(!nodes.has(id)){
   let html='';const node={addEventListener(){},showModal(){this.open=true;},close(){this.open=false;},scrollIntoView(){},textContent:'',value:'',hidden:false,dataset:{}};
   Object.defineProperty(node,'innerHTML',{get:()=>html,set:v=>{html=v;if(id==='detail-content')activityAlive=v.includes('id="activity-list"');}});
   Object.defineProperty(node,'textContent',{get:()=>'',set:v=>{if(id==='detail-content')activityAlive=false;}});
   nodes.set(id,node);
  }
  return nodes.get(id);
 };
 const context=vm.createContext({...featureGlobals,ORDER,FIELDS,renderActivityList,renderActivityDetail,fetch:async url=>({ok:true,status:200,json:async()=>url.includes('/activity?')?(++activityCalls===1?oldResponse:{ok:true,events:[],nextCursor:null}):detailResponse}),document:{addEventListener(){},getElementById:get,querySelectorAll:()=>[],hidden:false},AbortSignal,URLSearchParams,JSON,String,Object,Number,Date,crypto,Error,Promise,setTimeout,clearTimeout,clearInterval,setInterval,window:{}});
 vm.runInContext(fs.readFileSync(new URL('../lesson5/teacher.js',import.meta.url),'utf8').replace(/^import .*\r?\n/gm,'').replace('void boot();',''),context);
 vm.runInContext("renderDetail=s=>{$('detail-content').innerHTML='<div id=\"activity-list\"></div>';};selected={ref:'fixture-session'};rows=[{studentRef:'fixture-student',sessionRef:'fixture-session',displayName:'Học viên fixture'}];",context);
 const oldRead=vm.runInContext("readActivity('fixture-session')",context);
 const reopening=vm.runInContext("openDetail('fixture-student')",context);
 assert.equal(get('activity-state'),null);
 resolveOld({ok:true,events:[],nextCursor:null});
 await assert.doesNotReject(oldRead);
 resolveDetail({ok:true,session});await reopening;
 assert.ok(get('activity-list'));assert.equal(activityCalls,2);
});
