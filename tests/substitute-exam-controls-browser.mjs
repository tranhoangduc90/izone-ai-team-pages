// Browser thật; API/media giả và chặn bên ngoài. Không nộp/chấm bài thật hoặc ghi Portal.
import fs from 'node:fs';import path from 'node:path';import{createServer}from'node:http';import{fileURLToPath,pathToFileURL}from'node:url';import assert from'node:assert/strict';
import {execFileSync} from 'node:child_process';
if(!process.env.PLAYWRIGHT_MODULE||!process.env.SUBSTITUTE_CONTROLS_EVIDENCE)throw Error('Cần PLAYWRIGHT_MODULE và SUBSTITUTE_CONTROLS_EVIDENCE.');
const{chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href),root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),out=process.env.SUBSTITUTE_CONTROLS_EVIDENCE;fs.mkdirSync(out,{recursive:true});
// Cùng ca hành vi trên entry trước sửa; không ghi đè checkout khi lấy bằng chứng RED.
const baseline=process.env.SUBSTITUTE_CONTROLS_BASELINE;
if(baseline&&!/^[a-f0-9]{40}$/.test(baseline))throw Error('Baseline phải là revision Git đầy đủ.');
if(baseline&&process.argv.includes('--online'))throw Error('Không trộn baseline và tài nguyên online.');
const server=createServer((q,r)=>{const u=new URL(q.url,'http://fixture'),p=path.resolve(root,'.'+u.pathname.replace(/^\/izone-ai-team-pages/,'')+(u.pathname.endsWith('/')?'index.html':''));if(!p.startsWith(root+path.sep))return r.writeHead(403).end();try{r.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf'})[path.extname(p)]||'application/octet-stream');const relative=path.relative(root,p).replaceAll(path.sep,'/');r.end(baseline&&/^term-tests\/substitute-test-[12]-k(?:56|67)-computer-based\/index.html$/.test(relative)?execFileSync('git',['show',baseline+':'+relative],{cwd:root,windowsHide:true}):fs.readFileSync(p));}catch{r.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=process.argv.includes('--online')?'https://tranhoangduc90.github.io/izone-ai-team-pages':'http://127.0.0.1:'+server.address().port,browser=await chromium.launch({channel:'msedge',headless:true}),results=[];

function check(checks,id,ok,observed){checks.push({id,ok:Boolean(ok),observed});}
async function inspectMediumHeader(page, state, checks) {
 if (page.viewportSize().width !== 1024) return;
 const names = ['Đổi người học', 'Tải bài làm về máy', 'Reset dữ liệu'];
 const buttons = names.map(name => page.getByRole('button', { name, exact: true }));
 const boxes = await Promise.all([...buttons, page.locator('#studentSelect')].map(control => control.boundingBox()));
 const [change, download, reset, student] = boxes;
 const centerY = box => box.y + box.height / 2;
 const fits = boxes.every(Boolean)
  && boxes.every(box => Math.abs(centerY(box) - centerY(change)) < 5)
  && download.x >= change.x + change.width
  && student.x >= download.x + download.width
  && reset.x >= student.x + student.width
  && reset.x + reset.width <= 1024;
 check(checks, state + '-medium-header-fits', fits, boxes);
}
async function inspectControls(p,skill,checks){
 const form=p.locator('#'+skill+'View');
 await form.locator('.cbt-notes-open').waitFor();
 await inspectMediumHeader(p,skill,checks);
 if(skill==='listening'&&p.viewportSize().width===390){
  const download=p.getByRole('button',{name:'Tải bài làm về máy',exact:true});
  const change=p.getByRole('button',{name:'Đổi người học',exact:true});
  const [backupBox,changeBox]=await Promise.all([download.boundingBox(),change.boundingBox()]);
  check(checks,'download-shares-mobile-header-row',
   backupBox&&changeBox&&backupBox.x>=changeBox.x+changeBox.width
   &&Math.abs(backupBox.y+backupBox.height/2-changeBox.y-changeBox.height/2)<3
   &&backupBox.x+backupBox.width<=390,{backupBox,changeBox});
 }
 const geometry=await form.evaluate(f=>{
  const heading=f.querySelector('.cbt-test-heading'),tools=f.querySelector('.cbt-toolbar-controls'),nav=f.querySelector('.cbt-question-nav');
  const buttons=[...nav.querySelectorAll('.cbt-question-button')],r=buttons.map(e=>e.getBoundingClientRect());
  const instructions=heading.querySelector('.instructions'),legend=f.querySelector('.cbt-nav-legend');
  const box=e=>{const b=e.getBoundingClientRect();return{x:b.x,y:b.y,w:b.width,h:b.height};};
  return{toolsInHeading:tools.parentElement===heading,instructions:getComputedStyle(instructions).display,legend:getComputedStyle(legend).display,
   label:getComputedStyle(f.querySelector('.cbt-text-size>span')).display,rows:new Set(r.map(b=>Math.round(b.y))).size,
   nav:box(nav),buttons:r.map(b=>({x:b.x,y:b.y,w:b.width})),title:box(heading.querySelector('h2')),notes:box(f.querySelector('.cbt-notes-open')),
   timer:box(f.querySelector('[role=timer]')),submit:box(f.querySelector('[type=submit]:not([hidden])')),pageOverflow:document.documentElement.scrollWidth-innerWidth,
   partLabels:[...f.querySelectorAll('.cbt-part-button')].map(e=>({text:e.textContent,title:e.title,aria:e.getAttribute('aria-label')}))};
 });
 check(checks,skill+'-compact-tools',geometry.toolsInHeading&&geometry.instructions==='none'&&geometry.label==='none',geometry);
 check(checks,skill+'-single-row',geometry.rows===1&&geometry.legend==='none',geometry);
 check(checks,skill+'-no-page-overflow',geometry.pageOverflow<=1,geometry.pageOverflow);
 check(checks,skill+'-actions-visible',geometry.submit.x>=0&&geometry.submit.x+geometry.submit.w<=p.viewportSize().width+1&&(skill==='listening'||geometry.timer.w>0),geometry);
 if(p.viewportSize().width>700)check(checks,skill+'-map-in-viewport',geometry.nav.y+geometry.nav.h<=p.viewportSize().height,geometry.nav);
 if(p.viewportSize().width>1200)check(checks,skill+'-one-toolbar-row',Math.abs(geometry.notes.y+geometry.notes.h/2-geometry.title.y-geometry.title.h/2)<3,geometry);
 if(skill==='listening')check(checks,'part-labels',geometry.partLabels.every(b=>/^Section \d+ · Q/.test(b.text)||/^Part \d+$/.test(b.text)&&b.aria?.includes('Q')),geometry.partLabels);
 const pane=form.locator('.cbt-content-viewport'),size=pane.getAttribute('data-font-size');
 await form.getByRole('button',{name:'Tăng cỡ chữ',exact:true}).click();
 const after=await pane.getAttribute('data-font-size');await form.getByRole('button',{name:'Giảm cỡ chữ',exact:true}).click();
 check(checks,skill+'-zoom',after!==await size&&await pane.getAttribute('data-font-size')===await size,{before:await size,after});
 await form.locator('.cbt-notes-open').click();check(checks,skill+'-notes-open',await p.locator('#cbtNotesPanel').isVisible());
 await p.getByRole('button',{name:'Đóng Notes',exact:true}).click();check(checks,skill+'-notes-close',!await p.locator('#cbtNotesPanel').isVisible());
 const last=form.locator('.cbt-question-button').last();await last.focus();
 if(p.viewportSize().width===1440){await p.setViewportSize({width:1024,height:900});await p.waitForTimeout(400);const focused=await last.evaluate(e=>{const b=e.getBoundingClientRect(),n=e.parentElement.getBoundingClientRect();return e===document.activeElement&&b.left>=n.left-1&&b.right<=n.right+1;});check(checks,skill+'-resize-focused-before-enter',focused);await p.setViewportSize({width:1440,height:900});await p.waitForTimeout(250);}
 await p.keyboard.press('Enter');await p.waitForTimeout(400);
 const n=await last.evaluate(e=>{const b=e.getBoundingClientRect(),n=e.parentElement.getBoundingClientRect();return{visible:b.left>=n.left-1&&b.right<=n.right+1,active:e.classList.contains('is-active')};});
 check(checks,skill+'-keyboard-last-question',n.visible&&n.active,n);
 if(p.viewportSize().width===1440){
  for(const w of [1024,390]){await p.setViewportSize({width:w,height:900});await p.waitForTimeout(400);const resized=await last.evaluate(e=>{const b=e.getBoundingClientRect(),n=e.parentElement.getBoundingClientRect();return{visible:b.left>=n.left-1&&b.right<=n.right+1,active:e.classList.contains('is-active'),left:b.left,right:b.right,navLeft:n.left,navRight:n.right,scrollLeft:e.parentElement.scrollLeft};});check(checks,skill+'-resize-active-'+w,resized.visible&&resized.active,resized);}
  await p.setViewportSize({width:1440,height:900});await p.waitForTimeout(250);
 }
 await form.locator('.cbt-part-button').first().click();
 const input=form.locator('.cbt-content-viewport input:visible:not([type=radio]):not([type=checkbox]),.cbt-content-viewport select:visible').first();
 const handle=await input.elementHandle();if(await input.evaluate(e=>e.tagName==='SELECT')){const opt=input.locator('option:not([value=""])').first();await input.selectOption(await opt.getAttribute('value'));}else await input.fill('UI fixture');
 const value=await input.inputValue();await input.focus();await p.waitForTimeout(1000);
 const before=await input.evaluate(e=>({start:e.selectionStart,scroll:e.closest('.cbt-reading-questions,.cbt-listening-section')?.scrollTop||0}));
 // Không tắt nhịp nền: chờ hơn ba nhịp đồng hồ/đo layout thực.
 await p.waitForTimeout(3200);
 const afterInput=await input.evaluate(e=>({connected:e.isConnected,focused:e===document.activeElement,value:e.value,start:e.selectionStart,scroll:e.closest('.cbt-reading-questions,.cbt-listening-section')?.scrollTop||0}));
 check(checks,skill+'-input-background-stable',await handle.evaluate(e=>e.isConnected&&e===document.activeElement)&&afterInput.value===value&&afterInput.start===before.start&&Math.abs(afterInput.scroll-before.scroll)<=1,{before,after:afterInput});
 await p.screenshot({path:out+'/'+windowSafe(skill)+'-'+widthSafe(p)+'.png',fullPage:true});
 function windowSafe(x){return slugSafe(p)+'-'+x;}function widthSafe(p){return p.viewportSize().width;}function slugSafe(p){return new URL(p.url()).pathname.split('/').filter(Boolean).at(-1);}
}
async function inspectWriting(p,slug,checks){
 await p.goto(base+'/term-tests/'+slug+'-computer-based/?demo=writing&class=DEMO');await p.locator('#writingView').waitFor({state:'visible'});
 const inputs=p.locator('[data-writing-task]'),tabs=p.locator('#writingTaskTabs button'),count=await tabs.count();
 for(let i=0;i<count;i++){await tabs.nth(i).click();const visible=p.locator('[data-writing-task]:visible');await visible.fill('Fictional task '+i);}
 for(let i=0;i<count;i++){await tabs.nth(i).focus();await p.keyboard.press('Enter');check(checks,'writing-task-'+i,await p.locator('[data-writing-task]:visible').inputValue()==='Fictional task '+i);}
 // Preview Writing không dựng đồng hồ; đồng hồ thật có bộ kiểm resilience riêng.
 const g=await p.locator('.writing-exam-header').evaluate(e=>({title:getComputedStyle(e.querySelector('h2')).fontSize,overflow:document.documentElement.scrollWidth-innerWidth,submit:e.querySelector('#submitWriting').getBoundingClientRect().width,tabs:[...e.querySelectorAll('.writing-task-tab')].map(b=>getComputedStyle(b).fontSize)}));
 check(checks,'writing-compact-controls',g.title==='20px'&&g.tabs.every(x=>x==='13px')&&g.submit>0&&g.overflow<=1,g);
 await p.screenshot({path:out+'/'+slug+'-writing-'+p.viewportSize().width+'.png',fullPage:true});
 await p.reload();await p.locator('#writingView').waitFor({state:'visible'});for(let i=0;i<count;i++){await p.locator('#writingTaskTabs button').nth(i).click();check(checks,'writing-reload-'+i,await p.locator('[data-writing-task]:visible').inputValue()==='Fictional task '+i);}
}
// The lobby preview uses native playback so the ten-second gate sees real media progress.
const previewRate = 8000, previewFrames = 16 * previewRate;
const previewWav = Buffer.alloc(44 + 2 * previewFrames);
previewWav.write('RIFF');
previewWav.writeUInt32LE(previewWav.length - 8, 4);
previewWav.write('WAVEfmt ', 8);
previewWav.writeUInt32LE(16, 16);
previewWav.writeUInt16LE(1, 20);
previewWav.writeUInt16LE(1, 22);
previewWav.writeUInt32LE(previewRate, 24);
previewWav.writeUInt32LE(previewRate * 2, 28);
previewWav.writeUInt16LE(2, 32);
previewWav.writeUInt16LE(16, 34);
previewWav.write('data', 36);
previewWav.writeUInt32LE(previewFrames * 2, 40);

const slugs=['substitute-test-1-k56','substitute-test-2-k56','substitute-test-1-k67','substitute-test-2-k67'].filter(s=>!process.env.SUBSTITUTE_CONTROLS_SLUG||s===process.env.SUBSTITUTE_CONTROLS_SLUG);
const widths=[1440,1024,390].filter(w=>!process.env.SUBSTITUTE_CONTROLS_WIDTH||String(w)===process.env.SUBSTITUTE_CONTROLS_WIDTH);
if(!slugs.length||!widths.length)throw Error('Bộ lọc kiểm thử không hợp lệ.');
try{for(const slug of slugs)for(const width of widths){const height=900;
 const c=await browser.newContext({viewport:{width,height},serviceWorkers:'block'}),errors=[],requests=[];const epoch='11111111-1111-4111-8111-111111111111';
 await c.addInitScript(() => {
   window.IZONE_EXAM_DEVICE_CHECKED = true;
   const media = HTMLMediaElement.prototype;
   const play = media.play, load = media.load;
   const preview = element => element.hidden && element.parentElement === document.body;
   for (const [key, fakeValue] of [['duration', 1800], ['readyState', 4]]) {
     const original = Object.getOwnPropertyDescriptor(media, key).get;
     Object.defineProperty(media, key, {
       get() { return preview(this) ? original.call(this) : fakeValue; },
       configurable: true,
     });
   }
   media.play = function() { return preview(this) ? play.call(this) : Promise.resolve(); };
   media.load = function() {
     if (preview(this)) load.call(this);
     else queueMicrotask(() => this.dispatchEvent(new Event('loadedmetadata')));
   };
 });
 await c.route('**/*',async r=>{const q=r.request(),u=q.url();if(u.startsWith(base+'/shared/audio/transport.mjs'))return r.fulfill({status:200,contentType:'text/javascript',body:'export async function downloadSubstitute(){return null;}'});if(/\.(mp3|wav|m4a|enc)(?:\?|$)/.test(u))return r.fulfill({status:200,contentType:'audio/wav',body:previewWav});if(u.startsWith(base+'/'))return r.continue();if(u.includes('/webhook/')){const{route,payload={}}=q.postDataJSON();requests.push(route);let d={};
  if(route==='/api/test/history')d={testSlug:slug,historyEpoch:epoch,stateVersion:2,maintenance:false,serverNow:new Date().toISOString(),examTimingVersion:'substitute-audio-transfer-20261014-v1',classes:[{code:'DEMO',name:'DEMO'}],...(slug==='substitute-test-2-k67'?{writingVersions:{DEMO:'substitute-k67-test2-two-task-20261007-v1'}}:{})};
  else if(route==='/api/test/roster')d={students:[{ref:'fictional-01',name:'Học viên giả'}]};
  else if(route==='/api/test/writing/session')d={...payload,testSlug:slug,examVersion:'substitute-k67-test2-two-task-20261007-v1',writingSessionId:payload.clientRunId};
  else if(route==='/api/test/exam/session')d={...payload,testSlug:slug,timingVersion:'substitute-audio-transfer-20261014-v1',listeningStartedAt:new Date().toISOString(),listeningDeadlineAt:'',audioEndedAt:'',transferSeconds:300,serverNow:new Date().toISOString()};
  else if(route==='/api/test/grade'){assert.equal(payload.examId,'listening');d={persisted:true,snapshotHash:'a'.repeat(64),submittedAt:new Date().toISOString(),section:{correct:0,total:40,band:0,typeStats:[],details:Array.from({length:40},(_,i)=>({number:i+1,studentAnswer:'',correctAnswer:'Fixture',result:'blank'}))}};}
  else if(route==='/api/test/exam/section-status')d={...payload,testSlug:slug,skill:payload.examId,persisted:false};
  else return r.abort();return r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(d)});
 }return r.abort();});
 const p=await c.newPage();p.setDefaultTimeout(15000);p.on('dialog',d=>d.accept());p.on('pageerror',e=>errors.push(e.message));const observed=[],controlChecks=[];
 try{await p.goto(base+'/term-tests/'+slug+'-computer-based/?demo=exam&grading=server');await p.locator('#bootstrapClass').selectOption('DEMO');const opt=p.locator('#bootstrapStudent option:not([value=""])').first();await opt.waitFor({state:'attached'});await p.locator('#bootstrapStudent').selectOption(await opt.getAttribute('value'));await p.locator('#confirmIdentity').click();await p.locator('#bootstrapPreview:enabled').click();
  const countdown = p.locator('[data-audio-start-wait]');
  await countdown.waitFor();
  assert.equal(await p.locator('#bootstrapStart').isDisabled(), true);
  assert.equal(await countdown.evaluate(hint => hint.nextElementSibling.id), 'bootstrapStart');
  const start = p.locator('#bootstrapStart:enabled');
  await start.waitFor();
  assert.equal(await start.innerText(), 'Đã nghe rõ\nBắt đầu thi Listening');
  await start.click();await p.locator('#listeningView').waitFor({state:'visible'});await inspectControls(p,'listening',controlChecks);await p.locator('#submitListening').click();await p.locator('#listeningView').waitFor({state:'hidden'});await p.locator('#startReading').waitFor({state:'visible'});await inspectMediumHeader(p,'reading-prep',controlChecks);await p.locator('#startReading').click();await p.locator('#readingView').waitFor({state:'visible'});await p.locator('#readingView .cbt-passage-header').first().waitFor({state:'visible'});
  await inspectControls(p,'reading',controlChecks);const control=p.locator('#readingView .cbt-reading-questions input:visible, #readingView .cbt-reading-questions select:visible').first(),handle=await control.elementHandle(),kind=await control.evaluate(e=>e.tagName==='SELECT'?'select':e.type);
  if(kind==='select'){const value=await control.locator('option:not([value=""])').first().getAttribute('value');await control.selectOption(value);}else if(['radio','checkbox'].includes(kind))await control.check();else await control.fill('Scroll fixture');const answer=await control.inputValue();
  const tabs=p.locator('#readingView .cbt-part-button'),count=await tabs.count();
  for(let i=0;i<count;i++){await tabs.nth(i).click();const pane=p.locator('#readingView .cbt-reading-section:not([hidden]) .cbt-reading-passage'),header=pane.locator('.cbt-passage-header');await pane.evaluate(e=>e.scrollTo({top:0,behavior:'instant'}));const before=await header.boundingBox();if(i===0)await p.screenshot({path:out+'/'+slug+'-'+width+'-before.png'});
   const delta=await pane.evaluate(e=>{const amount=Math.min(300,e.scrollHeight-e.clientHeight);e.scrollTo({top:amount,behavior:'instant'});return amount;});assert.ok(delta>100,'Đề thật có đủ nội dung để kiểm cuộn');const after=await header.boundingBox(),view=await pane.boundingBox();observed.push({passage:i+1,scroll:delta,headingMoved:Math.round(before.y-after.y),headerBottom:Math.round(after.y+after.height),paneTop:Math.round(view.y)});
   if(i===0)await p.screenshot({path:out+'/'+slug+'-'+width+'-after.png'});
   assert.ok(Math.abs((before.y-after.y)-delta)<2,'Tiêu đề phải cuộn cùng nội dung, không ghim ở đầu pane');assert.ok(after.y+after.height<view.y,'Tiêu đề rời vùng đọc khi cuộn xuống');assert.equal(await p.locator('#submitReading').isVisible(),true);assert.equal(await p.locator('#readingView [role="timer"]').isVisible(),true);
  }
  assert.equal(await handle.evaluate(e=>e.isConnected&&e.value),answer,'Giữ nguyên ô và câu trả lời');assert.deepEqual(errors,[]);await inspectWriting(p,slug,controlChecks);const status=controlChecks.every(x=>x.ok)?'passed':'failed';results.push({slug,width,height,status,controlChecks,passages:observed,answerPreserved:true,readingSubmitted:false});console.log(status.toUpperCase()+' '+slug+' '+width+' · '+count+' passages');
 }catch(e){results.push({slug,width,height,controlChecks,status:'failed',error:e.message,passages:observed,errors});console.log('FAIL '+slug+' '+width+': '+e.message);}finally{await c.close();}
}}finally{await browser.close();await new Promise(r=>server.close(r));}
const result={ok:results.every(r=>r.status==='passed'),results,aiCalls:0,portalWrites:0};fs.writeFileSync(out+'/results.json',JSON.stringify(result,null,2));console.log(JSON.stringify({passed:results.filter(r=>r.status==='passed').length,failed:results.filter(r=>r.status==='failed').length}));if(!result.ok)process.exitCode=1;
