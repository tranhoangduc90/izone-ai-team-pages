import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import test from 'node:test';
process.env.K56_FIXTURE_IMPORT_ONLY='1';
const {fixture,wait}=await import('./term2-offline-browser.mjs');
const output=process.env.TERM2_EVIDENCE;assert.ok(output);

test('Term2 live v3 Reading run upgrades, restores offline and exports retained answers plus Task1 safely',{timeout:100000},async()=>{
 const f=await fixture('read_first',{product:2}),p=f.page;
 f.controls.r2Audio=true;f.controls.preparedOverride={term2ParallelEntry:true};
 const entry='/term-tests/term-test-2-k56-computer-based/';
 const old=await readFile(new URL('../term-tests/term-test-2-k56-computer-based/index-listening-report-v3.html',import.meta.url),'utf8');
 const current=await readFile(new URL('../term-tests/term-test-2-k56-computer-based/index-listening-report-v4.html',import.meta.url),'utf8');
 f.controls.assetOverrides.set(entry,old);f.controls.assetOverrides.set(entry+'index.html',old);
 const exported=[];
 const download=async name=>{
  const [file]=await Promise.all([p.waitForEvent('download'),p.getByRole('button',{name:'Tải bài làm về máy',exact:true}).click()]);
  const html=await readFile(await file.path(),'utf8');
  for(const value of [before.scope.attemptToken,before.scope.examSessionToken,before.scope.ownerId])assert.equal(html.includes(value),false,'Native scope must stay in the local run');
  assert.match(html,/Retained answer from the previous local operation/);
  await writeFile(resolve(output,name+'.html'),html);exported.push(name);return html;
 };
 let before;
 try{
  await p.goto(f.url);await p.locator('#bootstrapStudent option[value="'+f.student+'"]').waitFor({state:'attached'});
  await p.selectOption('#bootstrapStudent',f.student);await p.click('#confirmIdentity');
  await wait(p,()=>window.K56_TERM2_APP_READY&&window.K56_TERM2_OFFLINE?.record?.ready,'Original v3 Reading shell prepared');
  assert.match(await p.evaluate(()=>navigator.serviceWorker.controller.scriptURL),/offline-worker-listening-report-v3\.js/);
  await p.locator('#k56SectionReady button').click();
  await p.locator('#readingQuestions input[data-number]').first().fill('Reading typed before the export update');
  await p.evaluate(async()=>{
   const r=window.K56_TERM2_OFFLINE;
   r.record.supersededLocalOperations=[{...r.scope,operationId:crypto.randomUUID(),section:'reading',kind:'seal',revision:2,occurredAt:new Date().toISOString(),dependency:null,payload:{answers:{'1':'Retained answer from the previous local operation'}}}];
   await r.persist();
  });
  before=await p.evaluate(()=>({scope:window.K56_TERM2_OFFLINE.scope,section:window.K56_TERM2_OFFLINE.record.sections.reading}));
  f.controls.assetOverrides.set(entry,current);f.controls.assetOverrides.set(entry+'index.html',current);
  assert.equal(await p.locator('#readingQuestions input[data-number]').first().inputValue(),'Reading typed before the export update');
  await p.reload();await wait(p,()=>window.K56_TERM2_APP_READY,'v4 restores the Reading run');
  await wait(p,()=>navigator.serviceWorker.controller?.scriptURL.includes('offline-worker-listening-report-v4.js'),'Restored run verifies the new immutable shell',15000);
  f.disconnected=true;await f.context.setOffline(true);await p.reload();
  await wait(p,()=>window.K56_TERM2_APP_READY,'v4 Reading restored offline');
  assert.equal(await p.locator('#readingQuestions input[data-number]').first().inputValue(),'Reading typed before the export update');
  const after=await p.evaluate(()=>({scope:window.K56_TERM2_OFFLINE.scope,section:window.K56_TERM2_OFFLINE.record.sections.reading}));
  assert.deepEqual(after,before);
  assert.match(await download('TERM2_K56_READING_SAFE_EXPORT'),/Reading typed before the export update/);
  assert.equal(await p.evaluate(()=>window.K56_TERM2_OFFLINE.record.supersededLocalOperations[0].attemptToken),before.scope.attemptToken);
  f.disconnected=false;await f.context.setOffline(false);await p.click('#submitReading');
  await wait(p,()=>window.K56_TERM2_OFFLINE?.record?.sections.reading?.sealed&&window.K56_TERM2_OFFLINE.pending===0,'Reading receipt read');
  await p.click('#bootstrapPreview');await p.click('#bootstrapStart');
  await wait(p,()=>window.K56_TERM2_OFFLINE?.player?.currentTime>.5,'Short Listening branch advancing at 1×');
  await p.click('#submitListening');await p.click('#startWriting');
  await p.locator('[data-writing-task="task1"]').fill('Actual Task 1 typed after the warm upgrade.');
  assert.match(await download('TERM2_K56_TASK1_SAFE_EXPORT'),/Actual Task 1 typed after the warm upgrade/);
  f.controls.loseAck=true;await p.click('#submitWriting');
  await wait(p,()=>window.K56_TERM2_OFFLINE?.record?.sections.writing?.sealed&&window.K56_TERM2_OFFLINE.pending===0,'One Writing receipt recovered after ACK loss',20000);
  assert.equal(f.controls.ackLost,true);
  assert.equal([...f.receipts.values()].filter(r=>r.kind==='seal'&&r.section==='writing').length,1);
  assert.deepEqual(f.errors,[]);
  await writeFile(resolve(output,'TERM2_K56_EXPORT_WARM_PROOF.json'),JSON.stringify({oldShell:'v3',newShell:'v4',sameScope:true,sameDraft:true,sameStartedAtAndDeadline:true,exports:exported,nativeScopeOmitted:true,localSourceScopeRetained:true,oneTask1Receipt:true,lostAck:true,
   boundary:'Real isolated browser/cache/download/input; seeded retained operation, synthetic API and short media branch, not a native SQL or full-duration audio test'},null,2));
 }finally{await f.close();}
});
