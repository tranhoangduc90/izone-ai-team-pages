// Giao diện thật, dữ liệu giả và chặn mạng ngoài. Không nộp/chấm bài học viên.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {serve, chromium} from './helpers/k56-design-fixture.mjs';

const cases = [
  ['term-test-1-k56', 'task2', 55],
  ['term-test-2-k56', 'task1', 30],
  ['mini-test-k56', 'task2', 15],
  ['substitute-test-1-k56', 'task2', 55],
  ['substitute-test-2-k56', 'task1', 30]
];
const evidence = resolve('output/playwright/k56-no-outline');
mkdirSync(evidence, {recursive:true});
let server, browser;
test.before(async()=>{
  server = await serve(process.env.K56_NO_OUTLINE_ROOT || resolve('.'));
  browser = await chromium.launch({channel:'chrome', headless:true});
});
test.after(async()=>{await browser?.close(); await server?.close();});

for (const [slug,task,minutes] of cases) test(`${slug}: bỏ ô, giữ dữ liệu cũ và tổng thời gian`, async()=>{
  const context = await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1000}});
  const page = await context.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',r=>r.request().url().startsWith(server.base)?r.continue():r.abort());
  const substitute=slug.startsWith('substitute');
  const key=`izone-test:${slug}:FIXTURE${substitute?':preview:writing':slug==='mini-test-k56'?':cbt':''}`;
  const startedAt=new Date().toISOString(), deadlineAt=new Date(Date.now()+minutes*60000).toISOString();
  const oldOutline='Dàn ý cũ — phải giữ nguyên, không gửi rỗng.';
  const oldEssay='Original synthetic essay for this exact exam.';
  await context.addInitScript(({key,startedAt,deadlineAt,oldOutline,oldEssay,task})=>{
    if(sessionStorage.getItem('no-outline-seeded'))return;
    sessionStorage.setItem('no-outline-seeded','1');
    const state={studentRef:'11111111-1111-4111-8111-111111111111',studentName:'Học viên giả',
      attemptToken:'22222222-2222-4222-8222-222222222222',completed:true,writingStarted:true,
      writingSubmitted:false,writingStartedAt:startedAt,writingDeadlineAt:deadlineAt,
      drafts:{listening:{1:'OLD-L'},reading:{1:'OLD-R'},writing:{outline:oldOutline,task1:'',task2:'',[task]:oldEssay}}};
    for(const storage of [sessionStorage,localStorage])storage.setItem(key,JSON.stringify(state));
  },{key,startedAt,deadlineAt,oldOutline,oldEssay,task});
  const stored=()=>page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)),key);
  try {
    await page.goto(`${server.base}term-tests/${slug}-computer-based/?demo=writing&class=FIXTURE`);
    await page.locator('#writingView').waitFor({state:'visible'});
    assert.equal(await page.locator('.writing-outline-card,[data-writing-outline]').count(),0);
    assert.doesNotMatch(await page.locator('#writingPrepView').innerText(),/lập dàn ý/i);
    const editor=page.locator(`[data-writing-task="${task}"]`);
    assert.equal(await editor.inputValue(),oldEssay);
    assert.equal(await page.locator('[data-writing-task]').count(),1);
    assert.equal(await page.evaluate(()=>window.TERM_TEST_CONTENT.writing.totalMinutes),minutes);
    assert.equal(await page.locator('#submitWriting').isEnabled(),true);
    const before=await stored();
    await editor.fill(oldEssay+' A new sentence preserves the old outline.');
    const edited=await stored();
    assert.equal(edited.drafts.writing.outline,oldOutline);
    assert.equal(edited.drafts.reading[1],'OLD-R');
    assert.equal(edited.drafts.listening[1],'OLD-L');
    assert.equal(edited.writingDeadlineAt,before.writingDeadlineAt);
    assert.equal(edited.writingStartedAt,before.writingStartedAt);
    await editor.evaluate(e=>{window.savedWritingEditor=e;e.focus();e.setSelectionRange(3,12);});
    await page.waitForTimeout(3300); // Qua ít nhất ba nhịp timer/tự lưu.
    assert.equal(await editor.evaluate(e=>e===window.savedWritingEditor&&e.selectionStart===3&&e.selectionEnd===12),true);
    await page.reload();
    await page.locator('#writingView').waitFor({state:'visible'});
    assert.equal(await editor.inputValue(),edited.drafts.writing[task]);
    const restored=await stored();
    assert.equal(restored.drafts.writing.outline,oldOutline);
    assert.equal(restored.writingDeadlineAt,deadlineAt);
    assert.equal(restored.writingStartedAt,startedAt);
    await page.screenshot({path:resolve(evidence,slug+'.png'),fullPage:true});
    assert.deepEqual(errors,[]);
  } finally {await context.close();}
});
