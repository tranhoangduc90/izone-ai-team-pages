import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import test from 'node:test';
process.env.K56_FIXTURE_IMPORT_ONLY='1';
const {fixture,wait}=await import('./term2-offline-browser.mjs');
const output=process.env.TERM2_EVIDENCE;assert.ok(output);
test('Term2 refreshed shell installs cold, keeps speaker continuation stable and restores Reading offline',{timeout:90000},async()=>{
 const f=await fixture('lis_first',{product:2}),p=f.page;f.controls.r2Audio=true;
 f.controls.listeningReportsEnabled=true;f.controls.preparedOverride={term2ParallelEntry:true};
 try{
  await p.goto(f.url);await p.locator('#bootstrapStudent option[value="'+f.student+'"]').waitFor({state:'attached'});
  await p.selectOption('#bootstrapStudent',f.student);await p.click('#confirmIdentity');
  await wait(p,()=>window.K56_TERM2_OFFLINE?.record?.ready,'Refreshed Term2 verified shell ready');
  assert.match(await p.evaluate(()=>navigator.serviceWorker.controller.scriptURL),/offline-worker-listening-report-v4\.js/);
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
   coldShell:'offline-worker-listening-report-v4.js',stableButtonFrames:frames,oneInterruptionReceipt:true,
   readingRestored:after,boundary:'Real browser and media, synthetic API; original native business evidence retained'
  },null,2));
 }finally{await f.close();}
});
