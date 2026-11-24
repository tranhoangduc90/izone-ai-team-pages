import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {extname,resolve,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import test from 'node:test';

const fixturePath=process.env.MINI_K56_PAPER_NATIVE_FIXTURE;
assert.ok(fixturePath,'Provide an isolated K56 HTTP fixture');
const {createFixture}=await import(pathToFileURL(fixturePath));
const require=createRequire(resolve(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'));
const {chromium}=require('playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
const slug='mini-test-k56';
const route='/term-tests/'+slug+'/';
const apiOrigin='https://ducizone.ddns.net';
const type={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml'};
const previousRoot=process.env.MINI_PAPER_UPGRADE_ROOT;
const previousApp=process.env.MINI_PAPER_UPGRADE_APP||'app-mini-paper-browser-cloud-v1.js';
const orders=previousRoot?['read_first']:['read_first','lis_first'];

for(const order of orders)test('Mini K56 paper '+order,{timeout:170000},async()=>{
  const fixture=await createFixture();
  const contextInfo=[];
  const apiLog=[];
  const staticErrors=[];
  const versions=[];
  let previous=Boolean(previousRoot);
  const server=createServer(async(req,res)=>{
    const path=new URL(req.url,'http://localhost').pathname;
    try{
      const usePrevious=previous&&[route,route+'index.html',route+'offline-worker-paper-shell-v2.js'].includes(path);
      if([route,route+'index.html',route+'offline-worker-paper-shell-v2.js',route+'worker-paper-shell-confirmed-departure-v1.mjs'].includes(path))
        versions.push({path,usePrevious});
      const base=usePrevious?previousRoot:root;
      const file=resolve(base,'.'+path+(path.endsWith('/')?'index.html':''));
      if(!file.startsWith(resolve(base)+sep))return res.writeHead(403).end();
      const mime=type[extname(file)];
      const bytes=await readFile(file);
      res.writeHead(200,{'content-type':mime||'application/octet-stream'});
      return res.end(mime?bytes.toString().replaceAll('\r\n','\n'):bytes);
    }catch{staticErrors.push(path);return res.writeHead(404).end();}
  });
  let browser;
  let dropSeal=true;
  let droppedOperation;
  let sentSeal, mockPermit;
  const prefix='/api/term-tests/'+slug;
  try{
    do{
      await new Promise(done=>server.listen(0,'127.0.0.1',done));
      if(![5060,5061,6000,6566,6665,6666,6667,6668,6669,6697,10080].includes(server.address().port))break;
      await new Promise(done=>server.close(done));
    }while(true);
    const origin='http://127.0.0.1:'+server.address().port;
    browser=await chromium.launch({channel:'msedge',headless:true});
    async function enter(){
      const context=await browser.newContext();
      const session={context,online:true,errors:[],conflicts:[]};
      contextInfo.push(session);
      await context.route('**/*',async interception=>{
        const request=interception.request(), url=new URL(request.url());
        if(url.origin===origin)return interception.continue();
        if(url.origin!==apiOrigin||!url.pathname.includes('/api/')||!session.online)return interception.abort();
        const body=request.postData()||undefined;
        const api=url.pathname.slice(url.pathname.indexOf('/api/'));
        const permit=await request.headerValue('x-term2-permit');
        const result=await fetch(fixture.base+api+url.search,{method:request.method(),
          headers:{'Content-Type':'application/json',Origin:'https://tranhoangduc90.github.io',
            ...(permit?{'x-term2-permit':permit}:{})},body});
        const payload=await result.json().catch(()=>({}));
        let op;
        if(api===prefix+'/offline/operation')op=JSON.parse(body);
        if(api===prefix+'/offline/status'&&payload.officialProgress&&payload.persisted===false)
          session.conflicts.push(payload.officialProgress);
        apiLog.push({api,status:result.status,code:payload.error,kind:op?.kind,persisted:payload.persisted});
        if(dropSeal&&op?.kind==='seal'&&payload.receipt?.status==='accepted'){
          dropSeal=false;
          droppedOperation=op.operationId;
          sentSeal=op;
          mockPermit=permit;
          return interception.abort('failed');
        }
        return interception.fulfill({status:result.status,json:payload,headers:{'access-control-allow-origin':'*'}});
      });
      const page=await newPage(session);
      await page.goto(origin+route+'?class=IC5601&mode='+order);
      const ref=fixture.students[0].ref;
      await page.locator('#studentSelect option[value="'+ref+'"]').waitFor({state:'attached'});
      await page.locator('#studentSelect').selectOption(ref);
      await page.getByRole('button',{name:'Xác nhận và tiếp tục',exact:true}).click();
      return session;
    }
    async function newPage(session){
      const page=await session.context.newPage();
      session.page=page;
      page.setDefaultTimeout(35000);
      page.on('dialog',dialog=>session.stay&&dialog.type()==='beforeunload'?dialog.dismiss():dialog.accept());
      page.on('pageerror',error=>session.errors.push(error.message));
      return page;
    }
    const active=await enter();
    const standby=order==='lis_first'?await enter():null;
    const section=order==='read_first'?'reading':'listening';
    const skill=section==='reading'?'Reading':'Listening';
    const next=section==='reading'?'Listening':'Reading';
    const fieldFor=(page,section)=>page.locator('#'+section+'Questions input:visible,#'+section+'Questions select:visible').first();
    async function begin(session,expectedSection,label){
      await session.page.getByRole('button',{name:'Nhập đáp án '+label,exact:true}).first().click();
      const field=fieldFor(session.page,expectedSection);
      await field.waitFor();
      return field;
    }
    let field=await begin(active,section,skill);
    if(await field.evaluate(node=>node.tagName)==='SELECT')await field.selectOption({index:1});
    else await field.fill('A');
    const answer=await field.inputValue(), question=await field.getAttribute('data-number');
    let upgraded=false;
    if(previous){
      await active.page.waitForFunction(app=>Array.from(document.scripts).some(script=>script.src.endsWith('/'+app)),previousApp);
      previous=false;
      await active.page.evaluate(async()=>{
        const registration=await navigator.serviceWorker.getRegistration();
        await registration.update();
      });
      const {ASSET_BUILD_ID}=await import('../term-tests/mini-test-k56/offline-assets-paper-shell-confirmed-departure-v2.mjs');
      await active.page.waitForFunction(expected=>new Promise(resolve=>{
        const worker=navigator.serviceWorker.controller;
        if(!worker){resolve(false);return;}
        const channel=new MessageChannel();
        const timer=setTimeout(()=>{channel.port1.close();resolve(false);},700);
        channel.port1.onmessage=event=>{
          clearTimeout(timer);
          channel.port1.close();
          resolve(event.data.assetBuildId===expected);
        };
        worker.postMessage({type:'SHELL_VERSION'},[channel.port2]);
      }),ASSET_BUILD_ID,{timeout:22000});
      assert.equal(await field.inputValue(),answer);
      await active.page.close();
      const reopened=await newPage(active);
      await reopened.goto(origin+route+'?class=IC5601&mode='+order);
      await reopened.getByRole('button',{name:'Tải lại trang',exact:true}).waitFor();
      field=fieldFor(reopened,section);
      assert.equal(await field.inputValue(),answer);
      upgraded=true;
    }
    let competingAnswer;
    if(standby){
      const other=await begin(standby,section,skill);
      if(await other.evaluate(node=>node.tagName)==='SELECT')await other.selectOption({index:2});
      else await other.fill('B');
      competingAnswer=await other.inputValue();
      assert.notEqual(competingAnswer,answer);
    }
    await active.page.waitForFunction(()=>navigator.serviceWorker.controller?.scriptURL.includes('offline-worker-paper-shell-v2'));
    const forceOffline=async session=>{session.online=false;await session.context.setOffline(true);};
    const reconnect=async session=>{session.online=true;await session.context.setOffline(false);};
    const retryPending=page=>page.getByText('Phần '+skill+' đã khóa trên thiết bị. Đang chờ máy chủ xác nhận.',{exact:true});
    const acceptReload=page=>page.getByRole('dialog',{name:'Xác nhận rời bài thi'})
      .getByRole('button',{name:'Tải lại và nộp phần này',exact:true}).click();
    const reloadButton=page=>page.getByRole('button',{name:'Tải lại trang',exact:true});
    await forceOffline(active);
    const timeOrigin=await active.page.evaluate(()=>performance.timeOrigin);
    if(order==='read_first'){
      await reloadButton(active.page).click();
      await active.page.getByRole('button',{name:'Ở lại làm bài',exact:true}).click();
      assert.equal(await field.inputValue(),answer);
      assert.equal(await active.page.evaluate(()=>performance.timeOrigin),timeOrigin);
      await reloadButton(active.page).click();
      await acceptReload(active.page);
    }else{
      active.stay=true;
      await Promise.all([active.page.waitForEvent('dialog',{predicate:d=>d.type()==='beforeunload'}),
        active.page.reload({waitUntil:'commit',timeout:2500}).catch(error=>{
          if(!/ERR_ABORTED|Timeout/.test(error.message))throw error;
        })]);
      active.stay=false;
      assert.equal(await field.inputValue(),answer);
      assert.equal(await active.page.evaluate(()=>performance.timeOrigin),timeOrigin);
      await active.page.reload({waitUntil:'commit'});
      await active.page.waitForFunction(previous=>performance.timeOrigin!==previous,timeOrigin);
      await field.waitFor({state:'visible'});
      assert.equal(await field.inputValue(),answer);
      const beforeConfirm=(await fixture.db.query("SELECT operation_id FROM assessment.mini_k56_offline_operation WHERE kind='seal'")).rows;
      assert.equal(beforeConfirm.length,0);
      console.log(JSON.stringify({order,section,nativeReloadKeptAttempt:true,seals:0}));
      await reloadButton(active.page).click();
      await acceptReload(active.page);
    }
    await active.page.waitForFunction(previous=>performance.timeOrigin!==previous,timeOrigin);
    await retryPending(active.page).waitFor();
    await active.page.getByRole('heading',{name:'Chuẩn bị phần '+next}).waitFor();
    assert.equal(await field.isVisible(),false);
    const stored=async()=>(await fixture.db.query("SELECT operation_id,attempt_id,payload,receipt FROM assessment.mini_k56_offline_operation WHERE kind='seal' AND section=$1",[section])).rows;
    assert.equal((await stored()).length,0);
    if(standby){
      await forceOffline(standby);
      await reloadButton(standby.page).click();
      await acceptReload(standby.page);
      await retryPending(standby.page).waitFor();
    }
    await reconnect(active);
    await active.page.getByText('Máy chủ đã nhận phần '+skill+'.',{exact:true}).waitFor();
    const first=await stored();
    assert.equal(first.length,1);
    assert.equal(first[0].operation_id,droppedOperation);
    assert.equal(first[0].payload.payload.answers[question],answer);
    const repeat=await fetch(fixture.base+prefix+'/offline/operation',{
      method:'POST',headers:{'Content-Type':'application/json','x-term2-permit':mockPermit},body:JSON.stringify(sentSeal)});
    assert.equal(repeat.status,200);
    assert.deepEqual((await repeat.json()).receipt,first[0].receipt);
    assert.equal((await stored()).length,1);
    if(standby){
      await reconnect(standby);
      await retryPending(standby.page).waitFor({state:'hidden'});
      const standbyRecord=standby.page.locator('.exam-departure-note');
      await standbyRecord.getByText('Máy chủ đã ghi nhận phần '+skill+' từ lượt khác. Bản chốt này vẫn được giữ trên thiết bị để đối soát.',{exact:true}).waitFor();
      await standbyRecord.getByText('Máy chủ đã nhận phần '+skill+'.',{exact:true}).waitFor({state:'hidden'});
      await standby.page.getByRole('heading',{name:'Chuẩn bị phần '+next}).waitFor();
      assert.ok(standby.conflicts.length>0);
      const competing=await standby.page.evaluate(({section,question})=>{
        const pointer=JSON.parse(localStorage.getItem('mini-k56-paper:latest:IC5601'));
        const active=JSON.parse(localStorage.getItem('mini-k56-paper:'+pointer.key));
        const operation=active.supersededLocalOperations.find(op=>op.section===section&&op.kind==='seal');
        return {attempt:active.prepared.attemptToken,answer:operation.payload.answers[question]};
      },{section,question});
      assert.notEqual(competing.attempt,first[0].attempt_id);
      assert.equal(competing.answer,competingAnswer);
      assert.equal((await stored()).length,1);
    }
    if(order==='read_first'){
      const final=await begin(active,'listening','Listening');
      if(await final.evaluate(node=>node.tagName)==='SELECT')await final.selectOption({index:1});
      else await final.fill('FINAL');
      const finalAnswer=await final.inputValue(), finalQuestion=await final.getAttribute('data-number');
      await forceOffline(active);
      await reloadButton(active.page).click();
      await active.page.getByRole('dialog',{name:'Xác nhận rời bài thi'}).getByText(/Khi mở lại, bạn sẽ thấy màn hình kết thúc bài thi\./).waitFor();
      await acceptReload(active.page);
      await active.page.locator('#resultReadyView').waitFor();
      await active.page.getByText('Phần Listening đã khóa trên thiết bị. Đang chờ máy chủ xác nhận.',{exact:true}).waitFor();
      await reconnect(active);
      await active.page.getByText('Máy chủ đã nhận phần Listening.',{exact:true}).waitFor();
      const [{listening_answers:answers}]=(await fixture.db.query('SELECT listening_answers FROM assessment.term_test_attempt WHERE id=$1',[first[0].attempt_id])).rows;
      assert.equal(answers[finalQuestion],finalAnswer);
      console.log(JSON.stringify({order,section:'listening',finalSkill:true,answerPreserved:true}));
      if(upgraded){
        previous=true;
        await active.page.reload();
        await active.page.waitForFunction(app=>Array.from(document.scripts).some(script=>script.src.endsWith('/'+app)),previousApp);
        await active.page.locator('#resultReadyView').waitFor();
        assert.equal((await stored()).length,1);
        console.log(JSON.stringify({rollback:true,retainedOfficialReceipt:true}));
      }
    }
    for(const session of contextInfo)assert.deepEqual(session.errors,[]);
    console.log(JSON.stringify({order,section,officialReceiptCount:first.length,answerPreserved:true,droppedResponse:!!droppedOperation,twoProfiles:!!standby,upgraded}));
  }catch(error){
    const notices=await Promise.all(contextInfo.map(session=>session.page?.locator('#notice').textContent({timeout:800}).catch(()=>null)));
    const reloadState=await Promise.all(contextInfo.map(session=>session.page?.evaluate(async()=>{
      const ptr=JSON.parse(localStorage.getItem('mini-k56-paper:latest:IC5601'));
      const record=ptr&&JSON.parse(localStorage.getItem('mini-k56-paper:'+ptr.key));
      return {controller:navigator.serviceWorker.controller?.scriptURL,
        scripts:Array.from(document.scripts).map(script=>script.src.split('/').at(-1)),
        app:document.querySelector('#app')?.innerText.slice(0,350),
        hasReady:record?.ready,stages:Object.keys(record?.sections||{}),workerCaches:await caches.keys()};
    }).catch(()=>null)));
    throw Error(error.message+'\nAPI '+JSON.stringify(apiLog)+'\nNotices '+JSON.stringify(notices)+'\nStatic '+JSON.stringify(staticErrors.slice(-18))+
      '\nVersions '+JSON.stringify(versions)+'\nAfter reload '+JSON.stringify(reloadState),{cause:error});
  }finally{
    await browser?.close();
    await new Promise(done=>server.close(done));
    await fixture.close();
  }
});
