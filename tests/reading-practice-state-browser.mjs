// Kiểm gate Share bằng HTML/router/store/hub thật và kết quả AI giả, không gọi bên ngoài.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {createHomeworkObservationApp} from './fixtures/homework-observation-app.mjs';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const {chromium}=createRequire(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'))('playwright');
let browser;test.before(async()=>{browser=await chromium.launch({channel:'chrome',headless:true});});test.after(()=>browser?.close());
const until=async check=>{const end=Date.now()+12000;while(Date.now()<end){if(await check())return;await new Promise(r=>setTimeout(r,20));}throw Error('PRACTICE_BROWSER_TIMEOUT');};
for(const width of [1440,390])test(`Share snapshot/current gate, batched state and no redundant practice reads · ${width}px`,{timeout:45000},async t=>{
 const f=await createHomeworkObservationApp({root,fixtureName:'the-desolenator'}),context=await browser.newContext({viewport:{width,height:900},locale:'vi-VN'}),page=await context.newPage();t.after(async()=>{await context.close();await f.close();});page.setDefaultTimeout(12000);
 const errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===f.origin)return route.continue();if(u.pathname.startsWith('/teacher-session-api/')||u.pathname.includes('/shared-session'))return route.fulfill({status:401,json:{ok:false}});if(u.hostname==='accounts.google.com')return route.fulfill({contentType:'application/javascript',body:''});external.push(u.origin+u.pathname);return route.abort();});
 await page.goto(f.origin+'/reading-skills67/the-desolenator/?server=1&attemptId='+f.initial.attemptId);await page.locator('#entry-class').selectOption('1124');await page.locator('#entry-student').selectOption(f.scope.ownerId);await page.getByRole('button',{name:'Vào bài',exact:true}).click();await page.locator('.result-note').waitFor();await page.waitForFunction(()=>window.ReadingSharePractice.isAccepted());
 const old=await f.practice.status(f.scope,f.initial.attemptId);
 await f.db.query("UPDATE reading_listening67.web_share_practice SET status='rejected',outcome=$1,updated_at=now()",[{message:'Cần luyện thêm · thông báo kiểm thử.'}]);const scans=f.hub.snapshot().scans;await until(()=>f.hub.snapshot().scans>scans);assert.equal(await page.evaluate(()=>window.ReadingSharePractice.isAccepted()),true);assert.equal(await page.locator('#practice-share').inputValue(),old.url);
 await page.locator('footer [data-action="edit"]').click();await page.waitForFunction(()=>document.querySelector('.share-practice')?.dataset.state==='rejected');assert.equal(await page.locator('.reading-practice-gate').getAttribute('data-locked'),'true');
 const before=await f.store.draft(f.scope);await assert.rejects(()=>f.store.save(f.scope,{baseRevision:before.revision,mutationId:randomUUID(),body:before.body}),{code:'PRACTICE_NOT_ACCEPTED'});
 await page.evaluate(()=>{window.__practiceSource=document.querySelector('.passage-text');window.__practiceInput=document.querySelector('[data-target]');});
 const link='https://chatgpt.com/share/'+randomUUID();await page.locator('#practice-share').fill(link);await page.locator('#practice-check').click();await page.waitForFunction(()=>document.querySelector('.share-practice')?.dataset.state==='queued');assert.equal(await page.locator('.reading-practice-gate').getAttribute('data-locked'),'true');
 await f.practice.once();await page.waitForFunction(()=>document.querySelector('.reading-practice-gate')?.dataset.locked==='false');assert.equal(await page.evaluate(()=>__practiceSource.isConnected&&__practiceInput===document.querySelector('[data-target]')),true);
 assert.equal((await f.practice.status(f.scope)).url,link);assert.equal((await f.practice.status(f.scope,f.initial.attemptId)).url,old.url);assert.deepEqual((await f.store.draft(f.scope)).body,before.body);
 const start=f.hub.snapshot().scans;await until(()=>f.hub.snapshot().scans>=start+3);assert.equal(f.requests.filter(r=>r.path.endsWith('/practice')&&r.method==='GET').length,0);assert.equal(f.hub.snapshot().connections,1);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
});
