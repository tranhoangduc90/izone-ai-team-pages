import {fixture,wait} from './term2-offline-browser.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';
const output=process.env.TERM2_EVIDENCE;assert.ok(output);
for(const mode of ['lis_first','read_first'])test('Term 1 offline/phục hồi/tải file: '+mode,{timeout:180000},async()=>{
 const f=await fixture(mode,{product:1}),p=f.page;
 try{
  await p.goto(f.url);await p.locator('#bootstrapStudent option[value="'+f.student+'"]').waitFor({state:'attached'});
  await p.selectOption('#bootstrapStudent',f.student);await p.click('#confirmIdentity');
  await wait(p,()=>window.K56_TERM1_OFFLINE?.active,'Chuẩn bị offline');
  assert.equal(f.calls.filter(x=>x.includes('cloudflare')).length,0);
  f.disconnected=true;await f.context.setOffline(true);
  if(mode==='lis_first'){
   await p.click('#bootstrapPreview');await p.waitForTimeout(11000);await p.click('#bootstrapStart');
   await wait(p,()=>window.K56_TERM1_APP_READY&&window.K56_LISTENING_AUDIO,'Màn Listening sẵn sàng');
   await p.locator('#listeningQuestions input[data-number]').first().fill('answer kept offline');await p.locator('.cbt-part-button').filter({hasText:'Part 4'}).click();await p.locator('[data-number="32a"]').fill('pair a');await p.locator('[data-number="32b"]').fill('pair b');assert.equal(await p.locator('#listeningQuestions [data-number]').count(),41);
   const before=await p.evaluate(()=>window.K56_TERM1_OFFLINE.player.currentTime);await p.waitForTimeout(2200);
   const after=await p.evaluate(()=>window.K56_TERM1_OFFLINE.player.currentTime);assert.ok(after>before+1,'Audio không tiến khi mất mạng');
   await p.evaluate(()=>window.K56_TERM1_OFFLINE.player.dispatchEvent(new Event('error')));
   await p.waitForTimeout(1000);assert.equal(await p.locator('#listeningView').isVisible(),true);assert.equal(await p.evaluate(()=>window.K56_TERM1_OFFLINE.record.sections.listening.sealed),false);
   const decision=await p.evaluate(()=>window.K56_LISTENING_AUDIO.beforeAutoSubmit());assert.equal(decision.submit,false);
   await p.reload();await wait(p,()=>window.K56_TERM1_APP_READY&&window.K56_TERM1_OFFLINE.playerReady,'Reload Listening offline');
   const heldPosition=await p.evaluate(()=>window.K56_TERM1_OFFLINE.player.currentTime);await p.waitForTimeout(2200);assert.equal(await p.evaluate(()=>window.K56_TERM1_OFFLINE.player.paused),true);assert.ok(Math.abs(await p.evaluate(()=>window.K56_TERM1_OFFLINE.player.currentTime)-heldPosition)<.2);
   assert.equal(await p.locator('#listeningQuestions input[data-number]').first().inputValue(),'answer kept offline');assert.equal(await p.locator('[data-number="32a"]').inputValue(),'pair a');assert.equal(await p.locator('[data-number="32b"]').inputValue(),'pair b');
   await p.click('#submitListening');await p.click('#startReading');
  } else {await wait(p,()=>window.K56_TERM1_APP_READY,'Reading trước ready');await p.getByRole('button',{name:'Bắt đầu Reading',exact:false}).first().click();}
  assert.equal(await p.locator('#readingQuestions [data-number]').count(),26);await p.locator('#readingQuestions input[data-number]').first().fill('reading kept offline');
  await p.reload();await wait(p,()=>window.K56_TERM1_APP_READY,'Reload Reading offline');
  assert.equal(await p.locator('#readingQuestions input[data-number]').first().inputValue(),'reading kept offline');
  await p.click('#submitReading');
  if(mode==='read_first'){
   await p.waitForTimeout(500);await wait(p,()=>Boolean(document.getElementById('bootstrapPreview')),'Phòng nghe sau Reading');
   await p.click('#bootstrapPreview');await p.waitForTimeout(11000);await p.click('#bootstrapStart');
   await wait(p,()=>window.K56_TERM1_APP_READY&&window.K56_TERM1_OFFLINE.playerReady,'Listening sau Reading');await p.click('#submitListening');
  }
  await p.click('#startWriting');await wait(p,()=>!document.getElementById('writingView').hidden,'Writing bắt đầu offline');
  assert.equal(await p.locator('textarea[data-writing-outline]:not([readonly])').count(),0);
  await p.locator('[data-writing-task="task2"]').fill('Unicode giữ bài — <script>alert(1)</script>\nNew paragraph.');
  const d=p.waitForEvent('download');await p.getByRole('button',{name:'Tải bài làm về máy'}).click();const download=await d;
  const file=resolve(output,mode+'-answer.html');await download.saveAs(file);const html=await readFile(file,'utf8');assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('fixture-permit'));
  await p.reload();await wait(p,()=>window.K56_TERM1_APP_READY,'Reload Writing offline');assert.ok((await p.locator('[data-writing-task="task2"]').inputValue()).includes('Unicode giữ bài'));
  // Kiểm bài trắng: xóa có chủ đích, nộp và xác nhận theo quy tắc 0; không có endpoint AI.
  await p.locator('[data-writing-task="task2"]').fill('');await p.click('#submitWriting');
  await wait(p,()=>window.K56_TERM1_OFFLINE.record.sections.writing?.sealed,'Khóa Writing offline');
  await p.screenshot({path:resolve(output,mode+'-pending.png'),fullPage:true});
  assert.ok(await p.evaluate(()=>window.K56_TERM1_OFFLINE.pending)>0);
  f.disconnected=false;await f.context.setOffline(false);await p.evaluate(()=>{window.K56_TERM1_OFFLINE.retryAt=0;return window.K56_TERM1_OFFLINE.flush();});
  await wait(p,()=>window.K56_TERM1_OFFLINE.pending===0,'Gửi lại đủ operation');
  assert.equal(f.calls.some(x=>x.includes('writing-grading')),false);
  await writeFile(resolve(output,mode+'-result.json'),JSON.stringify({mode,calls:f.calls,errors:f.errors,receipts:[...f.receipts.values()]},null,2));
  assert.deepEqual(f.errors,[]);
 }catch(e){console.error('BROWSER_FAILURE',mode,e.message,JSON.stringify(f.errors));await p.screenshot({path:resolve(output,mode+'-failure.png'),fullPage:true});throw e;}
 finally{await f.close();}
});
