import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const backend=process.argv[2];
if(!backend)throw new Error('Cần đường dẫn package backend K67 để kiểm SQL thật.');
const {createMiniFixture}=await import(pathToFileURL(resolve(backend,'test/helpers/mini-answer-sheet-fixture.js')));
const require=createRequire('file:///C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const root=fileURLToPath(new URL('..',import.meta.url));
const fixture=await createMiniFixture();
const api=createServer(fixture.app);
const web=createServer(async(req,res)=>{try{
  let p=new URL(req.url,'http://localhost').pathname;if(p.endsWith('/'))p+='index.html';
  const f=resolve(root,'.'+p);if(!f.startsWith(resolve(root)))throw new Error('outside');
  res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html'})[extname(f)]||'text/plain');res.end(await readFile(f));
}catch{res.writeHead(404).end();}});
await Promise.all([new Promise(r=>api.listen(0,'127.0.0.1',r)),new Promise(r=>web.listen(0,'127.0.0.1',r))]);
const apiBase=`http://127.0.0.1:${api.address().port}`;
const webBase=`http://127.0.0.1:${web.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'});
const context=await browser.newContext({viewport:{width:390,height:844}});
const page=await context.newPage();const errors=[];let offlineDraft=false;
page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
// Chỉ đổi địa chỉ API về fixture local; body, SQL, chấm điểm và readback chạy thật.
await page.route('**/api/**',async route=>{
  if(process.env.MINI_DEBUG)console.log('Fixture request:',route.request().method(),route.request().url());
  if(offlineDraft&&route.request().url().endsWith('/draft'))return route.abort('internetdisconnected');
  const response=await fetch(apiBase+route.request().url().slice(route.request().url().indexOf('/api/')),
    {method:route.request().method(),headers:{'Content-Type':'application/json',origin:'https://tranhoangduc90.github.io'},
      body:route.request().postData()||undefined,signal:AbortSignal.timeout(5000)});
  const body=await response.text();
  if(response.status>=400)console.error('Fixture API:',route.request().method(),new URL(route.request().url()).pathname,response.status,body);
  await route.fulfill({status:response.status,contentType:'application/json',body});
});
await page.clock.install({time:new Date('2026-10-07T02:00:00Z')});
const out=process.env.MINI_EVIDENCE_DIR||resolve(root,'.local-evidence');
await mkdir(out,{recursive:true});
const first='11111111-1111-4111-8111-111111111111';const second='44444444-4444-4444-8444-444444444444';
async function enter(ref){await page.locator('#studentSelect').selectOption(ref);await page.locator('#miniEnter').click();await page.getByRole('button',{name:'Xác nhận, tiếp tục',exact:true}).click();}
try{
  await page.goto(webBase+'/term-tests/mini-test-lesson-5/');
  await page.locator('#miniClass').selectOption('IC2304');
  await page.locator('#studentSelect option[value="'+first+'"]').waitFor({state:'attached'});
  assert.equal(await page.locator('#listeningView').isVisible(),false);
  await page.screenshot({path:resolve(out,'mini-login-mobile.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await enter(first);await page.locator('#listeningView').waitFor({state:'visible'});
  await page.locator('#listeningQuestions [data-number="11"]').selectOption('A');
  await page.locator('#submitListening').click();await page.locator('#listeningSavedView').waitFor({state:'visible'});
  await page.locator('#startReading').click();await page.locator('#readingView').waitFor({state:'visible'});
  const field=page.locator('#readingQuestions [data-number="24"]');
  await field.fill('A');
  // Giả lập mất mạng khi lưu nháp; tải lại phải lấy lại bản local cùng chủ/lượt.
  offlineDraft=true;await page.clock.fastForward(5000);await page.reload();
  await page.locator('#studentSelect').waitFor({state:'visible'});await enter(first);
  await page.locator('#readingView').waitFor({state:'visible'});assert.equal(await field.inputValue(),'A');
  offlineDraft=false;await field.fill('A');await page.clock.runFor(6000);
  await page.locator('#readingSaveStatus').filter({hasText:'Đã lưu trên hệ thống'}).waitFor({state:'visible'});
  assert.equal((await fixture.db.query('SELECT reading_draft FROM assessment.term_test_attempt')).rows[0].reading_draft[24],'A');
  await page.clock.fastForward(2*60*60*1000);
  const unfinished=(await fixture.db.query('SELECT * FROM assessment.term_test_attempt')).rows[0];
  assert.equal(unfinished.completed_at,null);assert.equal(unfinished.reading_deadline_at,null);
  assert.equal(await field.isEnabled(),true);
  await page.screenshot({path:resolve(out,'mini-reading-mobile.png'),fullPage:true});
  await page.locator('#submitReading').click();await page.locator('#resultReadyView').waitFor({state:'visible'});
  await page.locator('#viewResult').click();await page.locator('#resultView').waitFor({state:'visible'});
  const saved=(await fixture.db.query('SELECT * FROM assessment.term_test_attempt')).rows[0];
  assert.equal(saved.reading_answers[24],'A');assert.ok(saved.completed_at);assert.equal(saved.reading_result.correct,1);
  await page.getByRole('button',{name:'Đổi người học',exact:true}).click();await enter(second);
  await page.locator('#listeningView').waitFor({state:'visible'});
  assert.equal(await page.locator('#listeningQuestions [data-number="11"]').inputValue(),'');
  await page.getByRole('button',{name:'Đổi người học',exact:true}).click();await enter(first);
  await page.locator('#resultView').waitFor({state:'visible'});
  assert.equal((await fixture.db.query('SELECT count(*) FROM assessment.term_test_attempt')).rows[0].count,1);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({ok:true,checks:['login-mobile','manual-listening','offline-reading-reload','two-hours-no-auto-submit','manual-reading-db-readback','change-user-no-draft-leak','completed-read-only-resume'],screenshots:out}));
}finally{await context.close();await browser.close();await Promise.all([new Promise(r=>api.close(r)),new Promise(r=>web.close(r))]);await fixture.db.close();}
