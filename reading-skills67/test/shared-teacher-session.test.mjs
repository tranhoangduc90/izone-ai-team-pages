// Phiên Reading đã có phải mở thẳng đúng bài, không hiện nút Google lần nữa.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
test('Existing Reading teacher session opens Materials without Google',async()=>{
 let native=false,bridges=0,html='';
 const app={set innerHTML(value){html=value;},get innerHTML(){return html;},querySelector(){return {checked:true,textContent:'',onclick:null};}};
 const fetch=async(url)=>{
  url=String(url);
  if(url.includes('/shared-session')){bridges++;return {ok:true,status:200,json:async()=>({ok:true})};}
  if(url.includes('/teacher-session-api/')){native=bridges>0;return {ok:native,status:native?200:401,json:async()=>({ok:native})};}
  if(url.endsWith('/config'))return {ok:true,status:200,json:async()=>({title:'Materials',demoGoogle:true})};
  return {ok:native,status:native?200:401,json:async()=>native?{student:{name:'Test learner'},attempts:[]}:{error:'TEACHER_LOGIN_REQUIRED'}};
 };
 const box={URL,URLSearchParams,Headers,Request,Response,AbortSignal,console,setTimeout,clearTimeout,fetch,
  location:{href:'https://tranhoangduc90.github.io/izone-ai-team-pages/reading-skills67/materials-beyond-concrete/?server=1&teacher=1&classId=1124&studentRef=11111111-1111-4111-8111-111111111111',search:'?teacher=1&classId=1124&studentRef=11111111-1111-4111-8111-111111111111'},
  document:{querySelector:()=>app},sessionStorage:{},localStorage:{setItem(){}},addEventListener(){},dispatchEvent(){}};
 box.window=box;box.READING67_API_BASE='https://ducizone.ddns.net/reading67-materials/api/reading-skills67';
 vm.createContext(box);
 const shared=new URL('../../shared/teacher-single-sign-on.js',import.meta.url);
 if(fs.existsSync(shared))vm.runInContext(fs.readFileSync(shared,'utf8'),box);
 vm.runInContext(fs.readFileSync(new URL('../access.js',import.meta.url),'utf8'),box);
 let result;
 box.Reading67Access.open().then(value=>result=value);
 for(let i=0;i<30&&!result;i++)await new Promise(resolve=>setTimeout(resolve,1));
 assert.equal(result?.teacher,true,'Expected teacher work; still waiting for Google login');
 assert.equal(html.includes('Đăng nhập để xem bài'),false);
 assert.ok(bridges>0);
});
