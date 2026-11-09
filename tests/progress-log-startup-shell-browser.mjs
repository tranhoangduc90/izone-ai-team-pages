import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {extname, resolve, sep} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const root = resolve(process.env.PROGRESS_STARTUP_ROOT || fileURLToPath(new URL('..', import.meta.url)));
const {chromium} = createRequire('C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const entries = [
  ['teacher.html', '#teacherNotice'], ['teacher-thuy.html', '#teacherNotice'],
  ['index.html', '#notice'], ['thuy.html', '#notice'], ['student.html', '#portalStatus'],
  ['journey.html', '#journeyNotice'], ['demo/index.html', '#notice'], ['demo/thuy.html', '#notice'],
];

test('Progress Log: mỗi lối vào chỉ hiện màn chờ khi JavaScript chưa tải', {timeout: 45000}, async () => {
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    const page = await browser.newPage({viewport:{width:390,height:844}});
    await page.route('**/*',async route => {
      const url = new URL(route.request().url());
      if (url.origin !== 'http://progress.test' || route.request().resourceType() === 'script') return route.abort();
      const pathname = url.pathname.replace(/^\/izone-ai-team-pages\//u, '/');
      const file = resolve(root, '.' + pathname);
      if (!file.startsWith(root + sep)) return route.abort();
      try {
        return route.fulfill({body:await readFile(file),contentType:extname(file)==='.html'?'text/html; charset=utf-8':
          extname(file)==='.css'?'text/css':'application/octet-stream'});
      } catch {return route.fulfill({status:404,body:''});}
    });
    const version = process.env.PROGRESS_STARTUP_RELEASE;
    const roots = version ? ['progress-log', `progress-log/releases/${version}/progress-log`] : ['progress-log'];
    for (const prefix of roots) {
      for (const [entry, notice] of entries) {
        // Gói bất biến dùng URL tuyệt đối cùng base path GitHub Pages.
        const base = version ? '/izone-ai-team-pages/' : '/';
        const response = await page.goto('http://progress.test' + base + prefix + '/' + entry);
        assert.equal(response.status(), 200, entry);
        assert.equal(await page.locator(notice).isVisible(),true,entry);
        for (const header of await page.locator('body > header, body > aside, body > main > header').all()) {
          assert.equal(await header.isVisible(),false,entry + ' hiện header/menu cũ trước khi app tải');
        }
      }
    }
  } finally {await browser.close();}
});
