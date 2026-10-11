// Dữ liệu giả; chạy đúng hàm render/polling của K67 trên DOM Chrome thật.
// Kiểm lỗi toggle tự đóng, dữ liệu mới và cách ly lượt thi; không gọi API thật.
// Các test cũ chỉ kiểm kênh cập nhật/revision, chưa kiểm trạng thái bảng sau cập nhật.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const modules = process.env.CODEX_NODE_MODULES || resolve(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = createRequire(pathToFileURL(resolve(modules, 'playwright/package.json')))('playwright');
const source = await readFile(new URL('../term-tests/shared/app.js', import.meta.url), 'utf8');
function extract(start, end) {
  const offset = source.indexOf(start);
  assert.ok(offset >= 0 && source.indexOf(end, offset) > offset);
  return source.slice(offset, source.indexOf(end, offset));
}
const code = extract('  function renderDetailBlock(', '  function portalNotice(')
  + extract('  async function refreshWritingGrading(', '  function setWritingSaveStatus(');

test('K67: polling giữ toggle/focus, cập nhật câu và đặt lại khi đổi lượt', async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage();
    await page.route('**/*', route => route.abort());
    await page.evaluate(code => {
      // Chỉ thay các biên API/trình bày ngoài bảng; dùng nguyên hàm đang phát hành.
      window.probe = new Function(`
        const state = {attemptToken:'fake-a',studentRef:'student-a',writingSubmitted:true};
        const elements = Object.fromEntries(['resultStudentName','resultMeta','summaryGrid','resultStatus','continueReadingFromResult','viewFullAttempt','questionDetails','skillPerformanceSections'].map(id=>[id,document.createElement('div')]));
        document.body.append(...Object.values(elements));
        const demoMode=false, miniAnswerSheet=false, writingConfig={}, writingTaskLabels='Writing', testConfig={title:'Synthetic test',slug:'term-test-1'};
        let listeningOnly=false;
        let writingGradingPollTimer=0,writingGradingPollStartedAt=0,writingGradingPollCount=0,writingGradingPollInFlight=false,writingGradingRefreshRequested=false;
        let calls=0;
        const row={number:1,studentAnswer:'A',correctAnswer:'A',result:'correct'};
        const payload={studentName:'Synthetic',className:'FAKE',completed:true,writing:{submitted:true,grading:{ready:false,status:'processing'}},result:{listening:{correct:1,total:1,details:[row]},reading:{correct:1,total:1,details:[row]}}};
        function resultsUnlocked(){return true;}
        function addSummaryCard(){return document.createElement('div');}
        function sectionScoreText(){return '1/1';}
        function renderSkillPerformance(){return document.createElement('div');}
        function renderWritingSubmission(){}
        function applyWritingFromServer(){}
        function startWritingGradingStream(){}
        function showNotice(){}
        function stopWritingGradingPolling(){clearTimeout(writingGradingPollTimer);writingGradingPollTimer=0;}
        async function apiRequest(){calls++;return structuredClone(payload);}
        ${code}
        renderResult(structuredClone(payload));
        const first=elements.questionDetails.children[0];
        first.querySelector('summary').click();first.querySelector('summary').focus();
        return {state,payload,elements,first,render:()=>renderResult(structuredClone(payload)),refresh:refreshWritingGrading,start:scheduleWritingGradingRefresh,stop:stopWritingGradingPolling,calls:()=>calls,listeningOnly:()=>{listeningOnly=true;},snapshot:()=>({open:Array.from(elements.questionDetails.children,n=>n.open),same:first===elements.questionDetails.children[0],focused:document.activeElement===first.querySelector('summary')})};
      `)();
      window.probe.start();
    }, code);
    await page.waitForFunction(() => window.probe.calls() === 1, { timeout: 12_000 });
    const polled = await page.evaluate(() => { window.probe.stop(); return window.probe.snapshot(); });
    assert.deepEqual(polled, {open:[true,false],same:true,focused:true}, 'Polling không được đóng bảng hoặc làm mất focus');

    const ready = await page.evaluate(async () => {
      const p=window.probe;
      p.elements.questionDetails.children[1].querySelector('summary').click();
      p.payload.writing.grading.ready=true;await p.refresh();return p.snapshot();
    });
    assert.deepEqual(ready.open, [true,true], 'Chấm xong vẫn giữ cả hai bảng đang mở');
    const changed = await page.evaluate(() => {
      const p=window.probe;
      p.payload.result.listening.details.push({number:2,studentAnswer:'B',correctAnswer:'C',result:'incorrect'});
      p.render();return {...p.snapshot(),rows:p.elements.questionDetails.children[0].querySelectorAll('tbody tr').length};
    });
    assert.deepEqual(changed.open,[true,true]);
    assert.equal(changed.rows,2,'Dữ liệu câu mới vẫn phải hiện');
    const closed = await page.evaluate(() => {
      const p=window.probe;p.elements.questionDetails.children[0].querySelector('summary').click();p.render();return p.snapshot().open;
    });
    assert.deepEqual(closed,[false,true],'Giữ độc lập lựa chọn đóng/mở từng kỹ năng');
    const switched = await page.evaluate(() => {
      const p=window.probe;p.state.attemptToken='fake-b';p.render();return p.snapshot().open;
    });
    assert.deepEqual(switched,[false,false],'Không mang trạng thái sang lượt khác');
    const retake = await page.evaluate(() => {
      const p=window.probe;p.listeningOnly();p.render();p.elements.questionDetails.children[0].querySelector('summary').click();p.render();return p.snapshot().open;
    });
    assert.deepEqual(retake,[true],'Thi bù riêng Listening cũng giữ toggle');
  } finally {
    await browser.close();
  }
});
