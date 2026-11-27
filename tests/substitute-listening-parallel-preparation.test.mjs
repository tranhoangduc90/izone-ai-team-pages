import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {preparationBudget} from '../term-tests/substitute-skill-shared/preparation-budget-20261127-v1.mjs';

const version=process.env.SUBSTITUTE_PARALLEL_BASE==='1'?'v1':'v2';
const source=readFileSync('term-tests/substitute-skill-shared/listening-controller-journey-20261127-'+version+'.mjs','utf8');
const begin=source.indexOf('async function prepare(){');
const prepare=source.slice(begin,source.indexOf('\nasync function start()',begin));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function fixture(ms=1000){
 const offline=deferred(),audio=deferred(),calls={offline:0,audio:0,dispose:0,prepare:0},errors=[];
 const elements=new Map();
 const $=id=>{if(!elements.has(id))elements.set(id,{value:'student',disabled:true});return elements.get(id);};
 const state={prepareOperation:'same-operation',identity:{attemptId:'same-attempt',contentHash:'hash'},phase:'prepared',studentRef:'student'};
 const content={testId:'test',skill:'listening',contentHash:'hash',sourceSlug:'source',audio:{hash:'audio-hash'},controls:[]};
 const context=vm.createContext({state,content,roster:[{studentRef:'student',name:'Fixture'}],testId:'test',skill:'listening',isListening:true,
  $,text(){},show(){},listenJournal(){},anchor(){},observation:{emit(){}},persist:async()=>{},
  updateNativeShell(){},checkAssignmentEntry:async()=>false,preparationBudget:()=>preparationBudget(ms),
  api:async action=>{if(action==='prepare')calls.prepare++;return action==='content'?content:{identity:state.identity,status:'prepared',revision:0};},
  prepareOffline:()=>{calls.offline++;return offline.promise;},verifyStandaloneListeningPackage:async()=>({sha256:'audio-hash'}),
  mount:async()=>{},mountPlayer:()=>{calls.audio++;return audio.promise;},disposeListening(){calls.dispose++;},
  fail:error=>errors.push(error.code??error.message),location:{reload(){throw Error('UNEXPECTED_RELOAD');}}});
 vm.runInContext('let busy=false,preparationFailure;'+prepare,context);
 return {context,offline,audio,calls,errors,$,state};
}
for(const first of ['offline','audio'])test('chuẩn bị song song; chỉ mở nghe thử sau cả hai: '+first+' xong trước',async()=>{
 const f=fixture(),pending=f.context.prepare();await pause(0);
 assert.equal(f.calls.offline,1);assert.equal(f.calls.audio,1);
 f[first].resolve(first==='offline'?{build:'fixture',updated:false}:undefined);await pause(0);
 assert.equal(f.$('preview').disabled,true);assert.equal(f.$('start').disabled,true);
 const last=first==='offline'?'audio':'offline';f[last].resolve(last==='offline'?{build:'fixture',updated:false}:undefined);
 await pending;assert.equal(f.$('preview').disabled,false);assert.equal(f.calls.prepare,0);assert.equal(f.state.identity.attemptId,'same-attempt');
 assert.deepEqual(f.errors,[]);
});
for(const failed of ['offline','audio'])test('lỗi '+failed+' giữ khóa, bỏ kết quả trễ và thử lại cùng lượt',async()=>{
 const f=fixture(),pending=f.context.prepare();await pause(0);
 f[failed].reject(Object.assign(Error('TEST_RESOURCE_FAILED'),{code:'TEST_RESOURCE_FAILED'}));await pending;
 const late=failed==='offline'?'audio':'offline';f[late].resolve(late==='offline'?{build:'fixture',updated:false}:undefined);await pause(0);
 assert.equal(f.$('preview').disabled,true);assert.equal(f.$('start').disabled,true);assert.ok(f.calls.dispose>0);
 f.context.prepareOffline=async()=>({build:'fixture',updated:false});f.context.mountPlayer=async()=>{};
 await f.context.prepare();assert.equal(f.$('preview').disabled,false);assert.equal(f.calls.prepare,0);
 assert.equal(f.state.identity.attemptId,'same-attempt');
});
test('hết hạn giữ khóa ngay cả khi cả hai tài nguyên hoàn tất muộn',async()=>{
 const f=fixture(25),pending=f.context.prepare();await pending;
 f.offline.resolve({build:'fixture',updated:false});f.audio.resolve();await pause(0);
 assert.equal(f.$('preview').disabled,true);assert.equal(f.$('start').disabled,true);
 assert.deepEqual(f.errors,['ASSIGNMENT_PREPARATION_TIMEOUT']);assert.ok(f.calls.dispose>0);
});
