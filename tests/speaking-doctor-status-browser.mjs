import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
// Renderer thật, người và API giả; chỉ mở lại bài đã nộp, không gửi finish hay sửa bài.
const root=fileURLToPath(new URL('../',import.meta.url)),out=process.env.SPEAKING_EVIDENCE_DIR;
assert.ok(out);await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);assert.ok(path.startsWith(root));res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png'})[extname(path)]||'application/octet-stream'});res.end(await readFile(path));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROME_EXECUTABLE,headless:true});
const ref='70000000-0000-4000-8000-000000000001',results=[];
try{for(const lesson of [2,8].filter(n=>!process.env.SPEAKING_LESSON_FILTER||process.env.SPEAKING_LESSON_FILTER.split(',').includes(String(n))))for(const width of [390,1440])for(const status of ['review','failed','processing','done']){
 const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),errors=[];let writes=0;
 page.on('pageerror',e=>errors.push(e.message));
 const parts=lesson===2?['paraphrase','speaking']:['comparison_direct','comparison_extended','freestyle'];
 const code=lesson===2?'67-speaking-paraphrase':'67-speaking-so_sanh';
 const exercises=[1,2,3].map(n=>({exercise_id:'exercise-'+n,title:'Bài luyện mẫu '+n,exercise_url:'https://example.invalid/'+n,recommendation_count:2,practice_count:1}));
 await page.route('https://ducizone.ddns.net/mapping-api/api/student-identity/resolve',r=>r.fulfill({json:{ok:true,status:'unique',identity:{authority:'erp-contact',id:'12345'},aliases:[{classCode:'LOPMAU',studentRef:ref}]}}));
 await page.route('https://ducizone.ddns.net/mapping-api/api/speaking-homework*/**',async route=>{
  const path=new URL(route.request().url()).pathname.split(/speaking-homework(?:-independent)?/)[1];let data;
  const assignment={assignmentCode:code,classCode:'LOPMAU',assignmentStatus:'open',title:'Bài mẫu',parts:parts.map((part,i)=>({part_key:part,min_questions:(lesson===2?[5,3]:[6,6,1])[i]})),requiredPracticeCount:lesson===2?0:2,doctorEnabled:true,students:[{student_ref:ref,name:'Học viên mẫu'}]};
  if(path==='/classes')data={classes:[{classCode:'LOPMAU',ready:true,assignmentStatus:'open'}]};
  else if(path==='/assignment/roster')data={assignment};
  else if(path==='/identity/resolve')data={status:'unique',classCode:'LOPMAU'};
  else if(path==='/session/start-selected')data={session:{accessToken:'fixture-token-'.padEnd(48,'x'),studentRef:ref,classCode:'LOPMAU',workUnitId:'fixture-doctor-'+lesson,documentId:''}};
  else if(path==='/open')data={status:'submitted',receipt:{id:'BIEN-NHAN-CU'},processing:{analyze_homework:{status}},links:parts.map((part,n)=>({part,check_status:'accepted',question_count:(lesson===2?[5,3]:[6,6,1])[n],share_url:'https://chatgpt.com/share/'+String(n+1).padStart(32,'0')})),practiceLinks:(lesson===2?[3]:[1,2,3]).map(slot=>({slot,exercise_id:'exercise-'+slot,status:'accepted',analysis_status:status,share_url:'https://chatgpt.com/share/'+String(slot+10).padStart(32,'0')}))};
  else if(path==='/doctor/list')data={needed:exercises,allNeeded:exercises,practiced:[],neededCount:3,personalCount:3,sharedCatalog:[]};
  else{writes++;throw Error('UNEXPECTED_MUTATION:'+path);}
  await route.fulfill({json:{ok:true,...data}});
 });
 await page.goto('http://127.0.0.1:'+server.address().port+'/speaking-homework/'+(lesson===2?'index.html':'lesson-8.html')+'?class=LOPMAU');
 await page.locator('#class-select').selectOption('LOPMAU');await page.waitForFunction(()=>!document.getElementById('student-select').disabled);
 await page.locator('#student-select').selectOption(ref);await page.locator('#open-homework').click();
 await page.locator('#completion-card').waitFor({state:'visible'});
 const text=await page.locator('#extra-history').innerText();
 if(status==='review'){assert.match(text,/kiểm lại/);assert.doesNotMatch(text,/đang phân tích/);assert.match(await page.locator('#doctor-sync').innerText(),/kiểm lại/);}
 if(status==='done')assert.match(text,/Đã phân tích/);
 if(status==='failed')assert.match(text,/thử phân tích lại/);
 if(status==='processing')assert.match(text,/đang phân tích/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 if(status==='review'){await page.locator('#doctor-sync').scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/doctor-review-${lesson}-${width}.png`});}
 assert.deepEqual(errors,[]);assert.equal(writes,0);results.push({lesson,width,status,outcome:'passed',submitCalls:0});await context.close();
}}finally{await writeFile(out+'/browser-results.json',JSON.stringify(results,null,2));await browser.close();await new Promise(r=>server.close(r));}
console.log(JSON.stringify({outcome:'passed',cases:results.length,submitCalls:0}));
