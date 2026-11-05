import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolve, extname, sep} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const {chromium} = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const site = 'https://tranhoangduc90.github.io';
const api = 'https://ducizone.ddns.net';
const prefix = '/izone-ai-team-pages/';
const broker = '/teacher-session-api/v1/';
const mime = {'.js':'text/javascript', '.mjs':'text/javascript', '.html':'text/html', '.css':'text/css'};

test('Substitute offers explicit Google login if session discovery loses its connection', async t => {
  const browser = await chromium.launch({channel:'msedge', headless:true});
  t.after(() => browser.close());
  for (const suffix of ['1-k56', '2-k56', '1-k67', '2-k67']) {
    const slug = 'substitute-test-' + suffix;
    const page = await browser.newPage({serviceWorkers:'block'});
    let verified = false;
    let discoveryFailed = false;
    const protectedReads = [];
    await page.route('**/*', async route => {
      const req = route.request();
      const url = new URL(req.url());
      const pathname = url.pathname;
      if (url.origin === site && pathname.startsWith(prefix)) {
        const local = resolve(root, pathname.slice(prefix.length) + (pathname.endsWith('/') ? 'index.html' : ''));
        assert.ok(local.startsWith(resolve(root) + sep));
        try {return await route.fulfill({contentType:mime[extname(local)] || 'application/octet-stream', body:fs.readFileSync(local)});}
        catch (error) {if (error.code !== 'ENOENT') throw error; return route.fulfill({status:404});}
      }
      if (url.origin === 'https://accounts.google.com' && pathname === '/gsi/client') {
        return route.fulfill({contentType:'text/javascript', body:`window.google={accounts:{id:{
          initialize({callback}){this.callback=callback},
          renderButton(target){const button=document.createElement('button');button.textContent='Google kiểm thử';button.onclick=()=>this.callback({credential:'fixture-google'});target.replaceChildren(button)},
          disableAutoSelect(){}
        }}};`});
      }
      if (url.origin !== api) return route.abort();
      const headers = {'access-control-allow-origin':site, 'access-control-allow-credentials':'true',
        'access-control-allow-headers':'Content-Type,X-Izone-Csrf', 'access-control-allow-methods':'GET,POST,OPTIONS'};
      const reply = (status, json = {}) => route.fulfill({status, headers, json});
      if (req.method() === 'OPTIONS') return route.fulfill({status:204, headers});
      if (pathname === broker + 'restore/substitute') return reply(verified ? 200 : 401);
      if (pathname.endsWith('/shared-session')) {discoveryFailed = true; return route.abort('failed');}
      if (pathname === broker + 'login/substitute') {
        assert.equal(req.postDataJSON().credential, 'fixture-google');
        verified = true;
        return reply(200);
      }
      if (pathname === '/substitute-teacher-api/teacher/config') return reply(200, {googleClientId:'fixture.apps.googleusercontent.com'});
      protectedReads.push({pathname, verified});
      if (!verified) return reply(401);
      if (pathname.endsWith('/scopes')) return reply(200, {scopes:[{testSlug:slug,classCode:'DEMO'}]});
      if (pathname.endsWith('/results')) return reply(200, {testSlug:slug,classCode:'ALL',results:[],hasMore:false});
      return reply(404);
    });
    try {
      await page.goto(site + prefix + 'term-tests/' + slug + '-results/');
      const button = page.getByRole('button', {name:'Google kiểm thử'});
      await page.waitForFunction(() => document.querySelector('#google-signin button') ||
        document.querySelector('#login-heading')?.textContent === 'Chưa mở được sản phẩm');
      assert.ok(discoveryFailed, slug);
      assert.ok(await button.isVisible(), slug + ' phải hiện Google khi mất kết nối dò phiên');
      assert.deepEqual(protectedReads, [], slug);
      await button.click();
      await page.locator('#filter-section').waitFor({state:'visible'});
      await page.waitForFunction(() => Boolean(document.querySelector('#updated-at')?.textContent));
      assert.deepEqual(protectedReads.map(read => read.pathname.split('/').pop()), ['scopes', 'results'], slug);
      assert.ok(protectedReads.every(read => read.verified), slug);
    } finally {
      await page.context().close();
    }
  }
});
