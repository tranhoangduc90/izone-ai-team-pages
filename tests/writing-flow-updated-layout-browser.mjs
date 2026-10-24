import fs from'node:fs/promises';import assert from'node:assert/strict';import {serveDirectory}from'./fixtures/static-ui-server.mjs';import {fileURLToPath}from'node:url';const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=process.env.SOURCE_ROOT||fileURLToPath(new URL('../',import.meta.url)),out=process.env.FLOW_UPDATED_EVIDENCE_DIR;assert(out,'Set FLOW_UPDATED_EVIDENCE_DIR outside Git');await fs.mkdir(out,{recursive:false});
const after=await serveDirectory(root),browser=await chromium.launch({channel:'chrome',headless:true}),records=[],traces=[];let page;
const stages=['intake','precheck','main','critic','arbiter','render','deliver'];
const pair={pair_id:'fixture-pair',source_type:'homework',student_name:'Học viên thử có tên dài để kiểm hiển thị',display_name:'Tài liệu thử',class_code:'LOPTHU',teacher_names:['Giảng viên thử'],homework_file_id:'FIXTURE_DOC',file_url:'https://docs.google.com/document/d/FIXTURE_DOC/edit',classroom_url:'https://classroom.google.com/c/FIXTURE',topic:'Đề bài thử cần đối chiếu đầy đủ',essay_preview:'Đoạn bài viết thử gồm nhiều câu. '.repeat(25),source_status:'ready',status:'needs_review',attempt_count:3,last_error_code:'FIXTURE_RETRY',tr_cc_check:true,created_at:'2026-10-24T00:00:00Z',source_created_at:'2026-10-24T00:00:00Z'};
const issue={...pair,source_issue_id:'fixture-issue',reason_code:'missing_essay',occurrence_count:2,first_seen_at:pair.created_at,last_seen_at:pair.created_at};
const classRow={class_code:'LOPTHU',classroom_id:'fixture-class',teacher_names:['Giảng viên thử'],total_count:1,pair_count:1,processing_count:1,status:'mapped',coverage_status:'mapped'};
const generic={ok:true,generatedAt:pair.created_at,classes:[classRow],pairs:[pair],days:[{day:'2026-10-24',newly_graded_count:1,delivered_count:1,historical_count:2}],issues:[issue],reviews:[pair],events:[{at:pair.created_at,action:'fixture_read',actor:'GV thử',status:'completed'}],failures:[{id:'fixture-failure',workflow_id:'FIXTURE',error_message:'Lỗi thử không phải production',created_at:pair.created_at}],items:[],filters:{classes:[{class_code:'LOPTHU',classCode:'LOPTHU'}],teachers:['Giảng viên thử']},counts:{stages:stages.map(stage_key=>({stage_key,stage_status:'needs_review',pair_count:1})),summary:{}},coverage:[classRow],records:[{...pair,record_id:'fixture-legacy',homework_title:'Bài cũ thử',teacher_name:'GV thử',source_status:'completed',match_status:'matched'}],summary:{},total:1,nextCursor:null,nextOffset:null};
const detail={source:{topic:pair.topic,essay:pair.essay_preview,trCcCheck:true},pair,stages:stages.map((stage_key,i)=>({stage_key,status:['pending','running','needs_review','succeeded'][i%4],attempt_count:3,result:{message:'Kết quả thử '+stage_key}}))};

async function setup(server,file){
 const ctx=await browser.newContext(),p=await ctx.newPage();page=p;const errors=[],writes=[],requests=[];let failure=false;
 p.on('pageerror',e=>errors.push(e.message));
 await ctx.route('**/*',async r=>{
  const req=r.request(),u=new URL(req.url());
  if(u.hostname==='accounts.google.com')return r.fulfill({contentType:'text/javascript',body:'window.google={accounts:{id:{initialize(){},renderButton(){},prompt(){},disableAutoSelect(){}}}};'});
  if(u.pathname.endsWith('/writing-flow-config.json'))return r.fulfill({json:{apiBase:server.origin+'/mock/',googleClientId:'fixture-google-id'}});
  if(u.pathname.startsWith('/mock/')){
   requests.push({path:u.pathname,query:u.search});if(req.method()!=='GET')writes.push({path:u.pathname,method:req.method()});
   if(req.method()!=='GET')return r.fulfill({status:503,json:{ok:false,error:'READ_ONLY_FIXTURE'}});
   if(u.pathname.endsWith('/auth/session'))return r.fulfill({json:{ok:true,user:{name:'GV giả',canManage:false}}});
   if(failure)return r.fulfill({status:503,json:{ok:false,message:'Lỗi thử, không phải danh sách rỗng.'}});
   if(u.pathname.endsWith('/worksheet-sources'))return r.fulfill({json:{ok:true,records:[{homework_file_id:'FIXTURE_PENDING',class_code:'LOPTHU',display_name:'Nguồn thử đang chờ tiếp nhận',dispatch_status:'pending',file_url:'https://docs.google.com/document/d/FIXTURE_PENDING/edit'},{homework_file_id:'FIXTURE_WORKSHEET',class_code:'LOPTHU',display_name:'Phiếu Writing1 giả',dispatch_status:'delivered',file_url:'https://docs.google.com/document/d/FIXTURE_WORKSHEET/edit',worksheet:{kind:'writing1',answeredCount:6,deliveredAt:pair.created_at}}]}});
   if(u.pathname.endsWith('/detail'))return r.fulfill({json:{ok:true,detail}});if(u.pathname.endsWith('/history'))return r.fulfill({json:{ok:true,history:{events:[{kind:'attempt',stage_key:'main',at:pair.created_at,attempt_no:3,status:'failed',error_code:'FIXTURE_RETRY'}]}}});return r.fulfill({json:generic});
  }
  if(u.origin===server.origin)return r.continue();return r.abort();
 });
 await p.addInitScript(()=>{const NativeDate=Date,fixed=Date.parse('2026-10-24T12:00:00Z');window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[fixed]));}static now(){return fixed;}};});
 await p.goto(server.origin+'/writing-handouts/'+file);await p.locator('#flow-dashboard').waitFor({state:'visible'});
 return{ctx,p,errors,writes,requests,setFailure:v=>failure=v};
}

try{
 for(const file of ['writing-flow.html','writing-flow-v2.html']){
  const f=await setup(after,file),p=f.p;
  for(const width of [1440,1024,760,600,390,320]){
   await p.setViewportSize({width,height:width>760?900:844});
   if(file.includes('v2'))await p.evaluate(()=>location.hash='stage/homework/precheck');else await p.locator('[data-view="precheck"]').click();
   await p.waitForFunction(()=>document.querySelector('#flow-view-title').textContent.includes('Kiểm trước'));
   await p.evaluate(()=>document.fonts.ready);
   for(const position of ['top','badge','bottom']){
    await p.evaluate(position=>{const badge=document.querySelector('#flow-view-status');const top=position==='top'?0:position==='bottom'?document.documentElement.scrollHeight:badge.getBoundingClientRect().top+scrollY-8;scrollTo(0,top);},position);
    await p.evaluate(()=>new Promise(requestAnimationFrame));
    const observed=await p.evaluate(()=>{
     const rect=e=>e?(()=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};})():null;
     const updated=document.querySelector('#flow-updated'),status=document.querySelector('#flow-view-status'),logo=document.querySelector('.m170-logo'),brand=document.querySelector('.m170-homework-header>span');
     const a=rect(updated),b=rect(status),c=rect(logo),d=rect(brand);
     const overlaps=(a,b)=>!!a&&!!b&&Math.min(a.right,b.right,innerWidth)>Math.max(a.left,b.left,0)&&Math.min(a.bottom,b.bottom,innerHeight)>Math.max(a.top,b.top,0);
     return {updated:a,status:b,logo:c,brand:d,overlap:overlaps(a,b)||overlaps(a,c)||overlaps(a,d),overflow:document.documentElement.scrollWidth>innerWidth,font:getComputedStyle(document.body).fontFamily,copy:document.querySelector('#flow-dashboard').innerText,controls:[...document.querySelectorAll('#flow-dashboard button,#flow-dashboard input,#flow-dashboard select')].map(e=>({tag:e.tagName,text:e.textContent.trim(),disabled:e.disabled,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})),kind:document.body.dataset.kind,updatedText:updated.textContent,scrollY};
    });
    assert.equal(observed.kind,'homework');assert.match(observed.font,/Source Sans 3/);assert.equal(observed.overflow,false);
    const photo=`${file.replace('.html','')}-${width}-${position}.png`;await p.screenshot({path:out+'/'+photo});records.push({file,width,position,photo,passed:!observed.overlap,...observed});
   }
  }
  assert.deepEqual(f.errors,[]);assert.deepEqual(f.writes,[]);traces.push({file,requests:f.requests,externalWrites:0});await f.ctx.close();console.log(JSON.stringify({file,observations:records.filter(r=>r.file===file).length}));
 }
 const failures=records.filter(r=>!r.passed),proof={outcome:failures.length?'failed':'passed',records,traces,failures:failures.map(({file,width,position})=>({file,width,position})),externalWrites:0,scope:'Actual Homework dashboards; public-compatible synthetic GET API and fixed fixture clock. Visible clock must not cover stage badge, logo or brand at page top, badge and bottom. Test route is not activated. No Google login or business mutations.'};
 await fs.writeFile(out+'/results.json',JSON.stringify(proof,null,2));console.log(JSON.stringify({outcome:proof.outcome,observations:records.length,failures:failures.length}));if(failures.length)process.exitCode=1;
}catch(error){await fs.writeFile(out+'/failure.json',JSON.stringify({outcome:'failed',error:error.stack,records,traces},null,2));throw error;}finally{await browser.close();await after.close();}
