import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import test from 'node:test';
process.env.K56_FIXTURE_IMPORT_ONLY='1';
const {fixture,wait}=await import('./term2-offline-browser.mjs');
const output=process.env.TERM2_EVIDENCE;assert.ok(output);
const workerName='offline-worker-student-cache-v2-preview-verified-v1-protected-listening-v1.js';
test('Term2 refreshed shell installs cold, keeps speaker continuation stable and restores Reading offline',{timeout:90000},async()=>{
 const f=await fixture('lis_first',{product:2}),p=f.page;f.controls.r2Audio=true;
 f.controls.listeningReportsEnabled=true;f.controls.preparedOverride={term2ParallelEntry:true};
 try{
  await p.goto(f.url);await p.locator('#bootstrapStudent option[value="'+f.student+'"]').waitFor({state:'attached'});
  await p.selectOption('#bootstrapStudent',f.student);await p.click('#confirmIdentity');
  await wait(p,()=>window.K56_TERM2_OFFLINE?.record?.ready,'Refreshed Term2 verified shell ready');
  assert.equal(await p.evaluate(()=>new URL(navigator.serviceWorker.controller.scriptURL).pathname.split('/').pop()),workerName);
  await p.click('#bootstrapPreview');await p.click('#bootstrapStart');
  await wait(p,()=>window.K56_TERM2_OFFLINE?.player?.currentTime>.8,'Term2 playback ready');
  await p.getByRole('button',{name:'Báo lỗi âm thanh',exact:true}).click();
  await p.getByRole('button',{name:'Tôi nghe thấy âm thanh nhưng bị rè',exact:true}).click();
  await p.getByRole('button',{name:'Loa ngoài',exact:true}).click();
  await p.getByRole('dialog',{name:'Listening gián đoạn',exact:true}).waitFor();
  await wait(p,()=>window.K56_TERM2_OFFLINE.pending===0,'Term2 interruption committed');
  const frames=await p.evaluate(()=>new Promise(resolve=>{
   const b=document.querySelector('#offlineListeningInterrupted button'),rows=[];
   const take=()=>{rows.push(b.getBoundingClientRect().y);if(rows.length<20)requestAnimationFrame(take);else resolve(rows);};requestAnimationFrame(take);
  }));
  assert.equal(new Set(frames).size,1,'The same stationary cursor must not toggle the button position');
  await p.getByRole('button',{name:/Tôi đã hiểu\. Đến phần thi tiếp theo/}).click({timeout:5000});
  await p.locator('#k56SectionReady button').click();
  await p.locator('#readingQuestions input[data-number]').first().fill('Term2 draft after refreshed cold cache');
  const before=await p.evaluate(()=>({scope:window.K56_TERM2_OFFLINE.scope,section:window.K56_TERM2_OFFLINE.record.sections.reading}));
  f.disconnected=true;await f.context.setOffline(true);await p.reload();
  await wait(p,()=>window.K56_TERM2_APP_READY,'Refreshed Term2 Reading offline');
  assert.equal(await p.locator('#readingQuestions input[data-number]').first().inputValue(),'Term2 draft after refreshed cold cache');
  const after=await p.evaluate(()=>({scope:window.K56_TERM2_OFFLINE.scope,section:window.K56_TERM2_OFFLINE.record.sections.reading}));
  assert.deepEqual(after,before);
  assert.equal([...f.receipts.values()].filter(row=>row.kind==='interrupt').length,1);
  assert.deepEqual(f.errors,[]);
  await writeFile(resolve(output,'TERM2_K56_SHELL_REFRESH_BROWSER_PROOF.json'),JSON.stringify({
   coldShell:workerName,stableButtonFrames:frames,oneInterruptionReceipt:true,
   readingRestored:after,boundary:'Real browser and media, synthetic API; original native business evidence retained'
  },null,2));
 }finally{await f.close();}
});

test('Term2 keeps the active reading tab on the previous pinned worker while the new shell is visible',{timeout:90000},async()=>{
 const f=await fixture('read_first',{product:2}),original=f.page;
 const routePath=new URL(f.url).pathname;
 const entryPath='/term-tests/term-test-2-k56-computer-based/index.html';
 const fresh=await readFile(new URL('..'+entryPath,import.meta.url),'utf8');
 const legacy=workerName.replace('-protected-listening-v1','');
 const prior=fresh.replace('preview-verified-v1-protected-listening-v1.js','preview-verified-v1.js');
 assert.notEqual(prior,fresh);
 f.controls.assetOverrides.set(routePath,prior);
 f.controls.r2Audio=true;
 f.controls.preparedOverride={term2ParallelEntry:true};
 const readWorker=page=>page.evaluate(()=>new URL(navigator.serviceWorker.controller.scriptURL).pathname.split('/').pop());
 try{
  await original.goto(f.url);
  await original.locator('#bootstrapStudent option[value="'+f.student+'"]').waitFor({state:'attached'});
  await original.selectOption('#bootstrapStudent',f.student);
  await original.click('#confirmIdentity');
  await wait(original,()=>window.K56_TERM2_OFFLINE?.record?.ready,'Previous bundle pinned');
  assert.equal(await readWorker(original),legacy);
  await original.getByRole('button',{name:'Bắt đầu Reading',exact:true}).click();
  const answer='Reading draft in the previously pinned tab';
  const field=original.locator('#readingQuestions input[data-number]').first();
  await field.fill(answer);
  const before=await original.evaluate(()=>window.K56_TERM2_OFFLINE.scope);
  f.controls.assetOverrides.delete(routePath);
  const newTab=await f.context.newPage();
  await newTab.goto(f.url);
  assert.ok(await newTab.evaluate(()=>[...document.scripts].some(script=>script.src.includes('protected-listening-v1'))));
  await newTab.getByText('Bài đang mở ở tab khác. Hãy quay lại tab đó.',{exact:true}).waitFor();
  assert.equal(await readWorker(original),legacy);
  assert.equal(await field.inputValue(),answer);
  assert.deepEqual(await original.evaluate(()=>window.K56_TERM2_OFFLINE.scope),before);
  await field.fill(answer+' remains editable');
  assert.equal(await field.inputValue(),answer+' remains editable');
  assert.deepEqual(f.errors,[]);
  await writeFile(resolve(output,'TERM2_K56_WARM_PIN_BROWSER_PROOF.json'),JSON.stringify({
   previousWorker:legacy,newWorkerExpected:workerName,previousTabKeptDraft:true,previousTabKeptScope:true,newTabBlocked:true,
  },null,2));
 }finally{await f.close();}
});
