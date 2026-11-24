import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {writeFile} from 'node:fs/promises';
import test from 'node:test';
import {pathToFileURL} from 'node:url';

process.env.K56_FIXTURE_IMPORT_ONLY = '1';
const {fixture,wait} = await import('./term2-offline-browser.mjs');
const selected=process.env.K56_DEPARTURE_TERM;
const product=selected==='mini'?'mini':Number(selected||2);
assert.ok([1,2,'mini'].includes(product));
const taskId=product===2?'task1':'task2';
const productLabel=product==='mini'?'Mini':`Term ${product}`;
const evidencePrefix=product===2?'':product===1?'term1-':'mini-';
const testCases = [
  {mode:'read_first', demo:false, action:'controlled'},
  {mode:'lis_first', demo:false, action:'back'},
  {mode:'read_first', demo:true, action:'reload'},
  {mode:'lis_first', demo:true, action:'close'},
];
if(product===1)testCases.push({mode:'read_first',demo:false,action:'cancel_then_close'});
const warning = 'Nếu bạn rời trang hoặc tải lại, hệ thống sẽ nộp ngay phần thi đang làm với các câu trả lời đã lưu. Bạn không thể quay lại làm tiếp phần này.';
const next = ' Khi mở lại bài thi, bạn sẽ chuyển sang phần tiếp theo.';
const last = ' Khi mở lại, bạn sẽ thấy màn hình kết thúc bài thi.';

async function selectStudent(page,exam) {
  await page.locator(`#bootstrapStudent option[value="${exam.student}"]`).waitFor({state:'attached'});
  await page.selectOption('#bootstrapStudent',exam.student);
  await page.click('#confirmIdentity');
}

async function start(page,skill) {
  if (skill === 'listening') {
    await page.click('#bootstrapPreview',{timeout:45000});
    await page.click('#bootstrapStart',{timeout:45000});
    await wait(page,()=>(window.K56_MINI_OFFLINE||window.K56_TERM1_OFFLINE||window.K56_TERM2_OFFLINE)?.player?.currentTime > .5,'Listening playing');
  } else {
    await page.getByRole('button',{name:'Bắt đầu Reading',exact:true}).click();
  }
}

function read(page,skill) {
  return page.evaluate(skill=>{
    const runtime=window.K56_MINI_OFFLINE||window.K56_TERM1_OFFLINE||window.K56_TERM2_OFFLINE;
    const run=runtime.record;
    const item=run.sections[skill];
    return {attempt:runtime.scope.attemptToken, document:window.departureTestDocument,
      active:runtime.departureSkill, next:runtime.sectionResponse().nextSection,
      draft:run.snapshot?.drafts?.[skill], content:item?.content, deadline:item?.deadlineAt,
      departure:run.departure, sealed:item?.sealed, operationId:item?.operationId,
      receipt:run.receipts[item?.operationId]?.status, position:runtime.player?.currentTime,
      queued:run.operations.map(({operationId,section,kind})=>({operationId,section,kind})),
      receiptIds:Object.keys(run.receipts), review:run.review};
  },skill);
}

const dialog = page => page.waitForEvent('dialog',{predicate:prompt=>prompt.type()==='beforeunload',timeout:8000});
function immediateNavigation(page,action) {
  if(action === 'back') return page.evaluate(()=>history.back());
  if(action === 'close') return page.close({runBeforeUnload:true});
  return page.reload({waitUntil:'commit',timeout:8000});
}

for(const {mode,demo,action} of testCases) {
  if(process.env.TERM2_DEPARTURE_ACTION && process.env.TERM2_DEPARTURE_ACTION!==action)continue;
  test(`${productLabel} ${demo?'DEMO':'CBT'} ${mode} ${action}`,{timeout:150000},async()=>{
    const entry=demo ? process.env.TERM2_NATIVE_DEMO_FIXTURE : process.env.TERM2_NATIVE_MAIN_FIXTURE;
    const native=entry && await (await import(pathToFileURL(entry))).createNativeRecoveryFixture();
    const exam=await fixture(mode,{product,demo,native,allowBackForwardCache:true});
    let page=exam.page;
    const first=mode==='read_first'?'reading':'listening';
    const second=mode==='read_first'?'listening':'reading';
    const answer='Đáp án trước khi rời '+action;
    exam.controls.r2Audio=true;
    const parallelFlag=product==='mini'?'miniCbtParallelEntry':`term${product}ParallelEntry`;
    exam.controls.preparedOverride={[parallelFlag]:true};
    exam.controls.listeningReportsEnabled=true;
    exam.controls.listeningRecoveryEnabled=true;
    exam.controls.beforeUnloadSpies=[];
    const previous=new URL('/term-tests/shared/exam-journal/bridge.mjs',exam.url).href;
    try {
      await exam.context.addInitScript(()=>{window.departureTestDocument=crypto.randomUUID();});
      await page.goto(previous);
      await page.goto(exam.url);
      await selectStudent(page,exam);
      await wait(page,()=>(window.K56_MINI_OFFLINE||window.K56_TERM1_OFFLINE||window.K56_TERM2_OFFLINE)?.active,'Prepared attempt');
      await start(page,first);
      const input=page.locator('#'+first+'Questions input[data-number]').first();
      await input.fill(answer);
      const policy=await page.locator('.exam-departure-note p').first().innerText();
      if(product===1)assert.match(policy,/Khi hệ thống chưa nhận được xác nhận, nháp và lượt thi của bạn được giữ/);
      else assert.equal(policy,warning+next);
      const before=await read(page,first);
      assert.equal(before.active,first);
      if(product===2 && action==='controlled' && process.env.K56_DEPARTURE_SLOW_RESTORE==='1'){
        await page.addInitScript(()=>{
          const module=new URL('offline-term2-confirmed-departure-v1.mjs',location.href);
          void import(module).then(({Term2Offline})=>{
            const audio=Term2Offline.prototype.audio;
            Term2Offline.prototype.audio=async function(){
              if(this.record.departure)await new Promise(resolve=>setTimeout(resolve,4000));
              return audio.call(this);
            };
          });
        });
      }
      const prompt=page.getByRole('dialog',{name:'Xác nhận rời bài thi'});
      if(action==='controlled'){
        await page.getByRole('button',{name:'Đổi người học',exact:true}).click();
        await prompt.getByRole('button',{name:'Rời trang và nộp phần này',exact:true}).waitFor();
        await prompt.getByRole('button',{name:'Ở lại làm bài',exact:true}).click();
        assert.equal((await read(page,first)).attempt,before.attempt);
      }
      await page.getByRole('button',{name:'Tải lại trang',exact:true}).click();
      assert.equal(await prompt.locator('p').innerText(),warning+next);
      if(action==='controlled' && process.env.TERM2_EVIDENCE)
        await page.screenshot({path:resolve(process.env.TERM2_EVIDENCE,'term2-departure-vietnamese-dialog.png')});
      await prompt.getByRole('button',{name:'Ở lại làm bài',exact:true}).click();
      if(action!=='controlled'){
        exam.controls.beforeUnloadDecision='stay';
        await Promise.all([dialog(page),immediateNavigation(page,action).catch(error=>{
          if((action==='reload'||action==='cancel_then_close') && /ERR_ABORTED|Timeout/.test(error.message))return;
          throw error;
        })]);
      }
      assert.equal(await input.inputValue(),answer);
      const stayed=await read(page,first);
      assert.equal(stayed.document,before.document);
      assert.equal(stayed.attempt,before.attempt);
      assert.equal(stayed.deadline,before.deadline);
      assert.equal(stayed.active,first);
      assert.equal(stayed.departure,undefined);
      if(first==='listening')assert.ok(stayed.position>=before.position);

      // Network signals and a single waiting observation do not collect a section.
      exam.disconnected=true;
      await exam.context.setOffline(true);
      await page.evaluate(()=>{
        document.dispatchEvent(new Event('visibilitychange'));
        (window.K56_MINI_OFFLINE||window.K56_TERM1_OFFLINE||window.K56_TERM2_OFFLINE).player?.dispatchEvent(new Event('waiting'));
      });
      assert.equal((await read(page,first)).active,first);
      assert.equal((await read(page,first)).sealed,false);
      // The previous history entry is outside this exam worker's offline scope.
      if(product===1&&action==='back'){
        exam.disconnected=false;
        await exam.context.setOffline(false);
      }
      exam.controls.beforeUnloadDecision='leave';
      if(action==='controlled'){
        await page.getByRole('button',{name:'Tải lại trang',exact:true}).click();
        await prompt.getByRole('button',{name:'Tải lại và nộp phần này',exact:true}).click();
      } else if(action==='cancel_then_close'){
        await page.close({runBeforeUnload:false});
        page=await exam.context.newPage();
        await page.goto(exam.url,{waitUntil:'domcontentloaded'});
      } else if(action==='close'){
        const closed=page.waitForEvent('close');
        await Promise.all([dialog(page),closed,immediateNavigation(page,action)]);
        page=await exam.context.newPage();
        // A new tab on shared DEMO needs a confirmed identity before showing a local attempt.
        exam.controls.pauseOperations=true;
        await exam.context.setOffline(false);
        exam.disconnected=false;
        await page.goto(exam.url);
        await selectStudent(page,exam);
      } else {
        await Promise.all([dialog(page),immediateNavigation(page,action)]);
        if(action==='back'){
          await page.waitForURL(previous,{waitUntil:'commit',timeout:8000});
          await page.goForward({waitUntil:'commit',timeout:8000});
        }
      }
      // Back/forward cache can restore the same untouched document when no seal was created.
      const mayRestoreDocument=product===1&&action==='back';
      if(!mayRestoreDocument)await page.waitForFunction(previousDocument=>window.departureTestDocument!==previousDocument,before.document);
      await wait(page,()=>(window.K56_MINI_OFFLINE||window.K56_TERM1_OFFLINE||window.K56_TERM2_OFFLINE)?.active,'Restored departed attempt');
      const departed=await read(page,first);
      assert.equal(departed.attempt,before.attempt);
      if(!mayRestoreDocument)assert.notEqual(departed.document,before.document);
      if(product===1 && action!=='controlled'){
        assert.equal(departed.sealed,false);
        assert.equal(departed.next,first);
        assert.equal(departed.departure,undefined);
        assert.equal(departed.deadline,before.deadline);
        assert.ok(Object.values(departed.draft||{}).includes(answer));
        assert.equal(departed.queued.some(op=>op.section===first&&op.kind==='seal'),false);
        assert.equal(exam.controls.beforeUnloadSpies.length,action==='cancel_then_close'?1:2);
        if(process.env.TERM2_EVIDENCE)await writeFile(resolve(process.env.TERM2_EVIDENCE,`${evidencePrefix}native-unconfirmed-${action}-${mode}.json`),
          JSON.stringify({mode,demo,action,prompts:exam.controls.beforeUnloadSpies.length,
            sameAttempt:true,draftPreserved:true,originalDeadline:true,localSeal:false},null,2));
        return;
      }
      assert.equal(departed.sealed,true);
      assert.equal(departed.next,second);
      assert.equal(departed.active,null);
      assert.equal(departed.departure.skill,first);
      assert.ok(Object.values(JSON.parse(departed.content).answers).includes(answer));
      assert.equal(departed.receipt,undefined);
      await page.getByText(/đã khóa trên thiết bị. Đang chờ máy chủ xác nhận/).waitFor();
      assert.equal(await page.locator('#'+first+'Questions input[data-number]').first().isVisible(),false);
      if(second==='listening')await page.locator('#bootstrapPreview').waitFor({state:'visible'});
      else await page.getByRole('button',{name:'Bắt đầu Reading',exact:true}).waitFor();
      const prepareCalls=()=>exam.controls.attemptPrepareRequests.filter(call=>!call.ownerScoped).length;
      const admissionBeforeReconnect=prepareCalls();
      exam.controls.loseAck=true;
      exam.controls.pauseOperations=false;
      exam.disconnected=false;
      await exam.context.setOffline(false);
      await page.evaluate(()=>{const runtime=window.K56_MINI_OFFLINE||window.K56_TERM1_OFFLINE||window.K56_TERM2_OFFLINE;runtime.retryAt=0;return runtime.flush();});
      await page.waitForFunction(id=>(window.K56_MINI_OFFLINE||window.K56_TERM1_OFFLINE||window.K56_TERM2_OFFLINE)?.record.receipts[id]?.status==='accepted',
        departed.operationId,{timeout:25000}).catch(async error=>{
        throw new Error('Read receipt after lost response '+JSON.stringify(await read(page,first)),{cause:error});
      });
      const acknowledged=await read(page,first);
      assert.equal(acknowledged.operationId,departed.operationId);
      assert.equal(acknowledged.receipt,'accepted');
      assert.equal(prepareCalls(),admissionBeforeReconnect,'Reconnect must reuse the owned sealed run');
      assert.equal(exam.controls.ackLost,true);
      const receipts=native
        ? (await native.db.query(`SELECT operation_id,payload,receipt FROM assessment.term2_offline_operation
             WHERE attempt_id=$1 AND section=$2 AND kind='seal'`,[departed.attempt,first])).rows
        : [...exam.receipts.values()].filter(receipt=>receipt.section===first&&receipt.kind==='seal')
          .map(receipt=>({operation_id:receipt.operationId,receipt}));
      assert.deepEqual(receipts.map(receipt=>receipt.operation_id),[departed.operationId]);
      if(native)assert.ok(Object.values(receipts[0].payload.payload.answers).includes(answer));
      await page.getByText(/Máy chủ đã nhận phần (Listening|Reading)/).waitFor();
      const count=exam.controls.beforeUnloadSpies.length;
      assert.equal(count,action==='controlled'?0:2);
      if(process.env.TERM2_EVIDENCE)await writeFile(resolve(process.env.TERM2_EVIDENCE,`${evidencePrefix}confirmed-departure-${demo?'demo':'cbt'}-${mode}.json`),
        JSON.stringify({mode,demo,action,first,second,prompts:exam.controls.beforeUnloadSpies,stored:departed,
          answered:acknowledged.receipt,acknowledgementDropped:exam.controls.ackLost,
          api:native?'K56 HTTP + isolated SQL':'simulator',
          sealReceipts:receipts.map(row=>row.receipt.receiptId)},null,2));
      if(action==='controlled'){
        await start(page,second);
        await page.locator('#listeningQuestions input[data-number]').first().fill('Giữ câu Listening');
        await page.click('#submitListening');
        await wait(page,()=>(window.K56_MINI_OFFLINE||window.K56_TERM1_OFFLINE||window.K56_TERM2_OFFLINE)?.record.operations.length===0,'Listening accepted before Writing');
        await page.click('#startWriting');
        const essay='Bản Writing được khóa khi tải lại.';
        const writingField=page.locator(`[data-writing-task="${taskId}"]`);
        await writingField.fill(essay);
        await page.getByRole('button',{name:'Tải lại trang',exact:true}).click();
        assert.equal(await prompt.locator('p').innerText(),warning+last);
        await prompt.getByRole('button',{name:'Ở lại làm bài',exact:true}).click();
        assert.equal(await writingField.inputValue(),essay);
        exam.disconnected=true;
        await exam.context.setOffline(true);
        const writing=await read(page,'writing');
        await page.getByRole('button',{name:'Tải lại trang',exact:true}).click();
        await prompt.getByRole('button',{name:'Tải lại và nộp phần này',exact:true}).click();
        await page.waitForFunction(previousDocument=>window.departureTestDocument!==previousDocument,writing.document);
        await wait(page,()=>(window.K56_MINI_OFFLINE||window.K56_TERM1_OFFLINE||window.K56_TERM2_OFFLINE)?.record?.sections.writing?.sealed,'Final skill restored');
        const final=await read(page,'writing');
        assert.equal(final.next,'result');
        assert.equal(final.attempt,before.attempt);
        assert.equal(JSON.parse(final.content)[taskId],essay);
        assert.equal(final.receipt,undefined);
        assert.equal(await writingField.isVisible(),false);
        await page.getByText('Phần Writing đã khóa trên thiết bị. Đang chờ máy chủ xác nhận.',{exact:true}).waitFor();
        await page.locator('#resultReadyView').waitFor({state:'visible'});
        exam.controls.ackLost=false;
        exam.disconnected=false;
        await exam.context.setOffline(false);
        await page.evaluate(()=>{const runtime=window.K56_MINI_OFFLINE||window.K56_TERM1_OFFLINE||window.K56_TERM2_OFFLINE;runtime.retryAt=0;return runtime.flush();});
        await page.getByText('Máy chủ đã nhận phần Writing.',{exact:true}).waitFor({timeout:25000});
        const confirmedWriting=await read(page,'writing');
        assert.equal(confirmedWriting.receipt,'accepted');
        assert.equal(exam.controls.ackLost,true);
        const writingRows=native
          ? (await native.db.query(`SELECT operation_id,payload,receipt FROM assessment.term2_offline_operation
              WHERE attempt_id=$1 AND section='writing' AND kind='seal'`,[final.attempt])).rows
          : [...exam.receipts.values()].filter(receipt=>receipt.section==='writing'&&receipt.kind==='seal')
            .map(receipt=>({operation_id:receipt.operationId,receipt}));
        assert.deepEqual(writingRows.map(row=>row.operation_id),[final.operationId]);
        if(native)assert.equal(writingRows[0].payload.payload[taskId],essay);
        if(process.env.TERM2_EVIDENCE)await writeFile(resolve(process.env.TERM2_EVIDENCE,`${evidencePrefix}confirmed-departure-final-writing.json`),
          JSON.stringify({before:writing,after:final,receipt:confirmedWriting.receipt,
            receiptIds:writingRows.map(row=>row.receipt.receiptId),acknowledgementDropped:exam.controls.ackLost},null,2));
      }
    } finally {await exam.close();await native?.close?.();}
  });
}

test(`${productLabel} Writing uses the final-skill Vietnamese rule`,async()=>{
  const {departureWarning}=await import('../term-tests/k56-offline-shared/exam-departure-v1.mjs');
  assert.equal(departureWarning(true),warning+last);
});
