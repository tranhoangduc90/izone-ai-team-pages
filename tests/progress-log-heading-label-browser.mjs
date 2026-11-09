import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {extname} from 'node:path';
import test from 'node:test';

const {chromium} = createRequire('C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const id = n => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
const options = [{id: id(1), label: 'i A new method'}, {id: id(2), label: 'ii An unexpected result'}];
const items = [1, 2].map((number, index) => ({
  itemVersionId: id(10 + number), itemFamilyId: id(20 + number), position: number,
  displayNumber: String(number), prompt: `The suitable heading for Paragraph ${'AB'[index]} is`,
  required: true, skillCodes: ['reading'], pedagogicalTypeCode: 'matching_headings',
  layoutType: 'matching_heading_dropdown', interactionType: 'single_choice',
  interactionConfig: {}, graderType: 'exact_option', maxScore: 1, options,
}));
const block = {blockId: id(40), checkpoint: 1, title: 'Reading', items};
const assignment = {
  assignmentId: id(50), publicToken: id(50), sessionNumber: 3,
  class: {id: '-99', name: 'Lớp giả'}, roster: [{studentRef: id(60), name: 'Học viên giả'}],
  definitionHash: 'a'.repeat(64), definition: {title: 'Matching headings · Buổi 3', blocks: [block]},
  blockReleases: [{blockId: block.blockId, status: 'open'}],
};

for (const preview of [false, true]) {
  test(`Matching Headings · ${preview ? 'Xem trước' : 'học viên'} · nhãn, nháp, chấm`, {timeout: 45000}, async () => {
    const server = createServer(async (request, response) => {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      if (!pathname.startsWith('/progress-log/') && !pathname.startsWith('/shared/')) {
        response.writeHead(404).end();
        return;
      }
      try {
        const content = await readFile(new URL('..' + pathname, import.meta.url));
        response.setHeader('Content-Type', {'.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css'}[extname(pathname)] || 'application/octet-stream');
        response.end(content);
      } catch {
        response.writeHead(404).end();
      }
    });
    await new Promise(done => server.listen(0, '127.0.0.1', done));
    const local = `http://127.0.0.1:${server.address().port}`;
    const base = process.env.PROGRESS_LOG_TEST_BASE || local;
    const previewBase = process.env.PROGRESS_LOG_TEST_RELEASE
      ? `${base}/progress-log/releases/${process.env.PROGRESS_LOG_TEST_RELEASE}` : base;
    const origin = new URL(base).origin;
    const browser = await chromium.launch({channel: 'chrome', headless: true});
    const page = await browser.newPage({serviceWorkers: 'block', viewport: {width: preview ? 1440 : 390, height: 900}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let draft = {}, revision = 0, checkpoint, final = false, startCount = 0, submissionCount = 0;
    const selected = Object.fromEntries(items.map(item => [item.itemVersionId, options[0].id]));
    const result = {
      answerRelease: 'released', summary: {maxScore: 2, scoreEarned: 1},
      items: items.map((item, index) => ({itemVersionId: item.itemVersionId, maxScore: 1,
        rawAnswer: options[0].id, expectedAnswer: options[index].id, verdict: index ? 'incorrect' : 'correct'})),
    };
    const attempt = () => ({attemptToken: id(70), draft, draftRevision: revision,
      identity: {studentRef: id(60), studentName: 'Học viên giả', classId: '-99', className: 'Lớp giả', sessionNumber: 3},
      checkpointSubmissions: checkpoint ? [checkpoint] : []});
    const finalReply = {receipt: {message: 'Đã nhận phiếu.', completeness: 'complete', attendanceStatus: 'self_confirmed'}, result};
    const calls = [];
    await page.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      const path = url.pathname;
      const json = body => route.fulfill({json: {ok: true, ...body}});
      if (path === '/__heading_preview') {
        return route.fulfill({contentType: 'text/html; charset=utf-8', body: `<button disabled>Xem trước</button><script type="module">
          import {openWorksheetPreview} from '${previewBase}/progress-log/worksheet-preview.js';
          const button = document.querySelector('button');
          button.onclick = () => openWorksheetPreview({title: 'Matching headings', prepare: async () => 'test-grant'});
          button.disabled = false;
        </script>`});
      }
      if (path.endsWith('/api/demo/runs')) return json({run: {publicToken: id(50), teacherToken: 'test-demo-teacher'}});
      if (path.endsWith('/api/demo/runs/open-blocks')) return json({});
      if (path.includes('/api/learning/')) {
        calls.push(path);
        if (path.endsWith('/frontend-release') && base !== local) return route.continue();
        if (path.endsWith('/assignments/open')) return json({assignment});
        if (path.endsWith('/attempts/resume')) return startCount ? json({attempt: attempt()})
          : route.fulfill({status: 404, json: {ok: false, error: 'ATTEMPT_NOT_FOUND'}});
        if (path.endsWith('/attempts/start')) { startCount++; return json({attempt: attempt()}); }
        if (path.endsWith('/attempts/draft')) {
          ({responses: draft, revision} = request.postDataJSON());
          return json({draft: {revision}});
        }
        if (path.endsWith('/checkpoints/submit')) {
          const body = request.postDataJSON();
          assert.deepEqual(body.responses, selected, 'giữ UUID của từng câu trong bài nộp');
          checkpoint = {blockId: block.blockId, completeness: 'complete', result};
          return json({checkpointSubmission: checkpoint});
        }
        if (path.endsWith('/attempts/submit')) { submissionCount++; final = true; return json(finalReply); }
        if (path.endsWith('/attempts/result') && final) return json(finalReply);
        return json({});
      }
      if (url.origin !== origin) return route.abort();
      return route.continue();
    });
    try {
      if (preview) {
        await page.goto(origin + '/__heading_preview');
        await page.getByRole('button', {name: 'Xem trước'}).click();
      } else {
        await page.goto(`${base}/progress-log/index.html#assignment=${assignment.publicToken}`);
      }
      const view = preview ? page.frameLocator('iframe.thuy-library-preview') : page;
      if (!preview) {
        await view.locator('#studentSelect').selectOption(id(60));
        await view.locator('#chooseStudentButton').click();
        await view.locator('#confirmButton').click();
      } else {
        await view.getByRole('button', {name: 'Bắt đầu làm'}).click();
      }
      const dropdowns = view.locator('.matching-heading-select');
      await dropdowns.first().waitFor({timeout: 7000}).catch(async error => {
        const body = await view.locator('body').innerText({timeout: 2000}).catch(() => '');
        throw new Error(`${error.message}\n${body}\n${JSON.stringify({errors, calls})}`);
      });
      assert.equal(await dropdowns.count(), items.length);
      for (const dropdown of await dropdowns.all()) {
        assert.deepEqual(await dropdown.locator('option').allTextContents(), ['Chọn heading', ...options.map(option => option.label)]);
        assert.deepEqual(await dropdown.locator('option').evaluateAll(nodes => nodes.map(node => node.value)), ['', ...options.map(option => option.id)]);
        await dropdown.selectOption(options[0].id);
      }
      assert.deepEqual(await view.locator('.heading-choice-preview').allTextContents(), [options[0].label, options[0].label]);
      await page.waitForResponse(response => response.url().endsWith('/attempts/draft') && response.ok(), {timeout: 15000});
      assert.deepEqual(draft, selected);
      if (preview) {
        const loaded = page.waitForEvent('framenavigated', frame => frame.parentFrame() === page.mainFrame());
        await view.locator('body').evaluate(() => setTimeout(() => location.reload(), 0));
        await loaded;
        await view.getByRole('button', {name: 'Tiếp tục làm'}).click();
      } else {
        await page.reload();
      }
      await dropdowns.first().waitFor();
      assert.deepEqual(await dropdowns.evaluateAll(nodes => nodes.map(node => node.value)), [options[0].id, options[0].id]);
      assert.equal(startCount, 1, 'tải lại khôi phục lượt cũ');
      if (preview) {
        await view.getByRole('button', {name: 'Nộp phần này'}).click();
        const review = view.locator('.thuy-part-review');
        await review.getByText('1 đúng · 1 sai / 2 câu đã chấm', {exact: true}).waitFor();
        assert.match(await review.textContent(), /Đáp án đúng: ii An unexpected result/);
        assert.doesNotMatch(await review.textContent(), /11111111-/);
      } else {
        await view.locator('#reflectionForm').evaluate(form => form.requestSubmit());
        await view.locator('.checkpoint-score').filter({hasText: '1/2'}).waitFor();
        assert.equal(await view.locator('.heading-feedback.is-correct').count(), 1);
        assert.equal(await view.locator('.heading-feedback.is-incorrect').count(), 1);
        assert.match(await view.locator('.heading-feedback.is-incorrect').textContent(), /ii An unexpected result/);
        assert.doesNotMatch((await view.locator('.heading-feedback').allTextContents()).join(' '), /11111111-/);
      }
      await page.waitForFunction(() => document.readyState === 'complete');
      await page.waitForResponse(response => response.url().endsWith('/attempts/submit') && response.ok(), {timeout: 5000})
        .catch(error => { if (submissionCount !== 1) throw error; });
      assert.equal(submissionCount, 1);
      assert.deepEqual(errors, []);
      assert.ok(calls.some(path => path.endsWith('/attempts/resume')));
    } finally {
      await browser.close();
      await new Promise(done => server.close(done));
    }
  });
}
