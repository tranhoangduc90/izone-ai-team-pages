import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
const read=path=>process.env.REGRESSION_BASE?execFileSync('git',['show',process.env.REGRESSION_BASE+':'+path],{encoding:'utf8'}):fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const run='c25faeb1-c369-4527-9ca9-e160e8930749',epoch='5cf7ccec-8359-4170-ae91-f219d81c80da';
async function fixture(slug,hint){
 const location=new URL('https://example.test/'+slug+'/?demo=exam&grading=server'+(hint?'&class='+hint:''));
 const window={location,addEventListener(){},dispatchEvent(){},history:{state:{fixtureTabIdentity:'preserve'},replaceState(state,_b,url){this.state=state;location.href=new URL(url,location).href;}},
 TERM_TEST_CONFIG:{slug},TERM_TEST_APP_CONFIG:{},TERM_TEST_CONTENT:{variant:'semantic-html'},
 TERM_TEST_BOOTSTRAP:{classCode:'IC2238',studentRef:'999990001',clientRunId:run}};
 const context=vm.createContext({window,location,history:window.history,document:{getElementById:()=>({})},URL,URLSearchParams,AbortController,Event,setTimeout,clearTimeout,
 fetch:async()=>({ok:true,json:async()=>({testSlug:slug,historyEpoch:epoch,stateVersion:2,classes:[{code:'IC2238',name:'IC2238'},{code:'DEMO',name:'DEMO'}]})})});
 vm.runInContext(read('term-tests/substitute-shared/state.js'),context);
 await window.SUBSTITUTE_STATE.initialize({slug},{API_BASE_URL:'/fixture'});
 window.SUBSTITUTE_STATE.bind(window.TERM_TEST_BOOTSTRAP);
 return {window,context,location};
}
for(const slug of ['substitute-test-1-k56','substitute-test-2-k56','substitute-test-1-k67','substitute-test-2-k67']){
 const app=slug.endsWith('k67')?'substitute-k67-shared':slug.includes('-2-')?'substitute-test-2-k56-shared':'substitute-k56-shared';
 for(const hint of ['', 'DEMO'])test(`${slug}: URL ${hint||'trống'} không đổi chủ payload/đồng hồ/annotations`,async()=>{
  const {window,context,location}=await fixture(slug,hint);
  // Mô phỏng URL cũ còn ở tab sau bootstrap tự nhớ học viên.
  location.search='?demo=exam&grading=server'+(hint?'&class='+hint:'');
  for(const [path,end] of [[`term-tests/${app}/app.js`,'  const storageKey ='],[`term-tests/${slug}-computer-based/enhance.js`,'  if (!contentConfig'],[`term-tests/${slug}-computer-based/annotations.js`,'  const storageKey =']]){
   const source=read(path),cut=source.indexOf(end);assert.ok(cut>0,path);
   vm.runInContext(source.slice(0,cut)+'window.fixtureClass=classCode;}());',context);
   assert.equal(window.fixtureClass,'IC2238',path);
   assert.equal(window.SUBSTITUTE_STATE.payload({classCode:hint}).classCode,'IC2238');
  }
 });
}
test('Binding lỗi không được phá định danh đã xác nhận hoặc đổi chủ lượt',async()=>{
 const {window,location}=await fixture('substitute-test-1-k67','DEMO');
 assert.equal(location.searchParams.get('class'),'IC2238');
 assert.equal(window.history.state.fixtureTabIdentity,'preserve');
 assert.throws(()=>window.SUBSTITUTE_STATE.bind({classCode:'DEMO',studentRef:'999990002',clientRunId:run}));
 assert.throws(()=>window.SUBSTITUTE_STATE.bind({classCode:'IC2238',studentRef:'999990001',clientRunId:'invalid'}));
 assert.equal(window.SUBSTITUTE_STATE.payload({}).classCode,'IC2238');
 assert.equal(window.SUBSTITUTE_STATE.payload({}).studentRef,'999990001');
 assert.equal(window.SUBSTITUTE_STATE.payload({}).clientRunId,run);
});
test('Trình duyệt chặn đổi URL vẫn giữ đúng binding trong RAM',async()=>{
 const {window,location}=await fixture('substitute-test-1-k67','');let calls=0;
 location.search='?demo=exam&grading=server';
 window.history.replaceState=()=>{calls++;throw Error('Fixture history denied');};
 assert.doesNotThrow(()=>window.SUBSTITUTE_STATE.bind(window.TERM_TEST_BOOTSTRAP));
 assert.equal(calls,1);assert.equal(window.history.state.fixtureTabIdentity,'preserve');
 assert.equal(window.SUBSTITUTE_STATE.payload({classCode:'DEMO'}).classCode,'IC2238');
});
