import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {serveDirectory} from './fixtures/static-ui-server.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE));
const matching='67-reading-materials-beyond-concrete-matching-information-nen-cap-1';
const routes=[
 ['materials-beyond-concrete/',matching,16,20],
 ['',matching,16,20],
 ['green-roofs/','67-reading-green-roofs',12,14],
 ['the-desolenator/','67-reading-the-desolenator',12,15],
 ['materials-beyond-concrete-matching-people/','67-reading-materials-to-take-us-beyond-concrete-matching-people',20,25],
 ['athletes-and-stress/','67-reading-athletes-and-stress',23,28],
 ['butterflies-britain-tfng/','67-reading-homework-butterflies-britain-tfng',42,42],
];
const liveBase=process.env.READING_PROGRESS_TEST_BASE;
let site,browser;
test.before(async()=>{
 site=liveBase?{origin:new URL(liveBase).origin,close:async()=>{}}:await serveDirectory(root);
 browser=await chromium.launch({channel:'chrome',headless:true});
});
test.after(async()=>{await browser?.close();await site?.close();});

function fixture(content,minimum,total,teacher){
 const identity={ownerId:'fixture-owner',courseId:'fixture-class',name:'Học viên thử',className:'LỚP THỬ'};
 const answers=Object.fromEntries(content.targets.map(({id})=>[id,'Câu trả lời thử']));
 const draft={body:{answers,annotations:[],flags:[],notes:''},revision:1,savedAt:'2026-11-23T06:00:00Z'};
 let practiceListener;
 const client=window.ReadingServerClient={identity,access:{config:{demo:true}},initialHistory:{attempts:[]},
  state:{status:'saved',completeness:{filled_cells:total,total_cells:total,minimum_required:minimum}},
  initialize:async()=>({content,identity,draft,teacher,history:[],config:{demo:true}}),
  watchPractice(_attemptId,onChange){practiceListener=onChange;onChange({status:'not_started'});return ()=>{};},
  flush:async()=>{},
  schedule(){client.state.status='dirty';window.dispatchEvent(new Event('reading67:server-state'));return true;},
 };
 window.setReadCount=count=>{client.state.status='saved';client.state.completeness.filled_cells=count;window.dispatchEvent(new Event('reading67:server-state'));};
 window.setReadPractice=status=>practiceListener({status});
}

async function open(t,slug,id,minimum,total,width,teacher=false){
 const {content}=JSON.parse(await fs.readFile(path.join(root,'homework-demo','data',`${id}.json`),'utf8'));
 const context=await browser.newContext({viewport:{width,height:800}}),page=await context.newPage();
 t.after(()=>context.close());page.setDefaultTimeout(6500);
 const errors=[],writes=[];page.on('pageerror',error=>errors.push(error.message));
 await context.route('**/*',route=>{
  const req=route.request(),url=new URL(req.url());
  if(req.method()!=='GET'){writes.push(url.pathname);return route.abort();}
  if(url.origin!==site.origin)return route.abort();
  if(url.pathname.endsWith('/api-config.js'))return route.fulfill({body:'',contentType:'text/javascript'});
  if(url.pathname.endsWith('/web-client.js'))return route.fulfill({contentType:'text/javascript',body:`(${fixture})(${JSON.stringify(content)},${minimum},${total},${teacher})`});
  return route.continue();
 });
 await page.goto(`${liveBase||site.origin+'/reading-skills67/'}${slug}?server=1`);
 await page.locator('[data-target]').first().waitFor({state:'attached'});
 return {page,label:page.locator('#progress-label'),errors,writes};
}

for(const [slug,id,minimum,total] of routes.slice(0,5))for(const width of [320,1440]){
 test(`${slug||'Materials legacy'} · ${width}px · ngưỡng và tối đa`,async t=>{
  const {page,label,errors,writes}=await open(t,slug,id,minimum,total,width);
  const gate=page.locator('.reading-practice-gate');
  if(slug==='the-desolenator/'){
   assert.equal(await gate.getAttribute('data-locked'),'true');
   assert.equal(await page.locator('#grade-button').isDisabled(),true);
   assert.equal(await label.textContent(),`Đã điền đủ ${total}/${total} mục. Hoàn thành bài luyện ChatGPT để nộp bài.`);
   const content=page.locator('.reading-practice-content'),before=await content.elementHandle();
   await page.evaluate(()=>{window.setReadPractice('queued');window.setReadPractice('processing');window.setReadPractice('rejected');});
   assert.equal(await label.textContent(),`Đã điền đủ ${total}/${total} mục. Hoàn thành bài luyện ChatGPT để nộp bài.`);
   await page.evaluate(()=>window.setReadPractice('accepted'));
   assert.equal(await page.locator('#grade-button').isEnabled(),true);
   assert.equal(await label.textContent(),`Đã điền đủ ${total}/${total} mục. Bạn có thể nộp bài để chấm.`);
   assert.equal(await content.evaluate((node,original)=>node===original,before),true);
  }
  await page.evaluate(count=>window.setReadCount(count),minimum-2);
  assert.equal(await label.innerText(),`Đã điền ${minimum-2}/${total} mục. Cần điền thêm 2 mục để nộp bài.`);
  await page.evaluate(count=>window.setReadCount(count),minimum);
  assert.equal(await label.innerText(),`Đã điền ${minimum}/${total} mục. Bạn có thể nộp bài để chấm.`);
  await page.evaluate(count=>window.setReadCount(count),total);
  assert.equal(await label.innerText(),`Đã điền đủ ${total}/${total} mục. Bạn có thể nộp bài để chấm.`);
  assert.equal(await page.locator('.minimum-note').filter({hasText:/Đủ \d+\/\d+ phần.*gửi chấm/}).count(),0);
  const field=page.locator('textarea[data-target]').first();
  if(!await field.isVisible()){
   const pane=await field.evaluate(el=>el.closest('.study-pane').id.replace('pane-',''));
   await page.locator(`button[data-pane="${pane}"]`).click();
  }
  await field.fill('');
  assert.equal(await label.innerText(),`Đã điền ${total-1}/${total} mục. Bạn có thể nộp bài để chấm.`);
  await field.fill('Đã khôi phục');
  assert.equal(await label.innerText(),`Đã điền đủ ${total}/${total} mục. Bạn có thể nộp bài để chấm.`);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  if(width===320)assert.ok((await label.boundingBox()).width>250);
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
 });
}

test('Giảng viên giữ màn xem tiến độ',async t=>{
 const [slug,id,minimum,total]=routes[3],{page,label}=await open(t,slug,id,minimum,total,1440,true);
 assert.equal(await label.textContent(),`Đã điền ${total}/${total} phần`);
 assert.equal(await page.locator('#grade-button').count(),0);
});

for(const [slug,id,minimum,total] of routes.slice(5))test(`${slug} · giữ thông báo hiện có`,async t=>{
 const {page,label}=await open(t,slug,id,minimum,total,320);
 const expected=total===42?'Đã điền 42/42 phần':'Đã điền đủ 28/28 mục. Bạn có thể nộp bài để chấm.';
 assert.equal(await label.textContent(),expected);
 if(total===42)assert.match(await page.locator('.minimum-note').textContent(),/42 trường trả lời/);
});
