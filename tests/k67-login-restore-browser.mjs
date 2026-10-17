// Mở giao diện thật bằng Chrome với học viên giả và API giả; chặn toàn bộ audio/mạng ngoài.
// So đường khôi phục, lỗi và người mới; ghi mốc nhìn thấy bài, không gọi production.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,stat,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire('file:///C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const baseline=process.env.K67_LOGIN_BASELINE_DIR;
const out=process.env.K67_LOGIN_EVIDENCE_DIR;
assert.ok(out,'Cần thư mục bằng chứng riêng.');await mkdir(out,{recursive:true});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const ref='11111111-1111-4111-8111-111111111111',attempt='22222222-2222-4222-8222-222222222222';
const session='33333333-3333-4333-8333-333333333333',classCode='IC9900';
const server=createServer(async(req,res)=>{
  try{
    const rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'');
    assert.ok(!rel.split('/').includes('..'));
    let file=path.join(root,rel);
    if(baseline&&['term-tests/shared/app.js','term-tests/term-test-2-computer-based/bootstrap.js','term-tests/term-test-1-computer-based/index.html'].includes(rel))file=path.join(baseline,rel);
    if((await stat(file)).isDirectory())file=path.join(file,'index.html');
    res.setHeader('Content-Type',file.endsWith('.js')||file.endsWith('.mjs')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');
    res.end(await readFile(file));
  }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'});
const results=[];
async function run({name,mode='lis_first',status=200,saved=true,slug='term-test-1',mobile=false,nextSection='reading'}) {
  const ctx=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:800},serviceWorkers:'block'});
  const page=await ctx.newPage(),calls=[],errors=[],blocked=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await ctx.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url()),p=url.pathname;
    if(/\.(mp3|wav|ogg|iztt)(?:$|\?)/i.test(req.url())||/\/session\/[^/]+\/(audio|preview)$/.test(p)){
      blocked.push(p);return route.abort();
    }
    if(p.includes('/api/')){
      calls.push(p);await wait(p.endsWith('/roster')?350:150);
      let data={ok:true},code=200;
      if(p.endsWith('/roster'))data={ok:true,class:{name:classCode},students:[{ref,name:'Học viên giả A'}]};
      else if(p.endsWith('/session/resume-attempt')){
        code=status;
        data=code===200?{ok:true,attemptToken:attempt,examSessionToken:session,studentName:'Học viên giả A',
          examMode:mode,nextSection,listeningSubmitted:mode==='lis_first',readingSubmitted:nextSection==='listening',
          readingStartedAt:new Date().toISOString(),readingDeadlineAt:new Date(Date.now()+3600000).toISOString(),
          readingDraft:{1:'server'},readingDraftRevision:2,serverNow:new Date().toISOString(),
          content:{baseTestSlug:slug,title:'Đề giả',listening:{instructions:[],sections:[]},reading:{instructions:[],sections:[]},writing:null}}
          :{ok:false,error:code===404?'ATTEMPT_NOT_FOUND':'TEMPORARY_FAILURE',message:'Máy chủ giả chưa xác nhận lượt'};
      }else if(p.endsWith('/result'))data={ok:true,studentName:'Học viên giả A',className:classCode,completed:false,
        exam:{examSessionToken:session,readingDeadlineAt:new Date(Date.now()+3600000).toISOString(),serverNow:new Date().toISOString()},writing:null};
      else if(!p.endsWith('/client-event')){code=409;data={ok:false,message:'Không được tạo lượt hoặc bắt đầu trong phép kiểm này'};}
      return route.fulfill({status:code,contentType:'application/json',body:JSON.stringify(data)});
    }
    if(url.origin!==origin){blocked.push(req.url());return route.abort();}
    return route.continue();
  });
  await ctx.addInitScript(({slug,ref,attempt,session,classCode,saved,mode})=>{
    if(!saved)localStorage.setItem('izone:remembered-writing-student:v1:https://ducizone.ddns.net:18869/term-mini-k67-api',JSON.stringify({version:1,studentRef:ref}));
    localStorage.setItem(`izone-test:${slug}:${classCode}`,JSON.stringify({studentRef:ref,studentName:'Tên cũ trên máy',
      ...(saved?{attemptToken:attempt,examSessionToken:session}:{}),examMode:mode,
      drafts:{reading:{1:'local-newer'}},draftRevisions:{reading:3},draftAckRevisions:{reading:2}}));
  },{slug,ref,attempt,session,classCode,saved,mode});
  const start=performance.now();
  await page.goto(`${origin}/term-tests/${slug}-computer-based/?class=${classCode}&mode=${mode}`,{waitUntil:'domcontentloaded'});
  let outcome='passed',error,ready;
  try{
    if(saved&&status===200&&nextSection==='reading'){
      await page.locator('#readingView').waitFor({state:'visible',timeout:12000});
      ready=performance.now()-start;
      await page.waitForTimeout(150);
      const state=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),`izone-test:${slug}:${classCode}`);
      assert.equal(state.studentRef,ref);assert.equal(state.attemptToken,attempt);
      assert.equal(state.studentName,'Học viên giả A');
      assert.equal(state.drafts.reading['1'],'local-newer');
      assert.equal(calls.filter(p=>p.endsWith('/roster')).length,0,'Phiên hợp lệ phải vào bài mà không tải roster');
      results.push({name,outcome,readyMs:ready,calls,errors,audioAttempts:blocked.filter(p=>/audio|preview|mp3/.test(p)).length});
    }else{
      if(saved&&status===503)await page.locator('#bootstrapNotice').filter({hasText:'chưa xác nhận'}).waitFor({timeout:10000});
      else await page.locator('#bootstrapStudent option').nth(1).waitFor({state:'attached',timeout:10000});
      assert.equal(await page.locator('#readingView').count(),0);
      assert.ok(!calls.some(p=>p.endsWith('/session/start')));
      assert.ok(!calls.some(p=>p.endsWith('/session/prepare')),'Không tự tạo lượt chỉ từ tên đã nhớ hoặc khi xác minh lỗi');
      if(!saved){assert.equal(await page.locator('#bootstrapStudent').inputValue(),ref);await page.locator('#bootstrap-change-remembered-student').click();assert.equal(await page.locator('#bootstrapStudent').inputValue(),'');}
      if(nextSection==='listening'){
        assert.equal(await page.locator('#bootstrapStudent').inputValue(),ref);
        assert.equal(await page.locator('#bootstrapStudent').isDisabled(),true);
        assert.equal(await page.locator('#bootstrapStudent').isVisible(),true);
        assert.ok(!calls.some(p=>p.endsWith('/roster')));
      }
      if(status!==200){const s=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),`izone-test:${slug}:${classCode}`);assert.equal(s.attemptToken,attempt);assert.equal(s.drafts.reading['1'],'local-newer');}
      results.push({name,outcome,calls,errors,audioAttempts:blocked.filter(p=>/audio|preview|mp3/.test(p)).length});
    }
    assert.deepEqual(errors,[]);assert.equal(blocked.filter(p=>/audio|preview|mp3/.test(p)).length,0);
    await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});
  }catch(e){outcome='failed';error=e.message;results.push({name,outcome,error,readyMs:ready,calls,errors});await page.screenshot({path:path.join(out,name+'-failure.png'),fullPage:true});}
  await ctx.close();return {outcome,error};
}
try{
  for(const c of [
    {name:'resume-listening-first'}, {name:'resume-reading-first',mode:'read_first'},
    {name:'resume-mobile',mobile:true}, {name:'remembered-without-session',saved:false},
    {name:'server-unavailable',status:503}, {name:'invalid-or-other-owner',status:404},
    ...['term-test-2','mini-test-lesson-5'].flatMap(slug=>[
      {name:slug+'-resume',slug}, {name:slug+'-read-first',slug,mode:'read_first'},
      {name:slug+'-mobile',slug,mobile:true}, {name:slug+'-remembered',slug,saved:false},
      {name:slug+'-unavailable',slug,status:503}, {name:slug+'-invalid',slug,status:404}]),
    {name:'reading-first-to-audio-lobby',mode:'read_first',nextSection:'listening'}
  ])await run(c);
}finally{await browser.close();await new Promise(r=>server.close(r));}
await writeFile(path.join(out,'results.json'),JSON.stringify({results,network:'API giả: roster 350ms, yêu cầu khác 150ms; asset local',productionMutations:0},null,2),'utf8');
console.log(JSON.stringify(results));
assert.ok(results.every(r=>r.outcome==='passed'),'Có ca giao diện chưa đạt; xem results.json');
