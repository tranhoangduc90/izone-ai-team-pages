import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// HTML/renderer thật; mọi API dùng danh tính và link giả, không gọi AI/Docs/nộp thật.
const root = resolve(process.env.SPEAKING_PAGES_ROOT || fileURLToPath(new URL('../', import.meta.url)));
const output = process.env.SPEAKING_EVIDENCE_DIR; assert.ok(output); await mkdir(output, { recursive: true });
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const server = createServer(async (req, res) => {
  try {
    const path = resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!path.startsWith(root + '/'.replace('/', process.platform === 'win32' ? '\\' : '/'))) throw Error('outside root');
    const data = await readFile(path);
    res.writeHead(200, { 'content-type': ({ '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png' })[extname(path)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.SPEAKING_BROWSER_PATH || 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
const results = [];
const ref = '70000000-0000-4000-8000-000000000001';
const share = n => 'https://chatgpt.com/share/' + String(n).padStart(32, '0');
const lessons = [
  { n: 2, file: 'index.html', code: '67-speaking-paraphrase', parts: ['paraphrase', 'speaking'], mins: [5, 2], practice: 0 },
  { n: 3, file: 'lesson-3.html', code: '67-speaking-lam_ro', parts: ['clarify_1', 'clarify_2', 'clarify_3', 'freestyle'], mins: [3, 2, 2, 2], practice: 0 },
  { n: 11, file: 'lesson-11.html', code: '67-speaking-ke_chuyen_dien_bien_chi_tiet', parts: ['story_detail', 'story_sequence'], mins: [1, 1], practice: 2 },
];
try {
  for (const lesson of lessons) for (const mode of ['independent', 'legacy']) for (const width of [390, 1440]) for (const scenario of lesson.n===11?['main','extra-success','extra-incomplete']:['main']) {
    if(process.env.SPEAKING_REAL_POLL==='1' && !(lesson.n===11&&mode==='independent'&&width===390&&scenario==='main'))continue;
    const context = await browser.newContext({ viewport: { width, height: 950 } });
    const page = await context.newPage(); page.setDefaultTimeout(12_000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const realPoll=process.env.SPEAKING_REAL_POLL==='1';
    if(!realPoll)await page.clock.install();
    const nextPoll=async()=>{if(realPoll)await page.waitForTimeout(15_100);else await page.clock.fastForward(15_100);};
    const extraScenario=scenario.startsWith('extra-');
    let phase = 'error', extraPhase='error', extraChecks=0, checks = 0, practiceChecks = 0, opens = 0, finishes = 0;
    const part = lesson.parts[0];
    const makeLink = key => ({ part: key, share_url: share(1), check_status: phase === 'success' ? 'accepted' : phase === 'pending' ? 'pending' : 'rejected',
      check_code: phase === 'error' ? 'CHECK_REVIEW_REQUIRED' : null, retryable: phase === 'error', question_count: lesson.mins[0], revision: phase === 'error' ? 1 : 2 });
    const exercise = { exercise_id: '70000000-0000-4000-8000-000000000002', title: 'Bài bổ trợ giả', exercise_url: 'https://example.invalid/practice', recommendation_count: 1, practice_count: 0 };
    const secondExercise={...exercise,exercise_id:'70000000-0000-4000-8000-000000000003',title:'Bài bổ trợ thứ hai'};
    if(extraScenario)await page.addInitScript(({ref,mode,exerciseId,url})=>{
      const key=`speaking-homework:lesson-11:${mode==='independent'?'fixture-retry-11':'fixture-doc-11'}:${ref}`;
      localStorage.setItem(key,JSON.stringify({extraExercise:exerciseId,extraLink:url}));
    },{ref,mode,exerciseId:exercise.exercise_id,url:share(4)});
    const assignment = { assignmentCode: lesson.code, classCode: 'LOPMAU', assignmentStatus: 'open', title: 'Bài mẫu',
      parts: lesson.parts.map((key, i) => ({ part_key: key, min_questions: lesson.mins[i] })), requiredPracticeCount: lesson.practice,
      doctorEnabled: lesson.n !== 3, students: [{ student_ref: ref, name: 'Học viên giả' }] };
    await page.route('https://ducizone.ddns.net/mapping-api/api/student-identity/resolve', route => route.fulfill({ json: { ok: true, status: 'unique', identity: { authority: 'erp-contact', id: '12345' }, aliases: [{ classId: '111', classCode: 'LOPMAU', studentRef: ref, studentName: 'Học viên giả' }] } }));
    await page.route('https://ducizone.ddns.net/mapping-api/api/speaking-homework*/**', async route => {
      const path = new URL(route.request().url()).pathname.split(/speaking-homework(?:-independent)?/)[1];
      const body = route.request().postDataJSON() || {}; let data;
      if (path === '/classes') data = { classes: [{ classCode: 'LOPMAU', ready: true, assignmentStatus: 'open' }] };
      else if (path === '/assignment/roster') data = { assignment };
      else if (path === '/identity/resolve') data = { status: 'unique', classCode: 'LOPMAU' };
      else if (path === '/session/start-selected') data = { session: { accessToken: 'fixture-token-'.padEnd(48, 'x'), studentRef: ref, classCode: 'LOPMAU', intakeMode: mode,
        ...(mode === 'independent' ? { workUnitId: 'fixture-retry-' + lesson.n } : {}), documentId: 'fixture-doc-' + lesson.n } };
      else if (path === '/open') {
        opens++;
        data = { links: [makeLink(part), { part: lesson.parts[1], share_url: share(3), check_status: 'pending', question_count: 0 }], practiceLinks: lesson.practice ? [{ slot: 1, exercise_id: exercise.exercise_id, share_url: share(2), status: practiceChecks ? 'pending' : 'rejected', retryable: !practiceChecks, check_code: practiceChecks ? null : 'CHECK_SERVICE_UNAVAILABLE', analysis_status: null }] : [], status: 'draft', receipt: null };
        if(extraScenario)data={...data,links:lesson.parts.map((part,i)=>({part,share_url:share(i+10),check_status:'accepted',question_count:1})),status:'submitted',receipt:{id:'RECEIPT-FIXTURE-KEEP'},processing:{analyze_homework:{status:'pending'}},practiceLinks:[
          {slot:1,exercise_id:exercise.exercise_id,share_url:share(20),status:'accepted',analysis_status:'done'},
          {slot:2,exercise_id:secondExercise.exercise_id,share_url:share(21),status:'accepted',analysis_status:'done'},
          {slot:3,exercise_id:exercise.exercise_id,share_url:share(4),status:extraPhase==='success'?'accepted':extraPhase==='pending'?'pending':'rejected',check_code:extraPhase==='error'?'CHECK_REVIEW_REQUIRED':extraPhase==='incomplete'?'PRACTICE_INCOMPLETE':null,retryable:extraPhase==='error',analysis_status:null},
          {slot:4,exercise_id:secondExercise.exercise_id,share_url:share(5),status:'accepted',analysis_status:'done'}]};
      } else if (path === '/doctor/list') data = { needed: [exercise,secondExercise], allNeeded: [exercise,secondExercise], neededCount: 2, personalCount: 2, sharedCatalog: [], practiced: [] };
      else if (path === '/checks/request') { assert.equal(body.url, share(1)); checks++; phase = 'pending'; data = { check: { id: 'fixture-retry-check', status: 'pending' } }; }
      else if (path === '/doctor/practice/request') { assert.equal(body.url, share(2)); practiceChecks++; data = { check: { id: 'fixture-practice-retry', status: 'pending' } }; }
      else if (path === '/doctor/practice/extra/request') { assert.equal(body.url,share(4)); extraChecks++;extraPhase='pending';data={check:{id:'EXTRA-RETRY-FIXTURE',status:'pending'}}; }
      else if (path === '/finish') { finishes++; throw Error('partial fixture must never submit'); }
      else throw Error('Unexpected API ' + path);
      await route.fulfill({ json: { ok: true, ...data } });
    });
    try {
      await page.goto(`${origin}/speaking-homework/${lesson.file}?class=LOPMAU`);
      await page.locator('#class-select').selectOption('LOPMAU');
      await page.locator('#student-select').selectOption(ref); await page.locator('#open-homework').click();
      if(extraScenario){
        const result=page.locator('#extra-result'),button=page.locator('#extra-confirm');
        await result.getByText('Hệ thống đang gặp lỗi',{exact:true}).waitFor();
        assert.equal(await button.innerText(),'Thử kiểm tra lại');
        await page.evaluate(()=>{window.historyKeep=document.querySelector('#extra-history [data-slot="4"]');window.optionKeep=document.querySelector('#extra-exercise option:checked');});
        for(let i=0;i<3;i++){await page.clock.fastForward(15_100);await page.waitForTimeout(50);}
        assert.equal(await page.evaluate(()=>window.historyKeep===document.querySelector('#extra-history [data-slot="4"]')&&window.optionKeep===document.querySelector('#extra-exercise option:checked')),true);
        await button.click();await result.getByText('Đang kiểm bài luyện thêm',{exact:true}).waitFor();
        assert.equal(extraChecks,1);assert.equal(await button.isDisabled(),true);
        extraPhase=scenario==='extra-success'?'success':'incomplete';await page.clock.fastForward(15_100);
        await result.getByText(extraPhase==='success'?'Đã nhận bài luyện thêm':'Bài luyện cần bổ sung',{exact:true}).waitFor();
        assert.equal(await page.locator('#extra-link').inputValue(),extraPhase==='success'?'':share(4));
        assert.equal(await page.evaluate(()=>window.historyKeep===document.querySelector('#extra-history [data-slot="4"]')),true);
        assert.equal(finishes,0);assert.deepEqual(errors,[]);
        await page.screenshot({path:`${output}/lesson-11-${mode}-${width}-${scenario}.png`,fullPage:true});
        results.push({lesson:lesson.n,mode,width,scenario,opens,extraChecks,outcome:'passed'});continue;
      }
      const result = page.locator(`#${part}-result`), button = page.locator(`#${part}-confirm`);
      await result.getByText('Hệ thống đang gặp lỗi', { exact: true }).waitFor();
      assert.equal(await button.innerText(), 'Thử kiểm tra lại');
      assert.equal(await button.isDisabled(), false);
      assert.equal(await page.locator(`#${part}-link`).inputValue(), share(1));
      await page.screenshot({path:`${output}/lesson-${lesson.n}-${mode}-${width}-technical-error.png`,fullPage:true});
      await page.evaluate(part => {
        const node = document.getElementById(part + '-result').querySelector('span'); window.retryNode = node;
        const selection = getSelection(); const range = document.createRange(); range.selectNodeContents(node); selection.removeAllRanges(); selection.addRange(range);
        document.getElementById(part + '-confirm').focus(); window.retrySelection = selection.toString();
      }, part);
      // Ba nhịp poll thật của renderer, clock được điều khiển trong fixture.
      for (let i = 0; i < 3; i++) { await nextPoll(); await page.waitForTimeout(30); }
      assert.ok(opens >= 4, 'three background reads must actually run');
      assert.equal(await page.evaluate(part => window.retryNode === document.getElementById(part + '-result').querySelector('span') && getSelection().toString() === window.retrySelection && document.activeElement.id === part + '-confirm', part), true);
      await page.evaluate(part => { const button = document.getElementById(part + '-confirm'); button.click(); button.click(); }, part);
      await result.getByText(/Đang kiểm nội dung|Đang đọc hội thoại/).waitFor();
      assert.equal(checks, 1); assert.equal(await button.isDisabled(), true);
      phase = 'success'; await nextPoll(); await result.getByText('Đã xác nhận hội thoại', { exact: true }).waitFor();
      assert.equal(await page.locator(`#${part}-link`).inputValue(), share(1));
      if (lesson.practice) {
        const practiceButton = page.locator('#practice-1-confirm');
        assert.equal(await practiceButton.innerText(), 'Thử kiểm tra lại');
        await practiceButton.click();
        await page.locator('#practice-1-result').getByText('Đang kiểm bài bổ trợ', { exact: true }).waitFor();
        assert.equal(practiceChecks, 1); assert.equal(await practiceButton.isDisabled(), true);
      }
      assert.equal(finishes, 0); assert.deepEqual(errors, []);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      await page.screenshot({ path: `${output}/lesson-${lesson.n}-${mode}-${width}.png`, fullPage: true });
      results.push({ lesson: lesson.n, mode, width, opens, checks, practiceChecks, outcome: 'passed' });
    } finally { await context.close(); }
  }
} catch (error) { results.push({ outcome: 'failed', error: error.message }); throw error; }
finally { await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2)); await browser.close(); await new Promise(resolve => server.close(resolve)); }
console.log('Speaking retry browser: ' + results.length + ' PASS');
