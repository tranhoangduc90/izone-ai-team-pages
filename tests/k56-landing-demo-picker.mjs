import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import * as model from '../term-tests/k56-demo/landing-model.js';

const source=fs.readFileSync(new URL('../term-tests/k56-demo/landing.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
const fakeClasses=[{name:'CODEXDEMO806'},{name:'IC2305'},{name:'IC2264'}];
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function element(){return {value:'',hidden:false,dataset:{},children:[],handlers:{},classList:{toggle(){}},setAttribute(){},removeAttribute(){},after(){},addEventListener(n,f){this.handlers[n]=f},replaceChildren(...children){this.children=children},setCustomValidity(s){this.validation=s},reportValidity(){}};}
async function fixture({query='?class=CODEXDEMO56&mode=lis_first',classes=fakeClasses,demoError='http',liveError=false,restoreError=false,authenticated=true,rosterOk=true}={}) {
 const elements=Object.fromEntries(['classCode','classSelect','classHelp','loginBadge','loginStatus','googleSignInButton','logoutButton','teacherDashboard'].map(id=>[id,element()]));
 const tests=['term-test-1-k56','term-test-2-k56','mini-test-k56'].map(slug=>Object.assign(element(),{dataset:{test:slug+'-computer-based',slug}}));
 const modes=['lis_first','read_first'].map(mode=>Object.assign(element(),{dataset:{mode}}));
 const destinations=['term-test-1-k56','term-test-2-k56','mini-test-k56','term-test-1-k56-audio','term-test-2-k56-audio','mini-test-k56-audio'].map(destination=>Object.assign(element(),{dataset:{destination}}));
 const location={search:query,href:'https://example.invalid/term-tests/k56-demo/'+query};
 const calls=[],history=[];
 const config={API_BASE_URL:'https://example.invalid/demo',API_BASE_URLS:['https://example.invalid/demo','https://example.invalid/live'],API_FOR_CLASS:code=>code==='CODEXDEMO56'?'https://example.invalid/demo':'https://example.invalid/live',GOOGLE_CLIENT_ID:'synthetic'};
 const context=vm.createContext({
  ...model,URLSearchParams,URL,AbortSignal,location,
  window:{TERM_TEST_APP_CONFIG:config,location,history:{replaceState(_state,_title,url){history.push(url);location.search=url;}},google:{accounts:{id:{disableAutoSelect(){}}}}},
  document:{getElementById:id=>elements[id],createElement:()=>element(),head:{append(){}},querySelectorAll:s=>s==='[data-test]'?tests:s==='[data-mode]'?modes:s==='[data-destination]'?destinations:[...tests,...destinations]},
  createTeacherSessionClient:({apiBaseUrl})=>({restore:async()=>{if(restoreError&&apiBaseUrl.endsWith('/demo'))throw new Error('Synthetic restore network error');return authenticated;},login:async()=>({ok:true}),logout:async()=>({ok:true})}),
  teacherSessionRequestOptions:opts=>({...opts,credentials:'include'}),
  fetch:async(url,opts)=>{
   calls.push({url,opts});
   if(url.endsWith('/teacher/options')) {
    const isDemo=url.includes('/demo/');
    if(isDemo&&demoError==='network')throw new Error('Synthetic options network error');
    const fail=isDemo?Boolean(demoError):liveError;
    return {ok:!fail,status:fail?500:200,json:async()=>fail?{ok:false,message:'Synthetic source unavailable'}:{ok:true,classes:isDemo?[{name:'CODEXDEMO56'}]:classes,reviewer:{displayName:'Giáo viên giả'}}};
   }
   return {ok:rosterOk,status:rosterOk?200:404,json:async()=>rosterOk?{ok:true,students:[{name:'Học viên giả',ref:'synthetic'}]}:{ok:false,message:'Synthetic roster missing'}};
  }
 });
 vm.runInContext(fs.readFileSync(new URL('../shared/teacher-auth-state.js',import.meta.url),'utf8').replace('export function','function')+'\n'+source,context);
 await tick();await tick();
 return {elements,tests,modes,destinations,location,calls,history,context,names:()=>elements.classSelect.children.map(x=>x.value)};
}

// Theo yêu cầu phục hồi: demo ở đầu; lớp thật vẫn giữ quyền, thứ tự và cách mở bài.
test('ghim demo trước lớp thật kể cả khi nguồn options demo chưa tải được',async()=>{
 const f=await fixture();assert.deepEqual(f.names(),['CODEXDEMO56','IC2305','IC2264']);
 assert.equal(f.elements.classSelect.value,'CODEXDEMO56');
});
test('link lớp giả cũ bị bỏ lựa chọn và không tạo yêu cầu mở bài',async()=>{
 for(const code of ['CODEXDEMO56X','CODEXDEMO806','CODEXID261018']){
  const f=await fixture({query:'?class='+code,authenticated:false});
  assert.equal(f.elements.classCode.value,'');assert.equal(new URLSearchParams(f.location.search).has('class'),false);
  const n=f.calls.length;await f.tests[0].handlers.click();assert.equal(f.calls.length,n);
 }
});
test('lớp thật mở đúng ba bài và hai thứ tự, chỉ đọc roster',async()=>{
 const f=await fixture({query:'?class=IC2264'});
 for(const mode of ['lis_first','read_first'])for(const b of f.tests){
  f.modes.find(x=>x.dataset.mode===mode).handlers.click();await b.handlers.click();
  assert.equal(f.location.href,`../${b.dataset.test}/?class=IC2264&mode=${mode}`);
 }
 assert.equal(f.calls.filter(x=>x.url.includes('/roster?')).length,6);
 assert.ok(f.calls.filter(x=>x.url.includes('/roster?')).every(x=>x.url.startsWith('https://example.invalid/live/')));
 assert.ok(f.calls.every(x=>!x.opts?.method||x.opts.method==='GET'));
});
test('tài khoản không được cấp lớp thật vẫn có đúng lớp demo dùng thử',async()=>{
 const f=await fixture({classes:[],demoError:false});
 assert.equal(f.elements.classSelect.hidden,false);assert.equal(f.elements.classCode.hidden,true);
 assert.deepEqual(f.names(),['CODEXDEMO56']);assert.match(f.elements.loginStatus.textContent,/0 lớp thật/);
});
test('một nguồn khôi phục lỗi vẫn giữ lớp thật của nguồn còn lại',async()=>{
 const f=await fixture({restoreError:true});assert.deepEqual(f.names(),['CODEXDEMO56','IC2305','IC2264']);
 assert.match(f.elements.loginStatus.textContent,/chưa khôi phục được/);
});
test('roster lỗi giữ trang và cho thử lại, không mở bài',async()=>{
 const f=await fixture({query:'?class=IC2264',rosterOk:false}),before=f.location.href;
 await f.tests[0].handlers.click();assert.equal(f.location.href,before);
 assert.match(f.elements.classHelp.textContent,/Synthetic roster missing/);assert.equal(f.tests[0].disabled,false);
});
test('Answer Sheet, audio và dashboard giữ lớp thật và thứ tự tương ứng',async()=>{
 const f=await fixture({query:'?class=IC2264&mode=read_first'});
 for(const b of f.destinations){b.handlers.click();assert.equal(f.location.href,`../${b.dataset.destination}/?class=IC2264${b.dataset.destination.endsWith('-audio')?'':'&mode=read_first'}`);}
 f.elements.teacherDashboard.handlers.click();assert.equal(f.location.href,'../teacher-k56/?class=IC2264');
});
test('lớp thật không được API cấp không được tự bổ sung vào danh sách',async()=>{
 const f=await fixture({classes:[{name:'IC2305'},{name:'CODEXDEMO56'},{name:'CODEXID261018'}],demoError:false});
 assert.deepEqual(f.names(),['CODEXDEMO56','IC2305']);
});

test('chưa đăng nhập vẫn mở demo đúng API, ba bài và hai thứ tự',async()=>{
 const f=await fixture({authenticated:false});
 for(const mode of ['lis_first','read_first'])for(const b of f.tests){
  f.modes.find(x=>x.dataset.mode===mode).handlers.click();await b.handlers.click();
  assert.equal(f.location.href,`../${b.dataset.test}/?class=CODEXDEMO56&mode=${mode}`);
 }
 const rosters=f.calls.filter(x=>x.url.includes('/roster?'));
 assert.equal(rosters.length,6);assert.ok(rosters.every(x=>x.url.startsWith('https://example.invalid/demo/')));
});
