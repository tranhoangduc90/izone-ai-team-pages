import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import test from 'node:test';
import {serveDirectory} from './fixtures/static-ui-server.mjs';

const {chromium} = createRequire(resolve(process.env.USERPROFILE,
  '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'))('playwright');
const numbers = [3,4,5,7,9,11,13,15];
const base = 'https://ducizone.ddns.net/api/handout67/v1';

async function fixture(t, mode) {
  const site = await serveDirectory(resolve(import.meta.dirname,'..'));
  const browser = await chromium.launch({channel:'chrome',headless:true});
  t.after(async()=>{await browser.close();await site.close();});
  const page = await browser.newPage({viewport:{width:1440,height:900}});
  page.setDefaultTimeout(8000);
  const calls = [];
  await page.addInitScript(()=>{
    Object.defineProperty(navigator.clipboard,'writeText',{value:async value=>{window.testCopiedLink=value;}});
  });
  await page.context().route('**/*', async route=>{
    const request=route.request(), url=new URL(request.url());
    if (url.origin===site.origin) return route.continue();
    const headers={'access-control-allow-origin':site.origin,'access-control-allow-credentials':'true'};
    const send=(json,status=200)=>route.fulfill({status,headers,json});
    if (!url.href.startsWith(base)) return route.abort();
    const path=url.pathname.slice(new URL(base).pathname.length);
    calls.push(path);
    if(path==='/teacher/session')return mode==='forbidden'?send({ok:false},403):send({ok:true,reviewer:{email:'teacher@example.test'}});
    const number=Number((path.split('/').at(-1).match(/^lesson(\d+)$/)||url.searchParams.get('activity')?.match(/^lesson(\d+)$/))?.[1]);
    const classA={classRef:'IC2304',className:'IC2304',studentCount:16};
    const classB={classRef:'IC2363',className:'IC2363',studentCount:8};
    if(path==='/teacher/classes')return number===13&&mode==='partial'?send({ok:false},503):send({ok:true,classes:number===4?[classB]:number===5?[classA,classB]:[classA]});
    if(path==='/teacher/students')return send({ok:true,students:[]});
    if(numbers.includes(number))return send({ok:true,lesson:{activity:'lesson'+number,number,title:'Đề buổi '+number,topic:'Writing prompt for Lesson '+number,body:2,
      classes:number===4?['IC2363']:number===5||number===7?['IC2304','IC2363']:['IC2304'],...(number===4?{outlineOnly:true,rosterScope:'lesson'}:{})}});
    return send({ok:false},404);
  });
  await page.goto(site.origin+'/writing-handouts/library67.html?class=IC2363');
  return {page,calls,site};
}

test('K67 library keeps the reference layout and routes by lesson-specific teacher access',async t=>{
  const {page,site}=await fixture(t,'partial');
  const cards=page.locator('.handout-card');
  await cards.first().waitFor();
  assert.deepEqual(await cards.evaluateAll(nodes=>nodes.map(card=>card.dataset.activity)),numbers.map(n=>'lesson'+n));
  assert.equal(await page.locator('#class-select').inputValue(),'IC2363');
  const lesson4=page.locator('[data-activity=lesson4]');
  const lesson5=page.locator('[data-activity=lesson5]');
  assert.equal(await lesson4.getByRole('button',{name:'Sao chép link học viên'}).count(),0);
  assert.match(await lesson4.innerText(),/Homework Docs/);
  assert.equal(await page.locator('[data-activity=lesson7]').getByRole('button',{name:'Xem dashboard'}).isEnabled(),false);
  assert.match(await page.locator('[data-activity=lesson7]').innerText(),/Chưa có quyền/);
  assert.equal(await page.locator('#retry-catalog').isVisible(),true);
  assert.equal((await page.locator('.library-shell').boundingBox()).width,1080);
  await lesson5.getByRole('button',{name:'Sao chép link học viên'}).click();
  assert.equal(await page.evaluate(()=>window.testCopiedLink),site.origin+'/writing-handouts/lesson5/?class=IC2363');
  const libraryUrl=page.url();
  const [handout]=await Promise.all([
    page.context().waitForEvent('page',{timeout:8000}),
    lesson5.getByRole('button',{name:'Xem handout'}).click(),
  ]);
  await handout.waitForURL('**/lesson5/?class=IC2363');
  assert.equal(page.url(),libraryUrl);
  await handout.close();
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth),true);
  const [dashboard]=await Promise.all([
    page.context().waitForEvent('page',{timeout:8000}),
    lesson4.getByRole('button',{name:'Xem dashboard'}).click(),
  ]);
  await dashboard.waitForURL('**/lesson4/dashboard.html?class=IC2363');
  await dashboard.locator('#dashboard').waitFor();
  assert.equal(await dashboard.locator('#class-select').inputValue(),'IC2363');
  assert.equal(await dashboard.locator('body').getAttribute('data-handout-read-only'),'true');
  assert.equal(page.url(),libraryUrl);
  assert.equal(await page.locator('#class-select').inputValue(),'IC2363');
  assert.equal(await page.evaluate(()=>window.opener===null),true);
  assert.equal(await dashboard.evaluate(()=>window.opener===null),true);
});

test('K67 library does not request class data or show sign-in for a forbidden teacher',async t=>{
  const {page,calls}=await fixture(t,'forbidden');
  await page.getByRole('button',{name:'Thử lại',exact:true}).waitFor();
  assert.deepEqual(calls,['/teacher/session']);
  assert.equal(await page.locator('#library-content').isVisible(),false);
  assert.equal(await page.locator('#google-signin').isVisible(),false);
});
