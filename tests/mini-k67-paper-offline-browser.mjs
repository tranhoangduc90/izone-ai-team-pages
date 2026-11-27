import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const backend = process.env.K67_BACKEND;
assert.ok(backend, 'Set K67_BACKEND to the isolated K67 backend package.');
const { createMiniFixture } = await import(pathToFileURL(resolve(backend, 'test/helpers/mini-answer-sheet-fixture.js')));
const require = createRequire(resolve(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'));
const { chromium } = require('playwright');
const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const ref = '11111111-1111-4111-8111-111111111111';
const term = process.env.K67_PAPER_TERM || (process.env.K67_PAPER_TERM1 === '1' ? '1' : '');
assert.ok(['','1','2'].includes(term),'K67_PAPER_TERM must be 1, 2 or empty for Mini.');
const pretest = process.env.K67_PAPER_PRETEST === '1';
assert.ok(!pretest || !term,'Select either Pretest or a Term profile.');
const journey = Boolean(term || pretest);
const slug = pretest?'pretest-lesson-16':term?'term-test-'+term:'mini-test-lesson-5';
const listenNumber = pretest?'21':'11';
const readingNumber = pretest?'18':term==='2'?'1':'24';
const draftPrefix=(pretest?'pretest-lesson-16-k67-paper-v1':term?'term'+term+'-k67-paper-journey-v1':'mini-k67-paper:run')+':';
const testDeparture = process.env.K67_PAPER_CONFIRMED_DEPARTURE === '1';
const testNativeDeparture = testDeparture && process.env.K67_PAPER_NATIVE_DEPARTURE === '1';
const orderOnly = process.env.K67_PAPER_ORDER;
const testPreviousPretestShell = pretest && process.env.K67_PAPER_UPGRADE_SHELL === '1';
const testLeaseFallback = pretest && process.env.K67_PAPER_IDB_LEASE === '1';
const miniParallel = !journey && process.env.K67_PAPER_MINI_PARALLEL === '1';
const paperFlagOff = process.env.K67_PAPER_FLAG_OFF === '1';
const routeName = '/term-tests/' + slug + '/';
const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve('http://127.0.0.1:' + server.address().port)));
const close = server => new Promise(resolve => server.close(resolve));

for (const mode of ['lis_first', 'read_first'].filter(mode=>!orderOnly||mode===orderOnly))
test(slug + ' K67 paper offline ' + mode, { timeout: 90000 }, async () => {
  const assets = { getTiming: () => ({ readingDurationMinutes: term ? 60 : 20 }) };
  const f = await createMiniFixture({ examOrder: true, assets, ...(journey
    ? {[pretest?'pretestPaperJourneyMode':'term'+term+'PaperJourneyMode']:paperFlagOff?'off':'on',completeSchema:true} : {miniPaperOffline:paperFlagOff?'off':'on', ...(miniParallel?{completeSchema:true,miniPaperParallelEntryMode:'on',
      miniCbtJourneyMode:'on',pretestCbtJourneyMode:'on',term2ParallelEntryMode:'on'}:{})}) });
  if(journey){
    const definition=(start,count)=>JSON.stringify({questions:Array.from({length:count},(_,i)=>({number:i+start,type:'Câu thử',accepted:['A']}))});
    const listening=pretest?definition(21,20):definition(1,40);
    const reading=pretest?definition(14,13):definition(1,40);
    await f.db.query(`INSERT INTO assessment.test_definition(slug,title,version,listening_definition,reading_definition,is_active)
      VALUES($1,'Đề giả',1,$2,$3,true)`,[slug,listening,reading]);
    if(pretest)await f.db.query('UPDATE assessment.test_definition SET open_class_ids=$2 WHERE slug=$1',
      [slug, JSON.stringify(['1293'])]);
  }
  if(miniParallel){
    for(const name of ['047-pretest-cbt-parallel-entry.sql','048-mini-k67-cbt-parallel-entry.sql','050-mini-k67-paper-parallel-entry.sql'])
      await f.db.exec(await readFile(resolve(backend,'db',name),'utf8'));
  }
  const api = createServer(f.app);
  const journalFailures = new Set();
  let servePreviousShell = testPreviousPretestShell && mode==='read_first';
  const web = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;
    // Keep the journal request failure separate from the worker's verified asset fetch.
    if (pathname.startsWith('/term-tests/shared/exam-journal/') && !url.searchParams.has('examBuild')) {
      journalFailures.add(pathname);
      return res.writeHead(503).end();
    }
    try {
      const requested = pathname.endsWith('/') ? pathname + 'index.html' : pathname;
      const file = resolve(root, '.' + (servePreviousShell && requested === routeName+'index.html'
        ? routeName+'index-audio-status-v2.html' : requested));
      if (!file.startsWith(root + sep)) return res.writeHead(403).end();
      const type = extname(file);
      let data = await readFile(file);
      if (['.js', '.mjs', '.html', '.css', '.svg'].includes(type)) data = Buffer.from(data.toString().replace(/\r\n/g, '\n'));
      res.writeHead(200, { 'content-type': types[type] || 'application/octet-stream' }).end(data);
    } catch {
      res.writeHead(404).end();
    }
  });
  const [apiBase, webBase] = await Promise.all([listen(api), listen(web)]);
  let browser, page;
  let lostAck = false, usedParallelPrepare = false;
  const seenOperations = new Map();
  let mediaRequests = 0;
  const errors = [], debug = [];
  try {
    browser = await chromium.launch({ headless: true, channel: process.env.TERM2_BROWSER_CHANNEL || 'msedge' });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    if(testLeaseFallback)await context.addInitScript(blockPageHideWrite=>{
      Object.defineProperty(navigator,'locks',{value:undefined});
      if(!blockPageHideWrite)return;
      window.addEventListener('pagehide',()=>{
        const transaction=IDBDatabase.prototype.transaction;
        IDBDatabase.prototype.transaction=function(stores,mode,...options){
          if(mode==='readwrite')throw new DOMException('Simulated document closing','AbortError');
          return transaction.call(this,stores,mode,...options);
        };
      },{capture:true,once:true});
    },testNativeDeparture&&process.env.K67_PAPER_IDB_BLOCK_PAGEHIDE_WRITE==='1');
    page = await context.newPage();
    let stayAtNativePrompt=false;
    const observe = page => {
      page.setDefaultTimeout(18000);
      page.on('pageerror', error => errors.push(error.message));
      page.on('dialog', dialog => stayAtNativePrompt && dialog.type()==='beforeunload'?dialog.dismiss():dialog.accept());
      page.on('request', req => { if (req.resourceType() === 'media') mediaRequests++; });
      page.on('response', response => {
        const path=new URL(response.url()).pathname;
        if(path.includes('journey')||path.endsWith('roster')||path.endsWith('order/open'))debug.push([path,response.status()]);
      });
    };
    observe(page);
    let onlinePaperApiDown=false, onlinePaperPosts=0;
    await context.route('**/*', async route => {
      const req = route.request();
      const u = new URL(req.url());
      if (u.origin === webBase) return route.continue();
      const index = u.pathname.indexOf('/api/');
      if (index < 0 || onlinePaperApiDown) return route.abort();
      const headers = { 'Content-Type': 'application/json', Origin: 'https://tranhoangduc90.github.io',
        'x-term2-permit': req.headers()['x-term2-permit'] || '' };
      if (testDeparture && req.method() === 'POST' && (journey ? u.pathname.endsWith('/paper-journey/seal')
        : u.pathname.endsWith('/offline/operation') && req.postDataJSON().kind==='seal')) {
        const {section, operationId} = req.postDataJSON();
        assert.equal(seenOperations.get(section) || operationId, operationId);
        seenOperations.set(section, operationId);
      }
      const result = await fetch(apiBase + u.pathname.slice(index) + u.search, {
        method: req.method(), headers, body: req.postData() || undefined
      });
      if(result.ok && u.pathname.endsWith('/offline/parallel-prepare'))usedParallelPrepare=true;
      const data = await result.text();
      const testedSection=mode==='lis_first'?'listening':'reading';
      if(paperFlagOff&&testDeparture&&req.method()==='POST'&&
        [`/${slug}/${testedSection}`, `/${slug}/answer-sheet/${testedSection}`].some(path=>u.pathname.endsWith(path))){
        onlinePaperPosts++;
        if(result.ok&&!lostAck){lostAck=true;return route.abort();}
      }
      if(!result.ok&&u.pathname.includes('journey'))debug.push([u.pathname,result.status,data]);
      if (req.method() === 'POST' && result.ok && !lostAck
        && (journey ? u.pathname.endsWith('/paper-journey/seal')
          : u.pathname.endsWith('/offline/operation') && req.postDataJSON().kind === 'seal')) {
        lostAck = true;
        return route.abort();
      }
      return route.fulfill({ status: result.status, body: data, contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' } });
    });
    const url = webBase + routeName + '?class=IC2304&mode=' + mode;
    await page.goto(url);
    await page.locator('#studentSelect option[value="' + ref + '"]').waitFor({ state: 'attached' });
    await page.locator('#studentSelect').selectOption(ref);
    if(!journey)await page.locator('#miniEnter').click();
    if(!pretest)await page.getByRole('button', { name: 'Xác nhận, tiếp tục', exact: true }).click();
    if(paperFlagOff){
      await page.locator(mode==='lis_first'?'#submitListening':'#startReading').waitFor({state:'visible'});
      assert.equal(await page.getByRole('button',{name:'Tải bài làm về máy'}).count(),0);
      if(testDeparture){
        const section=mode==='lis_first'?'listening':'reading';
        if(section==='reading')await page.locator('#startReading').click();
        const input=page.locator('#'+section+'Questions [data-number]').first();
        await input.waitFor();
        if(await input.evaluate(node=>node.tagName)==='SELECT')await input.selectOption({index:1});
        else await input.fill('draft offline');
        const answer=await input.inputValue();
        await page.getByRole('button',{name:'Tải lại trang',exact:true}).click({timeout:3000});
        await page.getByRole('button',{name:'Ở lại làm bài',exact:true}).click();
        assert.equal(await input.inputValue(),answer);
        const number=await input.getAttribute('data-number');
        if(process.env.K67_PAPER_ONLINE_SUBMIT==='1'){
          const saved=async()=>page.evaluate(()=>{
            const key=Object.keys(localStorage).find(key=>key.startsWith('["k67-paper-departure-v1"'));
            return key?JSON.parse(localStorage.getItem(key)):null;
          });
          onlinePaperApiDown=true;
          await page.getByRole('button',{name:'Tải lại trang',exact:true}).click();
          await page.getByRole('button',{name:'Tải lại và nộp phần này',exact:true}).click();
          await page.waitForLoadState('domcontentloaded');
          const local=await saved();
          assert.equal(local?.section,section);
          assert.equal(local?.snapshot.answers[number],answer);
          assert.equal(local?.outcome,'pending');
          assert.equal(onlinePaperPosts,0);
          onlinePaperApiDown=false;
          await page.reload();
          const choose=page.locator('#studentSelect');
          if(await choose.isVisible()&&await choose.isEnabled()){
            const option=choose.locator('option[value="'+ref+'"]');
            await option.waitFor({state:'attached'});
            if(await choose.inputValue()!==ref) await choose.selectOption(ref);
            const confirm=page.getByRole('button',{name:'Xác nhận, tiếp tục',exact:true});
            if(await confirm.isVisible())await confirm.click();
          }
          await page.waitForFunction(()=>{
            const key=Object.keys(localStorage).find(key=>key.startsWith('["k67-paper-departure-v1"'));
            return key&&JSON.parse(localStorage.getItem(key)).outcome==='received';
          });
          assert.equal(onlinePaperPosts,1);
          assert.equal(lostAck,true);
          const {examSessionToken,attemptToken,clientSubmissionId,generation}=local.current;
          const status=await fetch(apiBase+'/api/term-tests/'+slug+'/submission-status',{
            method:'POST',headers:{'Content-Type':'application/json',Origin:'https://tranhoangduc90.github.io'},
            body:JSON.stringify({section,generation,examSessionToken:examSessionToken||undefined,
              attemptToken:attemptToken||undefined,clientSubmissionId:!examSessionToken&&!attemptToken?clientSubmissionId:undefined})
          });
          assert.equal(status.status,200);
          const {persisted,receipt}=await status.json();
          assert.equal(persisted,true);
          assert.equal(receipt.answers[number],answer);
        }
      }
      assert.deepEqual(errors,[]);
      return;
    }
    await page.getByRole('button', { name: 'Tải bài làm về máy' }).waitFor();
    if(servePreviousShell){
      assert.match(await page.evaluate(()=>navigator.serviceWorker.controller.scriptURL),/\/offline-worker-audio-status-v2\.js\?/);
      servePreviousShell=false;
      await page.reload();
      const student = page.locator('#studentSelect');
      await student.or(page.getByRole('button',{name:'Tải bài làm về máy'})).first().waitFor();
      if(await student.isVisible())await student.selectOption(ref);
      await page.getByRole('button',{name:'Tải bài làm về máy'}).waitFor();
      const updatedWorker=await page.evaluate(()=>navigator.serviceWorker.controller.scriptURL);
      assert.equal(new URL(updatedWorker).pathname,
        routeName+'offline-worker-audio-status-v2-confirmed-departure-v1-verified-exit-v1-online-exit-v1.js');
    }
    await context.setOffline(true);
    const order = mode === 'lis_first' ? ['listening','reading'] : ['reading','listening'];
    for (const [index, section] of order.entries()) {
      const reading = section === 'reading';
      if (reading) await page.locator('#startReading').click();
      if(testDeparture&&!reading&&index>0){
        await page.getByRole('heading',{name:'Sẵn sàng làm Listening'}).waitFor();
        assert.equal(await page.locator('#listeningView').isVisible(),false);
        await page.getByRole('button',{name:'Bắt đầu Listening',exact:true}).click();
      }
      const selector = reading ? `#readingQuestions [data-number="${readingNumber}"]` : `#listeningQuestions [data-number="${listenNumber}"]`;
      const field = page.locator(selector);
      if (reading) await field.fill('A'); else await field.selectOption('A');
      if (testDeparture) {
        if(!reading){
          const players=await page.locator('audio').evaluateAll(elements=>elements.filter(audio=>audio.src||audio.currentSrc).length);
          assert.equal(players,0,'The answer sheet does not own the examination audio player.');
          console.log(JSON.stringify({testSlug:slug,mode,section,examAudioPlayers:players}));
        }
        const key = reading ? 'Reading' : 'Listening';
        const reload = page.getByRole('button', { name: 'Tải lại trang', exact: true });
        const modal = page.getByRole('dialog', { name: 'Xác nhận rời bài thi' });
        await page.waitForFunction(async ({skill, number, prefix, lease}) => {
          const saved = value => (value?.drafts||value?.snapshot?.drafts)?.[skill]?.[number]==='A';
          if(!lease)return Object.keys(localStorage).filter(key=>key.startsWith(prefix))
            .some(key=>saved(JSON.parse(localStorage.getItem(key))));
          return new Promise(resolve=>{
            const request=indexedDB.open('izone-pretest-lesson-16-k67-paper-v1',1);
            request.onerror=()=>resolve(false);
            request.onsuccess=()=>{
              const db=request.result;
              const read=db.transaction('records').objectStore('records').getAll();
              read.onerror=()=>{db.close();resolve(false);};
              read.onsuccess=()=>{db.close();resolve(read.result.some(saved));};
            };
          });
        },{skill:section,number:reading?readingNumber:listenNumber,prefix:draftPrefix,lease:testLeaseFallback});
        const origin=await page.evaluate(()=>performance.timeOrigin);
        const native = testNativeDeparture && index===0;
        if(native){
          const closeTab=mode==='lis_first';
          const leave=async stay=>{
            stayAtNativePrompt=stay;
            const prompt=page.waitForEvent('dialog',{predicate:dialog=>dialog.type()==='beforeunload',timeout:8000});
            const navigate=closeTab?page.close({runBeforeUnload:true}):page.reload({waitUntil:'commit'});
            await Promise.all([prompt,navigate.catch(error=>{
              if(!stay||!/ERR_ABORTED|Timeout/.test(error.message))throw error;
            })]);
          };
          await leave(true);
          assert.equal(await field.inputValue(),'A');
          assert.equal(await page.evaluate(()=>performance.timeOrigin),origin);
          const closed=closeTab?page.waitForEvent('close'):null;
          await leave(false);
          if(closed){
            await closed;
            page=await context.newPage();
            observe(page);
            await page.goto(url);
          }
          await page.waitForFunction(at=>performance.timeOrigin!==at,origin);
          const restored=page.locator(selector);
          const recovery=page.locator('#termPaperRecovery');
          await restored.or(recovery).first().waitFor();
          if(await recovery.isVisible()){
            await recovery.locator('input').fill('Học viên mô phỏng');
            await page.getByRole('button',{name:'Mở bài trên máy'}).click();
          }
          await restored.waitFor();
          assert.equal(await restored.inputValue(),'A');
          assert.equal(await page.getByText('Phần '+key+' đã khóa trên thiết bị. Đang chờ máy chủ xác nhận.',{exact:true}).count(),0);
          console.log(JSON.stringify({testSlug:slug,mode,section,nativeReloadKeptDraft:true}));
          await page.getByRole('button',{name:'Tải lại trang',exact:true}).click();
          await page.getByRole('dialog',{name:'Xác nhận rời bài thi'})
            .getByRole('button',{name:'Tải lại và nộp phần này',exact:true}).click();
        }else{
          await reload.click();
          if(index===1)await modal.getByText(/Khi mở lại, bạn sẽ thấy màn hình kết thúc bài thi/).waitFor();
          await modal.getByRole('button', { name: 'Ở lại làm bài', exact: true }).click();
          assert.equal(await field.inputValue(),'A');
          await reload.click();
          await modal.getByRole('button', {name: 'Tải lại và nộp phần này', exact: true}).click();
        }
        await page.waitForFunction(at=>performance.timeOrigin!==at,origin);
        const prompt = page.getByText('Phần '+key+' đã khóa trên thiết bị. Đang chờ máy chủ xác nhận.',{exact:true});
        await prompt.or(page.locator('#termPaperRecovery')).waitFor();
        if(await page.locator('#termPaperRecovery').isVisible()){
          await page.locator('#termPaperRecovery input').fill('Học viên mô phỏng');
          await page.getByRole('button',{name:'Mở bài trên máy'}).click();
        }
        await prompt.waitFor();
        assert.equal(await page.locator(selector).isVisible(),false);
        continue;
      }
      if (index === 0) {
        const download = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Tải bài làm về máy' }).click();
        const html = await readFile(await (await download).path(), 'utf8');
        assert.match(html, journey ? /<dd>A<\/dd>/ : /<td>A<\/td>/);
        assert.doesNotMatch(html, /permit|examSessionToken/i);
        if(journey){
          await page.getByText('Đã lưu nháp trên máy',{exact:true}).waitFor();
          await page.close();page=await context.newPage();observe(page);await page.goto(url);
          const name=page.locator('#termPaperRecovery input');
          await name.fill('Người khác');await page.getByRole('button',{name:'Mở bài trên máy'}).click();
          await page.getByText('Không khớp bài lưu của bạn.',{exact:false}).waitFor();
          await name.fill('Học viên mô phỏng');await page.getByRole('button',{name:'Mở bài trên máy'}).click();
        }
        else {
          // Closing without a beforeunload prompt simulates abrupt document loss and keeps the draft.
          await page.close();
          page=await context.newPage();
          observe(page);
          await page.goto(url);
        }
        await page.getByRole('button', { name: 'Tải bài làm về máy' }).waitFor();
        assert.equal(await page.locator(selector).inputValue(), 'A');
      }
      await page.locator(reading ? '#submitReading' : '#submitListening').click();
    }
    await page.locator('#resultReadyView').waitFor({ state: 'visible' });
    if(journey)assert.equal((await f.db.query('SELECT count(*)::int AS n FROM assessment.term_test_attempt WHERE completed_at IS NOT NULL')).rows[0].n,0);
    else assert.equal((await f.db.query("SELECT count(*)::int AS n FROM assessment.mini_k67_paper_offline_operation WHERE receipt->>'kind'='seal'")).rows[0].n,0);
    await context.setOffline(false);
    await page.getByText(journey?'Máy chủ đã xác nhận nhận bài':'Máy chủ đã xác nhận các thao tác đã gửi.', { exact: true }).waitFor({ timeout: 25000 });
    if(journey){
      const download=page.waitForEvent('download');
      await page.getByRole('button',{name:'Tải bài làm về máy'}).click();
      const html=await readFile(await (await download).path(),'utf8');
      assert.match(html,/Máy chủ đã nhận/);
      assert.doesNotMatch(html,/permit|examSessionToken|<h2>writing<\/h2>/i);
    }
    await page.locator('#viewResult').click();
    await page.locator('#resultView').waitFor({ state: 'visible' });
    const rows = (await f.db.query('SELECT * FROM assessment.term_test_attempt')).rows;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].listening_answers[listenNumber], 'A');
    assert.equal(rows[0].reading_answers[readingNumber], 'A');
    if(journey){
      assert.equal(new Date(rows[0].reading_deadline_at)-new Date(rows[0].reading_started_at),(term?60:20)*60_000);
      assert.equal(rows[0].writing_scope,'lr_only');
      assert.equal(rows[0].writing_submitted_at,null);
      assert.equal(mediaRequests,0);
    }else assert.equal(rows[0].reading_deadline_at, null);
    assert.ok(lostAck, 'test must lose a committed seal response');
    if(miniParallel)assert.ok(usedParallelPrepare,'The Mini parallel route must create the tested attempt.');
    if(testDeparture){
      assert.equal(seenOperations.size,2);
      if(journey){
        const {rows: journeys}=await f.db.query('SELECT sections FROM assessment.term_k67_cbt_journey');
        assert.equal(journeys.length,1);
        for(const section of order)assert.equal(journeys[0].sections[section].operationId,seenOperations.get(section));
      }else{
        const {rows: receipts}=await f.db.query("SELECT operation_id,session_id,receipt FROM assessment.mini_k67_paper_offline_operation WHERE receipt->>'kind'='seal'");
        assert.equal(receipts.length,2);
        assert.equal(new Set(receipts.map(row=>row.session_id)).size,1);
        for(const section of order){
          const original=receipts.find(row=>row.receipt.section===section);
          assert.equal(original?.operation_id,seenOperations.get(section));
          assert.equal(original.receipt.status,'accepted');
        }
      }
    }else{
      const bridge = pretest?'bridge-pretest-k67-paper-cloud-v1.mjs':term?'bridge-term'+term+'-k67-paper-browser-cloud-v1.mjs':'bridge.mjs';
      assert.ok(journalFailures.has('/term-tests/shared/exam-journal/'+bridge));
    }
    assert.deepEqual(errors, []);
  } catch (error) {
    const notice=await page?.locator('#notice').textContent({timeout:1500}).catch(()=>null);
    throw new Error(`${error.message}\nRequests: ${JSON.stringify(debug)}\nPage errors: ${JSON.stringify(errors)}\nVisible notice: ${notice}`,{cause:error});
  } finally {
    await browser?.close();
    await Promise.all([close(api), close(web)]);
    await f.db.close();
  }
});
