import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {sortClassesNewestFirst,buildK56LandingClasses} from '../term-tests/k56-demo/landing-model.js';
const source=fs.readFileSync(new URL('../term-tests/k56-demo/landing.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
function element(){return {value:'',hidden:false,dataset:{},handlers:{},classList:{toggle(){}},setAttribute(){},removeAttribute(){},focus(){},after(){},addEventListener(n,f){this.handlers[n]=f},replaceChildren(...children){this.children=children},setCustomValidity(s){this.validation=s},reportValidity(){return !this.validation},append(){}};}
const elements=Object.fromEntries(['classCode','classSelect','classHelp','loginBadge','loginStatus','googleSignInButton','logoutButton','teacherDashboard',
  'openExam','chosenName','rescue','rescueDetail','rescueLinks','rescueHelp','testPicker','testActions','pickStep','actionStep','changeTest',
  'studentLinkPanel','studentLink','studentLinkStatus','copyStudentLink','paperExam','paperExamLink','paperExamLabel','paperExamUrl','paperExamHelp'].map(id=>[id,element()]));
const modes=['lis_first','read_first'].map(mode=>Object.assign(element(),{dataset:{mode}}));
const history=[];
const buttons=[1,2].map(n=>Object.assign(element(),{textContent:`Term Test ${n}`,dataset:{test:`term-test-${n}-k56-computer-based`,slug:`term-test-${n}-k56`}}));
const requests=[];
buttons.push(Object.assign(element(), {textContent:'Mini Test',dataset:{test:'mini-test-k56-computer-based',slug:'mini-test-k56'}}));
const rescueChoices=['skill','audio','sheet'].map(kind=>Object.assign(element(),{dataset:{case:kind}}));
let response={ok:true,students:[{ref:'synthetic',name:'Học viên giả lập'}]};
const context=vm.createContext({
  window:{TERM_TEST_APP_CONFIG:{API_BASE_URL:'https://example.test/mapping-api-k56',API_FOR_CLASS:classCode=>classCode==='CODEXDEMO56'?'https://example.test/mapping-api-demo':'https://example.test/mapping-api-k56',GOOGLE_CLIENT_ID:'synthetic'},location:{href:'https://example.test/term-tests/k56-demo/?class=IC2264'},history:{replaceState(_state,_title,url){history.push(url)}},sessionStorage:{}},
  location:{search:'?class=IC2264'},URLSearchParams,URL,AbortController,AbortSignal,sortClassesNewestFirst,buildK56LandingClasses,
  document:{getElementById:id=>elements[id],createElement:()=>element(),head:{append(){}},querySelectorAll:selector=>selector==='[data-test]'?buttons:selector==='[data-mode]'?modes:rescueChoices},
  createTeacherSessionClient:()=>({login:async()=>({ok:true}),restore:async()=>false,logout:async()=>({ok:true})}),
  teacherSessionRequestOptions:options=>({...options,credentials:'include'}),
  fetch:async(url,options)=>{requests.push({url,options});return {ok:response.ok,status:response.ok?200:404,json:async()=>response}}
});
vm.runInContext(fs.readFileSync(new URL('../shared/teacher-auth-state.js',import.meta.url),'utf8').replace('export function','function')+'\n'+source,context);
assert.equal(elements.classCode.value,'IC2264');
async function open(button) {
  button.handlers.click();
  await elements.openExam.handlers.click();
}
function rescue(kind, index = 0) {
  rescueChoices.find(button => button.dataset.case === kind).handlers.click();
  elements.rescueLinks.children[index].handlers.click();
}
await open(buttons[0]);
assert.equal(context.window.location.href,'../term-test-1-k56-computer-based/?class=CODEXDEMO56&mode=lis_first');
assert.ok(requests[0].url.endsWith('roster?class=CODEXDEMO56&test=term-test-1-k56'));
context.window.location.href='';response={ok:false,message:'Lớp chưa được mở'};
await open(buttons[1]);assert.equal(context.window.location.href,'');assert.match(elements.classHelp.textContent,/Lớp chưa được mở/);
response={ok:true,classes:[{id:'1',name:'IC2264'}],reviewer:{displayName:'Giảng viên Demo'}};
await vm.runInContext('loginAvailableApis("synthetic-token").then(()=>connectSession())',context);
assert.equal(elements.classSelect.hidden,false);assert.equal(elements.classCode.hidden,true);
assert.equal(elements.classSelect.children.length,2);
assert.equal(elements.classSelect.children[0].value,'CODEXDEMO56');
response={ok:true,students:[{ref:'synthetic'}]};
await open(buttons[1]);assert.equal(context.window.location.href,'../term-test-2-k56-computer-based/?class=CODEXDEMO56&mode=lis_first');
await open(buttons[2]);assert.equal(context.window.location.href,'../mini-test-k56-computer-based/?class=CODEXDEMO56&mode=lis_first');
buttons[0].handlers.click();
rescue('audio');assert.equal(context.window.location.href,'../term-test-1-k56-audio/?class=IC2264');
buttons[1].handlers.click();
rescue('sheet');assert.equal(context.window.location.href,'../term-test-2-k56/?class=IC2264&mode=lis_first');
elements.teacherDashboard.handlers.click();assert.equal(context.window.location.href,'../teacher-k56/?class=IC2264&test=term-test-2-k56');
await elements.logoutButton.handlers.click();assert.equal(elements.classSelect.hidden,true);
assert.ok(requests.filter(r=>r.url.includes('/roster?')).every(r=>r.url.startsWith('https://example.test/mapping-api-demo/')));
assert.ok(requests.some(r=>r.options?.credentials==='include'));
for(const classCode of ['IC2264','IC2264','IC2305']) for(const mode of ['lis_first','read_first']) {
  elements.classCode.value=classCode;
  modes.find(button=>button.dataset.mode===mode).handlers.click();
  assert.ok(history.at(-1).includes('mode='+mode));
  response={ok:true,students:[{ref:'synthetic'}]};
  for(const button of buttons) {
    await open(button);
    assert.equal(context.window.location.href,`../${button.dataset.test}/?class=CODEXDEMO56&mode=${mode}`);
    rescue('audio');
    assert.equal(context.window.location.href,`../${button.dataset.slug}-audio/?class=${classCode}`);
    rescue('sheet');
    assert.equal(context.window.location.href,`../${button.dataset.slug}/?class=${classCode}&mode=${mode}`);
    assert.equal(rescueChoices[0].hidden, button !== buttons[0]);
    if (button === buttons[0]) for (const [index, skill] of ['listening', 'reading', 'writing'].entries()) {
      rescue('skill', index);
      assert.equal(context.window.location.href,`../term-test-1-k56-${skill}-fallback/?class=${classCode}&mode=${mode}`);
    }
  }
}
const html=fs.readFileSync(new URL('../term-tests/k56-demo/index.html',import.meta.url),'utf8');
assert.doesNotMatch(html,/data-copy=|copyLinkStatus|Sao chép link/);
console.log('K56 landing: chọn lớp, roster, ba bài thi, Audio Backup, Answer Sheet, kết quả và đăng xuất đều đạt.');
