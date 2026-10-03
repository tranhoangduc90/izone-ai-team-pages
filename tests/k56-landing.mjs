import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {sortClassesNewestFirst,buildK56LandingClasses} from '../term-tests/k56-demo/landing-model.js';
const source=fs.readFileSync(new URL('../term-tests/k56-demo/landing.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
function element(){return {value:'',hidden:false,dataset:{},handlers:{},classList:{toggle(){}},setAttribute(){},addEventListener(n,f){this.handlers[n]=f},replaceChildren(...children){this.children=children},setCustomValidity(s){this.validation=s},reportValidity(){},append(){}};}
const elements=Object.fromEntries(['classCode','classSelect','classHelp','loginBadge','loginStatus','googleSignInButton','logoutButton','teacherDashboard'].map(id=>[id,element()]));
const modes=['lis_first','read_first'].map(mode=>Object.assign(element(),{dataset:{mode}}));
const history=[];
const buttons=[1,2].map(n=>Object.assign(element(),{dataset:{test:`term-test-${n}-k56-computer-based`,slug:`term-test-${n}-k56`}}));
const requests=[];
buttons.push(Object.assign(element(), {dataset:{test:'mini-test-k56-computer-based',slug:'mini-test-k56'}}));
const destinationButtons=['term-test-1-k56-audio','term-test-2-k56-audio','mini-test-k56-audio','term-test-1-k56','term-test-2-k56','mini-test-k56']
  .map(destination=>Object.assign(element(),{dataset:{destination}}));
let response={ok:true,students:[{ref:'synthetic',name:'Học viên giả lập'}]};
const context=vm.createContext({
  window:{TERM_TEST_APP_CONFIG:{API_BASE_URL:'https://example.test/mapping-api-demo',API_FOR_CLASS:classCode=>classCode==='CODEXDEMO56'?'https://example.test/mapping-api-demo':'https://example.test/mapping-api-k56',GOOGLE_CLIENT_ID:'synthetic'},location:{href:'https://example.test/term-tests/k56-demo/?class=CODEXDEMO56'},history:{replaceState(_state,_title,url){history.push(url)}},sessionStorage:{}},
  location:{search:'?class=CODEXDEMO56'},URLSearchParams,URL,AbortSignal,sortClassesNewestFirst,buildK56LandingClasses,
  document:{getElementById:id=>elements[id],createElement:()=>element(),head:{append(){}},querySelectorAll:selector=>selector==='[data-test]'?buttons:selector==='[data-mode]'?modes:destinationButtons},
  createTeacherSessionClient:()=>({login:async()=>({ok:true}),restore:async()=>false,logout:async()=>({ok:true})}),
  teacherSessionRequestOptions:options=>({...options,credentials:'include'}),
  fetch:async(url,options)=>{requests.push({url,options});return {ok:response.ok,status:response.ok?200:404,json:async()=>response}}
});
vm.runInContext(source,context);
assert.equal(elements.classCode.value,'CODEXDEMO56');
await buttons[0].handlers.click();
assert.equal(context.window.location.href,'../term-test-1-k56-computer-based/?class=CODEXDEMO56&mode=lis_first');
assert.ok(requests[0].url.endsWith('roster?class=CODEXDEMO56&test=term-test-1-k56'));
context.window.location.href='';response={ok:false,message:'Lớp chưa được mở'};
await buttons[1].handlers.click();assert.equal(context.window.location.href,'');assert.match(elements.classHelp.textContent,/Lớp chưa được mở/);
response={ok:true,classes:[{id:'1',name:'CODEXDEMO56'}],reviewer:{displayName:'Giảng viên Demo'}};
await vm.runInContext('loginAvailableApis("synthetic-token").then(()=>connectSession())',context);
assert.equal(elements.classSelect.hidden,false);assert.equal(elements.classCode.hidden,true);
assert.equal(elements.classSelect.children.length,1);
response={ok:true,students:[{ref:'synthetic'}]};
await buttons[1].handlers.click();assert.equal(context.window.location.href,'../term-test-2-k56-computer-based/?class=CODEXDEMO56&mode=lis_first');
await buttons[2].handlers.click();assert.equal(context.window.location.href,'../mini-test-k56-computer-based/?class=CODEXDEMO56&mode=lis_first');
destinationButtons[0].handlers.click();assert.equal(context.window.location.href,'../term-test-1-k56-audio/?class=CODEXDEMO56');
destinationButtons[4].handlers.click();assert.equal(context.window.location.href,'../term-test-2-k56/?class=CODEXDEMO56&mode=lis_first');
elements.teacherDashboard.handlers.click();assert.equal(context.window.location.href,'../teacher-k56/?class=CODEXDEMO56');
await elements.logoutButton.handlers.click();assert.equal(elements.classSelect.hidden,true);
assert.ok(requests.every(r=>r.url.startsWith('https://example.test/mapping-api-demo/')));
assert.ok(requests.some(r=>r.options?.credentials==='include'));
for(const classCode of ['CODEXDEMO56','IC2264','IC2305']) for(const mode of ['lis_first','read_first']) {
  elements.classCode.value=classCode;
  modes.find(button=>button.dataset.mode===mode).handlers.click();
  assert.ok(history.at(-1).includes('mode='+mode));
  response={ok:true,students:[{ref:'synthetic'}]};
  for(const button of buttons) {
    await button.handlers.click();
    assert.equal(context.window.location.href,`../${button.dataset.test}/?class=${classCode}&mode=${mode}`);
  }
  for(const button of destinationButtons) {
    button.handlers.click();
    assert.equal(context.window.location.href,`../${button.dataset.destination}/?class=${classCode}${button.dataset.destination.endsWith('-audio')?'':'&mode='+mode}`);
  }
}
const html=fs.readFileSync(new URL('../term-tests/k56-demo/index.html',import.meta.url),'utf8');
assert.doesNotMatch(html,/data-copy=|copyLinkStatus|Sao chép link/);
console.log('K56 landing: chọn lớp, roster, ba bài thi, Audio Backup, Answer Sheet, kết quả và đăng xuất đều đạt.');
