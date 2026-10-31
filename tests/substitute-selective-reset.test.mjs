// Chỉ dùng danh tính giả. Lưu cũ của đúng lượt đã reset phải bị bỏ qua; không xóa người khác.
import test from'node:test';import assert from'node:assert/strict';import vm from'node:vm';import fs from'node:fs';import{webcrypto,createHash}from'node:crypto';import{execFileSync}from'node:child_process';
const run='22222222-2222-4222-8222-222222222222',fresh='33333333-3333-4333-8333-333333333333',epoch='11111111-1111-4111-8111-111111111111';
for(const slug of ['substitute-test-1-k56','substitute-test-2-k56','substitute-test-1-k67','substitute-test-2-k67'])for(const late of[false,true])test(slug+': '+(late?'tab cũ ghi pointer sau initialize':'nháp có sẵn')+' không khôi phục lượt đã reset',async()=>{
 const key='izone-test:'+slug+':IC9999:server-grade:fixture',owner={classCode:'IC9999',studentRef:'fake-student',clientRunId:run,attemptToken:''};
 const saved={...owner,listeningStartedAt:'2026-10-21T12:00:00Z',writingEssay:'Bài nháp giả',_substitute:{...owner,version:2,testSlug:slug,historyEpoch:epoch}};
 const data=new Map([[key,JSON.stringify(saved)]]),storage={get length(){return data.size},key:i=>[...data.keys()][i],getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};
 const invalidatedRunHashes=[createHash('sha256').update(JSON.stringify('substitute-run:'+slug+':'+run)).digest('hex')];
 const meta={testSlug:slug,historyEpoch:epoch,stateVersion:2,classes:[{code:'IC9999',name:'Lớp giả'}],invalidatedRunHashes};
 const win={crypto:webcrypto,localStorage:storage,sessionStorage:storage,addEventListener(){},dispatchEvent(){},location:{href:'https://fixture.invalid/'},history:{replaceState(){}}};
 const ctx=vm.createContext({window:win,location:{search:''},fetch:async()=>({ok:true,json:async()=>meta}),AbortController,TextEncoder,crypto:webcrypto,setTimeout,clearTimeout,URL,Event,console});
 const file='term-tests/substitute-shared/state.js',source=process.env.REGRESSION_BASE?execFileSync('git',['show',process.env.REGRESSION_BASE+':'+file],{encoding:'utf8'}):fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');vm.runInContext(source,ctx);
 if(late)data.clear();
 const state=win.SUBSTITUTE_STATE;await state.initialize({slug},{API_BASE_URL:'https://fixture.invalid/api'});
 if(late)data.set(key,JSON.stringify(saved));
 assert.equal(state.accept(saved,null),false);
 assert.equal(await state.verifyStoredRun(saved),false);
 assert.throws(()=>state.bind(owner),/reset|tải lại/i);
 const validSaved={...saved,clientRunId:fresh,_substitute:{...saved._substitute,clientRunId:fresh}};
 assert.equal(state.accept(validSaved,null),false);assert.equal(await state.verifyStoredRun(validSaved),true);assert.equal(state.accept(validSaved,null),true);
 const other={...owner,studentRef:'fake-other',clientRunId:fresh};state.bind(other);assert.equal(state.accept({...saved,...other,_substitute:{...saved._substitute,...other}}),true);
 assert.equal(data.get(key),JSON.stringify(saved),'Không xóa storage ngoài phạm vi; chỉ vô hiệu hóa lượt cũ');
 assert.equal(state.meta.historyEpoch,epoch);
});
