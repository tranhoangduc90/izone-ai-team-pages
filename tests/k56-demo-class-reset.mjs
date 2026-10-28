// Contract mới 20/10: reset từng người/bài thay yêu cầu xóa cả lớp ngày 06/10.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import {demoContext,resetStudent} from '../term-tests/demo/model.js';

test('K56 reset một học viên của đúng bài, không gọi đường xóa cả lớp',async()=>{
  const calls=[],ref='fe44d852-9523-40b3-9bec-dd2cfdbda001';
  for(const key of ['term1','term2','mini'])await resetStudent(demoContext('56',key),ref,async(url,options)=>{
    calls.push({url,body:JSON.parse(options.body)});return {ok:true,json:async()=>({ok:true,reset:{attempts:1,sessions:1}})};
  });
  assert.deepEqual(calls.map(c=>c.body.testSlug),['term-test-1-k56','term-test-2-k56','mini-test-k56']);
  assert.ok(calls.every(c=>c.url.endsWith('/demo/reset')&&c.body.studentRef===ref&&c.body.classCode==='CODEXDEMO56'));
});
function actualFunction(group,name){
  const src=readFileSync(new URL(`../term-tests/${group}/${group.endsWith('shared')?'app':'bootstrap'}.js`,import.meta.url),'utf8');
  const found=src.match(new RegExp(`(?:async )?function ${name}\\([^]*?^  }`,'m'));assert.ok(found,`${group}/${name}`);return found[0];
}
for(const group of ['k56-shared','k56-test2-shared','k56-mini-shared','term-test-1-k56-computer-based','term-test-2-k56-computer-based','mini-test-k56-computer-based']){
  test(`${group}: callback cache cũ bị chặn sau reset`,()=>{
    const name=group.endsWith('shared')?'saveSession':'saveState';
    const context={window:{K56_DEMO_RESETTING:true},get state(){throw new Error('Không được chạm state đã reset');}};
    vm.runInNewContext(`(${actualFunction(group,name)})()`,context);
  });
  test(`${group}: bỏ phản hồi API trả về muộn`,async()=>{
    let resolveData;const gate=new Promise(resolve=>resolveData=resolve);
    const context={window:{K56_DEMO_RESETTING:false,setTimeout:()=>1,clearTimeout(){}},appConfig:{API_BASE_URL:'https://demo.test'},paperEpoch:0,storageKey:'synthetic',paperMini:false,AbortController,setTimeout:()=>1,clearTimeout(){},fetch:async()=>({ok:true,json:()=>gate})};
    if(group.endsWith('shared'))context.rawApiRequest=vm.runInNewContext(`(${actualFunction(group,'rawApiRequest')})`,context);
    const fn=vm.runInNewContext(`(${actualFunction(group,'apiRequest')})`,context);
    const pending=fn('/prepare');await Promise.resolve();context.window.K56_DEMO_RESETTING=true;resolveData({ok:true,attemptToken:'old-token'});
    await assert.rejects(pending,/vừa reset/);
  });
}
