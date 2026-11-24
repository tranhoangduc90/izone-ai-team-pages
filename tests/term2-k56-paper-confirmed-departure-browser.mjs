import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const backend = process.env.K56_PAPER_NATIVE_FIXTURE;
assert.ok(backend, 'Provide the isolated K56 HTTP and database fixture.');
const {createFixture}=await import(pathToFileURL(backend));
const require=createRequire(resolve(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'));
const {chromium}=require('playwright');
const root=resolve(fileURLToPath(new URL('../', import.meta.url)));
const slug=process.env.K56_PAPER_DEPARTURE_SLUG || 'term-test-2-k56';
assert.ok(['term-test-1-k56','term-test-2-k56'].includes(slug));
const writingTask=slug==='term-test-1-k56'?'task2':'task1';
const routeName='/term-tests/'+slug+'/';
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
const modeOnly=process.env.K56_PAPER_DEPARTURE_ORDER;
const modes=modeOnly?[modeOnly]:['read_first','lis_first'];

for(const mode of modes)test(slug+' paper confirmed departure '+mode,{timeout:140000},async()=>{
  const f=await createFixture();
  const web=createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://localhost');
      if(url.pathname==='/before-exam')return res.writeHead(200,{'content-type':'text/html'}).end('<title>Trước bài thi</title>');
      const file=resolve(root,'.'+(url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname));
      if(!file.startsWith(root+sep))return res.writeHead(403).end();
      const type=extname(file);
      let bytes=await readFile(file);
      if(mime[type])bytes=Buffer.from(bytes.toString().replace(/\r\n/g,'\n'));
      res.writeHead(200,{'content-type':mime[type]||'application/octet-stream'}).end(bytes);
    }catch{res.writeHead(404).end();}
  });
  do {
    await new Promise(resolve=>web.listen(0,'127.0.0.1',resolve));
    if (![5060,5061,6000,6566,6665,6666,6667,6668,6669,6697,10080].includes(web.address().port)) break;
    await new Promise(resolve=>web.close(resolve));
  } while (true);
  const origin='http://127.0.0.1:'+web.address().port;
  let browser, page;
  const apiTrace=[], errors=[];
  let connected=true, dismissPrompt=false, lostResponse=false;
  let preservedOperation, attemptedBody;
  const section=mode==='read_first'?'reading':'listening';
  const next=section==='reading'?'listening':'reading';
  const label=section==='reading'?'Reading':'Listening';
  const nextLabel=next==='reading'?'Reading':'Listening';
  let submitPath='/api/term-tests/'+slug+'/'+section;
  try{
    browser=await chromium.launch({channel:'msedge',headless:true});
    const context=await browser.newContext();
    await context.route('**/*',async route=>{
      const req=route.request(),url=new URL(req.url());
      if(url.origin===origin)return route.continue();
      const api=url.pathname.indexOf('/api/');
      if(!connected||api<0||url.hostname!=='ducizone.ddns.net')return route.abort();
      const path=url.pathname.slice(api);
      const body=req.postData();
      if(path===submitPath && body && req.postDataJSON().recovery){
        const current=req.postDataJSON().recovery.operationId;
        if(preservedOperation)assert.equal(current,preservedOperation);
        preservedOperation=current;
        attemptedBody=body;
      }
      const result=await fetch(f.base+path+url.search,{method:req.method(),
        headers:{'Content-Type':'application/json',Origin:'https://tranhoangduc90.github.io'},
        ...(body?{body}:{})});
      const payload=await result.json().catch(()=>({}));
      apiTrace.push({path,status:result.status,error:payload.error});
      if(path===submitPath && result.ok && payload.receipt && !lostResponse){
        lostResponse=true;
        return route.abort('failed');
      }
      return route.fulfill({status:result.status,json:payload,headers:{'access-control-allow-origin':'*'}});
    });
    page=await context.newPage();
    page.setDefaultTimeout(21000);
    page.on('pageerror',e=>errors.push(e.message));
    page.on('dialog',dialog=>dismissPrompt&&dialog.type()==='beforeunload'?dialog.dismiss():dialog.accept());
    await page.goto(origin+'/before-exam');
    await page.goto(origin+routeName+'?class=IC5601&mode='+mode);
    await page.locator('#studentSelect option[value="'+f.students[0].ref+'"]').waitFor({state:'attached'});
    await page.locator('#studentSelect').selectOption(f.students[0].ref);
    await page.getByRole('button',{name:'Bắt đầu '+label,exact:mode==='lis_first'}).first().click();
    await page.waitForFunction(()=>navigator.serviceWorker.controller?.scriptURL.includes('offline-worker-confirmed-departure'));
    const field=page.locator('#'+section+'Questions [data-answer-key]:visible').first()
      .or(page.locator('#'+section+'Questions select:visible,#'+section+'Questions input:visible').first()).first();
    const kind=await field.evaluate(node=>node.tagName);
    if(kind==='SELECT')await field.selectOption({index:1});
    else await field.fill('A');
    const answer=await field.inputValue();
    const name=await field.getAttribute('data-number')||await field.getAttribute('data-answer-key');
    const documentOrigin=await page.evaluate(()=>performance.timeOrigin);
    const timing=()=>page.evaluate(({slug,section,ref})=>{
      const prefix='izone-test:'+slug+':IC5601';
      const snapshot=JSON.parse(sessionStorage.getItem(prefix+':student:'+ref));
      return [snapshot.attemptToken,snapshot.examSessionToken,snapshot.generation,
        snapshot[section+'StartedAt'],snapshot[section+'DeadlineAt']];
    },{slug,section,ref:f.students[0].ref});
    const activeTiming=await timing();
    assert.ok(activeTiming[0] && activeTiming[1] && activeTiming[3] && activeTiming[4]);
    await context.setOffline(true);
    connected=false;
    if(mode==='read_first'){
      await page.getByRole('button',{name:'Tải lại trang',exact:true}).click();
      const dialog=page.getByRole('dialog',{name:'Xác nhận rời bài thi'});
      await dialog.getByRole('button',{name:'Ở lại làm bài',exact:true}).click();
      assert.equal(await field.inputValue(),answer);
      assert.equal(await page.evaluate(()=>performance.timeOrigin),documentOrigin);
      assert.deepEqual(await timing(),activeTiming);
      await page.getByRole('button',{name:'Tải lại trang',exact:true}).click();
      await dialog.getByRole('button',{name:'Tải lại và nộp phần này',exact:true}).click();
    }else{
      dismissPrompt=true;
      const dismissed=page.waitForEvent('dialog',{predicate:d=>d.type()==='beforeunload'});
      await Promise.all([dismissed,page.reload({waitUntil:'commit',timeout:2200}).catch(error=>{
        if(!/ERR_ABORTED|Timeout/.test(error.message))throw error;
      })]);
      assert.equal(await field.inputValue(),answer);
      assert.equal(await page.evaluate(()=>performance.timeOrigin),documentOrigin);
      assert.deepEqual(await timing(),activeTiming);
      dismissPrompt=false;
      await page.reload({waitUntil:'commit'});
    }
    await page.waitForFunction(at=>performance.timeOrigin!==at,documentOrigin);
    await page.getByText('Phần '+label+' đã khóa trên thiết bị. Đang chờ máy chủ xác nhận.',{exact:true}).waitFor();
    await page.locator('#termPaperDepartureWaiting').getByRole('heading',{name:'Chuẩn bị phần '+nextLabel}).waitFor();
    assert.equal(await field.isVisible(),false);
    let rows=(await f.db.query('SELECT receipt FROM assessment.term_online_submission_hold WHERE section=$1 AND receipt IS NOT NULL',[section])).rows;
    assert.equal(rows.length,0);
    connected=true;
    await context.setOffline(false);
    await page.getByText('Máy chủ đã nhận phần '+label+'.',{exact:true}).waitFor();
    assert.equal(lostResponse,true);
    rows=(await f.db.query('SELECT operation_id,receipt FROM assessment.term_online_submission_hold WHERE section=$1 AND receipt IS NOT NULL',[section])).rows;
    assert.equal(rows.length,1);
    assert.equal(rows[0].operation_id,preservedOperation);
    assert.equal(rows[0].receipt.section,section);
    const duplicate=await fetch(f.base+submitPath,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://tranhoangduc90.github.io'},body:attemptedBody});
    assert.equal(duplicate.status,200);
    assert.equal((await duplicate.json()).receipt.receiptId,rows[0].receipt.receiptId);
    const [counts]=(await f.db.query('SELECT count(*)::int AS count FROM assessment.term_online_submission_hold WHERE section=$1 AND receipt IS NOT NULL',[section])).rows;
    assert.equal(counts.count,1);
    const [saved]=(await f.db.query('SELECT '+section+'_answers AS answers FROM assessment.term_test_attempt WHERE id=$1',[rows[0].receipt.attemptToken])).rows;
    assert.ok(saved?.answers && (name?saved.answers[name]===answer:Object.values(saved.answers).includes(answer)));
    await page.getByRole('button',{name:'Bắt đầu '+nextLabel,exact:next==='listening'}).first().waitFor();
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({mode,section,next,lostResponse,receiptCount:rows.length,answersPreserved:true}));
    if(mode==='read_first'){
      submitPath='/api/term-tests/'+slug+'/listening';
      preservedOperation=undefined;
      await page.getByRole('button',{name:'Bắt đầu Listening',exact:true}).click();
      await page.locator('#listeningQuestions input:visible').first().fill('A');
      await page.getByRole('button',{name:'Tải lại trang',exact:true}).click();
      await page.getByRole('dialog').getByRole('button',{name:'Tải lại và nộp phần này',exact:true}).click();
      await page.getByRole('button',{name:'Bắt đầu Writing',exact:true}).click();
      const essay='This draft belongs to the final Writing section of the synthetic K56 attempt.';
      const editor=page.locator('#writingView textarea[data-writing-task="'+writingTask+'"]');
      await editor.fill(essay);
      await page.getByRole('button',{name:'Tải lại trang',exact:true}).click();
      await page.getByRole('dialog').getByText(/Khi mở lại, bạn sẽ thấy màn hình kết thúc bài thi\./).waitFor();
      await page.getByRole('dialog').getByRole('button',{name:'Ở lại làm bài',exact:true}).click();
      assert.equal(await editor.inputValue(),essay);
      submitPath='/api/term-tests/'+slug+'/writing/finalize';
      preservedOperation=undefined;
      await context.setOffline(true);
      connected=false;
      const accepted=page.waitForEvent('dialog',{predicate:dialog=>dialog.type()==='beforeunload'});
      const closed=page.waitForEvent('close');
      await Promise.all([accepted,closed,page.close({runBeforeUnload:true})]);
      connected=true;
      await context.setOffline(false);
      const reopened=await context.newPage();
      page=reopened;
      page.setDefaultTimeout(21000);
      page.on('pageerror',e=>errors.push(e.message));
      page.on('dialog',dialog=>dialog.accept());
      await page.goto(origin+routeName+'?class=IC5601&mode='+mode);
      const receiptNote=page.getByText('Máy chủ đã nhận phần Writing.',{exact:true});
      await Promise.race([receiptNote.waitFor(),page.locator('#studentSelect option[value="'+f.students[0].ref+'"]').waitFor({state:'attached'})]);
      if (!await receiptNote.isVisible() && await page.locator('#studentSelect').isEnabled())
        await page.locator('#studentSelect').selectOption(f.students[0].ref);
      await receiptNote.waitFor();
      await page.locator('#resultReadyView').waitFor();
      const [writing]=(await f.db.query('SELECT receipt FROM assessment.term_online_submission_hold WHERE section=$1 AND receipt IS NOT NULL',['writing'])).rows;
      assert.equal(writing.receipt.attemptToken,rows[0].receipt.attemptToken);
      assert.equal(writing.receipt.operationId,preservedOperation);
      assert.equal(JSON.parse(attemptedBody)[writingTask],essay);
      const storedField=writingTask==='task2'?'writing_task_2':'writing_task_1';
      const [stored]=(await f.db.query('SELECT '+storedField+' AS text FROM assessment.term_test_attempt WHERE id=$1',[writing.receipt.attemptToken])).rows;
      assert.equal(stored.text,essay);
      assert.deepEqual(errors,[]);
      console.log(JSON.stringify({mode,section:'writing',next:'result',nativeClose:true,reopenedFreshTab:true}));
    }
    if(mode==='lis_first' && slug==='term-test-1-k56'){
      submitPath='/api/term-tests/'+slug+'/reading';
      preservedOperation=undefined;
      await page.getByRole('button',{name:'Bắt đầu Reading',exact:true}).click();
      const reading=page.locator('#readingQuestions input:visible').first();
      await reading.fill('HISTORY');
      const question=await reading.getAttribute('data-number');
      const requested=page.waitForEvent('dialog',{predicate:dialog=>dialog.type()==='beforeunload'});
      await Promise.all([requested,page.goBack({waitUntil:'commit'})]);
      await page.waitForURL(origin+'/before-exam');
      await page.goForward({waitUntil:'commit'});
      await page.getByText('Máy chủ đã nhận phần Reading.',{exact:true}).waitFor();
      await page.getByRole('button',{name:'Bắt đầu Writing',exact:true}).waitFor();
      const captured=(await f.db.query('SELECT receipt FROM assessment.term_online_submission_hold WHERE section=$1 AND receipt IS NOT NULL',['reading'])).rows;
      assert.equal(captured.length,1);
      assert.equal(captured[0].receipt.operationId,preservedOperation);
      const [state]=(await f.db.query('SELECT reading_answers FROM assessment.term_test_attempt WHERE id=$1',[captured[0].receipt.attemptToken])).rows;
      assert.equal(state.reading_answers[question],'HISTORY');
      console.log(JSON.stringify({mode,section:'reading',next:'writing',nativeBack:true,receiptCount:captured.length}));
    }
  }catch(error){
    const text=await page?.locator('#notice').textContent({timeout:1000}).catch(()=>null);
    throw new Error(error.message+'\nAPI: '+JSON.stringify(apiTrace)+'\nNotice: '+text+'\nPage errors: '+JSON.stringify(errors),{cause:error});
  }finally{
    await browser?.close();
    await new Promise(resolve=>web.close(resolve));
    await f.close();
  }
});
