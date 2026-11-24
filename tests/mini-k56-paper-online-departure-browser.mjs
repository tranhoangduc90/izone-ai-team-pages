import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {extname,resolve,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import test from 'node:test';

const fixturePath=process.env.MINI_K56_PAPER_NATIVE_FIXTURE;
assert.ok(fixturePath && process.env.MINI_PAPER_ONLINE_TEST==='true');
const {createFixture}=await import(pathToFileURL(fixturePath));
const require=createRequire(resolve(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'));
const {chromium}=require('playwright');
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const slug='mini-test-k56';
const route='/term-tests/'+slug+'/';
const api='/api/term-tests/'+slug+'/';
const labels={reading:'Reading',listening:'Listening'};
const type={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml'};
const variant=process.env.MINI_PAPER_ONLINE_ORDER;
const noShell=process.env.MINI_PAPER_NO_SHELL==='true';

for(const order of noShell?['read_first']:variant?[variant]:['read_first','lis_first'])test('Mini K56 paper online '+order,{timeout:120000},async()=>{
  const f=await createFixture();
  const web=createServer(async(req,res)=>{
    try{
      const path=new URL(req.url,'http://localhost').pathname;
      const name=resolve(root,'.'+path+(path.endsWith('/')?'index.html':''));
      if(!name.startsWith(root+sep))return res.writeHead(403).end();
      const mime=type[extname(name)];
      const data=await readFile(name);
      return res.writeHead(200,{'content-type':mime||'application/octet-stream'})
        .end(mime?data.toString().replaceAll('\r\n','\n'):data);
    }catch{return res.writeHead(404).end();}
  });
  let browser, origin, skippedResponse, lastRequest;
  const profiles=[], requests=[];
  const section=order==='read_first'?'reading':'listening';
  const next=section==='reading'?'listening':'reading';
  const skill=labels[section];
  const firstURL=api+section;
  try{
    do{
      await new Promise(done=>web.listen(0,'127.0.0.1',done));
      if(![5060,5061,6000,6566,6665,6666,6667,6668,6669,6697,10080].includes(web.address().port))break;
      await new Promise(done=>web.close(done));
    }while(true);
    origin='http://127.0.0.1:'+web.address().port;
    browser=await chromium.launch({channel:'msedge',headless:true});
    const destination=origin+route+'?class=IC5601&mode='+order;
    const ref=f.students[0].ref;
    async function open(){
      const context=await browser.newContext(noShell?{serviceWorkers:'block'}:{});
      const profile={context,connected:true,errors:[]};
      profiles.push(profile);
      await context.route('**/*',async intercepted=>{
        const request=intercepted.request(), u=new URL(request.url());
        if(u.origin===origin)return intercepted.continue();
        if(u.origin!=='https://ducizone.ddns.net' || !u.pathname.includes('/api/') || !profile.connected)return intercepted.abort();
        const path=u.pathname.slice(u.pathname.indexOf('/api/')), body=request.postData()||undefined;
        const result=await fetch(f.base+path+u.search,{body,method:request.method(),headers:{
          'Content-Type':'application/json',Origin:'https://tranhoangduc90.github.io'
        }});
        const data=await result.json().catch(()=>({}));
        requests.push({profile:profiles.indexOf(profile),path,status:result.status,code:data.error,persisted:data.persisted});
        if(path===firstURL && profiles[0]===profile && result.ok && !skippedResponse){
          skippedResponse=true;lastRequest=body;
          return intercepted.abort('failed');
        }
        return intercepted.fulfill({status:result.status,json:data,headers:{'access-control-allow-origin':'*'}});
      });
      const page=await newPage(profile);
      await page.goto(destination);
      await page.locator('#studentSelect option[value="'+ref+'"]').waitFor({state:'attached'});
      await page.locator('#studentSelect').selectOption(ref);
      await page.getByRole('button',{name:'Xác nhận và tiếp tục',exact:true}).click();
      await page.getByRole('button',{name:'Nhập đáp án '+skill,exact:true}).first().click();
      if(!noShell)await page.waitForFunction(()=>navigator.serviceWorker.controller?.scriptURL.includes('offline-worker-paper-shell-v2'));
      return profile;
    }
    async function newPage(profile){
      const page=await profile.context.newPage();
      profile.page=page;
      page.setDefaultTimeout(28000);
      page.on('dialog',dialog=>profile.stay&&dialog.type()==='beforeunload'?dialog.dismiss():dialog.accept());
      page.on('pageerror',error=>profile.errors.push(error.message));
      return page;
    }
    async function fill(profile,section,text,choice){
      const field=profile.page.locator('#'+section+'Questions input:visible,#'+section+'Questions select:visible').first();
      if(await field.evaluate(element=>element.tagName)==='SELECT')await field.selectOption({index:choice});
      else await field.fill(text);
      return {field,key:await field.getAttribute('data-number'),answer:await field.inputValue()};
    }
    const reload=page=>page.getByRole('button',{name:'Tải lại trang',exact:true});
    async function offline(profile){profile.connected=false;await profile.context.setOffline(true);}
    async function online(profile){profile.connected=true;await profile.context.setOffline(false);}
    async function confirm(page){
      await reload(page).click();
      await page.getByRole('button',{name:'Tải lại và nộp phần này',exact:true}).click();
    }
    const pending=(page,section)=>page.getByText('Phần '+labels[section]+' đã khóa trên thiết bị. Đang chờ máy chủ xác nhận.',{exact:true});
    const accepted=(page,section)=>page.getByText('Máy chủ đã nhận phần '+labels[section]+'.',{exact:true});
    const active=await open();
    const other=order==='lis_first'?await open():null;
    const answer=await fill(active,section,'A',1);
    const alternate=other&&await fill(other,section,'B',2);
    if(other)assert.notEqual(alternate.answer,answer.answer);
    const rows=async()=>(await f.db.query('SELECT id,'+section+'_answers AS answers,'+section+
      '_submitted_at AS submitted FROM assessment.term_test_attempt WHERE test_slug=$1 AND '+section+'_submitted_at IS NOT NULL',[slug])).rows;
    const original=await active.page.evaluate(()=>performance.timeOrigin);
    await offline(active);
    if(noShell){
      assert.equal(await active.page.evaluate(()=>!!navigator.serviceWorker.controller),false);
      const beforeUnload=active.page.waitForEvent('dialog',{predicate:d=>d.type()==='beforeunload'});
      const closed=active.page.waitForEvent('close');
      await Promise.all([beforeUnload,closed,active.page.close({runBeforeUnload:true})]);
      assert.equal((await rows()).length,0);
      const reopened=await newPage(active);
      await online(active);
      await reopened.goto(destination);
      const entry=reopened.locator('#miniPaperEnter');
      const choice=reopened.locator('#studentSelect:enabled');
      const confirmed=await Promise.race([
        accepted(reopened,section).waitFor().then(()=>true),
        choice.waitFor().then(()=>false)
      ]);
      if(!confirmed){await choice.selectOption(ref);await entry.click();}
    }else if(order==='read_first'){
      await reload(active.page).click();
      await active.page.getByRole('button',{name:'Ở lại làm bài',exact:true}).click();
      assert.equal(await answer.field.inputValue(),answer.answer);
      assert.equal(await active.page.evaluate(()=>performance.timeOrigin),original);
      await confirm(active.page);
    }else{
      active.stay=true;
      await Promise.all([active.page.waitForEvent('dialog',{predicate:d=>d.type()==='beforeunload'}),
        active.page.reload({waitUntil:'commit',timeout:2300}).catch(error=>{
          if(!/ERR_ABORTED|Timeout/.test(error.message))throw error;
        })]);
      active.stay=false;
      assert.equal(await answer.field.inputValue(),answer.answer);
      await active.page.reload({waitUntil:'commit'});
    }
    if(!noShell){
      await pending(active.page,section).waitFor();
      await active.page.getByRole('heading',{name:'Chuẩn bị phần '+labels[next]}).waitFor();
      assert.equal(await answer.field.isVisible(),false);
      assert.equal((await rows()).length,0);
      if(other){await offline(other);await confirm(other.page);await pending(other.page,section).waitFor();}
      await online(active);
    }
    await accepted(active.page,section).waitFor();
    assert.equal(skippedResponse,true);
    const [stored]=await rows();
    assert.equal(stored.answers[answer.key],answer.answer);
    const duplicate=await fetch(f.base+firstURL,{method:'POST',headers:{'Content-Type':'application/json'},body:lastRequest});
    assert.equal(duplicate.status,200);
    assert.deepEqual(await rows(),[stored]);
    if(other){
      await online(other);
      await other.page.getByText('Phần '+skill+' đã khóa trên thiết bị. Hãy báo giảng viên để đối soát.',{exact:true}).waitFor();
      await other.page.getByRole('button',{name:'Nhập đáp án '+labels[next],exact:true}).waitFor();
      assert.equal(await accepted(other.page,section).isVisible(),false);
      const local=await other.page.evaluate(()=>{
        const key=Object.keys(localStorage).find(key=>key.startsWith('izone-test:mini-test-k56:IC5601:paper:login:student:'));
        return JSON.parse(localStorage.getItem(key)).onlineDepartureReviews.listening;
      });
      assert.equal(local.body.answers[alternate.key],alternate.answer);
      assert.notEqual(local.scope.attemptToken,stored.id);
      assert.deepEqual(await rows(),[stored]);
    } else if(!noShell) {
      await active.page.getByRole('button',{name:'Nhập đáp án '+labels[next],exact:true}).click();
      const final=await fill(active,next,'FINAL',1);
      await offline(active);
      await reload(active.page).click();
      await active.page.getByRole('dialog').getByText(/Khi mở lại, bạn sẽ thấy màn hình kết thúc bài thi\./).waitFor();
      await active.page.getByRole('button',{name:'Tải lại và nộp phần này',exact:true}).click();
      await pending(active.page,next).waitFor();
      await active.page.getByRole('heading',{name:'Kết thúc bài thi',exact:true}).waitFor();
      await online(active);
      await accepted(active.page,next).waitFor();
      await active.page.locator('#resultReadyView').waitFor();
      const [saved]=(await f.db.query('SELECT listening_answers FROM assessment.term_test_attempt WHERE id=$1',[stored.id])).rows;
      assert.equal(saved.listening_answers[final.key],final.answer);
    }
    assert.ok(requests.some(row=>row.path===api+'offline/prepare'&&row.code==='OFFLINE_NEW_DISABLED'));
    assert.ok(requests.some(row=>row.path===api+'submission-status'&&row.persisted===true));
    for(const profile of profiles)assert.deepEqual(profile.errors,[]);
    console.log(JSON.stringify({order,section,oneCanonicalWrite:true,droppedResponse:true,competingLocalDraftPreserved:!!other,noShell}));
  }catch(error){
    const state=await Promise.all(profiles.map(profile=>profile.page?.evaluate(()=>({
      notices:document.querySelector('#notice')?.textContent,errors:document.querySelector('#app')?.innerText.slice(0,420),
      worker:navigator.serviceWorker.controller?.scriptURL
    })).catch(()=>null)));
    throw Error(error.message+'\nAPI '+JSON.stringify(requests)+'\nState '+JSON.stringify(state),{cause:error});
  }finally{
    await browser?.close();
    await new Promise(done=>web.close(done));
    await f.close();
  }
});
