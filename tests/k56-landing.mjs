import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {sortClassesNewestFirst} from '../term-tests/k56-demo/landing-model.js';
const source=fs.readFileSync(new URL('../term-tests/k56-demo/landing.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
function element(){return {value:'',hidden:false,dataset:{},handlers:{},addEventListener(n,f){this.handlers[n]=f},replaceChildren(...children){this.children=children},setCustomValidity(s){this.validation=s},reportValidity(){},append(){}};}
const elements=Object.fromEntries(['classCode','classSelect','classHelp','loginBadge','loginStatus','googleSignInButton','logoutButton','teacherDashboard'].map(id=>[id,element()]));
const buttons=[1,2].map(n=>Object.assign(element(),{dataset:{test:`term-test-${n}-k56-computer-based`,slug:`term-test-${n}-k56`}}));
const requests=[];
buttons.push(Object.assign(element(), {dataset:{test:'mini-test-k56-computer-based',slug:'mini-test-k56'}}));
const destinationButtons=['term-test-1-k56-audio','term-test-2-k56-audio','mini-test-k56-audio','term-test-1-k56','term-test-2-k56','mini-test-k56']
  .map(destination=>Object.assign(element(),{dataset:{destination}}));
let response={ok:true,students:[{ref:'synthetic',name:'Học viên giả lập'}]};
const context=vm.createContext({
  window:{TERM_TEST_APP_CONFIG:{API_BASE_URL:'https://example.test/mapping-api-demo',GOOGLE_CLIENT_ID:'synthetic'},location:{href:''},sessionStorage:{}},
  location:{search:'?class=CODEXDEMO56'},URLSearchParams,AbortSignal,sortClassesNewestFirst,
  document:{getElementById:id=>elements[id],createElement:()=>element(),head:{append(){}},querySelectorAll:selector=>selector==='[data-test]'?buttons:destinationButtons},
  createSessionStore:()=>({usable:()=>true,save(){},clear(){},read:()=>null}),
  fetch:async(url,options)=>{requests.push({url,options});return {ok:response.ok,status:response.ok?200:404,json:async()=>response}}
});
vm.runInContext(source,context);
assert.equal(elements.classCode.value,'CODEXDEMO56');
await buttons[0].handlers.click();
assert.equal(context.window.location.href,'../term-test-1-k56-computer-based/?class=CODEXDEMO56');
assert.ok(requests[0].url.endsWith('roster?class=CODEXDEMO56&test=term-test-1-k56'));
context.window.location.href='';response={ok:false,message:'Lớp chưa được mở'};
await buttons[1].handlers.click();assert.equal(context.window.location.href,'');assert.match(elements.classHelp.textContent,/Lớp chưa được mở/);
response={ok:true,classes:[{id:'1',name:'CODEXDEMO56'}],reviewer:{displayName:'Giảng viên Demo'}};
await vm.runInContext('connectWithToken("synthetic-token")',context);
assert.equal(elements.classSelect.hidden,false);assert.equal(elements.classCode.hidden,true);
assert.equal(elements.classSelect.children.length,1);
response={ok:true,students:[{ref:'synthetic'}]};
await buttons[1].handlers.click();assert.equal(context.window.location.href,'../term-test-2-k56-computer-based/?class=CODEXDEMO56');
await buttons[2].handlers.click();assert.equal(context.window.location.href,'../mini-test-k56-computer-based/?class=CODEXDEMO56');
destinationButtons[0].handlers.click();assert.equal(context.window.location.href,'../term-test-1-k56-audio/?class=CODEXDEMO56');
destinationButtons[4].handlers.click();assert.equal(context.window.location.href,'../term-test-2-k56/?class=CODEXDEMO56');
elements.teacherDashboard.handlers.click();assert.equal(context.window.location.href,'../teacher-k56/?class=CODEXDEMO56');
elements.logoutButton.handlers.click();assert.equal(elements.classSelect.hidden,true);
assert.ok(requests.every(r=>r.url.startsWith('https://example.test/mapping-api-demo/')));
console.log('K56 landing: chọn lớp, roster, ba bài thi, Audio Backup, Answer Sheet, kết quả và đăng xuất đều đạt.');
