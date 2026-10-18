// Hai tab thật dùng cùng bộ nhớ/IndexedDB trên localhost, không có API hoặc audio.
// Kiểm ghi đồng thời, quên/ghi cạnh tranh và hết thời gian chờ không ghi muộn.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const origin = process.env.IDENTITY_LOCAL_ORIGIN || 'http://127.0.0.1:8877';
assert.equal(new URL(origin).hostname, '127.0.0.1');
const out = process.env.IDENTITY_EVIDENCE_DIR; assert.ok(out); await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true }), results = [];
async function setup() {
  const ctx = await browser.newContext({ serviceWorkers: 'block' }), errors = [], requests = [];
  await ctx.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === origin && (url.pathname === '/preview/status' || url.pathname === '/shared/student-identity.js')) return route.continue();
    requests.push(url.pathname); return route.abort();
  });
  ctx.on('page', page => page.on('pageerror', e => errors.push(e.message)));
  const pages = await Promise.all([ctx.newPage(), ctx.newPage()]);
  for (const page of pages) { await page.goto(origin + '/preview/status');
    await page.evaluate(async () => { window.memory = (await import('/shared/student-identity.js?v=20261018-identity-v1')).createStudentIdentityMemory(); }); }
  return { ctx, pages, errors, requests };
}
async function run(name, fn) {
  const s = await setup();
  try { await fn(s.pages); assert.deepEqual(s.errors, []); assert.deepEqual(s.requests, []);
    results.push({ case: name, status: 'passed' }); console.log('Đạt:', name);
  } catch (e) { results.push({ case: name, status: 'failed', error: e.message, errors: s.errors }); throw e; }
  finally { await s.ctx.close(); }
}
try {
  await run('two-tabs-one-revision-only-one-writer-wins', async ([a,b]) => {
    const values = await Promise.all([a.evaluate(() => memory.rememberAtomic({ authority:'erp-contact', id:'900001' },null)),
      b.evaluate(() => memory.rememberAtomic({ authority:'erp-contact', id:'900002' },null))]);
    assert.deepEqual(values.map(v=>v.status).sort(),['conflict','ok']);
    const winner=values.find(v=>v.status==='ok');
    assert.equal((await a.evaluate(()=>memory.read())).identity.id,winner.identity.id);
    assert.equal((await b.evaluate(()=>memory.read())).revision,winner.revision);
  });
  await run('forget-vs-new-person-cannot-both-commit-old-revision', async ([a,b]) => {
    const previous=await a.evaluate(()=>memory.rememberAtomic({authority:'erp-contact',id:'900001'},null));
    const values=await Promise.all([a.evaluate(rev=>memory.forgetAtomic(rev),previous.revision),
      b.evaluate(rev=>memory.rememberAtomic({authority:'erp-contact',id:'900002'},rev),previous.revision)]);
    assert.equal(values.filter(v=>['ok','empty'].includes(v.status)).length,1);
    assert.equal(values.filter(v=>v.status==='conflict').length,1);
    const stored=await a.evaluate(()=>memory.read());
    assert.equal(['empty','ok'].includes(stored.status),true);assert.notEqual(stored.revision,previous.revision);
  });
  await run('queued-writer-timeout-does-not-write-after-release', async ([a,b]) => {
    const previous=await a.evaluate(()=>memory.rememberAtomic({authority:'erp-contact',id:'900001'},null));
    await a.evaluate(async()=>{
      const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('izone-student-identity-coordination-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
      window.releaseGate=false;
      const tx=db.transaction('writer','readwrite'),store=tx.objectStore('writer');
      tx.oncomplete=()=>db.close();
      window.gateReady=new Promise(resolve=>{const spin=()=>{store.get('gate').onsuccess=()=>{resolve();if(!window.releaseGate)spin();};};spin();});
      await window.gateReady;
    });
    const result=await b.evaluate(rev=>memory.rememberAtomic({authority:'erp-contact',id:'900002'},rev),previous.revision);
    assert.equal(result.status,'unavailable');
    await a.evaluate(()=>{window.releaseGate=true;});
    const current=await b.evaluate(()=>memory.read());assert.equal(current.identity.id,'900001');assert.equal(current.revision,previous.revision);
    const next=await b.evaluate(rev=>memory.rememberAtomic({authority:'erp-contact',id:'900002'},rev),previous.revision);
    assert.equal(next.status,'ok');
  });
} finally { await writeFile(path.join(out,'results.json'),JSON.stringify(results,null,2),'utf8');await browser.close(); }
