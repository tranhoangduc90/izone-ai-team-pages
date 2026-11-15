import assert from 'node:assert/strict';
import test from 'node:test';
import {pathToFileURL} from 'node:url';
import {writeFile} from 'node:fs/promises';

process.env.K56_FIXTURE_IMPORT_ONLY = '1';
const {fixture, wait} = await import('./term2-offline-browser.mjs');

async function openMini(page, f) {
  await page.goto(f.url);
  await page.locator('#bootstrapStudent option[value="' + f.student + '"]').waitFor({state: 'attached'});
  await page.selectOption('#bootstrapStudent', f.student);
  await page.click('#confirmIdentity');
  await wait(page, () => window.K56_MINI_OFFLINE?.active, 'Mini prepared');
}

async function startListening(page) {
  await page.click('#bootstrapPreview');
  await page.locator('#bootstrapStart:enabled').waitFor({timeout: 40000});
  await page.click('#bootstrapStart');
  await wait(page, () => window.K56_MINI_OFFLINE?.playerReady, 'Listening player ready');
}

async function seekForTest(page, seconds) {
  await page.evaluate(async position => {
    const audio = window.K56_MINI_OFFLINE.player;
    const ready = new Promise(resolve => audio.addEventListener('seeked', resolve, {once:true}));
    audio.currentTime = position;
    await ready;
  }, seconds);
  await wait(page, () => {
    const audio = window.K56_MINI_OFFLINE?.player;
    return audio?.readyState >= 3 && !audio.paused && !audio.seeking;
  }, 'Actual test media playing at selected time');
  await page.waitForFunction(position=>window.K56_MINI_OFFLINE.player.currentTime>position+0.15,seconds);
}

async function captureJournal(context) {
  const events = [];
  const headers = {
    'access-control-allow-origin':'*',
    'access-control-allow-headers':'Content-Type',
    'access-control-allow-methods':'POST,OPTIONS',
  };
  const bindingId = 'a'.repeat(64);
  await context.route('**/journal-*', async route => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({status:204, headers});
    const body = request.postDataJSON();
    if (request.url().endsWith('/journal-context')) {
      return route.fulfill({status:200, headers, json:{
        ok:true, bindingId, ticket:'isolated', ticketId:'fixture',
        issuedAt:Date.now()-100, expiresAt:Date.now()+600000,
        identityConfirmed:Boolean(body.examSessionToken),
      }});
    }
    events.push(...body.events);
    return route.fulfill({status:202, headers, json:{
      ok:true, persisted:true, scopeId:bindingId, acknowledgedIds:body.events.map(row => row.id)
    }});
  });
  return events;
}

async function expectReportEvent(events, decision) {
  const findEvent = () => events.find(event => event.data.checkpointState?.phase === 'manual_report_classified'
    && event.data.checkpointState.decision === decision);
  const limit = Date.now() + 15000;
  while (!findEvent() && Date.now() < limit) await new Promise(resolve => setTimeout(resolve, 150));
  const event = findEvent();
  assert.ok(event?.id, 'Expected a browser events batch for ' + decision);
  assert.equal(event.data.checkpointState.mapVersion, 1);
}

for (const mode of ['lis_first', 'read_first']) {
  test('Mini K56 dựng đủ đề từ lần mở đầu, bỏ script ghép cũ: ' + mode, {timeout: 150000}, async () => {
    const f = await fixture(mode, {product: 'mini'});
    f.controls.r2Audio = true;
    try {
      const page = f.page;
      const journal = await captureJournal(f.context);
      await page.addInitScript(() => {
        window.firstListeningFrames = [];
        window.legacyEnhancerRequests = 0;
        const nativeAppend = Node.prototype.appendChild;
        Node.prototype.appendChild = function appendChild(child) {
          if (child instanceof HTMLScriptElement && /\/enhance(?:-mini-journal-v1)?\.js(?:\?|$)/.test(child.src)) {
            window.legacyEnhancerRequests++;
            queueMicrotask(() => child.dispatchEvent(new Event('error')));
            return child;
          }
          return nativeAppend.call(this, child);
        };
        let last = '';
        function inspect() {
          const form = document.getElementById('listeningView');
          if (!form || form.hidden || !form.getClientRects().length) return;
          const questionContainer = form.querySelector('#listeningQuestions:not([hidden])');
          if (!questionContainer) return;
          const state = {
            controlCount: questionContainer.querySelectorAll('[data-number]').length,
            hasTitle: Boolean(questionContainer.querySelector('.cbt-listening-section h3')),
          };
          const key = JSON.stringify(state);
          if (key !== last) window.firstListeningFrames.push(state);
          last = key;
        }
        new MutationObserver(inspect).observe(document, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['hidden', 'class'],
        });
      });
      await openMini(page, f);
      assert.equal(await page.locator('#listeningQuestions h3').isVisible(), false);
      if (mode === 'read_first') {
        await page.locator('#k56SectionReady:not([hidden]) button').filter({hasText: 'Reading'}).click();
        await page.locator('#readingQuestions [data-number="1"]').fill('reading fixture');
        await page.click('#submitReading');
        await wait(page, () => window.K56_MINI_OFFLINE?.record?.sections?.reading?.sealed, 'Reading receipt before Listening');
      }
      f.controls.loseAck = true;
      await startListening(page);
      const frames = await page.evaluate(() => window.firstListeningFrames);
      assert.deepEqual(frames, [{controlCount: 10, hasTitle: true}]);
      assert.equal(await page.evaluate(() => window.legacyEnhancerRequests), 0);

      if (mode === 'lis_first') {
        await seekForTest(page, 20);
        const before = await page.evaluate(() => window.K56_MINI_OFFLINE.player.currentTime);
        await page.getByRole('button', {name:'Tôi không nghe được'}).click();
        const notice = page.locator('.mini-k56-silence-report');
        await notice.waitFor({state:'visible'});
        assert.match(await notice.textContent(), /^Hiện tại là khoảng im lặng trước câu hỏi 1–6 của part 1, không phải lỗi âm thanh\. Audio sẽ vang lên sau khoảng \d+ giây\. Hãy tập trung đọc và phân tích đề trong lúc này\.$/);
        assert.equal(await page.evaluate(() => Boolean(window.K56_MINI_OFFLINE.record.sections.listening.interrupted)), false);
        assert.equal(await page.locator('#listeningQuestions [data-number="1"]').isEnabled(), true);
        assert.ok(await page.evaluate(position => !window.K56_MINI_OFFLINE.player.paused && window.K56_MINI_OFFLINE.player.currentTime > position, before));
        await expectReportEvent(journal, 'planned_silence');
      }

      await page.setViewportSize({width: 1000, height: 570});
      await page.locator('#listeningView').getByRole('button',{name:'Tăng cỡ chữ'}).click();
      const lastAnswer = page.locator('#listeningQuestions [data-number="10"]');
      await lastAnswer.fill('fixture answer');
      assert.equal(await lastAnswer.inputValue(), 'fixture answer');
      await page.click('#submitListening');
      await wait(page, () => window.K56_MINI_OFFLINE?.record?.sections?.listening?.sealed, 'Listening sealed');
      await wait(page, () => window.K56_MINI_OFFLINE?.record?.operations?.every(op => op.section !== 'listening' || op.kind !== 'seal'), 'Listening ACK reconciled');
      const receipts = [...f.receipts.values()].filter(value => value.kind === 'seal' && value.section === 'listening');
      assert.equal(f.controls.ackLost, true);
      assert.equal(receipts.length, 1);
      assert.deepEqual(f.errors, []);
    } finally {
      await f.close();
    }
  });
}

test('Mini K56 giữ thông báo và biên nhận gián đoạn ở đoạn dự kiến có tiếng', {timeout:150000}, async () => {
  const f = await fixture('lis_first', {product:'mini'});
  f.controls.r2Audio = true;
  f.controls.listeningReportsEnabled = true;
  try {
    const page = f.page;
    const journal = await captureJournal(f.context);
    const reportReceived = new Promise(resolve => { f.controls.receiveStudyReport = resolve; });
    await f.context.route('**/mini-test-k56/listening/report', async route => {
      const body = route.request().postDataJSON();
      const native = f.receipts.get(body.operationId);
      const png = Buffer.from(body.pngBase64 || '', 'base64');
      f.controls.receiveStudyReport({native,body,header:route.request().headers()['x-term2-permit'],png});
      return route.fulfill({status:202,headers:{'access-control-allow-origin':'*'},json:{ok:true,incidentId:'7b04ca69-45d6-4044-b73f-55a194b496fd'}});
    });
    await openMini(page, f);
    await startListening(page);
    await seekForTest(page, 52);
    await page.getByRole('button', {name:'Tôi không nghe được'}).click();
    const dialog = page.getByRole('dialog', {name:'Listening gián đoạn'});
    await dialog.waitFor({state:'visible'});
    assert.match(await dialog.innerText(), /Hãy tiếp tục làm kỹ năng tiếp theo/);
    assert.equal(await page.locator('.mini-k56-silence-report').isVisible(), false);
    assert.equal(await page.evaluate(() => window.K56_MINI_OFFLINE.player.paused), true);
    await wait(page, () => window.K56_MINI_OFFLINE.record.sections.listening.interrupted, 'Native interruption persisted');
    assert.equal(await page.locator('#listeningQuestions [data-number="1"]').isDisabled(), true);
    await expectReportEvent(journal, 'expected_audible');
    await dialog.getByRole('button', {name:'Tôi đã hiểu. Đến phần thi tiếp theo.'}).click();
    await page.locator('#k56SectionReady:not([hidden])').waitFor({state:'visible'});
    const report = await Promise.race([reportReceived,new Promise((_,reject)=>{
      setTimeout(()=>reject(new Error('Thiếu báo sự cố có ảnh sau biên nhận native')),15000).unref();
    })]);
    assert.equal(report.native?.status,'accepted');
    assert.equal(report.native?.kind,'interrupt');
    assert.equal(report.body.mode,'offline');
    assert.equal(report.body.operationId,report.native.operationId);
    assert.equal(report.header,'fixture-permit-no-production-authority');
    assert.equal(report.png.toString('ascii',1,4),'PNG');
    assert.equal(report.png.readUInt32BE(16),900);
    assert.equal(report.png.readUInt32BE(20),520);
    assert.equal(report.body.studentName,undefined);
    assert.equal(report.body.answers,undefined);
    assert.deepEqual(f.errors, []);
  } finally {
    await f.close();
  }
});

test('Mini K56 online Đọc trước mở Reading với nội dung Listening bị giữ ở server', {timeout:60000}, async () => {
  const f = await fixture('read_first', {product:'mini'});
  f.controls.redactListening = true;
  const now = Date.now();
  f.controls.preparedOverride = {
    readingStartedAt:new Date(now-1000).toISOString(), readingDeadlineAt:new Date(now+24*60*1000).toISOString()
  };
  try {
    const page = f.page;
    await page.goto(f.url);
    await page.locator('#bootstrapStudent option[value="' + f.student + '"]').waitFor({state:'attached'});
    await page.selectOption('#bootstrapStudent', f.student);
    await page.click('#confirmIdentity');
    await page.locator('#readingQuestions .cbt-reading-passage').waitFor({state:'visible'});
    assert.equal(await page.locator('#listeningView').isVisible(),false);
    assert.equal(await page.locator('#listeningQuestions .cbt-listening-section').count(),0);
    assert.deepEqual(f.calls.filter(endpoint=>endpoint.endsWith('/session/start')),[]);
    assert.deepEqual(f.errors,[]);
  } finally {
    await f.close();
  }
});

test('Mini K56 online giữ khoảng lặng và gửi đúng ảnh sau checkpoint thủ công', {timeout:90000}, async () => {
  const f=await fixture('lis_first',{product:'mini'});
  f.controls.onlineMini=true;
  try{
    const {page}=f;
    const journal=await captureJournal(f.context);
    const reports=[];
    let themeFailureInjected=false;
    await page.route('**/k56-design/theme.css*',route=>{
      themeFailureInjected=true;
      return route.fulfill({status:503,body:'fixture blocked cosmetic theme'});
    });
    await f.context.route('**/mini-test-k56/listening/report',async route=>{
      if(route.request().method()!=='POST')return route.fulfill({status:204,headers:{
        'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'POST',
      }});
      reports.push({body:route.request().postDataJSON(),header:route.request().headers()['x-term2-permit'],
        checkpoint:f.controls.manualCheckpoint});
      return route.fulfill({status:202,headers:{'access-control-allow-origin':'*'},json:{ok:true,incidentId:'fixture-only'}});
    });
    await page.goto(f.url);
    await page.locator('#bootstrapStudent option[value="'+f.student+'"]').waitFor({state:'attached'});
    await page.selectOption('#bootstrapStudent',f.student);
    await page.click('#confirmIdentity');
    await wait(page,()=>!document.getElementById('bootstrapPreview')?.disabled,'Online preview ready',15000);
    await page.locator('#bootstrapPreview:enabled').click();
    await page.locator('#bootstrapStart:enabled').waitFor({timeout:40000});
    await page.click('#bootstrapStart');
    const reportButton=page.getByRole('button',{name:'Tôi không nghe được'});
    await reportButton.waitFor({state:'visible'});
    assert.equal(themeFailureInjected,true);
    await page.locator('#listeningQuestions [data-number="1"]').fill('fixture');
    for(const position of [20,52]){
      await page.evaluate(async seconds=>{
        const audio=window.TERM_TEST_BOOTSTRAP.officialAudioElement;
        const ready=new Promise(resolve=>audio.addEventListener('seeked',resolve,{once:true}));
        audio.currentTime=seconds;
        await ready;
      },position);
      await wait(page,()=>{
        const audio=window.TERM_TEST_BOOTSTRAP?.officialAudioElement;
        return audio?.readyState>=3&&!audio.paused&&!audio.seeking;
      },'Online official audio ready',10000);
      await page.waitForFunction(seconds=>window.TERM_TEST_BOOTSTRAP.officialAudioElement.currentTime>seconds+0.15,position);
      await reportButton.click();
      if(position===20){
        await page.locator('.mini-k56-silence-report').waitFor({state:'visible'});
        assert.equal(f.controls.manualCheckpoint,undefined);
        assert.equal(reports.length,0);
        assert.equal(await page.evaluate(()=>window.TERM_TEST_BOOTSTRAP.officialAudioElement.paused),false);
        await expectReportEvent(journal,'planned_silence');
      }
    }
    await page.getByText(/Audio đang dừng do sự cố/).waitFor({state:'visible'});
    await expectReportEvent(journal,'expected_audible');
    const until=Date.now()+10000;
    while(!reports.length&&Date.now()<until)await new Promise(resolve=>setTimeout(resolve,100));
    assert.equal(reports.length,1);
    const [{body,header,checkpoint}]=reports;
    assert.equal(checkpoint?.state,'pause');
    assert.equal(body.mode,'online');
    assert.equal(body.operationId,checkpoint.recoveryId);
    assert.equal(body.ownerId,checkpoint.audioOwnerId);
    assert.equal(body.reportedAt,checkpoint.manualListeningReport.reportedAt);
    assert.equal(header,'synthetic-online-scoped-grant');
    const image=Buffer.from(body.pngBase64,'base64');
    assert.equal(image.subarray(1,4).toString(),'PNG');
    assert.equal(image.readUInt32BE(16),900);
    assert.equal(image.readUInt32BE(20),520);
    assert.deepEqual(f.errors,[]);
  }finally{await f.close();}
});

const nativeFixturePath=process.env.MINI_K56_NATIVE_REPORT_FIXTURE;
if(nativeFixturePath)test('Mini K56 từ nút báo đến receipt native, ảnh, và nhật ký xếp hàng', {timeout:120000}, async t=>{
  process.env.K56_NATIVE_REPORT_FIXTURE_ONLY='1';
  const {miniNativeReportFixture}=await import(pathToFileURL(nativeFixturePath));
  const native=await miniNativeReportFixture(t,{authorized:true,generation:0});
  const f=await fixture('lis_first',{product:'mini',native});
  try{
    const {page}=f;
    const journal=await captureJournal(f.context);
    await openMini(page,f);
    await startListening(page);
    await seekForTest(page,20);
    const button=page.getByRole('button',{name:'Tôi không nghe được'});
    await button.click();
    await page.locator('.mini-k56-silence-report').waitFor({state:'visible'});
    await expectReportEvent(journal,'planned_silence');
    const count=async()=>Number((await native.query('SELECT count(*) AS count FROM assessment.mini_k56_listening_report')).rows[0].count);
    assert.equal(await count(),0);
    await seekForTest(page,52);
    await button.click();
    await page.getByRole('dialog',{name:'Listening gián đoạn'}).waitFor({state:'visible'});
    await expectReportEvent(journal,'expected_audible');
    const until=Date.now()+15000;
    while(!native.log.some(row=>row.phase==='delivery')&&Date.now()<until)await new Promise(resolve=>setTimeout(resolve,100));
    const delivered=(await native.query('SELECT operation_id,incident_id,state,photo_message_id FROM assessment.mini_k56_listening_report')).rows;
    assert.equal(delivered.length,1);
    const [report]=delivered;
    assert.equal(report.state,'sent');
    assert.equal(report.photo_message_id,'49');
    const receipt=(await native.query('SELECT receipt FROM assessment.mini_k56_offline_operation WHERE operation_id=$1',[report.operation_id])).rows[0].receipt;
    assert.equal(receipt.status,'accepted');
    assert.equal(receipt.kind,'interrupt');
    assert.equal(receipt.operationId,report.operation_id);
    assert.ok(native.log.some(row=>row.phase==='delivery'&&row.incidentId===report.incident_id&&row.operationId===receipt.operationId));
    assert.equal(native.provider.length,1);
    const imageStart=native.provider[0].body.indexOf(Buffer.from([0x89,0x50,0x4e,0x47]));
    assert.ok(imageStart>=0);
    assert.equal(native.provider[0].body.readUInt32BE(imageStart+16),900);
    assert.equal(native.provider[0].body.readUInt32BE(imageStart+20),520);
    const evidencePath=process.env.MINI_K56_SYNTHETIC_IMAGE;
    if(evidencePath){
      const multipart=native.provider[0].body;
      let end=imageStart+8;
      while(multipart.toString('ascii',end+4,end+8)!=='IEND')end+=12+multipart.readUInt32BE(end);
      await writeFile(evidencePath,multipart.subarray(imageStart,end+12),{flag:'wx'});
    }
    assert.deepEqual(f.errors,[]);
  }finally{await f.close();}
});
