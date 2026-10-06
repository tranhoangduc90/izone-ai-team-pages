import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const file = process.env.RESET_SOURCE || new URL('../term-tests/k56-demo-reset/app.js', import.meta.url);
const source = process.env.BASE_RESET_REV
  ? execFileSync('git',['show',`${process.env.BASE_RESET_REV}:term-tests/k56-demo-reset/app.js`],{cwd:new URL('..',import.meta.url),encoding:'utf8'})
  : readFileSync(file, 'utf8');
const slugs = ['term-test-1-k56','term-test-2-k56','mini-test-k56'];
function storage() {
  const data = new Map();
  for (const slug of slugs) for (const prefix of ['izone-test','izone-test-ui','izone-test-annotations'])
    for (const suffix of ['',':server-grade',':server-grade:v2']) data.set(`${prefix}:${slug}:CODEXDEMO56${suffix}`, 'old');
  data.set('izone-test:term-test-1-k56:IC2264','real');
  data.set('izone-test:term-test-1:CODEXDEMO806','k67');
  return {data,get length(){return data.size;},key:i=>[...data.keys()][i],getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
}
function harness({classCode='CODEXDEMO56',confirm=true,fetchResult,fetchError}={}) {
  const listeners={}, calls=[], alerts=[], replacements=[], buttons=[];
  const header={classList:{add(){}},append(b){b.parentElement=this;buttons.push(b);}};
  const root={querySelector:selector=>selector.includes('topbar')?header:null,addEventListener(){}};
  const location={search:`?class=${classCode}&mode=read_first`,href:`https://example.test/test/?class=${classCode}&mode=read_first`,replace:u=>replacements.push(u),reload:()=>replacements.push('reload')};
  const context={ URL, URLSearchParams, AbortController, Math, Date, location,
    TERM_TEST_CONFIG:{slug:slugs[0],title:'Term Test 1'},TERM_TEST_APP_CONFIG:{API_BASE_URL:'https://demo.test'},
    document:{getElementById:()=>root,createElement:()=>({addEventListener:(k,fn)=>listeners['button:'+k]=fn})},
    localStorage:storage(),sessionStorage:storage(),MutationObserver:class{observe(){}},
    confirm:()=>confirm,alert:message=>alerts.push(message),setTimeout:()=>1,clearTimeout(){},
    addEventListener:(k,fn)=>listeners[k]=fn,
    fetch:async(url,options)=>{calls.push({url,options});if(fetchError)throw fetchError;
      return fetchResult || {ok:true,json:async()=>({ok:true,reset:{classCode,remaining:0,generation:'reset-generation'}})};}};
  context.window=context;
  vm.runInNewContext(source,context);
  return {context,listeners,calls,alerts,replacements,buttons,click:()=>listeners['button:click']()};
}
test('Reset không cần chọn học viên, gọi một request toàn lớp',async()=>{
  const h=harness();assert.equal(h.buttons[0].disabled,false);await h.click();
  assert.equal(h.calls.length,1);assert.equal(h.calls[0].url,'https://demo.test/api/term-tests/demo/reset-class');
  assert.deepEqual(JSON.parse(h.calls[0].options.body),{classCode:'CODEXDEMO56',confirmation:'RESET_DEMO_CLASS'});
});
test('Xóa bản nháp tất cả ba bài và phiên bản, giữ lớp thật và K67',async()=>{
  const h=harness();await h.click();
  for(const s of [h.context.localStorage,h.context.sessionStorage]){
    assert.equal([...s.data.keys()].filter(k=>k.includes(':CODEXDEMO56')).length,s===h.context.localStorage?1:0);
    assert.equal(s.data.get('izone-test:term-test-1-k56:IC2264'),'real');
    assert.equal(s.data.get('izone-test:term-test-1:CODEXDEMO806'),'k67');
  }
  const url=new URL(h.replacements[0]);assert.equal(url.searchParams.get('reset'),'1');assert.equal(url.searchParams.get('mode'),'read_first');
});
test('Bấm lặp chỉ gửi một request khi đang reset',async()=>{const h=harness();const one=h.click();await h.click();await one;assert.equal(h.calls.length,1);});
test('Hủy xác nhận không xóa hoặc gọi server',async()=>{const h=harness({confirm:false});await h.click();assert.equal(h.calls.length,0);assert.equal(h.context.localStorage.length,29);});
test('Lỗi phản hồi giữ dữ liệu, không tự gửi lại',async()=>{const h=harness({fetchResult:{ok:false,status:500,json:async()=>({message:'reset failed'})}});await h.click();assert.equal(h.calls.length,1);assert.equal(h.replacements.length,0);assert.equal(h.context.localStorage.length,29);assert.equal(h.buttons[0].disabled,false);});
test('Timeout chưa rõ kết quả, không auto-retry',async()=>{const h=harness({fetchError:Object.assign(new Error(),{name:'AbortError'})});await h.click();assert.equal(h.calls.length,1);assert.match(h.alerts[0],/Không tự gửi lại/);assert.equal(h.replacements.length,0);});
test('Lớp thật không tạo nút hoặc listener reset',()=>{const h=harness({classCode:'IC2264'});assert.equal(h.buttons.length,0);assert.equal(Object.keys(h.listeners).length,0);});
test('Tab bài khác nhận tín hiệu reset toàn lớp và xóa local',()=>{const h=harness();h.listeners.storage({key:'izone-demo-reset:class:CODEXDEMO56',newValue:'other-tab'});assert.equal(h.context.sessionStorage.length,2);assert.equal(h.replacements.length,1);assert.equal(h.calls.length,0);});
test('Không xử lý tín hiệu reset của lớp khác',()=>{const h=harness();h.listeners.storage({key:'izone-demo-reset:class:IC2264',newValue:'other'});assert.equal(h.replacements.length,0);});
function actualFunction(group,name){
  const src=readFileSync(new URL(`../term-tests/${group}/${group.endsWith('shared')?'app':'bootstrap'}.js`,import.meta.url),'utf8');
  const expression=new RegExp(`(?:async )?function ${name}\\([^]*?^  }`,'m');
  const found=src.match(expression);assert.ok(found,`${group}/${name}`);return found[0];
}
for(const group of ['k56-shared','k56-test2-shared','k56-mini-shared','term-test-1-k56-computer-based','term-test-2-k56-computer-based','mini-test-k56-computer-based']){
  test(`${group}: callback cache cũ bị chặn sau reset`,()=>{
    const h=harness();h.context.K56_DEMO_RESETTING=true;
    const name=group.endsWith('shared')?'saveSession':'saveState';
    const context={window:h.context, get state(){throw new Error('Không được chạm state đã reset');}};
    vm.runInNewContext(`(${actualFunction(group,name)})()`,context);
  });
  test(`${group}: bỏ phản hồi API trả về muộn`,async()=>{
    let resolveData;const gate=new Promise(resolve=>resolveData=resolve);
    const context={window:{K56_DEMO_RESETTING:false,setTimeout:()=>1,clearTimeout(){}},
      appConfig:{API_BASE_URL:'https://demo.test'},AbortController,setTimeout:()=>1,clearTimeout(){},
      fetch:async()=>({ok:true,json:()=>gate})};
    const fn=vm.runInNewContext(`(${actualFunction(group,'apiRequest')})`,context);
    const pending=fn('/prepare');await Promise.resolve();context.window.K56_DEMO_RESETTING=true;
    resolveData({ok:true,attemptToken:'old-token'});
    await assert.rejects(pending,/vừa reset/);
  });
}
test('Nút đặt cờ vô hiệu hóa trước khi gửi reset',async()=>{const h=harness();await h.click();assert.equal(h.context.K56_DEMO_RESETTING,true);h.listeners.pagehide();assert.equal(h.context.sessionStorage.length,2);});
test('Lỗi reset mở lại cờ, không phá bài đang làm',async()=>{const h=harness({fetchError:new Error('network')});await h.click();assert.equal(h.context.K56_DEMO_RESETTING,false);});
