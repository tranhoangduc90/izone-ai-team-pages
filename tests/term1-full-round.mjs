// Hai lượt đủ audio thật + 60 phút Reading + 30 phút Writing. Chỉ API/danh tính giả.
// Không tua gần EOF hoặc rút giờ trong runner này; các runner ngắn kiểm nhánh riêng.
import {fixture,wait} from './term2-offline-browser.mjs';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const output=process.env.TERM2_EVIDENCE;assert.ok(output);
process.env.TERM2_FIXTURE_IMPORT_ONLY='1';
const {pathToFileURL}=await import('node:url');
const {fixture:nativeFixture}=await import(pathToFileURL(process.env.TERM2_NATIVE_FIXTURE));
const {completeFakeResult}=await import(pathToFileURL(process.env.K56_FAKE_GRADING));
await mkdir(output,{recursive:true});
const manifest=await readFile(new URL('../term-tests/term-test-1-k56-computer-based/offline-assets.mjs',import.meta.url));
const sourceSha256=createHash('sha256').update(manifest).digest('hex');
await writeFile(resolve(output,'source.json'),JSON.stringify({pid:process.pid,sourceSha256,startedAt:new Date().toISOString()},null,2));
async function round(mode){
 const native=await nativeFixture(mode,{skipPrepare:true,realtime:true}),f=await fixture(mode,{product:1,native}),p=f.page,offline=mode==='read_first',started=Date.now(),timeline=[];let timer;
 const record=async(stage,extra={})=>{timeline.push({at:new Date().toISOString(),stage,...extra});await writeFile(resolve(output,mode+'-full-progress.json'),JSON.stringify({mode,offline,sourceSha256,startedAt:new Date(started).toISOString(),timeline},null,2));};
 try{
  await p.goto(f.url);await p.locator('#bootstrapStudent option[value="'+f.student+'"]').waitFor({state:'attached'});await p.selectOption('#bootstrapStudent',f.student);await p.click('#confirmIdentity');
  await wait(p,()=>window.K56_TERM1_OFFLINE?.active,'Ready full');await record('ready');
  if(offline){f.disconnected=true;await f.context.setOffline(true);}
  timer=setInterval(async()=>{try{const state=await p.evaluate(()=>({section:window.K56_TERM1_OFFLINE?.sectionResponse().nextSection,position:window.K56_TERM1_OFFLINE?.player?.currentTime,pending:window.K56_TERM1_OFFLINE?.pending}));await record('progress',state);}catch{}},60000);timer.unref();
  const order=mode==='read_first'?['reading','listening','writing']:['listening','reading','writing'];
  for(const skill of order){
   if(skill==='listening'){
    await p.click('#bootstrapPreview');await p.waitForTimeout(11000);await p.click('#bootstrapStart');await wait(p,()=>window.K56_TERM1_APP_READY&&window.K56_TERM1_OFFLINE.playerReady,'Listening full');
    await p.locator('#listeningQuestions input[data-number]').first().fill('full duration listening');await record('listening_started');
    await wait(p,()=>window.K56_TERM1_OFFLINE.record.sections.listening?.sealed,'Listening ended and auto sealed',2000000);
    const observed=await p.evaluate(()=>window.K56_TERM1_OFFLINE.record.player);assert.ok(observed.ended);assert.ok(observed.position>1846);await record('listening_naturally_finished',observed);
   }else if(skill==='reading'){
    if(mode==='read_first')await wait(p,()=>window.K56_TERM1_APP_READY,'Reading layout full');
    const button=mode==='read_first'?p.getByRole('button',{name:'Bắt đầu Reading',exact:false}).first():p.locator('#startReading');await button.click();await record('reading_started');
    await p.locator('#readingQuestions input[data-number]').first().fill('full duration reading');
    if(offline){await p.waitForTimeout(5000);await p.reload();await wait(p,()=>window.K56_TERM1_APP_READY,'Reading restored full');assert.equal(await p.locator('#readingQuestions input[data-number]').first().inputValue(),'full duration reading');await record('reading_restored');}
    await wait(p,()=>window.K56_TERM1_OFFLINE.record.sections.reading?.sealed,'Reading auto sealed after 40 minutes',2500000);await record('reading_finished');
    if(mode==='read_first')await wait(p,()=>Boolean(document.getElementById('bootstrapPreview')),'Listening lobby after full reading');
   }else{
    await p.click('#startWriting');await record('writing_started');
    // Bài trắng được nộp tự động theo hạn; kết quả 0 được kiểm qua SQL runner riêng.
    assert.equal(await p.locator('[data-writing-task="task2"]').inputValue(),'');if(offline)await p.locator('[data-writing-task="task2"]').fill('A canonical Task 2 answer kept throughout the full Writing duration.');
    await wait(p,()=>window.K56_TERM1_OFFLINE.record.sections.writing?.sealed,'Writing auto sealed after 55 minutes',3400000);await record('writing_finished');
   }
  }
  f.disconnected=false;await f.context.setOffline(false);await p.evaluate(()=>{window.K56_TERM1_OFFLINE.retryAt=0;return window.K56_TERM1_OFFLINE.flush();});
  await wait(p,()=>window.K56_TERM1_OFFLINE.pending===0,'Full sync');await record('synced',{receipts:f.receipts.size,elapsedMs:Date.now()-started,errors:f.errors});
  const jobs=(await native.db.query('SELECT * FROM assessment.term_test_writing_grading_job')).rows;if(offline){assert.equal(jobs.length,1);await completeFakeResult(native,2);}else{assert.equal(jobs.length,0);assert.equal(Number((await native.db.query('SELECT writing_score FROM assessment.term_test_writing_grading_final')).rows[0].writing_score),0);}await record('native_grading_verified',{jobCount:jobs.length,score:offline?6:0});
  assert.deepEqual(f.errors,[]);await p.screenshot({path:resolve(output,mode+'-full-final.png'),fullPage:true});
  return {mode,outcome:'passed',elapsedMs:Date.now()-started};
 }catch(e){await record('failed',{message:e.message,errors:f.errors});await p.screenshot({path:resolve(output,mode+'-full-failure.png'),fullPage:true});return {mode,outcome:'failed',error:e.message};}
 finally{clearInterval(timer);await f.close();await native.close();}
}
const results=await Promise.all([round('lis_first'),round('read_first')]);
await writeFile(resolve(output,'full-results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));if(results.some(x=>x.outcome!=='passed'))process.exitCode=1;
