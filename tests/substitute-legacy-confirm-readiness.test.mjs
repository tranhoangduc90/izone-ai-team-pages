import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
const base=process.env.SUBSTITUTE_CONFIRM_BASE==='1';
const path='term-tests/substitute-skill-shared/'+(base?'legacy-presentation.mjs':'legacy-presentation-journey-20261127-v1.mjs');
const source=base?execFileSync('git',['show','165b779:'+path],{encoding:'utf8'}):readFileSync(path,'utf8');
const handler=source.split('\n').find(line=>line.trim().startsWith('accept.onclick='));
test('xác nhận sớm giữ hộp thoại; sẵn sàng rồi nhận đúng một thao tác',()=>{
 let ready=false,calls=0;const confirm={open:true,close(){this.open=false;}};
 const context=vm.createContext({accept:{},confirm,isReady:()=>ready,isBusy:()=>false,$:()=>({value:'fixture'}),onPrepare:()=>calls++});
 vm.runInContext(handler,context);context.accept.onclick();assert.equal(confirm.open,true);assert.equal(calls,0);
 ready=true;context.accept.onclick();assert.equal(confirm.open,false);assert.equal(calls,1);
});
