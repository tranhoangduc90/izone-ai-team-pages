import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';

process.env.K56_FIXTURE_IMPORT_ONLY='1';
const {fixture,wait}=await import('./term2-offline-browser.mjs');
const full=process.env.MINI_FULL_ROUNDS==='1';

for(const paper of [true,false])for(const mode of ['lis_first','read_first']){
 if(paper&&full)continue;
 test(`Mini ${paper?'phiếu':'CBT'} ${mode}`,{timeout:full?3_120_000:200_000},async()=>{
  const f=await fixture(mode,{paper,product:'mini',profile:'mini-'+randomUUID()});
  f.controls.r2Audio=!paper;f.controls.primaryAudioFail=mode==='read_first';f.controls.loseAck=true;
  try{
   let p=f.page;
   await p.goto(f.url);
   const id=paper?'#studentSelect':'#bootstrapStudent';
   await p.locator(`${id} option[value="${f.student}"]`).waitFor({state:'attached'});
   await p.selectOption(id,f.student);
   await p.click(paper?'#miniPaperEnter':'#confirmIdentity');
   if(paper||mode==='read_first')await p.getByRole('button',{name:'Tải bài làm về máy'}).waitFor({state:'attached',timeout:90000});
   await wait(p,()=>window.K56_MINI_OFFLINE?.active||window.K56_MINI_APP_READY,'Mini sẵn sàng');
   f.disconnected=true;await f.context.setOffline(true);
   const skills=mode==='lis_first'?['listening','reading']:['reading','listening'];
   for(const skill of skills){
    if(!paper&&skill==='listening'){
     await p.click('#bootstrapPreview');
     await p.waitForTimeout(11000);
     await p.click('#bootstrapStart');
     await wait(p,()=>window.K56_MINI_OFFLINE?.playerReady,'Player thật');
    }else{
     const label=skill==='reading'?'Reading':'Listening';
     await p.locator('#k56SectionReady:not([hidden]) button,#listeningSavedView:not([hidden]) button#startReading').filter({hasText:label}).first().click();
    }
    const field=p.locator(`#${skill}Questions [data-number="1"]`);
    await field.fill(skill+' kept offline');
    if(!paper&&skill==='listening'){
     await p.waitForTimeout(1600);
     await p.evaluate(()=>window.K56_MINI_OFFLINE.player.dispatchEvent(new Event('error')));
     assert.equal(await p.evaluate(async()=> (await window.K56_LISTENING_AUDIO.beforeAutoSubmit()).submit),false);
     assert.equal(await p.evaluate(()=>window.K56_MINI_OFFLINE.record.sections.listening.sealed),false);
    }
    if(skill===skills[0]){
     await f.reopen({offline:true});
     p=f.page;await p.goto(f.url);
     await wait(p,()=>window.K56_MINI_APP_READY,'Đóng trình duyệt và mở lại offline');
    }
    assert.equal(await p.locator(`#${skill}Questions [data-number="1"]`).inputValue(),skill+' kept offline');
    const download=p.waitForEvent('download');
    await p.getByRole('button',{name:'Tải bài làm về máy'}).click();
    const html=await readFile(await (await download).path(),'utf8');
    assert.ok(html.includes(skill+' kept offline'));
    assert.ok(!html.includes('fixture-permit')&&!html.includes('X-Amz-Signature'));
    if(paper)assert.doesNotMatch(html,/<h2>Writing/);
    if(!paper&&skill==='listening'){
     await p.getByRole('button',{name:/Tiếp tục audio/}).click();
     if(full){await p.waitForFunction(()=>window.K56_MINI_OFFLINE.record.sections.listening.sealed,undefined,{timeout:480000});continue;}
    }
    if(full&&!paper&&skill==='reading'){
     await p.waitForFunction(()=>window.K56_MINI_OFFLINE.record.sections.reading.sealed,undefined,{timeout:1550000});
    }else await p.click(skill==='reading'?'#submitReading':'#submitListening');
   }
   if(!paper){
    await p.click('#startWriting');
    await p.locator('[data-writing-task="task2"]').fill(mode==='lis_first'?' \n\u200b':'This short paragraph must keep the LMS path.');
    if(full)await p.waitForFunction(()=>window.K56_MINI_OFFLINE.record.sections.writing.sealed,undefined,{timeout:950000});
    else await p.click('#submitWriting');
   }
   await p.locator('#resultReadyView').waitFor({state:'visible'});
   if(paper)assert.deepEqual(f.controls.audioCalls,[]);
   else assert.equal(f.controls.audioCalls.length,mode==='read_first'?2:1);
   if(!paper)assert.equal(await p.evaluate(()=>window.K56_MINI_OFFLINE.failures),0,'Offline phải giữ bài tại chỗ, không tăng backoff');
   f.disconnected=false;await f.context.setOffline(false);
   await wait(p,()=>document.querySelector('.writing-save-status')?.textContent.includes('Máy chủ đã xác nhận'),'Đã đối chiếu máy chủ');
   const seals=[...f.receipts.values()].filter(receipt=>receipt.kind==='seal');
   assert.deepEqual(seals.map(receipt=>receipt.section),paper?skills:[...skills,'writing']);
   assert.equal(f.controls.ackLost,true);
   if(!paper&&mode==='lis_first'){
    assert.equal(seals.at(-1).writingBlank,true);
    await p.getByText('Đã nộp · Bài trắng',{exact:true}).waitFor();
   }
   assert.deepEqual(f.errors,[]);
  }finally{await f.close();}
 });
}

if(!full)for(const fault of ['sources','native','shell']){
 test('Mini giữ Start khóa khi lỗi '+fault,{timeout:100000},async()=>{
  const f=await fixture('lis_first',{product:'mini'});
  f.controls.r2Audio=true;
  if(fault==='sources'){f.controls.primaryAudioFail=true;f.controls.pagesAudioFail=true;}
  if(fault==='native')f.controls.denyOfflinePrepare=true;
  if(fault==='shell')f.controls.assetFailures.add('/term-tests/k56-mini-shared/styles.css');
  try{
   const p=f.page;await p.goto(f.url);
   await p.locator(`#bootstrapStudent option[value="${f.student}"]`).waitFor({state:'attached'});
   await p.selectOption('#bootstrapStudent',f.student);await p.click('#confirmIdentity');
   await wait(p,()=>document.querySelector('#bootstrapNotice')?.textContent.includes('Chưa chuẩn bị được bài thi'),'Chuẩn bị bị từ chối');
   assert.equal(await p.locator('#bootstrapStart').isDisabled(),true);
   assert.equal(await p.evaluate(()=>Boolean(window.K56_MINI_OFFLINE?.active)),false);
   assert.equal(f.calls.some(path=>path.endsWith('/offline/operation')||path.endsWith('/session/start')),false);
   if(fault==='native')assert.deepEqual(f.controls.audioCalls,[]);
  }finally{await f.close();}
 });
}

if(!full)for(const paper of [true,false]){
 test('Mini giữ luồng cũ khi thiếu Web Locks '+(paper?'phiếu':'CBT'),{timeout:30000},async()=>{
  const f=await fixture('read_first',{product:'mini',paper});
  try{
   const p=f.page;
   await p.addInitScript(()=>Object.defineProperty(Navigator.prototype,'locks',{get:()=>undefined}));
   await p.goto(f.url);
   const id=paper?'#studentSelect':'#bootstrapStudent';
   await p.locator(`${id} option[value="${f.student}"]`).waitFor({state:'attached'});
   await p.selectOption(id,f.student);await p.click(paper?'#miniPaperEnter':'#confirmIdentity');
   await p.locator('#k56SectionReady:not([hidden]) button').filter({hasText:'Reading'}).waitFor();
   assert.equal(f.calls.some(path=>path.endsWith('/offline/prepare')),false);
   assert.deepEqual(f.controls.audioCalls,[]);
   assert.deepEqual(f.errors,[]);
  }finally{await f.close();}
 });
}
