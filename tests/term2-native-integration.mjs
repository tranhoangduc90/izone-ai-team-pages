// Browser → transport HTTP thật → transaction/receipt/grading SQL; API/danh tính cách ly.
import test from 'node:test';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
process.env.TERM2_FULL_ROUND='1';process.env.TERM2_FIXTURE_IMPORT_ONLY='1';
assert.ok(process.env.TERM2_NATIVE_FIXTURE,'Cần đường dẫn release/test.mjs đã ghép native source');
const {fixture:nativeFixture}=await import(pathToFileURL(process.env.TERM2_NATIVE_FIXTURE));
const {fixture,wait}=await import('./term2-offline-browser.mjs');
for(const mode of ['lis_first','read_first'])test('Browser/native SQL end-to-end '+mode,{timeout:180000},async()=>{
 const native=await nativeFixture(mode,{skipPrepare:true,realtime:true}),f=await fixture(mode,{native}),p=f.page;
 try{await p.goto(f.url);await p.locator('#bootstrapStudent option[value="'+f.student+'"]').waitFor({state:'attached'});await p.selectOption('#bootstrapStudent',f.student);await p.click('#confirmIdentity');await wait(p,()=>window.K56_TERM2_OFFLINE?.active,'Native prepare');
  for(const skill of mode==='read_first'?['reading','listening','writing']:['listening','reading','writing']){
   if(skill==='listening'){await p.click('#bootstrapPreview');await p.waitForTimeout(11000);await p.click('#bootstrapStart');await wait(p,()=>window.K56_TERM2_OFFLINE.playerReady,'Native Listening');await p.locator('#listeningQuestions input[data-number]').first().fill('A');await p.click('#submitListening');}
   else if(skill==='reading'){if(mode==='read_first')await wait(p,()=>window.K56_TERM2_APP_READY,'Native Reading ready');await(mode==='read_first'?p.getByRole('button',{name:'Bắt đầu Reading',exact:false}).first():p.locator('#startReading')).click();await p.locator('#readingQuestions input[data-number]').first().fill('A');await p.click('#submitReading');if(mode==='read_first')await wait(p,()=>Boolean(document.getElementById('bootstrapPreview')),'Native Listening lobby');}
   else {await p.click('#startWriting');f.disconnected=true;await f.context.setOffline(true);await p.locator('[data-writing-task="task1"]').fill('\u00a0\u200b');await p.click('#submitWriting');await wait(p,()=>window.K56_TERM2_OFFLINE.record.sections.writing?.sealed,'Native Writing sealed offline');}
  }
  f.disconnected=false;await f.context.setOffline(false);await p.evaluate(()=>{window.K56_TERM2_OFFLINE.retryAt=0;return window.K56_TERM2_OFFLINE.flush();});await wait(p,()=>window.K56_TERM2_OFFLINE.pending===0,'Native receipts khớp');
  const result=(await native.db.query('SELECT writing_score,status FROM assessment.term_test_writing_grading_final')).rows[0];assert.equal(Number(result?.writing_score),0);assert.equal(result.status,'ready');assert.equal((await native.db.query('SELECT * FROM assessment.term_test_writing_grading_job')).rows.length,0);
  assert.equal((await native.db.query("SELECT count(*)::int AS count FROM assessment.term2_offline_operation WHERE receipt->>'status'<>'accepted'")).rows[0].count,0);assert.deepEqual(f.errors,[]);
 }finally{await f.close();await native.close();}
});
