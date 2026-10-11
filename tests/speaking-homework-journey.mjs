import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);

// Trang và handler thật với API giả. Kiểm thứ tự, hướng dẫn, giữ nháp, receipt
// và hai cách tiếp nhận; không đọc hội thoại hoặc ghi hệ thống bên ngoài.
const root=fileURLToPath(new URL('../',import.meta.url));
const out=process.env.SPEAKING_EVIDENCE_DIR;assert.ok(out);await mkdir(out,{recursive:true});
const ref='70000000-0000-4000-8000-000000000001';
const lessons=[
  {n:2,file:'index.html',code:'67-speaking-paraphrase',parts:['paraphrase','speaking'],mins:[5,3],practice:0},
  {n:3,file:'lesson-3.html',code:'67-speaking-lam_ro',parts:['clarify_1','clarify_2','clarify_3','freestyle'],mins:[3,2,2,2],practice:0},
  {n:4,file:'lesson-4.html',code:'67-speaking-diem_giua',parts:['insert_middle','freestyle'],mins:[3,1],practice:2},
  {n:5,file:'lesson-5.html',code:'67-speaking-on_tap_lam_ro_diem_giua',parts:['review_clarify_middle','freestyle'],mins:[3,1],practice:2},
  {n:6,file:'lesson-6.html',code:'67-speaking-ly_do_hanh_vi',parts:['benefit_harm','reason_action','freestyle'],mins:[0,2,1],practice:2},
  {n:7,file:'lesson-7.html',code:'67-speaking-cach_lam_mot_viec',parts:['how_to_do'],mins:[4],practice:2}
];
const exercises=[1,2,3].map(n=>({exercise_id:`exercise-${n}`,title:'Bài mẫu '+n,exercise_url:'https://example.invalid/'+n,recommendation_count:4-n,practice_count:n}));
const server=createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://localhost');const path=resolve(root,'.'+url.pathname);
  if(!path.startsWith(root))throw Error('Outside root');
  res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png'})[extname(path)]||'application/octet-stream'});res.end(await readFile(path));
}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROME_EXECUTABLE||'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',headless:true});
const results=[];const share=n=>'https://chatgpt.com/share/'+String(n).padStart(32,'0');
try{
for(const lesson of lessons.filter(l=>!process.env.SPEAKING_LESSON_FILTER||process.env.SPEAKING_LESSON_FILTER.split(',').includes(String(l.n))))for(const width of [390,768,1440]){
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage();
  const errors=[],requests=[];page.on('console',m=>{if(m.type()==='error')console.error(m.text());});let links=[],practice=[],submitted=false;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://ducizone.ddns.net/mapping-api/api/speaking-homework*/**',async route=>{
    const url=new URL(route.request().url()),path=url.pathname.split(/speaking-homework(?:-independent)?/)[1];
    const body=route.request().postDataJSON()||{};requests.push({path,body,url:url.pathname});
    const assignment={assignmentCode:lesson.code,classCode:'LOPMAU',assignmentStatus:'open',title:'Bài mẫu',parts:lesson.parts.map((p,i)=>({part_key:p,min_questions:lesson.mins[i]})),requiredPracticeCount:lesson.practice,doctorEnabled:lesson.n!==3,students:[{student_ref:ref,name:'Học viên mẫu'}]};
    let data;
    if(path==='/classes')data={classes:[{classCode:'LOPMAU',ready:true,assignmentStatus:'open'}]};
    else if(path==='/assignment/roster')data={assignment};
    else if(path==='/identity/resolve')data={status:'unique',classCode:'LOPMAU'};
    else if(path==='/session/start-selected')data={session:{accessToken:'fixture-token-'.padEnd(48,'x'),studentRef:ref,classCode:'LOPMAU',workUnitId:'fixture-'+lesson.n,documentId:''}};
    else if(path==='/open')data={links,practiceLinks:practice,status:submitted?'submitted':'open',receipt:submitted?{id:'BIEN-NHAN-MAU-'+lesson.n}:null};
    else if(path==='/doctor/list')data={needed:exercises,allNeeded:exercises,neededCount:3,personalCount:3,sharedCatalog:[],practiced:[],requiredPracticeCount:lesson.practice};
    else if(path==='/checks/request'){links=links.filter(l=>l.part!==body.part).concat({part:body.part,share_url:body.url,check_status:'accepted',question_count:lesson.mins[lesson.parts.indexOf(body.part)],analysis_status:'done'});data={check:{}};}
    else if(path==='/doctor/practice/request'){practice=practice.filter(p=>p.slot!==body.slot).concat({slot:body.slot,exercise_id:body.exerciseId,share_url:body.url,status:'accepted',analysis_status:'done'});data={check:{}};}
    else if(path==='/finish'){assert.equal(links.length,lesson.parts.length);assert.equal(practice.length,lesson.practice);submitted=true;data={receipt:{id:'BIEN-NHAN-MAU-'+lesson.n}};}
    else throw Error('Unexpected '+path);
    await route.fulfill({json:{ok:true,...data}});
  });
  await page.goto(origin+'/speaking-homework/'+lesson.file+'?class=LOPMAU');
  await page.locator('#class-select').selectOption('LOPMAU');await page.waitForFunction(()=>!document.getElementById('student-select').disabled||!document.getElementById('reload-roster').hidden);assert.equal(await page.locator('#student-select').isDisabled(),false,JSON.stringify({message:await page.locator('#identity-message').innerText(),errors,requests}));await page.locator('#student-select').selectOption(ref);await page.locator('#open-homework').click();
  await page.waitForFunction(()=>document.activeElement?.matches('#lesson-hero h1'));
  await page.evaluate(()=>document.fonts.ready);
  assert.match(await page.locator('body').evaluate(el=>getComputedStyle(el).fontFamily),/Nunito Sans/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  if(width!==768)await page.screenshot({path:`${out}/lesson-${lesson.n}-${width}-start.png`,fullPage:true});
  for(const [i,part] of lesson.parts.entries()){
    const input=page.locator('#'+part+'-link');const card=page.locator('#'+part+'-card');
    const help=card.getByRole('button',{name:'Cách lấy link Share'});
    assert.equal(await help.evaluate((el,id)=>Boolean(el.compareDocumentPosition(document.getElementById(id))&Node.DOCUMENT_POSITION_FOLLOWING),part+'-link'),true);
    await input.fill('giữ nháp');await help.click();await page.locator('#share-guide-dialog').waitFor({state:'visible'});await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(()=>document.activeElement?.textContent),'Cách lấy link Share');assert.equal(await input.inputValue(),'giữ nháp');
    await input.fill('https://chatgpt.com/c/private');await page.locator('#'+part+'-confirm').click();await card.getByText('Link chưa đúng',{exact:true}).waitFor();
    await input.fill(share(i+1));await page.locator('#'+part+'-confirm').click();await card.getByText('Đã xác nhận hội thoại',{exact:true}).waitFor();
    if(i===0&&lesson.parts.length+lesson.practice>1){
      await input.fill('');assert.equal(await input.inputValue(),'');assert.equal(await page.locator('#completion-card').isVisible(),false);
      await page.reload();await page.locator('#open-homework').click();await page.waitForFunction(()=>document.activeElement?.matches('#lesson-hero h1'));assert.equal(await input.inputValue(),'');
      await input.fill(share(i+1));await page.locator('#'+part+'-confirm').click();await card.getByText('Đã xác nhận hội thoại',{exact:true}).waitFor();
    }
  }
  for(let slot=1;slot<=lesson.practice;slot++){
    const input=page.locator(`#practice-${slot}-link`),help=page.locator(`#practice-${slot}-link-share-guide`);
    assert.equal(await help.evaluate((el,id)=>Boolean(el.compareDocumentPosition(document.getElementById(id))&Node.DOCUMENT_POSITION_FOLLOWING),`practice-${slot}-link`),true);
    await page.locator(`#practice-${slot}-exercise`).selectOption('exercise-'+slot);await input.fill(share(lesson.parts.length+slot));await page.locator(`#practice-${slot}-confirm`).click();
    await page.locator(`#practice-${slot}-result`).getByText('Đã nhận bài bổ trợ',{exact:true}).waitFor();
  }
  await page.locator('#completion-card').waitFor({state:'visible'});assert.equal(requests.filter(r=>r.path==='/finish').length,1);
  assert.equal(await page.locator('#return-homework').isVisible(),false);assert.doesNotMatch(await page.locator('#completion-message').innerText(),/quay lại file Homework/);
  if(width!==768)await page.screenshot({path:`${out}/lesson-${lesson.n}-${width}-submitted.png`,fullPage:true});
  await page.reload();await page.locator('#open-homework').click();await page.waitForFunction(()=>document.activeElement?.matches('#completion-card h2'));
  assert.equal(requests.filter(r=>r.path==='/finish').length,1);assert.deepEqual(errors,[]);
  results.push({lesson:lesson.n,width,outcome:'passed'});await context.close();
}
}catch(e){results.push({outcome:'failed',error:e.message});throw e;}
finally{await writeFile(out+'/journey-results.json',JSON.stringify(results,null,2));await browser.close();await new Promise(r=>server.close(r));}
console.log('Speaking journey: '+results.length+' PASS');
