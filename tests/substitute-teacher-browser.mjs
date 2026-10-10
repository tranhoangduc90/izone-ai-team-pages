// Kiểm giao diện thật qua API/GIS giả; không dùng token thật, gọi AI hay ghi Portal.
import {createServer} from 'node:http';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const root=path.resolve(new URL('../',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'));
const {chromium}=createRequire('C:/Users/vukha/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const slugs=['substitute-test-1-k56','substitute-test-2-k56','substitute-test-1-k67','substitute-test-2-k67'];
const server=createServer((req,res)=>{const u=new URL(req.url,'http://localhost'),p=path.resolve(root,'.'+u.pathname+(u.pathname.endsWith('/')?'index.html':''));if(!p.startsWith(root+path.sep))return res.writeHead(403).end();try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[path.extname(p)]||'application/octet-stream');res.end(fs.readFileSync(p));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=process.argv.includes('--online')?'https://tranhoangduc90.github.io/izone-ai-team-pages':'http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'msedge',headless:true}),results=[],out=path.join(root,'output/playwright/substitute-teacher');fs.mkdirSync(out,{recursive:true});
const gis="window.google={accounts:{id:{initialize(o){this.callback=o.callback},disableAutoSelect(){},renderButton(el){const b=document.createElement('button');b.textContent='Đăng nhập bằng Google';b.onclick=()=>this.callback({credential:'fictional-token'});el.append(b)}}}}";
try{
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:900}});let expired=false,delayDetail=false,failOldDetail=false,twoTaskFixture=false,allClassFixture=false,releaseDetail,oldRequested;const unauthorized=[],errors=[],googleReferrers=[];
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.href.startsWith(base+'/'))return route.continue();
   if(url.href==='https://accounts.google.com/gsi/client'){googleReferrers.push(route.request().headers().referer);return route.fulfill({contentType:'text/javascript',body:gis});}
   if(url.pathname.startsWith('/substitute-teacher-api/teacher/')){
    const name=url.pathname.split('/').pop(),slug=url.searchParams.get('test'),classCode=url.searchParams.get('class');let status=200,body;
    if(name==='config')body={googleClientId:'fictional.apps.googleusercontent.com'};
    else if(route.request().headers().authorization!=='Bearer fictional-token'){unauthorized.push(name);status=401;body={};}
    else if(expired){status=401;body={};}
    else if(name==='scopes')body={scopes:slugs.flatMap(testSlug=>(allClassFixture?['DEMO',...(testSlug.endsWith('k56')?['IC2264',...Array.from({length:35},(_,i)=>'IC'+(9000+i))]:['IC2063',...Array.from({length:14},(_,i)=>'IC'+(9100+i))])]:['DEMO']).map(classCode=>({testSlug,classCode})))};
    else if(name==='results'&&allClassFixture&&classCode!=='DEMO')body={testSlug:slug,classCode,hasMore:false,results:[]};
    else if(name==='results')body={testSlug:slug,classCode,hasMore:false,results:[1,2].map(n=>({testSlug:slug,classCode:'DEMO',studentRef:'fictional-student',studentName:n===1?'Học viên giả <img src=x>':'Học viên giả',attemptToken:'fictional-attempt-'+n,submittedAt:'2026-10-07T02:00:00Z',status:n===1?'ready':'processing',portalStatus:'not_applicable',scores:{listening:{raw:30,max:40,band:7},reading:{raw:20,max:slug==='substitute-test-1-k56'?26:40,band:6}},result:n===1?{taskScore:7.5}:null}))};
    else if(name==='result'){
     if(url.searchParams.has('stage'))return route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({testSlug:slug,classCode,studentRef:url.searchParams.get('student'),attemptToken:url.searchParams.get('attempt'),stageKey:url.searchParams.get('stage'),report:'Fictional protected Task 1 stage report.'})});
     if(delayDetail||(failOldDetail&&url.searchParams.get('attempt')==='fictional-attempt-1'))await new Promise(resolve=>{releaseDetail=resolve;oldRequested?.();});
     if(failOldDetail&&url.searchParams.get('attempt')==='fictional-attempt-1')status=500;
     body={testSlug:slug,classCode,studentRef:url.searchParams.get('student'),attemptToken:url.searchParams.get('attempt'),status:'ready',portalStatus:'not_applicable',taskNumber:slug==='substitute-test-2-k56'?1:2,result:{taskScore:7.5,criteria:['TR','CC','LR','GRA'].map(key=>({key,score:7.5,feedback:'## Nhận xét giả\n\n**Điểm mạnh**\n\n- Nội dung giả'})),report:'```html\n<pre>## Báo cáo giả\n\n**Kết luận giả**\n\n- Mục giả</pre><script>parent.document.body.dataset.exploited="yes"</script><img src="https://evil.invalid/leak"><p>### Tiêu đề trong HTML</p>\n```'}};
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
   await page.locator('.feedback-rich h3').getByText('Báo cáo giả',{exact:true}).waitFor({timeout:3000});assert.equal(await page.locator('.feedback-rich strong').getByText('Kết luận giả',{exact:true}).count(),1);assert.equal(await page.locator('.feedback-rich li').getByText('Mục giả',{exact:true}).count(),1);assert.equal(await page.locator('.feedback-rich iframe,.feedback-rich script,.feedback-rich img,.feedback-rich pre').count(),0);assert.equal(await page.locator('body').getAttribute('data-exploited'),null);assert.ok(!(await page.locator('#attempt-content').innerText()).includes('```'));assert.ok(!(await page.locator('#attempt-content').innerText()).includes('## '));
   await page.locator('.criterion-card summary').first().click();await page.screenshot({path:path.join(out,slug+'-feedback-'+width+'.png'),fullPage:true});
   await page.locator('#toggle-filters').click();assert.equal(await page.locator('#extra-filters').isVisible(),true);await page.locator('#name-filter').fill('Học viên giả');await page.locator('#writing-filter').selectOption('ready');await page.locator('#portal-filter').selectOption('not_applicable');await page.locator('#from-filter').fill('2026-10-07');await page.locator('#to-filter').fill('2026-10-09');
   const filtered=page.waitForRequest(r=>r.url().includes('/teacher/results')&&new URL(r.url()).searchParams.get('from')==='2026-10-07');await page.locator('#apply-filters').click();const filterUrl=new URL((await filtered).url());assert.equal(filterUrl.searchParams.get('name'),'Học viên giả');assert.equal(filterUrl.searchParams.get('to'),'2026-10-09');assert.equal(filterUrl.searchParams.get('writing'),'ready');await page.locator('#reset-filters').click();
   await page.evaluate(()=>document.fonts.ready);assert.match(await page.locator('body').evaluate(e=>getComputedStyle(e).fontFamily),/Source Sans Pro/);assert.equal(await page.evaluate(()=>document.fonts.check('16px "Source Sans Pro"')&&document.fonts.check('700 16px "Source Sans Pro"')),true);assert.equal(await page.locator('#load-results').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(219, 8, 41)');
   const stored=await page.evaluate(()=>({local:Object.keys(localStorage),session:Object.keys(sessionStorage)}));assert.deepEqual(stored,{local:[],session:[]});
   await page.screenshot({path:path.join(out,slug+'-'+width+'.png'),fullPage:true});results.push({slug,width,login:true,realAttemptShape:true,fourCriteria:true,reportSandboxed:true});
  }
  twoTaskFixture=true;await page.goto(base+'/term-tests/substitute-test-2-k67-results/');await page.getByRole('button',{name:'Đăng nhập bằng Google'}).click();await page.locator('.open-student').first().click();await page.locator('.criterion-card').first().waitFor();
  assert.equal(await page.locator('.criterion-card').count(),8);assert.equal(await page.locator('[data-task-stage]').count(),0);assert.ok((await page.locator('#attempt-content').innerText()).includes('Writing tổng · 7.5/9'));
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
  allClassFixture=true;
  for(const slug of slugs){
   await page.goto(base+'/term-tests/'+slug+'-results/');await page.getByRole('button',{name:'Đăng nhập bằng Google'}).click();
   const count=slug.endsWith('k56')?38:17,realClass=slug.endsWith('k56')?'IC2264':'IC2063';
   await page.waitForFunction(expected=>document.querySelector('#class-filter').options.length===expected,count);
   assert.equal(await page.locator('#class-filter option').count(),count);
   await page.locator('#class-filter').selectOption(realClass);await page.getByText('Chưa có lượt nộp trong phạm vi này.',{exact:true}).waitFor();
   assert.equal(await page.locator('#class-filter').inputValue(),realClass);assert.equal(await page.locator('#roster-section').isVisible(),true);
   await page.screenshot({path:path.join(out,slug+'-all-classes-'+width+'.png'),fullPage:true});results.push({slug,width,allApprovedClassOptions:true,emptyRealClassVisible:true});
  }
  allClassFixture=false;await page.locator('#logout').click();
  await page.getByRole('button',{name:'Đăng nhập bằng Google'}).click();await page.locator('#student-rows .open-student').first().waitFor();expired=true;
  await page.locator('#load-results').click();await page.waitForFunction(()=>document.querySelector('#login-status').textContent.includes('Chỉ giáo viên'));
  const origin=new URL(base).origin+'/';
  assert.equal(await page.locator('#roster-section').isVisible(),false);assert.deepEqual(unauthorized,[]);assert.deepEqual(errors,[]);assert.deepEqual(googleReferrers,[...slugs.map(()=>origin),origin,origin,...slugs.map(()=>origin)]);
  await context.close();
 }
 console.log(JSON.stringify({ok:true,results,screenshots:out,aiCalls:0,portalWrites:0}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
