import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import path from 'node:path';
const read=p=>fs.readFileSync(process.env.AUDIO127_SOURCE_ROOT?path.join(process.env.AUDIO127_SOURCE_ROOT,'term-tests',p):new URL('../term-tests/'+p,import.meta.url),'utf8');
for(const slug of ['substitute-test-1-k56','substitute-test-2-k56','substitute-test-1-k67','substitute-test-2-k67']){
 const source=read(slug+'-computer-based/bootstrap.js');
 async function resume({bookmark=60,ended=false}={}){
  const a=source.indexOf('        const existingStart = Date.parse(state.listeningStartedAt');
  const b=source.indexOf('        const serverNow = new Date();',a);assert.ok(a>=0&&b>a);
  const now=Date.parse('2026-10-15T08:00:00Z');class Clock extends Date {static now(){return now;}}
  let played=0;const audio={currentTime:0,duration:1800,async play(){played++;}};
  const ctx=vm.createContext({state:{listeningStartedAt:new Date(now-180000).toISOString(),audioEndedAt:ended?new Date(now-1000).toISOString():'',serverTimeOffsetMs:0},officialAudio:audio,Date:Clock,readLegacyUiState:()=>({audioStarted:true,audioTime:bookmark})});
  await vm.runInContext('(async()=>{'+source.slice(a,b)+'})()',ctx);return {heard:audio.currentTime,played};
 }
 test(slug+': mở lại mốc đã nghe 60, không dùng elapsed 180',async()=>assert.equal((await resume()).heard,60));
 test(slug+': không có bookmark thì không bỏ đoạn nghe',async()=>assert.equal((await resume({bookmark:0})).heard,0));
 test(slug+': audio đã kết thúc thì không phát lại',async()=>assert.deepEqual(await resume({ended:true}),{heard:1800,played:0}));
}
for(const slug of ['term-test-1-k56','term-test-2-k56','mini-test-k56','substitute-test-1-k56','substitute-test-2-k56','substitute-test-1-k67','substitute-test-2-k67']){
 test(slug+': lobby giao cảnh báo cho app sau khi app đã đăng ký guard',()=>{
  const source=read(slug+'-computer-based/bootstrap.js'),a=source.indexOf("  window.addEventListener('beforeunload', event => {");assert.ok(a>=0);
  const b=source.indexOf('\n  });',a);assert.ok(b>a);let callback;
  const ctx=vm.createContext({query:new URLSearchParams(),state:{studentRef:'fake',listeningStartedAt:'fake'},window:{TERM_TEST_LEAVE_GUARD_READY:true,addEventListener:(name,fn)=>callback=fn}});
  vm.runInContext(source.slice(a,b+6),ctx);let warned=false;callback({preventDefault(){warned=true;}});assert.equal(warned,false,'State lobby không được tiếp tục cảnh báo sau khi app đã hoàn tất/nộp bài');
 });
}
const apps=['k56-shared','k56-test2-shared','k56-mini-shared','substitute-k56-shared','substitute-test-2-k56-shared','substitute-k67-shared'];
for(const folder of apps){
 const source=read(folder+'/app.js');
 function warning(state,options={}){
  const a=source.indexOf("  window.addEventListener('beforeunload', event => {");
  assert.ok(a>=0,'App đang thi phải đăng ký cảnh báo');
  const b=source.indexOf('\n  });',a);assert.ok(b>a);
  let handler;const ctx=vm.createContext({state,demoMode:options.demoMode||'',serverGradingMode:!!options.server,window:{TERM_TEST_ALLOW_NAVIGATION:!!options.navigate,TERM_TEST_CONTENT:options.paper?null:{},addEventListener:(name,fn)=>handler=fn}});
  vm.runInContext(source.slice(a,b+6),ctx);let warned=false;handler({preventDefault(){warned=true;}});return warned;
 }
 test(folder+': cảnh báo active, miễn completed và chuyển đã nộp',()=>{
  const active={examSessionToken:'fake',listeningStartedAt:'fake',listeningDeadlineAt:'fake'};
  assert.equal(warning(active),true);assert.equal(warning({...active,completed:true,listeningSubmitted:true}),false);
  assert.equal(warning(active,{navigate:true}),false);
  assert.equal(warning({writingStarted:true}),true);assert.equal(warning({writingStarted:true,writingSubmitted:true}),false);
  assert.equal(warning({readingStartedAt:'fake',readingDeadlineAt:'fake'}),true);
  assert.equal(warning({studentRef:'fake',stage:'listening'},{paper:true}),true);
 });
 test(folder+': demo=exam có grading server vẫn cảnh báo, preview không cảnh báo',()=>{
  const active={listeningStartedAt:'fake',testGrades:{}};
  assert.equal(warning(active,{demoMode:'exam',server:true}),true);
  assert.equal(warning(active,{demoMode:'complete'}),false);
 });
}

for(const slug of ['term-test-1-k56','term-test-2-k56','mini-test-k56'])test(slug+': lobby đang nghe vẫn cảnh báo khi lượt đã có attempt token',()=>{
 const source=read(slug+'-computer-based/bootstrap.js'),a=source.indexOf("  window.addEventListener('beforeunload', event => {"),b=source.indexOf('\n  });',a);assert.ok(a>=0&&b>a);let callback;
 vm.runInNewContext(source.slice(a,b+6),{query:new URLSearchParams(),state:{studentRef:'fake',attemptToken:'prepared',listeningStartedAt:'fake'},window:{addEventListener:(name,fn)=>callback=fn}});
 let warned=false;callback({preventDefault(){warned=true;}});assert.equal(warned,true);
});
