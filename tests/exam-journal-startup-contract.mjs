import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {connectExamJournal} from '../term-tests/shared/exam-journal/bridge.mjs';
const sdkRevision=JSON.parse(fs.readFileSync('term-tests/shared/exam-journal/SDK_MANIFEST.json','utf8')).revision;

test('initialization never acquires the native owner, including after adoption and delayed context',async t=>{
 const rows=[],proofs=[];let release;
 const waiting=new Promise(r=>release=r);
 const doc=new EventTarget();Object.assign(doc,{body:{},querySelectorAll:()=>[],visibilityState:'visible'});
 const win=new EventTarget();Object.assign(win,{location:{href:'https://fixture.invalid'},performance,navigator:{userAgent:'Synthetic',languages:[],onLine:true},screen:{width:1000,height:800},MutationObserver:class{observe(){}disconnect(){}}});
 const outbox={async renewBinding(){},async put(binding,event){rows.push({binding,event});},async size(){return 0;},async list(){return [];},async close(){}};
 const bridge=connectExamJournal({enabled:true,endpoint:'https://fixture.invalid/api',testSlug:'fixture',document:doc,window:win,outbox,
  getState:()=>({classCode:'ICFIXA',stage:'reading',attemptToken:'synthetic-native',drafts:{}}),
  fetcher:async(url,options)=>{
   const proof=JSON.parse(options.body);proofs.push(proof);if(!proof.attemptToken)await waiting;
   return {ok:true,json:async()=>({ok:true,bindingId:(proof.attemptToken?'c':'a').repeat(64),ticket:'synthetic',ticketId:crypto.randomUUID(),issuedAt:Date.now(),expiresAt:Date.now()+3600000,identityConfirmed:!!proof.attemptToken})};
  }});
 t.after(async()=>{release();await bridge.stop();});
 const row={type:'identity_observed',data:{action:'selection_changed',identityConfirmed:false,checkpointState:{selected:{value:'fixture-A',label:'Fixture A'},observedAt:'2026-10-24T11:13:11.000Z'}}};
 const pending=bridge.recordInitialization([row],{classCode:'ICFIXA'});
 bridge.adopt(()=>({classCode:'ICFIXB',stage:'reading',attemptToken:'synthetic-other',drafts:{}}));
 const late=connectExamJournal({enabled:true,endpoint:'https://fixture.invalid/api',testSlug:'fixture',document:doc,window:win,adoptExistingState:false,
  getState:()=>({classCode:'ICFIXA',stage:'initialization',drafts:{}})});
 assert.equal(late,bridge);
 release();await pending;await bridge.recorder.idle();
 const change=rows.find(r=>r.event.data.action==='selection_changed');
 assert.equal(change?.binding,'a'.repeat(64));assert.equal(change?.event.data.identityConfirmed,false);
 const earlyProof=proofs.find(p=>!p.attemptToken);assert.equal(earlyProof.classCode,'ICFIXA');assert.equal(earlyProof.examSessionToken,'');
 assert.equal(earlyProof.studentRef,undefined);
 await new Promise(setImmediate);bridge.stateChanged('late_initialization_import');await bridge.recorder.idle();
 assert.ok(rows.some(r=>r.binding==='c'.repeat(64)&&r.event.data.checkpointState?.stage==='reading'),'late startup import must not replace the native state reader');
});

const bootstraps=fs.readdirSync('term-tests',{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>path.join('term-tests',d.name,'bootstrap.js')).filter(p=>fs.existsSync(p));
for(const file of bootstraps){
 const source=fs.readFileSync(file,'utf8');const start=source.indexOf('  async function apiRequest(');if(start<0)continue;
 const end=source.indexOf('\n  function ',start),fn=source.slice(start,end);
 for(const scenario of ['ok','denied','timeout','logger-throws'])test(file+': request '+scenario+' retains native result/permission/error',async()=>{
  const traces=[],options={method:'POST',body:JSON.stringify({value:'synthetic-only'}),headers:{'x-existing':'unchanged'}},gateway=/substitute-test-[12]-k56-/.test(file);
  const window={setTimeout,clearTimeout,EXAM_JOURNAL_STARTUP:{startRequest(){if(scenario==='logger-throws')throw Error('logger');return {done(...args){traces.push(args);}};}},
   location:{origin:'https://fixture.invalid'},K67_EXAM_ORDER:{request:value=>value},K67_AUDIO_OWNER:{request:value=>value},SUBSTITUTE_STATE:{track:()=>()=>{},payload:value=>value}};
  const sandbox={window,URL,AbortController,appConfig:{API_BASE_URL:'https://fixture.invalid'},fetch:async(url,sent)=>{
   if(gateway){assert.equal(url,'https://fixture.invalid');assert.deepEqual(JSON.parse(sent.body),{route:'/api/fixture',payload:{value:'synthetic-only'}});assert.equal(sent.headers['Content-Type'],'text/plain;charset=UTF-8');}
   else {assert.equal(url,'https://fixture.invalid/api/fixture');assert.equal(sent.body,options.body);assert.deepEqual(sent.headers,options.headers);}
   if(scenario==='timeout')throw Object.assign(Error('synthetic timeout'),{name:'AbortError'});
   return {ok:scenario!=='denied',status:scenario==='denied'?403:200,json:async()=>({ok:scenario!=='denied',message:'Synthetic denied',value:7})};
  }};
  const api=vm.runInNewContext('('+fn.trim()+')',sandbox);
  if(scenario==='denied'||scenario==='timeout')await assert.rejects(api('/api/fixture',options),error=>scenario==='denied'?error.message==='Synthetic denied':error.message.includes('quá chậm'));
  else assert.equal((await api('/api/fixture',options)).value,7);
  assert.equal(traces.length,scenario==='logger-throws'?0:1);
 });
}

test('all live student entries install early capture before app/bootstrap, with cache closure',()=>{
 const entries=['term-test-1','term-test-2','mini-test-lesson-5','term-test-1-k56','term-test-2-k56','mini-test-k56'].flatMap(s=>[s,s+'-computer-based'])
  .concat(['substitute-test-1-k67-computer-based','substitute-test-2-k67-computer-based','substitute-test-1-k56-computer-based','substitute-test-2-k56-computer-based','term-test-1-listening-retake']);
 for(const entry of entries){
  const html=fs.readFileSync('term-tests/'+entry+'/index.html','utf8'),config=html.match(/src="([^"]*test-config\.js[^\"]*)"/);
  assert.ok(config,entry);assert.ok(config.index<html.search(/<script src="[^"]*(?:shared\/app|bootstrap)\.js/),entry);
  assert.equal(new URL(config[1],'https://fixture.invalid/').searchParams.get('ej'),sdkRevision);
  const definition=fs.readFileSync(path.resolve('term-tests',entry,config[1].split('?')[0]),'utf8');
  assert.match(definition,/BEGIN GENERATED EXAM JOURNAL STARTUP v1/);
 }
 for(const dir of ['shared','k56-shared','k56-test2-shared','k56-mini-shared','substitute-k67-shared','substitute-k56-shared','substitute-test-2-k56-shared']){
  const source=fs.readFileSync('term-tests/'+dir+'/app.js','utf8');assert.match(source,/EXAM_JOURNAL_STARTUP\?\.startRequest/);
  const specifier=source.match(/import\(['"]([^'"]*exam-journal\/bridge\.mjs\?[^'"]+)['"]\)/)?.[1];
  assert.ok(specifier,dir);assert.equal(new URL(specifier,'https://fixture.invalid/').search,'?ej='+sdkRevision);
 }
});
