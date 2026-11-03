import test from 'node:test';
import assert from 'node:assert/strict';
import {createScopedTeacherResults,createTeacherReadingRegions} from '../term-tests/shared/teacher-reading-state.mjs';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const scope=(classId='1293',generation=0)=>({generation,classId,className:'IC'+classId,testSlug:'term-test-1'});
const result=s=>({class:{id:s.classId},test:{slug:s.testSlug},students:[]});

test('Teacher results: overlapping reads coalesce; changing class starts immediately and discards older response',async()=>{
 let current=scope();const calls=[],applied=[],finished=[];
 const load=createScopedTeacherResults({current:()=>current,request:(url,options)=>{const d=deferred();calls.push({url,options,d});return d.promise;},
  apply:(value,s)=>applied.push(s.classId),start(){},finish:()=>finished.push(current.classId)});
 const first=load(),same=load();assert.equal(calls.length,1);
 const old=current;current=scope('1294');const next=load();assert.equal(calls.length,2);
 calls[1].d.resolve(result(current));await next;assert.deepEqual(applied,['1294']);
 calls[0].d.resolve(result(old));const outcomes=await Promise.allSettled([first,same]);
 assert.ok(outcomes.every(x=>x.status==='rejected'&&x.reason.staleSession));assert.deepEqual(applied,['1294']);assert.deepEqual(finished,['1294']);
 assert.equal(calls[0].options.isCurrent(),false);assert.equal(calls[1].options.isCurrent(),true);
});

test('Teacher results: changed login, late failures, wrong class and wrong test do not replace displayed data',async()=>{
 for(const mode of ['login','error','class','test']){
  let current=scope();const d=deferred(),applied=[];
  const load=createScopedTeacherResults({current:()=>current,request:()=>d.promise,apply:x=>applied.push(x),start(){},finish(){}});
  const pending=load();
  if(mode==='login'||mode==='error')current=scope('1293',1);
  if(mode==='error')d.reject(Object.assign(Error('Old session revoked'),{status:401}));
  else d.resolve({...result(scope()),...(mode==='class'?{class:{id:'other'}}:{}),...(mode==='test'?{test:{slug:'term-test-2'}}:{})});
  await assert.rejects(pending,e=>mode==='login'||mode==='error'?e.staleSession:/chưa khớp/.test(e.message));assert.deepEqual(applied,[]);
 }
});

test('Teacher reading: unrelated updates preserve a region; same-attempt result and scope changes still render',()=>{
 const render=createTeacherReadingRegions();let draws=0;const draw=()=>draws++;
 const value={scope:['1293','term-test-1'],student:{ref:'A',writing:{status:'processing'}}};
 assert.equal(render('student',value,draw),true);assert.equal(render('student',structuredClone(value),draw),false);
 value.student.writing.status='ready';assert.equal(render('student',value,draw),true);
 value.scope[0]='1294';assert.equal(render('student',value,draw),true);assert.equal(draws,3);
});
