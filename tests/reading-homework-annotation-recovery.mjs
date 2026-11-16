import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHomeworkObservationApp } from './fixtures/homework-observation-app.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const {chromium}=createRequire(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'))('playwright');

test('The Desolenator keeps the large local draft across closing, then submits its exact revision',async t=>{
 const fixture=await createHomeworkObservationApp({root,fixtureName:'the-desolenator'});
 t.after(()=>fixture.close());
 const browser=await chromium.launch({channel:'chrome',headless:true});
 t.after(()=>browser.close());
 const context=await browser.newContext();
 let blockSaves=false;
 await context.route('**/*',route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin!==fixture.origin)return route.abort();
  if(blockSaves&&request.method()==='PUT'&&url.pathname.endsWith('/draft'))return route.abort();
  return route.continue();
 });
 const connect=async history=>{
  const page=await context.newPage();
  await page.goto(fixture.origin+'/reading-skills67/the-desolenator/?server=1'+(history?'&attemptId='+fixture.initial.attemptId:''));
  await page.locator('#entry-class').selectOption('1124');
  await page.locator('#entry-student').selectOption(fixture.scope.ownerId);
  await page.getByRole('button',{name:'Vào bài',exact:true}).click();
  return page;
 };
 let page=await connect(true);
 await page.locator('footer [data-action="edit"]').click();
 await page.waitForFunction(()=>window.ReadingInteractionBridge?.writable());
 const old=await fixture.store.draft(fixture.scope);
 blockSaves=true;
 const expected=await page.evaluate(()=>{
  const bridge=window.ReadingInteractionBridge,state=bridge.current();
  const first=Object.keys(state.answers)[0];
  state.answers[first]='Đáp án giữ qua lần đóng trang';
  state.annotations=Array.from({length:300},(_,i)=>({
   id:crypto.randomUUID(),kind:'note',rootKey:'reading-fixture-notes',skill:'reading',start:i*4,end:i*4+3,
   quote:'abc',questionRef:'1',note:'synthetic note data '.repeat(10)
  }));
  bridge.save();
  return{answers:state.answers,annotations:state.annotations,notes:state.notes,flags:state.flags};
 });
 assert.ok(Buffer.byteLength(JSON.stringify(expected))>65536);
 await page.close();
 assert.equal((await fixture.store.draft(fixture.scope)).revision,old.revision);
 blockSaves=false;
 page=await connect(false);
 await page.waitForFunction(()=>window.ReadingServerClient.state.status==='saved'&&window.ReadingServerClient.revision>1);
 const draft=await fixture.store.draft(fixture.scope);
 assert.equal(draft.body.annotations.length,300);
 assert.deepEqual(draft.body,expected);
 const rejected=await page.evaluate(async ({body,revision})=>{
  const response=await fetch('/api/reading-skills67/draft',{method:'PUT',credentials:'include',
   headers:{'Content-Type':'application/json',...window.Reading67Access.headers},
   body:JSON.stringify({body:{...body,annotations:[...body.annotations,{...body.annotations[0],id:crypto.randomUUID()}]},baseRevision:revision,mutationId:crypto.randomUUID()})});
  return{status:response.status,code:(await response.json()).error};
 },draft);
 assert.deepEqual(rejected,{status:400,code:'ANNOTATION_LIMIT'});
 assert.deepEqual((await fixture.store.draft(fixture.scope)).body,expected);
 const submitted=await page.evaluate(()=>window.ReadingServerClient.submit());
 await fixture.completePending();
 const readback=await fixture.store.attempt(fixture.scope,submitted.attemptId);
 assert.equal(readback.status,'done');
 assert.equal(readback.draftRevision,draft.revision);
 assert.deepEqual(readback.snapshot,expected);
});
