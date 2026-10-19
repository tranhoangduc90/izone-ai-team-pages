import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, resolve, sep, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Renderer thật, API/Google giả để kiểm riêng UI/race/đổi vai; không gọi hệ thống bên ngoài.
const imported = process.env.PLAYWRIGHT_MODULE ? await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href) : await import('playwright');
const { chromium } = imported.chromium ? imported : imported.default;
const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const output = process.env.TEACHER_EVIDENCE_DIR || join(root, 'output/playwright/teacher-progress');
await mkdir(output, { recursive: true });
const baseA = '20000000-0000-4000-8000-000000000001', baseB = '20000000-0000-4000-8000-000000000002';
const savedAt = '2026-10-19T02:00:00.000Z';
const codes = { speaking: '67-speaking-diem_giua', reading: '67-practice-reading_matching_heading_mcq', listening: '67-practice-listening_mcq_flowchart' };
const variants=['speaking','speaking-legacy','speaking-personal','speaking-legacy-personal','reading','listening']
  .map(variant=>({variant,product:variant.startsWith('speaking')?'speaking':variant}));
if(process.env.TEACHER_DEFINITIONS_DIR)for(const product of ['reading','listening']){
  const rows=JSON.parse(await readFile(join(process.env.TEACHER_DEFINITIONS_DIR,product+'-definitions-readonly.json'),'utf8'));
  rows.forEach((row,i)=>variants.push({variant:product+'-definition-'+i,product,captured:row}));
}

for (const {variant,product,captured} of variants) test(`${variant}: chưa nộp, đổi A/B, tải lại, hết phiên và không tải audio`, async t => {
  const code=captured?.code||codes[product],questionIds=captured?.question_ids||['21','22'];
  const A = (variant.includes('legacy') ? 'legacy_' : '') + baseA, B = (variant.includes('legacy') ? 'legacy_' : '') + baseB;
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const path = resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!path.startsWith(root + sep)) return res.writeHead(403).end();
    try { const data = await readFile(path);res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' })[extname(path)] || 'application/octet-stream' });res.end(data); }
    catch { res.writeHead(404).end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  let browser;
  // Đóng tab trước máy chủ; polling của trang không được giữ bước dọn bộ thử vô hạn.
  t.after(async () => { if (browser) await browser.close();server.closeAllConnections();await new Promise(r => server.close(r)); });
  browser = await chromium.launch({ channel: process.env.TEACHER_BROWSER_CHANNEL || 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();page.setDefaultTimeout(7000);
  const errors = [], forbidden = [], calls = [];let signed = true, delayA = false;
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { if (!localStorage.getItem('fixture-student-memory')) { localStorage.setItem('fixture-student-memory', 'Học viên đang nhớ');localStorage.setItem('fixture-student-draft', 'Bản nháp cần giữ'); } });
  const endpoint = product === 'speaking' ? '/mapping-api/api/speaking-homework-independent/teacher/progress' : '/api/teacher/progress';
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (/\.(mp3|wav|ogg)(?:$|\?)|\/audio(?:[/?-]|$)/i.test(url.href)) { forbidden.push(url.href);return route.abort(); }
    if (url.hostname === 'accounts.google.com') return route.fulfill({ contentType: 'text/javascript', body: `window.google={accounts:{id:{initialize(o){this.callback=o.callback},renderButton(el){let b=document.createElement('button');b.textContent='Google thử';b.onclick=()=>this.callback({credential:'fixture-google-credential'});el.replaceChildren(b)},disableAutoSelect(){}}}};` });
    if (url.pathname.startsWith('/api/') || url.hostname === 'ducizone.ddns.net') {
      calls.push({ path: url.pathname, method: req.method() });
      if (url.pathname.endsWith('/config')) return route.fulfill({ json: { googleClientId: 'fixture-google-client' } });
      if (url.pathname.endsWith('/teacher/login') || url.pathname.endsWith('/auth/session')) { signed = req.method() !== 'DELETE';return route.fulfill({ json: { ok: true } }); }
      if (url.pathname.endsWith('/teacher/logout')) { signed = false;return route.fulfill({ json: { ok: true } }); }
      if (!signed) return route.fulfill({ status: 401, json: { error: { code: 'LOGIN_REQUIRED', message: 'Đăng nhập lại để xem bài.' } } });
      if (url.pathname === endpoint + '/entry') return route.fulfill({json:{code,classId:'1124',studentRef:baseA,documentId:'fixture-doc',unitIds:[A]}});
      if (url.pathname === endpoint + '/classes') return route.fulfill({ json: { classes: [{ classId: '1124', classCode: 'LỚP THỬ 67' }] } });
      if (url.pathname === endpoint + '/students') return route.fulfill({ json: { assignment: { title: 'Bài kiểm thử' }, students: [A, B].map((id, i) => ({ studentRef: product==='speaking'?[baseA,baseB][i]:id, name: i ? 'Học viên B' : 'Học viên A', active: true, units: [{ id, status: 'draft', sentLinks: 1, answered: 1, savedAt }] })) } });
      if (url.pathname.startsWith(endpoint + '/units/')) {
        const id = url.pathname.split('/').at(-1), name = id === A ? 'Học viên A' : 'Học viên B';
        if (id === A && delayA) await new Promise(r => setTimeout(r, 300));
        const body = { id, student: { name, classCode: 'LỚP THỬ 67' }, savedAt, status: 'draft',
          assignment: { title: 'Bài kiểm thử', parts: [{ part_key: 'freestyle', display_title: 'Luyện câu trả lời' }], requiredPracticeCount: 1 },
          links: [{ kind: 'main', part: 'freestyle', status: 'pending', url: 'https://chatgpt.com/share/fixture', savedAt }],
          code,definition: captured?.definition||{ passage: { A: 'Nội dung đọc giả để kiểm giao diện.' } }, questionIds,
          attempts: [{ id, no: 1, status: 'running', answers: { '21': id === A ? 'A' : 'B' }, notes: 'Nháp của ' + name }] };
        return route.fulfill({ json: body }).catch(() => {});
      }
      forbidden.push(url.href);return route.fulfill({ status: 500, json: { error: { message: 'Đường ngoài hợp đồng thử' } } });
    }
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) { forbidden.push(url.href);return route.abort(); }
    return route.continue();
  });
  const folder = product === 'speaking' ? 'speaking-homework' : `${product}-practice`;
  const url = `http://127.0.0.1:${server.address().port}/${folder}/teacher-progress.html?code=${code}${variant.includes('personal')?'&documentId=fixture-doc':''}`;
  await page.goto(url);
  if(!variant.includes('personal')){
    await page.getByRole('button', { name: 'Xem bài →', exact: true }).first().waitFor();
    await page.getByRole('button', { name: 'Xem bài →', exact: true }).first().click();
  }
  await page.getByRole('heading', { name: 'Học viên A', exact: true }).waitFor();
  assert.equal(await page.locator('audio').count(), 0);
  if (product !== 'speaking') assert.match(await page.locator('#detail').innerText(), new RegExp('Câu '+questionIds.find(n=>n!=='21')+'[\\s\\S]*Chưa nhập'));
  if(captured){
    const paper=await page.locator('.teacher-paper').first().innerText(),normal=value=>String(value).replace(/\s+/g,' ').trim();
    const strings=value=>typeof value==='string'?[value]:Array.isArray(value)?value.flatMap(strings):value&&typeof value==='object'?Object.values(value).flatMap(strings):[];
    for(const value of strings(captured.definition))assert.ok(normal(paper).includes(normal(value)),code+': thiếu nội dung đề');
    for(const key of ['headings','experts','endingOptions','bank']){
      const entries=Array.isArray(captured.definition[key])?captured.definition[key]:Object.entries(captured.definition[key]||{});
      for(const [label]of entries)assert.ok(paper.includes(label+'.'),key+': thiếu nhãn');
    }
    for(const row of captured.definition.summary||[])if(row.question)assert.ok(paper.includes('(Câu '+row.question+') _____'));
    for(const row of captured.definition.flow||[])assert.ok(paper.includes('(Câu '+row[0]+') _____'));
    assert.equal(await page.locator('.teacher-paper img,.teacher-paper audio,.teacher-paper iframe').count(),0);
  }
  await page.screenshot({ path: join(output, `${variant}-detail-desktop.png`), fullPage: true });
  // Tải lại phải giữ đúng bài đang xem; chưa có link bài nộp nào trong fixture.
  await page.reload();await page.getByRole('heading', { name: 'Học viên A', exact: true }).waitFor();
  await page.getByRole('link', { name: '← Về danh sách học viên' }).click();
  if(variant.includes('personal'))await page.locator('#search').fill('');
  delayA = true;
  await page.getByRole('button', { name: 'Xem bài →', exact: true }).first().click();
  await page.getByRole('button', { name: 'Xem bài →', exact: true }).nth(1).click();
  await page.getByRole('heading', { name: 'Học viên B', exact: true }).waitFor();
  await page.waitForTimeout(350);
  assert.equal(await page.getByRole('heading', { name: 'Học viên A', exact: true }).count(), 0);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: join(output, `${variant}-detail-mobile.png`), fullPage: true });
  signed = false;
  await page.getByRole('button', { name: 'Cập nhật bài đã lưu' }).click();
  await page.getByRole('button', { name: 'Google thử' }).waitFor();
  assert.equal((await page.locator('body').innerText()).includes('Học viên B'), false);
  await page.getByRole('button', { name: 'Google thử' }).click();
  await page.getByRole('heading', { name: 'Học viên B', exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => [localStorage.getItem('fixture-student-memory'), localStorage.getItem('fixture-student-draft')]), ['Học viên đang nhớ', 'Bản nháp cần giữ']);
  assert.deepEqual(errors, []);assert.deepEqual(forbidden, []);
  assert.equal(calls.some(c => /\/(begin|open|pulse|submit|audio-access)(?:$|\?)/.test(c.path)), false);
  await writeFile(join(output, `${variant}-requests.json`), JSON.stringify({ errors, forbidden, calls }, null, 2), 'utf8');
});
