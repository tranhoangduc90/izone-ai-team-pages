// Renderer/stylesheet native, dữ liệu và trạng thái cách ly. Không gọi API/AI/Docs hay phát audio thật.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {serveDirectory} from './fixtures/static-ui-server.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),out=process.env.SPACE_EVIDENCE_DIR;
assert.ok(out);await fs.mkdir(out,{recursive:true});
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const catalog=JSON.parse(await fs.readFile(path.join(root,'homework-demo/catalog.json'),'utf8'));
const slugs={matching_information:'materials-beyond-concrete',tfng:'butterflies-britain-tfng','green-roofs':'green-roofs',matching_people:'materials-beyond-concrete-matching-people',sentence_completion:'athletes-and-stress',matching_headings:'the-desolenator'};
const reading=[];
for(const item of catalog.filter(r=>r.kind==='reading-homework')){const data=JSON.parse(await fs.readFile(path.join(root,'homework-demo/data',item.code+'.json'),'utf8'));reading.push({kind:'reading-homework',slug:slugs[data.content.type]||'materials-beyond-concrete',content:data.content});}
assert.equal(reading.length,6);
const listening=[['scandinavian-studies','interactive-content.json'],['horton-castle','horton-castle-content.json'],['natural-dyes','natural-dyes-content.json'],['origami','origami-content.json']].map(([slug,presentation])=>({kind:'listening-homework',slug,presentation}));
const cases=[...reading,...listening,{kind:'reading-practice',slug:'reading'},{kind:'listening-practice',slug:'listening'},{kind:'reading-practice',slug:'reading-full',full:true},{kind:'listening-practice',slug:'listening-full',full:true}];
const viewports=process.env.SPACE_AUDIT?[[1552,864],[1366,600],[390,844]]:[[1552,864],[1366,600],[1024,768],[390,844],[320,568],[844,390]];
const site=await serveDirectory(root),browser=await chromium.launch({channel:'chrome',headless:true}),records=[];
const sourceFiles=['shared/master170/workspace-space.css','listening-homework/interactive-workspace.mjs','listening-homework/workspace-status.mjs','reading-skills67/prototype.js',...reading.map(r=>'reading-skills67/'+r.slug+'/index.html'),...listening.map(r=>'listening-homework/'+r.slug+'.html'),'reading-practice/index.html','listening-practice/index.html'];
const sourceHashes=Object.fromEntries(await Promise.all(sourceFiles.map(async file=>[file,createHash('sha256').update(await fs.readFile(path.join(root,file))).digest('hex')])));
function readingClient(content){
 const body={answers:{},flags:[],notes:'',annotations:[]},identity={ownerId:'synthetic-space-owner',courseId:'1293',name:'Học viên thử',className:'LỚP THỬ'};
 const C=window.ReadingServerClient={identity,access:{config:{demo:true}},initialHistory:{attempts:[]},state:{status:'saved',savedAt:'2026-11-01T03:02:00Z',homework:{status:'verified',cta:'verified'},completeness:{filled_cells:0,total_cells:content.targets.length}},
 initialize:async()=>({content,identity,draft:{body,savedAt:C.state.savedAt},history:[],config:{demo:true},restored:false}),getHistory:async()=>[],historyDetail:async()=>({attempts:[],archives:[]}),practice:async()=>({status:'accepted'}),flush:async()=>{},stopPoll(){},schedule(value){window.__spaceBody=structuredClone(value);return true;}};
}
try{
 for(const spec of cases)for(const [width,height] of viewports){
  if(process.env.SPACE_ONLY&&!process.env.SPACE_ONLY.split(',').includes(spec.kind))continue;
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),errors=[],writes=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  const row={kind:spec.kind,slug:spec.slug,width,height,outcome:'passed'};
  try{
   await context.route('**/*',route=>{const req=route.request(),url=new URL(req.url());if(req.method()!=='GET'){writes.push(url.pathname);return route.abort();}if(url.origin!==site.origin)return route.abort();
    if(spec.kind==='reading-homework'&&url.pathname.endsWith('/api-config.js'))return route.fulfill({body:'',contentType:'text/javascript'});
    if(spec.kind==='reading-homework'&&url.pathname.endsWith('/web-client.js'))return route.fulfill({body:`(${readingClient.toString()})(${JSON.stringify(spec.content)});`,contentType:'text/javascript'});
    if(spec.kind==='listening-homework'&&url.pathname.endsWith('/app.mjs'))return route.fulfill({contentType:'text/javascript',body:`import {createListeningWorkspace} from './interactive-workspace.mjs';import {setWorkspaceText} from './workspace-status.mjs';const data=await fetch('./${spec.presentation}').then(r=>r.json());const $=id=>document.getElementById(id);$('access').hidden=true;$('work-area').hidden=false;$('header-status').hidden=false;$('person').textContent='Học viên thử · LỚP THỬ';$('change-person').hidden=false;$('teacher-entry').hidden=true;window.__spaceWorkspace=createListeningWorkspace({data,body:{answers:{},notes:'',annotations:[],flags:[]},readonly:false,onChange(){setWorkspaceText('save-status','Đã lưu nháp trên hệ thống.');},onHistory(){},audioManifest:async()=>{throw Error('Audio excluded from layout test')}});window.__spaceText=setWorkspaceText;setWorkspaceText('save-status','Đã lưu nháp trên hệ thống.');setWorkspaceText('docs-status','Đã cập nhật trạng thái về Homework Docs.');setWorkspaceText('threshold','Điền ít nhất 80% số mục để nộp.');`});
    if(/\.(mp3|wav|enc)$/.test(url.pathname))return route.abort();return route.continue();});
   if(spec.kind==='reading-homework'){
    await page.goto(site.origin+'/reading-skills67/'+spec.slug+'/?server=1');await page.waitForSelector('[data-target]',{state:'attached'});
    if(spec.content.type==='matching_headings')await page.waitForFunction(()=>document.querySelector('.reading-practice-gate')?.dataset.locked==='false');
   }else if(spec.kind==='listening-homework'){
    await page.goto(site.origin+'/listening-homework/'+spec.slug+'.html');await page.waitForSelector('#exercise input');
   }else{
    await page.goto(site.origin+'/tests/fixtures/practice-short-'+spec.kind.split('-')[0]+'.html');
    const native=await fs.readFile(path.join(root,spec.kind,'index.html'),'utf8');
    const extra=[...native.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(m=>new URL(m[1],site.origin+'/'+spec.kind+'/').href);
    await page.evaluate(({kind,extra,full})=>{Object.assign(document.body.dataset,{izoneDesign:'master170@1.1',izoneUiProfile:'exam-compact',izoneConsumer:kind,teacherProduct:kind.split('-')[0]});if(full){if(kind==='listening-practice')document.body.classList.add('listening-full-test');const nav=document.querySelector('.cbt-question-nav');nav.style.setProperty('--reading-question-count','40');nav.innerHTML=Array.from({length:40},(_,i)=>`<button class="cbt-question-button" aria-label="Câu ${i+1}">${i+1}</button>`).join('');}for(const href of extra){if([...document.styleSheets].some(s=>s.href===href))continue;const l=document.createElement('link');l.rel='stylesheet';l.href=href;document.head.append(l);}}, {kind:spec.kind,extra,full:spec.full});
   }
   await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(80);
   const measure=()=>page.evaluate(kind=>{const reading=kind==='reading-homework',hw=kind==='listening-homework',dock=document.querySelector(reading?'.study-footer':hw?'.hw-question-dock':'.cbt-question-nav-wrap'),region=document.querySelector(reading?'.study-grid':hw?'#workspace':'.cbt-content-viewport'),status=document.querySelector(reading?'.homework-sync':hw?'#docs-status':'.autosave-status');const box=dock.getBoundingClientRect(),area=region.getBoundingClientRect();return{footerGap:Math.round(innerHeight-box.bottom),areaHeight:Math.round(area.height),overflow:document.documentElement.scrollWidth>innerWidth+1,y:scrollY,statusInDock:reading?!!status?.closest('.study-footer'):hw?!!status?.closest('.hw-status-area'):true,footer:Math.round(box.height),statusParent:status?.parentElement.className};},spec.kind);
   row.geometry=await measure();await page.screenshot({path:path.join(out,`${spec.slug}-${width}.png`)});
   if(!process.env.SPACE_AUDIT){assert.equal(row.geometry.overflow,false,'No whole-page horizontal overflow');if(width>1000){assert.ok(Math.abs(row.geometry.footerGap)<=1,'Footer must reach viewport bottom: '+JSON.stringify(row.geometry));assert.ok(row.geometry.areaHeight>=Math.min(260,height*.35),'Usable reading area');}if(spec.kind.endsWith('homework'))assert.equal(row.geometry.statusInDock,true,'Save and Homework messages share one status area');}
   if(spec.kind==='reading-homework'){
    const input=page.locator('textarea[data-target]').first();if(width<=800||width<=1000&&height<=500){const pane=await input.evaluate(el=>el.closest('.study-pane').id);await page.locator('[data-pane="'+(pane==='pane-passage'?'passage':'questions')+'"]').click();}await input.fill('Ý thử cần được giữ nguyên.');await input.focus();
    await input.evaluate(el=>{el.setSelectionRange(2,6);window.__spaceKept={el,scrollY,p:document.querySelector('#scroll-passage').scrollTop,q:document.querySelector('#scroll-questions').scrollTop};});
    for(const h of [{status:'pending'},{status:'blocked'},{status:'verified',cta:'verified'}]){await page.evaluate(h=>{window.ReadingServerClient.state.homework=h;window.dispatchEvent(new Event('reading67:server-state'));},h);await page.waitForTimeout(80);}
    if(!process.env.SPACE_AUDIT)assert.equal(await input.evaluate(el=>el===window.__spaceKept.el&&document.activeElement===el&&el.selectionStart===2&&el.selectionEnd===6&&scrollY===window.__spaceKept.scrollY),true,'Status refresh preserves the working field and reading position');
   }else if(spec.kind==='listening-homework'){
    const input=page.locator('#exercise input').first();await input.fill('Nội dung thử');await input.focus();
    await input.evaluate(el=>{window.__spaceKept={el,value:el.value,y:scrollY};});
    for(const message of ['Đang chờ nối trạng thái về đúng Homework Docs của bạn.','Bài trên hệ thống đã giữ; cập nhật Homework Docs đang cần kiểm tra.','Đã cập nhật trạng thái về Homework Docs.']){await page.evaluate(s=>window.__spaceText('docs-status',s),message);await page.waitForTimeout(80);}
    if(!process.env.SPACE_AUDIT)assert.equal(await input.evaluate(el=>el===window.__spaceKept.el&&el.value===window.__spaceKept.value&&document.activeElement===el),true);
   }
   assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  }catch(e){row.outcome='failed';row.error=e.message;row.errors=errors;}
  finally{records.push(row);await context.close();}
 }
}finally{await browser.close();await site.close();}
for(const file of sourceFiles)assert.equal(createHash('sha256').update(await fs.readFile(path.join(root,file))).digest('hex'),sourceHashes[file],'Source changed during verification: '+file);
await fs.writeFile(path.join(out,'results.json'),JSON.stringify({scope:'Native renderer and CSS with isolated state. Practice shell fixture; no real API/audio/AI/Docs or physical devices.',sourceHashes,records},null,2));
console.log(JSON.stringify({cases:records.length,failed:records.filter(r=>r.outcome==='failed'),geometry:records.filter(r=>r.width>1000).map(({kind,slug,width,geometry})=>({kind,slug,width,...geometry}))},null,2));
if(records.some(r=>r.outcome==='failed'))process.exitCode=1;
