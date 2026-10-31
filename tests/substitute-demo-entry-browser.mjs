// Giao diện thật, danh sách và API giả. Không nộp bài, gọi AI hoặc ghi Portal.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=process.env.SUBSTITUTE_DEMO_ROOT||path.resolve(fileURLToPath(new URL('../',import.meta.url)));
if(!process.env.PLAYWRIGHT_MODULE||!process.env.SUBSTITUTE_DEMO_EVIDENCE)throw Error('Cần PLAYWRIGHT_MODULE và SUBSTITUTE_DEMO_EVIDENCE.');
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const out=process.env.SUBSTITUTE_DEMO_EVIDENCE;fs.mkdirSync(out,{recursive:true});
const online=process.argv.includes('--online');
const server=createServer((req,res)=>{let pathname=new URL(req.url,'http://fixture').pathname.replace(/^\/izone-ai-team-pages/,'');if(pathname.endsWith('/'))pathname+='index.html';const p=path.resolve(root,'.'+pathname);if(!p.startsWith(path.resolve(root)+path.sep))return res.writeHead(403).end();try{const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};res.setHeader('Content-Type',mime[path.extname(p)]||'application/octet-stream');res.end(fs.readFileSync(p));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=online?'https://tranhoangduc90.github.io/izone-ai-team-pages':'http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'msedge',headless:true}),results=[];
const slugs=['substitute-test-1-k56','substitute-test-2-k56','substitute-test-1-k67','substitute-test-2-k67'];
async function scenario(name,fn,{width=1366,height=900}={}){
 const context=await browser.newContext({viewport:{width,height},serviceWorkers:'block'}),requests=[],errors=[];
 await context.route('**/*',async route=>{
  const r=route.request(),u=r.url();if(u.startsWith(base+'/'))return route.continue();
  if(u.includes('ducizone.ddns.net/webhook/')&&r.method()==='POST'){
   const body=r.postDataJSON(),slug=u.match(/substitute-test-[12]-k(?:56|67)/)?.[0];requests.push(body);
   let data;
   if(body.route==='/api/test/history')data={testSlug:slug,historyEpoch:'11111111-1111-4111-8111-111111111111',stateVersion:2,maintenance:false,classes:[{code:'DEMO',name:'DEMO · Không gửi Portal'},{code:'IC9002',name:'IC9002'},{code:'IC9001',name:'IC9001'}].filter(c=>!body.payload?.excludeTestClasses||c.code!=='DEMO')};
   else if(body.route==='/api/test/roster')data={students:[{ref:'fictional-01',name:'Học viên giả'}]};
   else return route.abort();
   return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)});
  }
  return route.abort();
 });
 const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 try{await fn({page,context,requests});assert.deepEqual(errors,[]);assert.equal(requests.every(r=>['/api/test/history','/api/test/roster'].includes(r.route)),true,'Không có lệnh nộp/chấm/ghi');results.push({name,status:'passed'});console.log('PASS '+name);}
 catch(e){results.push({name,status:'failed',error:e.message});await page.screenshot({path:path.join(out,'failure-'+results.length+'.png'),fullPage:true}).catch(()=>{});console.log('FAIL '+name+': '+e.message);}
 finally{await context.close();}
}
try{
 for(const width of [1366,390])await scenario('Trang tổng: chỉ mở Substitute, giữ bốn bài và bộ lọc · '+width,async({page})=>{
  await page.goto(base+'/term-tests/substitute-test-1-k56-dashboard/');
  assert.equal(await page.locator('a[href*="/demo/"]').count(),0,'Không còn liên kết đi sang demo Term/Mini');
  assert.equal(await page.locator('#demo-heading').count(),0);
  assert.equal(await page.locator('.test-row').count(),4);
  assert.deepEqual(await page.locator('.test-number').allTextContents(),['01','02','03','04']);
  await page.locator('#course-filter').selectOption('k67');assert.equal(await page.locator('.test-row:visible').count(),2);
  await page.locator('#course-filter').selectOption('all');assert.equal(await page.locator('.test-row:visible').count(),4);
  assert.equal(await page.locator('a[href*="-computer-based/"]').count(),4);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  await page.screenshot({path:path.join(out,'dashboard-'+width+'.png'),fullPage:true});
 },{width,height:900});
 for(const slug of slugs){
  const open=async page=>{await page.goto(base+'/term-tests/'+slug+'-computer-based/?demo=exam&grading=server');await page.locator('#bootstrapClass option[value="IC9001"]').waitFor({state:'attached'});};
  await scenario(slug+': DEMO cuối danh sách, lớp thật giữ thứ tự và không có Reset',async({page})=>{
   await open(page);
   const values=await page.locator('#bootstrapClass option').evaluateAll(o=>o.map(x=>x.value).filter(Boolean));
   assert.deepEqual(values,['IC9002','IC9001','DEMO']);
   await page.locator('#bootstrapClass').selectOption('IC9001');await page.locator('#bootstrapStudent option[value="fictional-01"]').waitFor({state:'attached'});
   assert.equal(await page.locator('.k56-reset-button').isVisible(),false);
   assert.equal(await page.evaluate(s=>{try{window.SUBSTITUTE_STATE.clear(s);return 'unexpected';}catch(e){return e.message;}},slug),'RESET_DEMO_ONLY');
  });
  await scenario(slug+': DEMO cùng phòng chờ, Reset hủy/đồng ý và bảo toàn lớp thật',async({page,requests})=>{
   await open(page);
   const keys={demo:'izone-test:'+slug+':DEMO:server-grade:fixture',real:'izone-test:'+slug+':IC9001:server-grade:fixture',other:'izone-test:unrelated:DEMO:server-grade:fixture'};
   await page.evaluate(k=>{for(const s of [localStorage,sessionStorage])for(const [name,key]of Object.entries(k))s.setItem(key,name+'-draft');},keys);
   const pointer='izone-substitute-lobby-v1:'+slug+':11111111-1111-4111-8111-111111111111:DEMO:fictional';
   await page.evaluate(key=>{for(const s of [localStorage,sessionStorage])s.setItem(key,JSON.stringify({classCode:'DEMO'}));},pointer);
   await page.locator('#bootstrapClass').focus();await page.locator('#bootstrapClass').press('End');
   assert.equal(await page.locator('#bootstrapClass').inputValue(),'DEMO');
   await page.locator('.k56-reset-button:visible').waitFor();
   await page.locator('.k56-reset-button').click();await page.locator('.k56-reset-dialog[open]').waitFor();
   await page.locator('[data-reset-cancel]').click();
   assert.equal(await page.evaluate(k=>localStorage.getItem(k),keys.demo),'demo-draft');
   await page.screenshot({path:path.join(out,slug+'-demo-reset.png'),fullPage:true});
   const initial=requests.filter(r=>r.route==='/api/test/history').length;
   await page.locator('.k56-reset-button').click();await page.locator('[data-reset-confirm]').click();
   await page.waitForURL(u=>!u.searchParams.has('reset'));
   await page.locator('#bootstrapClass option[value="IC9001"]').waitFor({state:'attached'});
   assert.equal(await page.locator('#bootstrapStudent').inputValue(),'');
   assert.equal(await page.locator('#bootstrapClass').isEnabled(),true);
   assert.ok(requests.filter(r=>r.route==='/api/test/history').length>initial);
   const storage=await page.evaluate(k=>[localStorage,sessionStorage].map(s=>({demo:s.getItem(k.demo),real:s.getItem(k.real),other:s.getItem(k.other)})),keys);
   assert.deepEqual(storage,[{demo:null,real:'real-draft',other:'other-draft'},{demo:null,real:'real-draft',other:'other-draft'}]);
   assert.deepEqual(await page.evaluate(key=>[localStorage,sessionStorage].map(s=>s.getItem(key)),pointer),[null,null]);
  });
 }
}finally{await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({ok:results.every(r=>r.status==='passed'),mode:online?'online-assets-fixture-api':'local-fixture-api',results,aiCalls:0,portalWrites:0},null,2));}
console.log(JSON.stringify({passed:results.filter(r=>r.status==='passed').length,failed:results.filter(r=>r.status==='failed').length}));
if(results.some(r=>r.status==='failed'))process.exitCode=1;
