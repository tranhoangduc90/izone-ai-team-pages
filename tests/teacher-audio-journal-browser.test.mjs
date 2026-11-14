import assert from 'node:assert/strict';
import test from 'node:test';
import {pathToFileURL} from 'node:url';
import {serve} from './helpers/result-details-browser-fixture.mjs';

const playwright = process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright';
const {chromium} = await import(playwright);
const slug='term-test-1-k56';
const student={ref:'b90bba62-4c1f-41cc-800f-55522d781d1a',name:'Học viên giả A'};
const state={found:true,occupied:true,canReleasePreparation:false,canTransferActive:true,
  answeredCount:3,draftRevision:9,checkpointSeconds:25,startedAt:'2026-11-14T03:00:00Z',version:'a'.repeat(64)};
const privateReason='Lý do thử không vào log';

async function fixture(t){
  const server=await serve();
  const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'msedge',headless:true});
  t.after(async()=>{await browser.close();await server.close();});
  const context=await browser.newContext({serviceWorkers:'block'});
  const page=await context.newPage();
  const origin=process.env.TEACHER_AUDIO_PUBLIC_BASE||server.base;
  const entry=new URL('term-tests/teacher-k56/',origin).href;
  const module=new URL('term-tests/shared/teacher-audio-recovery.js?v=20261026-v1&resilience=20261027-v1&journal=20261114-v1',origin).href;
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('dialog',dialog=>dialog.accept());
  await context.route('**/*',route=>{
    const url=route.request().url();
    return url===entry||url===module?route.continue():route.abort();
  });
  assert.equal((await page.goto(entry)).status(),200);
  await page.evaluate(async({module,state,student,slug})=>{
    const {clearTeacherAudioRecovery,openTeacherAudioRecovery,readTeacherAudioJournal}=await import(module);
    window.fixture={posts:[],current:true,mode:'timeout',read:readTeacherAudioJournal,close:clearTeacherAudioRecovery};
    openTeacherAudioRecovery({student,className:'IC9999',testSlug:slug,isCurrent:()=>window.fixture.current,request:async(path,options)=>{
      if(!options)return {ok:true,state};
      fixture.posts.push(JSON.parse(options.body));
      if(fixture.mode==='pending')return new Promise(resolve=>{fixture.resolve=resolve;});
      if(fixture.mode==='denied'){
        fixture.current=false;
        throw Object.assign(Error('fixture access revoked'),{status:403});
      }
      if(fixture.mode==='timeout')throw Error('fixture response lost');
      return {ok:true,recovered:true,replayed:true,state:{...state,canTransferActive:false}};
    }});
  },{module,state,student,slug});
  await page.getByRole('button',{name:'Hỗ trợ chuyển thiết bị'}).waitFor();
  await page.locator('#audioRecoveryReason').fill(privateReason);
  await page.locator('#audioRecoveryStopped').check();
  return {page,errors,read:()=>page.evaluate(()=>fixture.read())};
}

test('Mất ACK và tra lại dùng cùng mã hỗ trợ, bỏ dữ liệu riêng khỏi log',async t=>{
  const f=await fixture(t);
  await f.page.getByRole('button',{name:'Hỗ trợ chuyển thiết bị'}).click();
  const retry=f.page.getByRole('button',{name:'Kiểm tra lại thao tác vừa gửi'});
  await retry.waitFor();
  await f.page.evaluate(()=>fixture.mode='replay');
  await retry.click();
  await f.page.getByText('Đã lưu thao tác hỗ trợ.',{exact:false}).waitFor();
  const log=await f.read();
  assert.deepEqual(log.map(row=>row.outcome),['read_requested','read_confirmed','action_requested','action_unconfirmed','action_retried','action_replayed']);
  const posts=await f.page.evaluate(()=>fixture.posts);
  assert.equal(posts.length,2);
  assert.deepEqual(posts[0],posts[1]);
  assert.deepEqual([...new Set(log.filter(row=>row.requestId).map(row=>row.requestId))],[posts[0].requestId]);
  assert.ok(log.every(row=>row.testSlug===slug));
  for(const value of [student.ref,student.name,privateReason,'IC9999'])assert.ok(!JSON.stringify(log).includes(value));
  assert.deepEqual(f.errors,[]);
});

test('Thiếu quyền có mốc 403 dù phiên bị ẩn, không báo đã lưu',async t=>{
  const f=await fixture(t);
  await f.page.evaluate(()=>fixture.mode='denied');
  await f.page.getByRole('button',{name:'Hỗ trợ chuyển thiết bị'}).click();
  await f.page.waitForFunction(()=>fixture.read().some(row=>row.outcome==='action_denied'));
  const row=(await f.read()).at(-1);
  assert.equal(row.status,403);assert.equal(row.outcome,'action_denied');
  assert.equal(await f.page.getByText('Đã lưu thao tác hỗ trợ.',{exact:false}).count(),0);
  assert.deepEqual(f.errors,[]);
});

test('Phản hồi cũ không áp dụng sau khi phạm vi thay đổi',async t=>{
  const f=await fixture(t);
  await f.page.evaluate(()=>fixture.mode='pending');
  await f.page.getByRole('button',{name:'Hỗ trợ chuyển thiết bị'}).click();
  await f.page.waitForFunction(()=>fixture.resolve);
  await f.page.evaluate(state=>{
    fixture.current=false;
    fixture.resolve({ok:true,recovered:true,state});
  },state);
  await f.page.waitForFunction(()=>fixture.read().some(row=>row.outcome==='response_stale'));
  assert.equal((await f.read()).at(-1).requestId,(await f.page.evaluate(()=>fixture.posts[0])).requestId);
  assert.equal(await f.page.getByText('Đã lưu thao tác hỗ trợ.',{exact:false}).count(),0);
  assert.deepEqual(f.errors,[]);
});
