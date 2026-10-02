import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import * as model from '../term-tests/k56-demo/landing-model.js';

const source=fs.readFileSync(new URL('../term-tests/k56-demo/landing.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
const fakeClasses=[{name:'CODEXDEMO806'},{name:'IC2305'},{name:'IC2264'}];
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function element(){return {value:'',hidden:false,dataset:{},children:[],handlers:{},classList:{toggle(){}},setAttribute(){},addEventListener(n,f){this.handlers[n]=f},replaceChildren(...children){this.children=children},setCustomValidity(s){this.validation=s},reportValidity(){}};}
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
 vm.runInContext(source,context);
 await tick();await tick();
 return {elements,tests,modes,destinations,location,calls,history,context,names:()=>elements.classSelect.children.map(x=>x.value)};
}

test('regression: demo options HTTP500, live có806 vẫn hiện56 và mở cả3bài/2mode đúngAPI',async()=>{
 const f=await fixture();
 assert.equal(f.elements.classSelect.hidden,false);
 assert.ok(f.names().includes('CODEXDEMO56'),'Demo56 must remain selectable when its teacher/options fails');
 assert.ok(!f.names().includes('CODEXDEMO806'),'K67 demo must not appear in K56 picker');
 assert.equal(f.elements.classSelect.value,'CODEXDEMO56');
 for(const mode of ['lis_first','read_first']) {
  f.modes.find(x=>x.dataset.mode===mode).handlers.click();
  for(const button of f.tests){await button.handlers.click();assert.equal(f.location.href,`../${button.dataset.test}/?class=CODEXDEMO56&mode=${mode}`);}
 }
 const rosterCalls=f.calls.filter(x=>x.url.includes('/roster?'));
 assert.equal(rosterCalls.length,6);assert.ok(rosterCalls.every(x=>x.url.startsWith('https://example.invalid/demo/')));
});
test('một options source lỗi mạng không làm mất lớp được source còn lại cấp',async()=>{
 const f=await fixture({demoError:'network'});
 assert.deepEqual(f.names().sort(),['CODEXDEMO56','IC2264','IC2305']);
 assert.match(f.elements.loginStatus.textContent,/không tải được|chưa tải được/i);
});
test('một nguồn restore lỗi không làm mất phiên và lớp nguồn còn lại',async()=>{
 const f=await fixture({restoreError:true});
 assert.equal(f.elements.classSelect.hidden,false);assert.ok(f.names().includes('IC2305'));assert.ok(f.names().includes('CODEXDEMO56'));
 assert.match(f.elements.loginStatus.textContent,/chưa khôi phục được/i);
});
test('nhập tay mã demo806 sau boot cũng chuẩn hóa56 cho mọi link',async()=>{
 const f=await fixture({authenticated:false,query:'?class=IC2264&mode=read_first'});
 for(const b of [...f.tests,...f.destinations,f.elements.teacherDashboard]) {
  f.elements.classCode.value=' codexdemo806 ';
  await b.handlers.click();
  assert.match(f.location.href,/class=CODEXDEMO56(?:&|$)/);
  assert.equal(f.elements.classCode.value,'CODEXDEMO56');
 }
});
test('URL806 cũ được chuẩn hóa56 và giữ thứ tự, cả khi chưa đăng nhập',async()=>{
 for(const mode of ['lis_first','read_first']) {
  const f=await fixture({query:`?class=CODEXDEMO806&mode=${mode}`,authenticated:false});
  assert.equal(f.elements.classCode.value,'CODEXDEMO56');
  assert.equal(new URLSearchParams(f.location.search).get('class'),'CODEXDEMO56');
  assert.equal(new URLSearchParams(f.location.search).get('mode'),mode);
  await f.tests[0].handlers.click();assert.equal(f.location.href,`../term-test-1-k56-computer-based/?class=CODEXDEMO56&mode=${mode}`);
 }
});
test('realallowlist giữ nguyên, demo được dedup/canonical, không thêm lớp thật lạ',async()=>{
 const f=await fixture({demoError:false,classes:[{name:'IC2305'},{name:' codexdemo56 '},{name:'CODEXDEMO806'}]});
 assert.deepEqual(f.names().sort(),['CODEXDEMO56','IC2305']);assert.ok(!f.names().includes('IC2264'));
});
test('chọn lớp được lưu vàoURL, reload giữ lớp thật được cấp vàmode',async()=>{
 const f=await fixture({query:'?class=CODEXDEMO56&mode=read_first'});
 f.elements.classSelect.value='IC2305';await f.elements.classSelect.handlers.change();
 assert.equal(new URLSearchParams(f.location.search).get('class'),'IC2305');
 const resumed=await fixture({query:f.location.search});
 assert.equal(resumed.elements.classSelect.value,'IC2305');await resumed.tests[0].handlers.click();
 assert.equal(resumed.location.href,'../term-test-1-k56-computer-based/?class=IC2305&mode=read_first');
});
test('AnswerSheet giữmode, audio/dashboard không thêmmode hoặc đổiAPI',async()=>{
 const f=await fixture({query:'?class=CODEXDEMO56&mode=read_first'});
 for(const b of f.destinations){b.handlers.click();assert.equal(f.location.href,`../${b.dataset.destination}/?class=CODEXDEMO56${b.dataset.destination.endsWith('-audio')?'':'&mode=read_first'}`);}
 f.elements.teacherDashboard.handlers.click();assert.equal(f.location.href,'../teacher-k56/?class=CODEXDEMO56');
});
test('mọi options lỗi vẫn mở demo bằng ômãlớp, không hiện các lớp thật bịtừchối',async()=>{
 const f=await fixture({liveError:true});
 assert.equal(f.elements.classSelect.hidden,true);assert.equal(f.elements.classCode.value,'CODEXDEMO56');
 await f.tests[2].handlers.click();assert.equal(f.location.href,'../mini-test-k56-computer-based/?class=CODEXDEMO56&mode=lis_first');
});
test('roster lỗi giữ trang/thứtự và báo lỗi, không mở bài hoặc tạoattempt',async()=>{
 const f=await fixture({rosterOk:false});const before=f.location.href;
 await f.tests[0].handlers.click();assert.equal(f.location.href,before);assert.match(f.elements.classHelp.textContent,/Synthetic roster missing/);assert.equal(f.tests[0].disabled,false);
 assert.ok(f.calls.every(c=>!c.opts?.method||c.opts.method==='GET'));
});
test('mãlớp không hợp lệ bịchặn trướcrequest, classselect rỗng không điều hướng',async()=>{
 const f=await fixture({authenticated:false});f.elements.classCode.value='<bad>';
 const before=f.calls.length;await f.tests[0].handlers.click();assert.equal(f.calls.length,before);assert.ok(f.elements.classCode.validation);
});
