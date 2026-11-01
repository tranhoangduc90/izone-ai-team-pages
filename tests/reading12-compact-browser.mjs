// Kiểm bố cục Lesson 12 bằng renderer thật và dữ liệu giả; chặn mọi API ngoài máy.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {serveDirectory} from './fixtures/static-ui-server.mjs';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root=resolve(fileURLToPath(new URL('../',import.meta.url))),out=process.env.READING12_EVIDENCE_DIR;
assert.ok(out);await fs.mkdir(out,{recursive:true});
const revision=process.env.READING12_REVISION,publicBase=process.env.READING12_PUBLIC_BASE;
const assets=['reading-skills67/butterflies-britain-tfng/index.html','reading-skills67/prototype.js','reading-skills67/tfng.css','reading-skills67/repair-workspace.js'];
const overrides=new Map();
for(const asset of assets){
 if(revision)overrides.set('/'+asset,Buffer.from(execFileSync('git',['-C',root,'show',revision+':'+asset])));
 if(publicBase){const r=await fetch(publicBase.replace(/\/$/,'')+'/'+asset,{headers:{'Cache-Control':'no-cache'}});assert.equal(r.status,200);overrides.set('/'+asset,Buffer.from(await r.arrayBuffer()));}
}
const content={type:'tfng',lesson:12,code:'synthetic-compact',version:'fixture-v1',title:'The impact of climate change on butterflies in Britain',minimumRequired:42,blankValues:[],dropdownPlaceholders:[],paragraphs:Array.from({length:9},(_,i)=>({id:String(i+1),text:('Synthetic passage for checking reading space and scroll preservation. ').repeat(15)})),questions:[],targets:[]};
for(let n=1;n<=6;n++){
 const q={number:n,text:'Synthetic comparison of population changes '+n,leader:'population',sensitive:'time and conditions',targets:{},chunks:[]};
 for(let m=1;m<=3;m++){
  const evidence=`q${n}.m${m}.evidence`,label=`q${n}.m${m}.label`;
  q.chunks.push({number:m,text:'Synthetic fragment '+m,evidenceTarget:evidence,labelTarget:label});
  q.targets['m'+m+'_evidence']=evidence;q.targets['m'+m+'_label']=label;
  content.targets.push({id:evidence,kind:'evidence',question:n,label:evidence},{id:label,kind:'chunk_label',question:n,label});
 }
 q.targets.conclusion=`q${n}.conclusion`;content.targets.push({id:q.targets.conclusion,kind:'conclusion',question:n,label:'Conclusion '+n});content.questions.push(q);
}
function stub(content){
 const answers=Object.fromEntries(content.targets.slice(0,7).map(t=>[t.id,t.kind==='evidence'?'Synthetic saved evidence':'TRUE']));
 const identity={ownerId:'synthetic-owner',name:'Học viên thử',className:'LỚP THỬ'},savedAt='2026-11-01T03:02:00Z';
 const C={identity,access:{config:{demo:true,type:'tfng'}},initialHistory:{attempts:[]},state:{status:'saved',savedAt,completeness:{filled_cells:7,total_cells:42},homework:{status:'verified',cta:'verified'}},
  initialize:async()=>({content,identity,draft:{body:{answers,flags:[],annotations:[],notes:''},savedAt},history:[],config:{demo:true,type:'tfng'},restored:false}),
  schedule(body){C.state.completeness.filled_cells=Object.values(body.answers).filter(Boolean).length;return true;},stopPoll(){},flush:async()=>{},getHistory:async()=>[],historyDetail:async()=>({attempts:[],archives:[]})};
 window.ReadingServerClient=C;
}
const site=await serveDirectory(root),browser=await chromium.launch({channel:'chrome',headless:true}),records=[];
try{
 for(const [width,height] of [[1552,864],[1440,900],[1366,600],[1024,768],[390,844],[320,568],[844,390]]){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),errors=[],writes=[];page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
  const row={width,height,outcome:'passed'};
  try{
   await context.route('**/*',route=>{const req=route.request(),u=new URL(req.url());if(u.origin!==site.origin)return route.abort();if(req.method()!=='GET'){writes.push(u.pathname);return route.abort();}let path=u.pathname;if(path.endsWith('/butterflies-britain-tfng/'))path+='index.html';if(overrides.has(path))return route.fulfill({body:overrides.get(path),contentType:path.endsWith('.html')?'text/html':path.endsWith('.css')?'text/css':'text/javascript'});if(path.endsWith('/api-config.js'))return route.fulfill({body:'',contentType:'text/javascript'});if(path.endsWith('/web-client.js'))return route.fulfill({body:`(${stub.toString()})(${JSON.stringify(content)})`,contentType:'text/javascript'});return route.continue();});
   await page.goto(site.origin+'/reading-skills67/butterflies-britain-tfng/?server=1');await page.waitForSelector('.homework-sync');await page.evaluate(()=>document.fonts.ready);
   row.geometry=await page.evaluate(()=>{const footer=document.querySelector('.study-footer').getBoundingClientRect(),save=document.querySelector('#save-state').getBoundingClientRect(),sync=document.querySelector('.homework-sync').getBoundingClientRect(),grid=document.querySelector('.study-grid').getBoundingClientRect();return{gap:innerHeight-footer.bottom,footerHeight:footer.height,gridHeight:grid.height,syncInFooter:!!document.querySelector('.study-footer .homework-sync'),inline:sync.left>=save.right-1&&Math.abs(sync.top-save.top)<2,overflow:document.documentElement.scrollWidth>innerWidth};});
   await page.screenshot({path:out+`/layout-${width}.png`});
   assert.equal(row.geometry.syncInFooter,true,'Homework status must share the bottom bar.');
   assert.equal(row.geometry.overflow,false,'The page must fit horizontally.');
   if(width>1000){assert.ok(Math.abs(row.geometry.gap)<=1,'The footer must reach the viewport bottom: '+row.geometry.gap);assert.ok(row.geometry.gridHeight>=height-320,'Reading space must remain usable.');}
   if(width>=1366)assert.equal(row.geometry.inline,true,'Homework confirmation belongs to the right of the saved status.');
   assert.match(await page.locator('#progress-label').textContent(),/7\/42/);
   const input=page.locator('[data-target="q6.m3.evidence"]');if(width<=1000)await page.locator('[data-pane="questions"]').click();
   await input.scrollIntoViewIfNeeded();await input.focus();await input.evaluate(el=>{window.__compactKept={node:el,pane:document.querySelector('#scroll-questions').scrollTop,y:scrollY};el.setSelectionRange(0,0);});
   for(const homework of [{status:'pending'},{status:'blocked'},{status:'unavailable'},{status:'pending',jobs:[{errorCode:'HOMEWORK_NOT_FOUND'}]},{status:'verified',cta:'verified'}]){
    await page.evaluate(h=>{window.ReadingServerClient.state.homework=h;window.dispatchEvent(new Event('reading67:server-state'));},homework);await page.waitForTimeout(750);
    assert.equal(await page.locator('.study-footer .homework-sync').count(),1);assert.equal(await page.locator('.lesson-head + .homework-sync').count(),0);
    assert.deepEqual(await input.evaluate(el=>({same:el===window.__compactKept.node,focus:el===document.activeElement,pane:document.querySelector('#scroll-questions').scrollTop===window.__compactKept.pane,y:scrollY===window.__compactKept.y})),{same:true,focus:true,pane:true,y:true});
   }
   assert.match(await page.locator('.homework-sync').textContent(),/Đã cập nhật trạng thái và link vào Homework/);
   await page.evaluate(()=>{window.ReadingServerClient.state.status='error';window.dispatchEvent(new Event('reading67:server-state'));});assert.match(await page.locator('#save-state').textContent(),/Chưa lưu máy chủ/);
   await page.evaluate(()=>{window.ReadingServerClient.state.homework={status:'not_started'};window.dispatchEvent(new Event('reading67:server-state'));});assert.equal(await page.locator('.homework-sync').count(),0);
   assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  }catch(e){row.outcome='failed';row.error=e.message;}
  finally{records.push(row);await context.close();}
 }
}finally{await browser.close();await site.close();}
await fs.writeFile(out+'/results.json',JSON.stringify({revision,publicBase,records},null,2));
console.log(JSON.stringify({cases:records.length,failed:records.filter(r=>r.outcome==='failed')},null,2));if(records.some(r=>r.outcome==='failed'))process.exitCode=1;
