import fs from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,sep,extname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const out=process.env.SPEAKING_TEACHER_EVIDENCE_DIR||resolve(root,'output/playwright/speaking-teacher-receipt');
await fs.mkdir(out,{recursive:true});
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const revision=process.env.SPEAKING_TEACHER_REVISION||null,publicBase=process.env.SPEAKING_TEACHER_PUBLIC_BASE||null;
assert.ok(!(revision&&publicBase));
const assetPaths=['speaking-homework/teacher.html','speaking-homework/teacher.js','speaking-homework/teacher.css','shared/master170/speaking-review.css'],overrides=new Map();
for(const path of assetPaths){
 if(revision)overrides.set('/'+path,execFileSync('git',['-C',root,'show',revision+':'+path]));
 if(publicBase){const response=await fetch(publicBase.replace(/\/$/,'')+'/'+path,{headers:{'Cache-Control':'no-cache'}});assert.equal(response.status,200);overrides.set('/'+path,Buffer.from(await response.arrayBuffer()));}
}

const server=createServer(async(req,res)=>{
  const u=new URL(req.url,'http://localhost'),path=resolve(root,'.'+decodeURIComponent(u.pathname));
  if(!path.startsWith(root+sep))return res.writeHead(403).end();
  try{const body=await fs.readFile(path);res.writeHead(200,{'content-type':({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png'})[extname(path)]||'application/octet-stream'}).end(body);}
  catch{res.writeHead(404).end();}
});
await new Promise((ok,no)=>{server.once('error',no);server.listen(35681,'127.0.0.1',ok);});
const origin='http://127.0.0.1:35681',id='20000000-0000-4000-8000-000000000001';
const share=n=>'https://chatgpt.com/share/'+String(n).padStart(32,'0');
const receipt={title:'Speaking · Biên nhận thử giao diện',class_code:'LỚP THỬ 67',student_name:'Hồ sơ giảng viên thử',submitted_at:'2026-10-19T02:00:00Z',
  grade_summary:{totalQuestions:12},links:{
    paraphrase:{url:share(1),questionCount:3,evidence:{acceptanceBasis:'chatbot_completion',countVerified:false,completionEvidence:{quote:'Đã hoàn thành phần luyện mẫu.'}}},
    benefit_harm:{url:'https://chatgpt.com/c/private-fixture'},
    freestyle:{url:'https://example.invalid/fixture',questionCount:1}},
  practice_links:[{slot:1,exerciseTitle:'Bài mẫu một',url:share(2),status:'accepted',analysisStatus:'done'},
    {slot:2,exerciseTitle:'Bài mẫu hai',url:share(3).replace('chatgpt.com','www.chatgpt.com'),status:'accepted',analysisStatus:'processing',evidence:{acceptanceBasis:'chatbot_completion'}},
    {slot:3,exerciseTitle:'Bài luyện thêm mẫu',url:'https://chatgpt.com/c/private-extra',status:'rejected'}],
  processing:{write_doc:{status:'done'},grade_speaking:{status:'review'},doctor_analyze:{status:'failed'},analyze_practice:{status:'pending'}}};
const records=[],browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const system of ['legacy','independent'])for(const [width,height]of[[1440,1000],[320,568]])for(const state of ['invalid','login','denied','network','server','success']){
  const key=`${system}-${state}-${width}`,context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'}),page=await context.newPage();
  page.setDefaultTimeout(8000);const calls=[],errors=[],unexpected=[];let signed=state!=='login';
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(u.hostname==='accounts.google.com')return route.fulfill({contentType:'text/javascript',body:"window.google={accounts:{id:{initialize(x){this.callback=x.callback},renderButton(el){const b=document.createElement('button');b.textContent='Google thử';b.onclick=()=>this.callback({credential:'fixture-only-google'});el.replaceChildren(b)},disableAutoSelect(){}}}};"});
   if(u.origin===origin){if(overrides.has(u.pathname))return route.fulfill({body:overrides.get(u.pathname),contentType:u.pathname.endsWith('.js')?'text/javascript':u.pathname.endsWith('.css')?'text/css':'text/html; charset=utf-8'});return route.continue();}
   if(u.hostname==='ducizone.ddns.net'){
    calls.push({path:u.pathname,method:req.method()});
    if(u.pathname.endsWith('/api/auth/session')){
     if(req.method()==='POST')signed=true;if(req.method()==='DELETE')signed=false;
     return route.fulfill({status:signed||req.method()==='DELETE'?200:401,json:{ok:signed||req.method()==='DELETE'}});
    }
    const prefix=system==='independent'?'/api/speaking-homework-independent':'/api/speaking-homework';
    if(u.pathname.endsWith(prefix+'/teacher/receipts/'+id)){
     assert.equal(req.method(),'GET');
     if(state==='network')return route.abort('connectionfailed');
     if(state==='denied')return route.fulfill({status:403,json:{ok:false,message:'Không có quyền xem lớp thử.'}});
     if(state==='server')return route.fulfill({status:503,json:{ok:false,message:'Dịch vụ thử đang bận. Hãy thử lại sau.'}});
     return route.fulfill({json:{ok:true,receipt}});
    }
   }
   unexpected.push({url:u.href,method:req.method()});return route.abort();
  });
  try{
   await page.goto(origin+'/speaking-homework/teacher.html?receipt='+(state==='invalid'?'bad-receipt':id)+(system==='independent'?'&system=independent':''));
   if(state==='success')await page.locator('#receipt-panel').waitFor({state:'visible'});
   else if(state==='invalid')await page.waitForFunction(()=>document.querySelector('#notice').textContent==='Link xem bài không hợp lệ.');
   else if(state==='login')await page.getByRole('button',{name:'Google thử',exact:true}).waitFor();
   else await page.waitForFunction(()=>{const x=document.querySelector('#notice').textContent;return !x.includes('Đang tải')&&!x.includes('Đang kiểm');});
   await page.evaluate(()=>document.fonts.ready);
   const initialUi=await page.evaluate(()=>{const notice=document.querySelector('#notice'),style=getComputedStyle(notice);return{notice:notice.textContent,noticeKind:notice.dataset.state||null,bg:style.backgroundColor,fg:style.color,kicker:getComputedStyle(document.querySelector('.eyebrow')).color,font:getComputedStyle(document.body).fontFamily,summary:document.querySelector('#summary').textContent,parts:document.querySelector('#parts').textContent,processing:document.querySelector('#processing').textContent,links:[...document.querySelectorAll('#receipt-panel a')].map(a=>({text:a.textContent,href:a.getAttribute('href'),target:a.target,rel:a.rel})),readonlyFields:document.querySelectorAll('#receipt-panel input,#receipt-panel textarea,#receipt-panel select').length,receiptVisible:!document.querySelector('#receipt-panel').hidden,loginVisible:!document.querySelector('#login-panel').hidden};});
   const expected=['invalid','denied','server'].includes(state)?{bg:'rgb(253, 232, 235)',fg:'rgb(155, 10, 34)'}:['login','network'].includes(state)?{bg:'rgb(255, 244, 224)',fg:'rgb(138, 83, 0)'}:{bg:'rgb(230, 238, 245)',fg:'rgb(23, 66, 101)'};
   const checks={role:initialUi.bg===expected.bg&&initialUi.fg===expected.fg,kicker:initialUi.kicker==='rgb(88, 100, 119)',font:initialUi.font.includes('Source Sans 3'),networkCopy:state!=='network'||initialUi.notice==='Chưa kết nối được để tải bài. Hãy kiểm tra mạng rồi thử lại.'};

   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   if(state==='success'){
    assert.match(await page.locator('#summary').innerText(),/LỚP THỬ 67[\s\S]*Hồ sơ giảng viên thử/);
    assert.match(await page.locator('#grade-summary').innerText(),/12[\s\S]*chưa xác minh số câu/);
    assert.equal(await page.locator('#parts > section').count(),6);
    assert.equal(await page.locator('#parts a[href]').count(),3);
    assert.equal(await page.getByText('Link hội thoại không hợp lệ',{exact:true}).count(),3);
    assert.equal(await page.locator('#processing li').count(),4);
    const text=await page.locator('#processing').innerText();for(const word of ['Hoàn tất','Cần kiểm tra lại','Cần thử lại','Đang xử lý'])assert.ok(text.includes(word));
    assert.equal(await page.locator('#receipt-panel input,#receipt-panel textarea,#receipt-panel select').count(),0);
    await page.locator('#grade-summary').screenshot({path:out+'/'+key+'-grade.png'});
    for(let n=0;n<6;n++)await page.locator('#parts > section').nth(n).screenshot({path:out+'/'+key+`-part-${n+1}.png`});
    await page.locator('#processing').screenshot({path:out+'/'+key+'-processing.png'});
   }else{
    assert.equal(await page.locator('#receipt-panel').isVisible(),false);
    if(state==='denied')assert.match(await page.locator('#notice').innerText(),/Không có quyền xem lớp thử/);
    if(state==='server')assert.match(await page.locator('#notice').innerText(),/Dịch vụ thử đang bận/);
    if(state==='network')assert.ok((await page.locator('#notice').innerText()).trim());
    if(state==='invalid')assert.equal(calls.some(x=>x.path.includes('/teacher/receipts/')),false);
   }
   await page.screenshot({path:out+'/'+key+'.png',fullPage:true});
   if(state==='login'){
    await page.getByRole('button',{name:'Google thử',exact:true}).click();await page.locator('#receipt-panel').waitFor({state:'visible'});
    await page.locator('#logout').click();await page.locator('#login-panel').waitFor({state:'visible'});
    assert.equal(await page.locator('#receipt-panel').isVisible(),false);
   }
   assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
   assert.ok(calls.every(x=>x.method==='GET'||x.path.endsWith('/api/auth/session')));
   records.push({system,state,width,height,outcome:Object.values(checks).every(Boolean)?'passed':'failed',checks,initialUi,notice:await page.locator('#notice').innerText(),calls});
  }catch(e){records.push({system,state,width,height,outcome:'failed',error:e.stack,calls,errors,unexpected});}
  finally{await context.unrouteAll({behavior:'wait'});await context.close();}
 }
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
const sources={};for(const path of ['speaking-homework/teacher.html','speaking-homework/teacher.js','speaking-homework/teacher.css','shared/teacher-session-client.js','shared/teacher-single-sign-on.js','shared/master170/speaking-review.css','shared/master170/theme.css'])sources[path]=createHash('sha256').update(overrides.get('/'+path)||await fs.readFile(resolve(root,path))).digest('hex');
const result={outcome:records.every(x=>x.outcome==='passed')?'passed':'failed',records,sourceHashes:sources,revision,publicBase,testSha256:createHash('sha256').update(await fs.readFile(fileURLToPath(import.meta.url))).digest('hex'),externalWrites:0,scope:'Actual teacher.html renderer; both receipt API variants, synthetic receipt and Google/API responses. No real login, SQL, AI, Google Docs or student writes. Successful login/logout POST/DELETE are fulfilled mocks. Public mode substitutes four HTML/JS/CSS assets, remaining assets local.'};
await fs.writeFile(out+'/results.json',JSON.stringify(result,null,2));console.log(JSON.stringify({outcome:result.outcome,cases:records.length,failed:records.filter(x=>x.outcome==='failed').length,errors:records.filter(x=>x.error).map(x=>({system:x.system,state:x.state,width:x.width,error:x.error}))}));if(result.outcome!=='passed')process.exitCode=1;
