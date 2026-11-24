import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import test from 'node:test';
process.env.K56_FIXTURE_IMPORT_ONLY='1';
const {fixture,wait}=await import('./term2-offline-browser.mjs');
const output=process.env.TERM2_EVIDENCE;assert.ok(output);
const workerName='offline-worker-student-cache-v2-preview-verified-v1-protected-listening-v2.js';
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
 const legacy=workerName.replace('-protected-listening-v2','-protected-listening-v1');
 const prior=fresh.replace('-protected-listening-v2.js','-protected-listening-v1.js');
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
  assert.ok(await newTab.evaluate(()=>[...document.scripts].some(script=>script.src.includes('protected-listening-v2'))));
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

const rollbackBase = process.env.TERM2_ROLLBACK_BASE;
for (const demo of [false, true]) {
  const route = demo ? 'demo' : 'main';
  test(`Term 2 K56 rehearses entry-only rollback without dropping a pinned draft (${route})`,
    {timeout: 90000, skip: !rollbackBase}, async () => {
    assert.match(rollbackBase, /^[a-f0-9]{40}$/);
    const path = `term-tests/term-test-2-k56-computer-based/${demo ? 'demo-journal-v1/' : ''}index.html`;
    const prior = execFileSync('git', ['show', `${rollbackBase}:${path}`]);
    const priorSource = prior.toString('utf8');
    const oldVariant = priorSource.includes('-protected-listening-v1.js') ? '-protected-listening-v1' : '';
    const oldBootstrap = (demo ? 'bootstrap-term2-demo-journal-v1-preview-verified-v1' :
      'bootstrap-log-renewal-student-cache-v2-preview-verified-v1') + oldVariant + '.js';
    assert.ok(priorSource.includes(oldBootstrap));
    assert.ok(!priorSource.includes('protected-listening-v2'));
    const currentWorker = demo ? 'offline-worker-preview-verified-v1-protected-listening-v2.js' : workerName;
    const previousWorker = currentWorker.replace('-protected-listening-v2', oldVariant);
    const selectLearner = async (page, exam) => {
      await page.goto(exam.url);
      await page.locator(`#bootstrapStudent option[value="${exam.student}"]`).waitFor({state: 'attached'});
      await page.selectOption('#bootstrapStudent', exam.student);
      await page.click('#confirmIdentity');
      await wait(page, () => window.K56_TERM2_OFFLINE?.record?.ready, 'Local examination package ready');
    };
    const readWorker = page => page.evaluate(() => new URL(navigator.serviceWorker.controller.scriptURL).pathname.split('/').pop());
    const original = await fixture('read_first', {product: 2, demo});
    const {page} = original;
    try {
      original.controls.r2Audio = true;
      original.controls.preparedOverride = {term2ParallelEntry: true};
      await selectLearner(page, original);
      assert.equal(await readWorker(page), currentWorker);
      await page.getByRole('button', {name: 'Bắt đầu Reading', exact: true}).click();
      const answer = 'Draft from the protected build before entry rollback';
      const before = () => page.evaluate(() => {
        const exam = window.K56_TERM2_OFFLINE;
        const {startedAt, deadlineAt} = exam.record.sections.reading;
        return {scope: exam.scope, startedAt, deadlineAt};
      });
      const field = page.locator('#readingQuestions input[data-number]').first();
      await field.fill(answer);
      const scope = await before();

      original.controls.assetOverrides.set(new URL(original.url).pathname, priorSource);
      const second = await original.context.newPage();
      await second.goto(original.url);
      assert.ok(await second.evaluate(name => [...document.scripts].some(script => new URL(script.src, location.href).pathname.endsWith(name)), oldBootstrap));
      if (demo) {
        // A fresh online DEMO tab opens the roster instead of claiming the original tab's saved run.
        await second.locator(`#bootstrapStudent option[value="${original.student}"]`).waitFor({state: 'attached'});
        assert.equal(await second.evaluate(() => Boolean(window.K56_TERM2_OFFLINE?.active)), false);
      } else {
        await second.getByText('Bài đang mở ở tab khác. Hãy quay lại tab đó.', {exact: true}).waitFor();
      }
      assert.equal(await readWorker(page), currentWorker);
      assert.equal(await field.inputValue(), answer);
      await second.close();

      original.disconnected = true;
      await original.context.setOffline(true);
      await page.reload();
      await wait(page, () => window.K56_TERM2_APP_READY, 'Pinned protected package reopened offline');
      assert.equal(await readWorker(page), currentWorker);
      assert.deepEqual(await before(), scope);
      assert.equal(await field.inputValue(), answer);
      assert.deepEqual(original.errors, []);
    } finally {
      await original.close();
    }

    const cold = await fixture('read_first', {product: 2, demo});
    try {
      cold.controls.assetOverrides.set(new URL(cold.url).pathname, priorSource);
      cold.controls.r2Audio = true;
      cold.controls.preparedOverride = {term2ParallelEntry: true};
      await selectLearner(cold.page, cold);
      assert.equal(await readWorker(cold.page), previousWorker);
      await cold.page.getByRole('button', {name: 'Bắt đầu Reading', exact: true}).waitFor();
      assert.deepEqual(cold.errors, []);
      await writeFile(resolve(output, `${route}-entry-rollback.json`), JSON.stringify({
        route, rollbackBase, entryPath: path, entrySha256: createHash('sha256').update(prior).digest('hex'),
        protectedTab: {draftKept: true, scopeKept: true, timerKept: true, offlineRestart: true, worker: currentWorker},
        secondTab: demo ? 'fresh_demo_roster' : 'existing_tab_notice', freshProfileWorker: previousWorker,
      }, null, 2));
    } finally {
      await cold.close();
    }
  });
}
