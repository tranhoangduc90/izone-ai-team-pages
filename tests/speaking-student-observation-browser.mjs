import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {startTrackingFixture} from './fixtures/speaking-tracking-server.mjs';
import {learners} from './fixtures/speaking-draft-server.mjs';

// Playwright library, không dùng @playwright/test. Browser/profile sạch và API
// loopback; chỉ kiểm renderer thật với dữ liệu giả, không gọi AI/Google/Docs.
assert.ok(process.env.PLAYWRIGHT_MODULE);assert.ok(process.env.SPEAKING_EVIDENCE_DIR);
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root=resolve(fileURLToPath(new URL('../',import.meta.url))),output=resolve(process.env.SPEAKING_EVIDENCE_DIR);
await mkdir(output,{recursive:true});
const fixture=await startTrackingFixture(root);let browser;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),results=[],contexts=[],errors=[],external=[];
const files={2:'index.html',3:'lesson-3.html',8:'lesson-8.html'};
const matching=(lesson,ref,store)=>fixture.requests.filter(row=>row.number===lesson&&row.ref===ref&&row.store===store);
const count=(rows,path)=>rows.filter(row=>row.path===path).length;
async function until(predicate,timeout=5000){const end=Date.now()+timeout;while(Date.now()<end){if(predicate())return;await wait(20);}throw Error('Fixture assertion deadline exceeded');}
async function control(page,value){return page.evaluate(value=>fetch('/__fixture/control',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value)}).then(r=>r.json()),value);}
async function reading(page,three=true){return page.evaluate(async three=>{const {requests,...value}=await (await import('/tests/fixtures/speaking-tracking-browser-actions.mjs')).readingResult({requireThreeTicks:three});return value;},three);}
async function save(name,value){await writeFile(join(output,name+'.json'),JSON.stringify(value,null,2)+'\n');results.push({name,...value});console.log(JSON.stringify({event:'speaking_browser_case',name,passed:true}));}
async function open(lesson,ref,store='independent',streamExpected=true,width=1440){
 const context=await browser.newContext({viewport:{width,height:1000}});contexts.push(context);
 await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==fixture.origin){external.push(url.hostname);return route.abort();}return route.continue();});
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.goto(fixture.origin+'/speaking-homework/'+files[lesson]+'?class=IC2304'+(store==='legacy'?'&fixtureIntake=legacy':''));
 await page.evaluate(async input=>(await import('/tests/fixtures/speaking-tracking-browser-actions.mjs')).startReading(input),{lesson,ref,store,streamExpected});
 return page;
}
try{
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 fixture.record(8,learners[1],'legacy').supported=false;
 const [two,three,eight,old]=await Promise.all([open(2,learners[0]),open(3,learners[0]),open(8,learners[0]),open(8,learners[1],'legacy',false,390)]);
 await wait(46000);
 for(const [name,page]of [['lesson2',two],['lesson3',three],['lesson8',eight]])await save(name+'-three-intervals',await reading(page));
 const oldReading=await reading(old,false);assert.ok(oldReading.elapsed>=45000);assert.ok(oldReading.newReads.opens>=3);assert.ok(oldReading.newReads.doctors>=3);
 assert.equal(matching(8,learners[1],'legacy').filter(row=>row.path.startsWith('/observation/')).length,0);
 await save('old-capability-mobile-native-fallback',oldReading);

 // Bắt đầu lỗi đọc trên engine2; kiểm lại sau khi các ca khác chạy xong.
 const faultBefore=count(matching(2,learners[0],'independent'),'/observation/student/view');
 await control(two,{number:2,ref:learners[0],failStatus:503,part:'speaking',patch:{check_status:'rejected',analysis_status:'done'}});
 await until(()=>count(matching(2,learners[0],'independent'),'/observation/student/view')===faultBefore+1);
 const faultAt=matching(2,learners[0],'independent').filter(row=>row.path==='/observation/student/view').at(-1).at;
 await control(two,{number:2,ref:learners[0],docs:{status:'pending',sequence:'2',applied_sequence:'0'}});
 await wait(5000);assert.equal(count(matching(2,learners[0],'independent'),'/observation/student/view'),faultBefore+1);
 await reading(two,false);await control(two,{number:2,ref:learners[0],failStatus:0});

 await control(eight,{number:8,ref:learners[0],docs:{status:'verified',sequence:'2',applied_sequence:'2'}});
 await eight.waitForFunction(()=>document.getElementById('docs-progress-status').textContent.startsWith('Đã cập nhật'),{},{timeout:5000});
 const docs=await reading(eight,false);assert.equal(docs.newReads.views,0);assert.equal(docs.newReads.opens,0);assert.equal(docs.newReads.doctors,0);await save('docs-only',docs);
 await control(eight,{number:8,ref:learners[0],part:'freestyle',patch:{check_status:'accepted',analysis_status:'done',question_count:100}});
 await eight.waitForFunction(()=>document.getElementById('freestyle-result').textContent.includes('100'),{},{timeout:6000});
 const content=await reading(eight,false);assert.equal(content.newReads.views,1);assert.equal(content.newReads.opens,0);assert.equal(content.newReads.doctors,0);await save('changed-content-stable-other-regions',content);

 await control(eight,{number:8,ref:learners[0],part:'comparison_extended',patch:{check_status:'rejected',analysis_status:'done'},docs:{status:'pending',sequence:'3',applied_sequence:'2'}});
 await eight.waitForFunction(()=>document.getElementById('comparison_extended-result').textContent.includes('Chưa'),{},{timeout:6000}).catch(async error=>{
  // Ô đang gõ khác link máy chủ thì kết quả được ẩn theo renderer native.
  assert.equal(await eight.locator('#comparison_extended-result').isHidden(),true);await wait(4500);
 });
 const boundaryBefore=count(matching(8,learners[0],'independent'),'/observation/student/view');
 await control(eight,{number:8,ref:learners[0],part:'comparison_direct',patch:{question_count:777},docs:{status:'verified',sequence:'4',applied_sequence:'4'}});
 await eight.waitForFunction(()=>document.getElementById('comparison_direct-result').textContent.includes('777'),{},{timeout:6000});
 assert.equal(count(matching(8,learners[0],'independent'),'/observation/student/view'),boundaryBefore+1);
 await save('final-docs-content-before-idle',{viewReads:1,result:await eight.locator('#comparison_direct-result').innerText()});

 // Biên nhận đã ghi nhưng phản hồi bị mất: đọc lại, không gửi finish lần hai.
 let lostAck=0;await three.route('**/finish',async route=>{if(lostAck++===0){await route.fetch();await route.abort('failed');}else await route.continue();});
 await three.locator('#clarify_2-link').fill('https://chatgpt.com/share/00000000-0000-4000-8000-000000000031');
 await control(three,{number:3,ref:learners[0],allAccepted:true,docs:{status:'verified',sequence:'2',applied_sequence:'2'}});
 await three.locator('#completion-card').waitFor({state:'visible',timeout:8000});
 assert.equal(count(matching(3,learners[0],'independent'),'/finish'),1);assert.equal(lostAck,1);
 await save('lost-finish-response',{finishes:1,lostAck,receipt:await three.locator('#completion-card').innerText()});

 // Phản hồi của người cũ còn chậm5giây, người mới đã mở và có nội dung riêng.
 fixture.record(8,learners[1]).links[0].question_count=66;
 await control(eight,{number:8,ref:learners[0],docs:{status:'pending',sequence:'5',applied_sequence:'4'}});await eight.reload();
 await eight.evaluate(async ref=>(await import('/tests/fixtures/speaking-tracking-browser-actions.mjs')).startReading({lesson:8,ref}),learners[0]);
 const identityBefore=count(matching(8,learners[0],'independent'),'/observation/student/view');
 await control(eight,{number:8,ref:learners[0],viewDelayMs:5000,part:'comparison_direct',patch:{question_count:888}});
 await until(()=>count(matching(8,learners[0],'independent'),'/observation/student/view')>identityBefore);
 await eight.evaluate(async ref=>{window.__lateTexts=[];new MutationObserver(()=>window.__lateTexts.push(document.getElementById('comparison_direct-result').textContent)).observe(document.getElementById('comparison_direct-result'),{subtree:true,childList:true,characterData:true});await (await import('/tests/fixtures/speaking-tracking-browser-actions.mjs')).select(ref);},learners[1]);
 await wait(6000);
 const identity=await eight.evaluate(()=>({result:document.getElementById('comparison_direct-result').textContent,input:document.getElementById('comparison_extended-link').value,
  latePaint:window.__lateTexts.some(text=>text.includes('888')),draftRetained:Object.entries(localStorage).some(([key,value])=>key.startsWith('speaking-homework:lesson-8:')&&value.includes('999999999997'))}));
 assert.match(identity.result,/66/);assert.equal(identity.latePaint,false);assert.equal(identity.draftRetained,true);assert.ok(identity.input.endsWith('000000000081'));await save('identity-late-response',identity);

 // Chỉ còn Docs đang chờ; view409 phải ép một vòng native để không mất nội dung cuối.
 await control(eight,{number:8,ref:learners[1],part:'comparison_extended',patch:{check_status:'rejected',analysis_status:'done'}});
 await control(eight,{number:8,ref:learners[1],part:'freestyle',patch:{check_status:'rejected',analysis_status:'done'}});await wait(5000);
 const terminalRows=matching(8,learners[1],'independent'),terminalOpens=count(terminalRows,'/open'),terminalViews=count(terminalRows,'/observation/student/view');
 await control(eight,{number:8,ref:learners[1],failStatus:409,part:'comparison_direct',patch:{question_count:99},docs:{status:'verified',sequence:'2',applied_sequence:'2'}});
 await until(()=>count(matching(8,learners[1],'independent'),'/observation/student/view')>terminalViews);
 await control(eight,{number:8,ref:learners[1],failStatus:0});
 await eight.waitForFunction(()=>document.getElementById('comparison_direct-result').textContent.includes('99'),{},{timeout:22000});
 assert.equal(count(matching(8,learners[1],'independent'),'/open')-terminalOpens,1);assert.equal(count(matching(8,learners[1],'independent'),'/observation/student/view')-terminalViews,1);
 await save('terminal-unsupported-native-read',{opens:1,views:1,result:await eight.locator('#comparison_direct-result').innerText()});

 await until(()=>count(matching(2,learners[0],'independent'),'/observation/student/view')>=faultBefore+2,35000);
 const faultReads=matching(2,learners[0],'independent').filter(row=>row.path==='/observation/student/view').slice(faultBefore);
 assert.equal(faultReads.length,2);assert.ok(faultReads[1].at-faultAt>=30000);const recovered=await reading(two,false);
 await save('view-fault-backoff-recovery',{gapMs:faultReads[1].at-faultAt,reads:faultReads.length,reading:recovered});
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 const sourceFiles=['shared/test-state-observer.mjs','shared/speaking-student-tracking.mjs','speaking-homework/live-tracking.js','speaking-homework/lesson-2-live.js','speaking-homework/lesson-3-live.js','speaking-homework/lesson-4-live.js',
  'tests/fixtures/speaking-tracking-server.mjs','tests/fixtures/speaking-tracking-browser-actions.mjs','tests/speaking-student-observation-browser.mjs'];
 const hashes=await Promise.all(sourceFiles.map(async path=>({path,sha256:createHash('sha256').update(await readFile(join(root,path))).digest('hex')})));
 await writeFile(join(output,'result.json'),JSON.stringify({outcome:'success',browser:'Edge headless isolated',version:browser.version(),nativeIntervalMs:15000,results,sourceHashes:hashes,uncaughtErrors:errors,externalAttempts:external.length,productionMutations:0},null,2)+'\n');
 console.log(JSON.stringify({event:'speaking_browser_complete',outcome:'success',cases:results.length,externalAttempts:0}));
}finally{for(const context of contexts)await context.close();await browser?.close();await fixture.close();}
