// Chỉ localhost và dữ liệu giả. Mọi request ngoài asset local đều bị chặn/mô phỏng.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
export { serve, completedPage } from './result-details-browser-fixture.mjs';
const modules = process.env.CODEX_NODE_MODULES || resolve(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
export const { chromium } = createRequire(pathToFileURL(resolve(modules, 'playwright/package.json')))('playwright');
export const slugs = ['term-test-1-k56', 'term-test-2-k56', 'mini-test-k56'];
export const studentRef = '11111111-1111-4111-8111-111111111111';
const token = '22222222-2222-4222-8222-222222222222';
const session = '33333333-3333-4333-8333-333333333333';

export async function readingPage(browser, base, slug, mode = 'lis_first', delivery = '-computer-based') {
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1366, height: 768 } });
  const page = await context.newPage(), errors = [], calls = [];
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  let draft = {}, revision = 0;
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    let body = {}; try { body = request.postDataJSON() || {}; } catch {}
    const api = body.route || url.pathname.slice(url.pathname.indexOf('/api/'));
    if (url.pathname.includes('/api/') || body.route) {
      if (request.method() === 'OPTIONS') return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'}});
      calls.push(api);
      const now = new Date().toISOString();
      let data = { ok: true };
      if (api.includes('/student-identity')) data = {ok:true,status:'unique',identity:{authority:'erp-contact',id:'900001'},aliases:[{classId:'9999',classCode:'IC9999',studentRef,studentName:'Học viên giả có tên dài để kiểm giao diện K56'}]};
      else if (api.includes('roster')) data = {ok:true,class:{name:'IC9999'},students:[{ref:studentRef,name:'Học viên giả có tên dài để kiểm giao diện K56'}]};
      else if (api.endsWith('/attempt/active')) data = {ok:true,found:true,attemptToken:token,examSessionToken:session,studentName:'Học viên giả có tên dài để kiểm giao diện K56'};
      else if (api.endsWith('/attempt/prepare') || api.endsWith('/session/prepare')) {
        const content = delivery ? await page.evaluate(() => window.K56_TERM_TEST_CONTENT) : {};
        const minutes = await page.evaluate(() => window.TERM_TEST_CONFIG.reading.durationMinutes);
        data = {ok:true,attemptMode:delivery?'cbt':'answer_sheet',policy:{timed:Boolean(delivery),autoSubmit:Boolean(delivery)},generation:0,
          attemptToken:token,examSessionToken:session,studentName:'Học viên giả có tên dài để kiểm giao diện K56',examMode:mode,nextSection:'reading',
          listeningSubmitted:true,readingSubmitted:false,readingStartedAt:now,readingDeadlineAt:new Date(Date.now()+minutes*60000).toISOString(),
          listeningDraft:{},readingDraft:draft,listeningDraftRevision:0,readingDraftRevision:revision,serverNow:now,content};
      } else if (api.endsWith('/reading/draft')) {
        if (body.revision > revision) { draft = body.answers; revision = body.revision; }
        data = {ok:true,accepted:true,revision,draft};
      } else if (api.includes('/result/stream')) return route.fulfill({status:404,body:''});
      else if (!/client-event|\/events|\/result|\/auth\/session/.test(api)) errors.push('API ngoài contract fixture: '+api);
      return route.fulfill({json:data,headers:{'access-control-allow-origin':'*'}});
    }
    if (url.href.startsWith(base)) return route.continue();
    return route.abort();
  });
  await page.goto(base+'term-tests/'+slug+delivery+'/?class=IC9999&mode='+mode);
  const select = page.locator(delivery ? '#bootstrapStudent' : '#studentSelect');
  await select.locator('option').nth(1).waitFor({state:'attached'});
  await select.selectOption(studentRef);
  for (const id of ['confirmIdentity','miniPaperEnter']) {
    const button = page.locator('#'+id);
    if (await button.isVisible()) await button.click();
  }
  await page.locator('#readingView').waitFor({state:'visible'});
  if (delivery) await page.locator('.cbt-reading-section').first().waitFor({state:'attached'});
  await page.evaluate(() => document.fonts.ready);
  return {page,context,errors,calls,draft:()=>draft,close:()=>context.close()};
}
