import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
const base=process.env.SUBSTITUTE_MOUNT_BASE==='1';
const path='term-tests/substitute-skill-shared/'+(base?'objective-controller-listening-departure-preview-v1.mjs':'listening-controller-journey-20261127-v1.mjs');
const source=base?execFileSync('git',['show','165b779:'+path],{encoding:'utf8'}):readFileSync(path,'utf8');
const mount=source.split('\n').find(line=>line.startsWith('async function mount(){')).replace("import('./native-'+skill+'.mjs')",'Promise.resolve(nativeModule)');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function fixture(layout){
 const view={closest(){return this;},addEventListener(){}};
 const context=vm.createContext({state:{identity:{attemptId:'fixture'},answers:{}},epoch:0,skill:'listening',isListening:true,
  content:{controls:[],sourceSlug:'fixture'},storage:{},fail(){},persist:async()=>{},changed:async()=>{},$:()=>view,
  document:{querySelectorAll:()=>[]},nativeModule:{mountNativeListening(){},nativeLayout:layout,nativeAnnotations:async()=>{}},structuredClone});
 vm.runInContext('let native,mounted=false,mounting;'+mount,context);return context;
}
test('retry chờ cùng layout đang dựng, không bỏ qua vì mounted sớm',async()=>{
 let release,calls=0;const f=fixture(()=>{calls++;return new Promise(r=>release=r);});
 const first=f.mount();await pause(0);let secondDone=false;const second=f.mount().then(()=>secondDone=true);
 await pause(20);assert.equal(secondDone,false);assert.equal(calls,1);release();await Promise.all([first,second]);
});
test('layout lỗi được dựng lại khi retry, không báo sẵn sàng giả',async()=>{
 let calls=0;const f=fixture(async()=>{if(++calls===1)throw Error('LAYOUT_FAILED');});
 await assert.rejects(f.mount(),/LAYOUT_FAILED/);await f.mount();assert.equal(calls,2);
});
