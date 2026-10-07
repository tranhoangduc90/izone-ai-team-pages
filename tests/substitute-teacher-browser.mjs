// Kiểm giao diện thật qua API/GIS giả; không dùng token thật, gọi AI hay ghi Portal.
import {createServer} from 'node:http';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const root=path.resolve(new URL('../',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'));
const {chromium}=createRequire('C:/Users/vukha/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const slugs=['substitute-test-1-k56','substitute-test-2-k56','substitute-test-1-k67','substitute-test-2-k67'];
const server=createServer((req,res)=>{const u=new URL(req.url,'http://localhost'),p=path.resolve(root,'.'+u.pathname+(u.pathname.endsWith('/')?'index.html':''));if(!p.startsWith(root+path.sep))return res.writeHead(403).end();try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[path.extname(p)]||'application/octet-stream');res.end(fs.readFileSync(p));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'msedge',headless:true}),results=[],out=path.join(root,'output/playwright/substitute-teacher');fs.mkdirSync(out,{recursive:true});
const gis="window.google={accounts:{id:{initialize(o){this.callback=o.callback},disableAutoSelect(){},renderButton(el){const b=document.createElement('button');b.textContent='Đăng nhập bằng Google';b.onclick=()=>this.callback({credential:'fictional-token'});el.append(b)}}}}";
try{
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:900}});let expired=false,delayDetail=false,failOldDetail=false,twoTaskFixture=false,releaseDetail,oldRequested;const unauthorized=[],errors=[],googleReferrers=[];
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.origin===base)return route.continue();
   if(url.href==='https://accounts.google.com/gsi/client'){googleReferrers.push(route.request().headers().referer);return route.fulfill({contentType:'text/javascript',body:gis});}
   if(url.pathname.startsWith('/substitute-teacher-api/teacher/')){
    const name=url.pathname.split('/').pop(),slug=url.searchParams.get('test'),classCode=url.searchParams.get('class');let status=200,body;
    if(name==='config')body={googleClientId:'fictional.apps.googleusercontent.com'};
    else if(route.request().headers().authorization!=='Bearer fictional-token'){unauthorized.push(name);status=401;body={};}
    else if(expired){status=401;body={};}
    else if(name==='scopes')body={scopes:slugs.map(testSlug=>({testSlug,classCode:'DEMO'}))};
    else if(name==='results')body={testSlug:slug,classCode,hasMore:false,results:[1,2].map(n=>({testSlug:slug,classCode:'DEMO',studentRef:'fictional-student',studentName:n===1?'Học viên giả <img src=x>':'Học viên giả',attemptToken:'fictional-attempt-'+n,submittedAt:'2026-10-07T02:00:00Z',status:n===1?'ready':'processing',portalStatus:'not_applicable',scores:{listening:{raw:30,max:40,band:7},reading:{raw:20,max:slug==='substitute-test-1-k56'?26:40,band:6}},result:n===1?{taskScore:7.5}:null}))};
    else if(name==='result'){
     if(url.searchParams.has('stage'))return route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({testSlug:slug,classCode,studentRef:url.searchParams.get('student'),attemptToken:url.searchParams.get('attempt'),stageKey:url.searchParams.get('stage'),report:'Fictional protected Task 1 stage report.'})});
     if(delayDetail||(failOldDetail&&url.searchParams.get('attempt')==='fictional-attempt-1'))await new Promise(resolve=>{releaseDetail=resolve;oldRequested?.();});
     if(failOldDetail&&url.searchParams.get('attempt')==='fictional-attempt-1')status=500;
     body={testSlug:slug,classCode,studentRef:url.searchParams.get('student'),attemptToken:url.searchParams.get('attempt'),status:'ready',portalStatus:'not_applicable',taskNumber:slug==='substitute-test-2-k56'?1:2,result:{taskScore:7.5,criteria:['TR','CC','LR','GRA'].map(key=>({key,score:7.5,feedback:'Nhận xét giả'})),report:'<p>Báo cáo giả</p><script>parent.document.body.dataset.exploited="yes"</script><img src="https://evil.invalid/leak">'}};
     if(twoTaskFixture){const tasks=[1,2].map(taskNumber=>({taskNumber,status:'ready',result:{taskScore:taskNumber===1?7:8,criteria:(taskNumber===1?['TA','CC','LR','GRA']:['TR','CC','LR','GRA']).map(key=>({key,score:7,feedback:'Nhận xét giả'})),report:'Báo cáo giả cho Task '+taskNumber,...(taskNumber===1?{details:Array.from({length:9},(_,i)=>({stageKey:String(i+1).padStart(2,'0')+'-fixture',name:'Phân tích '+(i+1),url:'https://evil.invalid/redirect'}))}:{})}}));body={...body,requiredTasks:[1,2],tasks,result:{writingScore:7.5}};}
    }else throw Error('UNKNOWN_FIXTURE_ROUTE');
    return route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'Authorization'},body:JSON.stringify(body)}).catch(()=>{});
   }
   if(url.hostname==='evil.invalid')throw Error('REPORT_NETWORK_ESCAPE');return route.abort();
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  for(const slug of slugs){
   await page.goto(base+'/term-tests/'+slug+'-results/');await page.getByRole('button',{name:'Đăng nhập bằng Google'}).waitFor();
   assert.equal(await page.locator('#roster-section').isVisible(),false);assert.equal(await page.locator('#student-detail').isVisible(),false);
   await page.getByRole('button',{name:'Đăng nhập bằng Google'}).click();await page.locator('#student-rows .open-student').first().waitFor();
   assert.equal(await page.locator('#test-select').inputValue(),slug);assert.equal(await page.locator('#student-rows tr').count(),2);
   assert.ok((await page.locator('#student-rows').innerText()).includes('7.5/9'));assert.equal(await page.locator('#student-rows img').count(),0);
   await page.locator('.open-student').first().click();await page.locator('.criterion-card').first().waitFor();assert.equal(await page.locator('.criterion-card').count(),4);
   assert.equal(await page.locator('.feedback-frame').getAttribute('sandbox'),'');await page.frameLocator('.feedback-frame').getByText('Báo cáo giả').waitFor();assert.equal(await page.locator('body').getAttribute('data-exploited'),null);
   const stored=await page.evaluate(()=>({local:Object.keys(localStorage),session:Object.keys(sessionStorage)}));assert.deepEqual(stored,{local:[],session:[]});
   await page.screenshot({path:path.join(out,slug+'-'+width+'.png'),fullPage:true});results.push({slug,width,login:true,realAttemptShape:true,fourCriteria:true,reportSandboxed:true});
  }
  twoTaskFixture=true;await page.goto(base+'/term-tests/substitute-test-2-k67-results/');await page.getByRole('button',{name:'Đăng nhập bằng Google'}).click();await page.locator('.open-student').first().click();await page.locator('.criterion-card').first().waitFor();
  assert.equal(await page.locator('.criterion-card').count(),8);assert.equal(await page.locator('[data-task-stage]').count(),9);assert.ok((await page.locator('#attempt-content').innerText()).includes('Writing tổng · 7.5/9'));
  const stageLink=new URL(await page.locator('[data-task-stage]').first().getAttribute('href'));assert.equal(stageLink.origin,base);assert.equal(stageLink.searchParams.get('attempt'),'fictional-attempt-1');assert.equal(stageLink.searchParams.get('student'),'fictional-student');
  twoTaskFixture=false;
  // Liên kết thật của từng stage phải mở báo cáo sau khi login/loadResults đổi generation.
  await page.goto(base+'/term-tests/substitute-test-2-k67-results/?test=substitute-test-2-k67&class=DEMO&student=fictional-student&attempt=fictional-attempt-1&stage=01-ta-overview');
  await page.getByRole('button',{name:'Đăng nhập bằng Google'}).click();await page.getByText('Fictional protected Task 1 stage report.',{exact:true}).waitFor();
  assert.equal(await page.locator('#student-detail').isVisible(),true);
  // A lỗi muộn sau khi B đã hiện: phải giữ nguyên báo cáo B và danh sách.
  failOldDetail=true;let requested=new Promise(resolve=>{oldRequested=resolve;});await page.locator('.open-student').first().click();await requested;
  await page.locator('.open-student').nth(1).click();await page.locator('.criterion-card').first().waitFor();releaseDetail();await page.waitForTimeout(100);
  assert.equal(await page.locator('.criterion-card').count(),4);assert.equal(await page.locator('#roster-section').isVisible(),true);failOldDetail=false;oldRequested=null;
  // Logout trong lúc yêu cầu chi tiết chậm: dữ liệu không được xuất hiện lại.
  delayDetail=true;requested=new Promise(resolve=>{oldRequested=resolve;});await page.locator('.open-student').first().click();await requested;
  await page.locator('#logout').click();releaseDetail?.();delayDetail=false;await page.waitForTimeout(100);
  assert.equal(await page.locator('#student-detail').isVisible(),false);assert.equal(await page.locator('.criterion-card').count(),0);
  await page.getByRole('button',{name:'Đăng nhập bằng Google'}).click();await page.locator('#student-rows .open-student').first().waitFor();expired=true;
  await page.locator('#load-results').click();await page.waitForFunction(()=>document.querySelector('#login-status').textContent.includes('Chỉ giáo viên'));
  assert.equal(await page.locator('#roster-section').isVisible(),false);assert.deepEqual(unauthorized,[]);assert.deepEqual(errors,[]);assert.deepEqual(googleReferrers,[...slugs.map(()=>base+'/'),base+'/',base+'/']);
  await context.close();
 }
 console.log(JSON.stringify({ok:true,results,screenshots:out,aiCalls:0,portalWrites:0}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
