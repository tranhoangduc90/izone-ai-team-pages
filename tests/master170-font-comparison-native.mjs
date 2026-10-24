// Input: static Pages checkout and an empty evidence folder. Output: bounded native UI results.
// All notes/answers stay in RAM; unexpected network requests fail the run.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { serveDirectory } from './fixtures/static-ui-server.mjs';
const root=process.env.FONT_COMPARE_ROOT||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=process.env.FONT_COMPARE_OUT;
if(!out) throw new Error('Set FONT_COMPARE_OUT to a new evidence folder.');
await fs.mkdir(out,{recursive:false});
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=await serveDirectory(root),browser=await chromium.launch({channel:'chrome',headless:true});
const records=[],requests=[],errors=[];let photos=0;
const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
const matrix=[];
for(const width of [1440,390,320])for(const scene of ['lesson','reading','dashboard'])for(const linh_font of ['writing','substitute'])for(const scale of ['1','1.25'])matrix.push({view:'compare',width,scene,linh_font,scale});
for(const width of [1440,390,320])for(const scene of ['lesson','reading','dashboard'])matrix.push({view:'colors',width,scene,font:'master',scale:'1'});
for(const [font,linh_font]of [['master','writing'],['nunito','writing'],['linh','writing'],['linh','substitute'],['geologica','writing']])matrix.push({view:'single',width:320,scene:'lesson',font,linh_font,scale:'1'});
for(const theme of ['master','reading','linh','thuy'])matrix.push({view:'single',width:320,scene:'reading',font:'master',theme,scale:'1'});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.route('**/*',route=>{const q=route.request();if(!q.url().startsWith(server.origin+'/')){requests.push({url:q.url(),method:q.method()});return route.abort();}return route.continue();});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 async function open(params){await page.setViewportSize({width:params.width||320,height:1000});const query=new URLSearchParams(Object.entries(params).filter(([k])=>k!=='width'));await page.goto(server.origin+'/design/font-comparison/?'+query);await page.waitForFunction(()=>document.querySelector('#fontStatus').classList.contains('ready')||document.querySelector('#fontStatus').classList.contains('error'));await page.evaluate(()=>document.fonts.ready);}
 async function record(id,checks,params={},photo=false){const failures=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);let image=null;if(photo){image=id+'.png';await page.screenshot({path:path.join(out,image),fullPage:true});photos++;}records.push({id,params,checks,failures,image});}
 for(let i=0;i<matrix.length;i++){
  const m=matrix[i];await open(m);
  const observed=await page.locator('.font-column').evaluateAll(columns=>columns.map(c=>({family:c.dataset.family,palette:c.dataset.palette,status:c.querySelector('[data-font-state]').textContent,font:getComputedStyle(c.querySelector('.specimen')).fontFamily,html:c.querySelector('.specimen').innerHTML,ready:document.fonts.check('400 16px "'+c.dataset.family+'"','Nguyễn Thủy Đặng Ước mơ')})));
  const query=Object.fromEntries(new URL(page.url()).searchParams);
  const geometry=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
  const checks={all_font_labels_ready:observed.every(c=>c.status==='✓ Font đã tải'),actual_font_faces_ready:observed.every(c=>c.ready&&c.font.includes(c.family)),column_count:observed.length===(m.view==='single'?1:4),query_state:query.view===m.view&&query.scene===m.scene&&query.scale===m.scale,no_page_overflow:geometry.scrollWidth<=geometry.width+1};
  await record('matrix-'+String(i+1).padStart(2,'0'),checks,m,m.scale==='1'&&(process.env.FONT_COMPARE_PHASE!=='baseline'||[0,36,45,50].includes(i)));
  Object.assign(records.at(-1),{observed,sample_digest:digest(observed.map(c=>c.html).join('\n')),query,geometry});
 }
 for(const scene of ['lesson','dashboard']){
  await open({view:'compare',scene,width:390});const fields=page.locator('[data-note]');await fields.first().fill('Ghi chú thử: Nguyễn Đặng');
  const synced=await fields.evaluateAll(es=>es.every(e=>e.value==='Ghi chú thử: Nguyễn Đặng'));
  if(scene==='lesson')await page.locator('[data-answer][value="C"]').first().check();
  const selected=scene!=='lesson'||await page.locator('[data-answer][value="C"]').evaluateAll(es=>es.every(e=>e.checked));
  await page.locator('[data-save]').first().click();const saved=await page.locator('.save-status').evaluateAll(es=>es.every(e=>e.textContent.includes('Đã giữ nội dung thử')));
  await page.locator('[data-view="single"]').click();const rerender=(await page.locator('[data-note]').inputValue())==='Ghi chú thử: Nguyễn Đặng';
  await page.locator('[data-reset]').click();const reset=(await page.locator('[data-note]').inputValue())===''&&(await page.locator('.save-status').textContent())==='';
  await page.locator('[data-note]').fill('Chỉ RAM');const query=page.url();await page.reload();await page.locator('[data-note]').waitFor();const reload=(await page.locator('[data-note]').inputValue())===''&&page.url()===query;
  await record('ram-'+scene,{synced,selected,saved,rerender,reset,reload},{scene},process.env.FONT_COMPARE_PHASE!=='baseline');
 }
 await open({view:'compare',width:320,scene:'lesson'});await page.locator('[data-column-theme="thuy"][data-owner-font="nunito"]').click();
 const palettes=await page.locator('.font-column').evaluateAll(es=>es.map(e=>e.dataset.palette));const focused=await page.evaluate(()=>document.activeElement.dataset.ownerFont==='nunito'&&document.activeElement.dataset.columnTheme==='thuy');
 await record('column-isolation',{only_owner_changed:JSON.stringify(palettes)===JSON.stringify(['master','thuy','reading','reading']),focus_retained:focused});
 await open({view:'single',scene:'lesson',width:320,font:'segoe',theme:'k56'});const legacy=new URL(page.url()).searchParams;
 await record('legacy-url',{font_alias:legacy.get('font')==='linh',theme_alias:legacy.get('theme')==='linh'});
 await open({view:'single',scene:'lesson',width:320,font:'nunito'});
 const masterFont=page.locator('[data-font="master"]'),masterTheme=page.locator('[data-theme="master"]');const fontExists=await masterFont.count()===1,themeExists=await masterTheme.count()===1;
 let selected=false;if(fontExists&&themeExists){await masterFont.click();await masterTheme.click();selected=await page.locator('.font-column').evaluate(e=>e.dataset.family==='Source Sans 3'&&e.dataset.palette==='master');}
 await record('master-controls',{font_option_exists:fontExists,theme_option_exists:themeExists,master_selectable:selected});
 const failure=await context.newPage();await failure.route('**/*nunitosans*.woff2',route=>route.abort());await failure.goto(server.origin+'/design/font-comparison/?font=nunito&view=single');
 await failure.waitForFunction(()=>document.querySelector('#fontStatus').classList.contains('ready')||document.querySelector('#fontStatus').classList.contains('error'));
 const unavailable=await failure.locator('.font-column').evaluate(e=>({label:e.querySelector('[data-font-state]').textContent,flag:e.classList.contains('font-unavailable'),summary:document.querySelector('#fontStatus').textContent}));
 await failure.screenshot({path:path.join(out,'font-unavailable.png'),fullPage:true});photos++;
 records.push({id:'font-unavailable',checks:{explicit_failure:unavailable.label==='Chưa tải được font'&&unavailable.flag&&unavailable.summary.includes('Nunito Sans')},failures:unavailable.label==='Chưa tải được font'&&unavailable.flag&&unavailable.summary.includes('Nunito Sans')?[]:['explicit_failure'],observed:unavailable,image:'font-unavailable.png'});
 const result={outcome:records.every(r=>!r.failures.length)&&!requests.length&&!errors.length?'passed':'failed',at:new Date().toISOString(),phase:process.env.FONT_COMPARE_PHASE||'native',source:{app_sha256:digest(await fs.readFile(path.join(root,'design/font-comparison/app.js')))},cases:records.length,failed:records.filter(r=>r.failures.length).map(r=>({id:r.id,failures:r.failures})),photos,realExternalWrites:0,unexpectedRequests:requests,pageErrors:errors,records};
 await fs.writeFile(path.join(out,'results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({outcome:result.outcome,cases:result.cases,failed:result.failed,photos}));if(result.outcome!=='passed')process.exitCode=1;
}finally{await browser.close();await server.close();}
