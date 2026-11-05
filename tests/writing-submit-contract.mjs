// Chạy handler Writing thật và controller thật, thay mạng/DOM bằng dụng cụ quan sát.
// Bài giả, không gọi AI/Portal. BASE_REF cho phép cùng ca thất bại trên mã trước sửa.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {createWritingSubmission,writingStatus} from '../term-tests/shared/writing-submission.mjs';
const apps=['shared','k56-shared','k56-test2-shared','k56-mini-shared','substitute-k56-shared','substitute-k67-shared','substitute-test-2-k56-shared'];
function harness(app,{lost=false,resultError=false}={}) {
  const relative=`term-tests/${app}/app.js`;
  const source=process.env.BASE_REF?execFileSync('git',['show',process.env.BASE_REF+':'+relative],{encoding:'utf8'}):fs.readFileSync(new URL('../'+relative,import.meta.url),'utf8');
  const start=source.indexOf("    elements.writingView.addEventListener('submit', async event => {");
  const end=source.indexOf('\n    });',start)+len('\n    });');
  function len(x){return x.length;}
  let resolveSend;const barrier=new Promise(r=>resolveSend=r),storage=new Map(),notices=[];let calls=0,reads=0;
  const sub=app.startsWith('substitute');
  const state={studentRef:'fixture-a',attemptToken:'fixture-attempt',writingSubmitted:false,writingDirty:true,
    drafts:{writing:{task1:'Synthetic essay one',task2:'Synthetic essay two',outline:''},listening:{},reading:{}},testGrades:{}};
  const form={dataset:{},querySelectorAll:()=>[],addEventListener:(_e,fn)=>{c.handler=fn;},dispatchEvent:()=>{}};
  const elements={writingView:form,submitWriting:{},viewResult:{},writingTaskTabs:{children:[{click(){}}]}};
  const ack={accepted:true,grading:{status:'processing',ready:false}},saved={writing:{submitted:true,accepted:true}};
  const c=vm.createContext({state,elements,console,CustomEvent:class{},twoTaskWriting:false,
    demoMode:sub?'exam':'',serverGradingMode:sub,classCode:'FIXTURE',promptVersion:'fixture',writingMinutes:30,
    writingConfig:{tasks:[{id:'task2',minimumWords:0,label:'Task 2'}]},writingPlanning:{flush:async()=>{}},
    writingSaveTimer:0,writingRetryTimer:0,writingForceSaveTimer:0,
    window:{clearTimeout(){},setTimeout(){return 1;},SUBSTITUTE_STATE:{blocked:false},confirm:()=>true},
    countWords:()=>100,ensureValidAttemptToken(){},setBusy(){},setStage(){},saveSession(){},renderResult(){},
    showNotice:(text,type)=>notices.push({text,type}),setWritingSaveStatus(){},buildDemoPayload:()=>({}),scheduleWritingGradingRefresh(){},
    saveWritingToServer:async()=>{calls++;await barrier;return saved;},
    apiRequest:async(path)=>{if(path.endsWith('/status')){reads++;return ack;}calls++;await barrier;if(lost)throw Error('response lost after commit');return ack;},
    loadResult:async()=>{if(resultError)throw Error('result read offline');},
  });
  c.writingSubmission=createWritingSubmission({owner:()=>state.studentRef+state.attemptToken,submitted:()=>state.writingSubmitted,
    grading:()=>state.testGrades.writing?.grading,notify:c.showNotice,check:async()=> 'pending',doc:null,
    storage:()=>[{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}]});
  vm.runInContext(source.slice(start,end),c);
  const submit=()=>c.handler({preventDefault(){},submitter:{dataset:{}}});
  return {state,notices,submit,release:()=>resolveSend(),calls:()=>calls,reads:()=>reads};
}
for(const app of apps) {
  test(app+': click/Enter lặp chỉ có một lần gửi, chấm dở chỉ kiểm tra',async()=>{
    const h=harness(app),a=h.submit(),b=h.submit();await new Promise(r=>setImmediate(r));
    const count=h.calls();h.release();await Promise.all([a,b]);assert.equal(count,1);
    assert.equal(h.state.writingSubmitted,true);await h.submit();assert.equal(h.calls(),1);
    assert.match(h.notices.at(-1).text,/được nhận|chờ chấm|chấm xong/);
  });
  if(!app.startsWith('substitute')) test(app+': lỗi đọc kết quả không biến bài đã nhận thành chưa nộp',async()=>{
    const h=harness(app,{resultError:true}),a=h.submit();h.release();await a;
    assert.equal(h.state.writingSubmitted,true);assert.equal(h.notices.some(n=>/Không thể nộp|chưa thể nộp/.test(n.text)),false);
  });
  else test(app+': mất ACK sau commit được đọc lại, không gửi chấm lần hai',async()=>{
    const h=harness(app,{lost:true}),a=h.submit();h.release();await a;
    assert.equal(h.state.writingSubmitted,true);assert.equal(h.calls(),1);assert.equal(h.reads(),1);
  });
  test(app+': phản hồi muộn không áp sang học viên mới',async()=>{
    const h=harness(app),a=h.submit();await new Promise(r=>setImmediate(r));h.state.studentRef='fixture-b';h.release();await a;
    assert.equal(h.state.writingSubmitted,false);
  });
}
test('queued/processing/failed phản ánh đúng việc đã nhận bài',()=>{
  assert.match(writingStatus({status:'queued'},true),/chờ chấm/);
  assert.match(writingStatus({status:'processing'},true),/đang chấm/);
  assert.match(writingStatus({status:'failed'},true),/đã được nhận.*kiểm tra/);
});
test('gói gửi chưa rõ kết quả sống qua reload và chỉ gửi lại sau khi đọc thấy chưa lưu',async()=>{
  const map=new Map(),stores=[{getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)}];
  const make=()=>createWritingSubmission({owner:()=> 'A/run-1',submitted:()=>false,grading:()=>null,notify(){},check(){},doc:null,storage:()=>stores});
  const first=make(),payload={task2:'Original immutable answer'};
  await assert.rejects(first.submitOnline({payload,send:async()=>{throw Error('offline');},read:async()=>{throw Error('offline');}}));
  const restored=make();assert.equal(restored.pending().task2,payload.task2);let sends=0;
  const accepted={accepted:true,grading:{status:'processing',ready:false}};
  await restored.submitOnline({payload:{task2:'Different text'},send:async()=>{sends++;},read:async()=>accepted});
  assert.equal(sends,0);assert.equal(map.size,0);
});
