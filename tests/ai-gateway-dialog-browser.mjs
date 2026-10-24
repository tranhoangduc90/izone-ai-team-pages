// Native popup contract: close button/Escape/backdrop restore focus; selection and cancelled gestures retain it.
// Existing VM tests cannot observe browser pointer coordinates, native dialog focus or narrow viewport scrolling.
// Fixtures contain synthetic data. No production hook/export, real identity or external API write is used.
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=process.env.GATEWAY_DIALOG_EVIDENCE_DIR;assert(out,'Choose an evidence directory outside the repository.');await fs.mkdir(out,{recursive:true});
const revision=process.env.GATEWAY_DIALOG_REVISION,publicBase=process.env.GATEWAY_DIALOG_PUBLIC_BASE;assert(!(revision&&publicBase));
const cache=new Map(),types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2'};
async function load(n){if(cache.has(n))return cache.get(n);let b;if(revision)b=execFileSync('git',['show',`${revision}:${n}`],{cwd:root,maxBuffer:3000000});else if(publicBase){const r=await fetch(new URL(n,publicBase));assert(r.ok,`${n}: ${r.status}`);b=Buffer.from(await r.arrayBuffer());}else b=await fs.readFile(path.join(root,n));cache.set(n,b);return b;}
const server=http.createServer(async(req,res)=>{try{let n=decodeURIComponent(new URL(req.url,'http://local').pathname).slice(1);if(n.endsWith('/'))n+='index.html';assert(n&&!n.includes('..'));res.writeHead(200,{'content-type':types[path.extname(n)]||'application/octet-stream'}).end(await load(n));}catch{res.writeHead(404).end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
const item={operation_id:'fixture-operation-0001',source_machine_name:'Máy dữ liệu giả',source_ip:'192.0.2.1',product_id:'fixture-ui',model_id:'fixture-model',thinking_level:'high',status:'success',worker_name:'Máy xử lý giả',final_provider:'google',received_at:'2026-10-23T10:00:00Z',completed_at:'2026-10-23T10:00:01Z',latency_ms:1000};
const detail={...item,attempts:[{attempt_no:1,provider:'google',worker_name:item.worker_name,status:'success',latency_ms:1000}],request_payload:{prompt:'DỮ LIỆU GIẢ\n'.repeat(100)},response_payload:{text:'KẾT QUẢ GIẢ\n'.repeat(100),last:'FIXTURE_TAIL'}};
const browser=await chromium.launch({channel:'chrome',headless:true}),records=[];
try{for(const[width,height]of[[1440,1000],[320,568]]){
 const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'}),p=await context.newPage();p.setDefaultTimeout(8000);const calls=[],errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  await context.route('**/*',async r=>{const q=r.request(),u=new URL(q.url());if(u.hostname==='accounts.google.com')return r.fulfill({contentType:'text/javascript',body:'window.google={accounts:{id:{initialize(){},renderButton(){},disableAutoSelect(){}}}};'});if(u.hostname==='ducizone.ddns.net'){
   const endpoint=u.pathname.slice('/ai-gateway-dashboard'.length);calls.push({method:q.method(),endpoint,query:u.search});if(q.method()!=='GET')return r.abort();const data=endpoint==='/auth/session'?{operator:{email:'fixture@example.test',name:'Người vận hành giả'}}:endpoint==='/summary'?{summary:{total:1,success_rate:1},workers:[],billing:[],shares:{}}:endpoint==='/usage'?{}:endpoint==='/credentials'?{items:[]}:endpoint==='/requests'?{items:[item]}:endpoint==='/requests/'+item.operation_id?detail:null;assert(data,'Unexpected mock endpoint '+endpoint);return r.fulfill({json:data});}if(u.origin===origin)return r.continue();return r.abort();});
  await p.goto(origin+'/ai-gateway-dashboard/');const row=p.locator('#historyBody tr').first();await row.waitFor();await p.evaluate(()=>document.fonts.ready);const dialog=p.locator('#detailDialog');
  async function open(){await row.click();await dialog.waitFor({state:'visible'});}
  async function closed(){return await dialog.evaluate(e=>!e.open)&&await row.evaluate(e=>document.activeElement===e);}
  await open();const box=await dialog.boundingBox();assert(box.x>2&&box.y>=0&&box.y+box.height<=height+1);assert.deepEqual(await dialog.locator('pre').allTextContents(),[JSON.stringify(detail.request_payload,null,2),JSON.stringify(detail.response_payload,null,2)]);await p.screenshot({path:path.join(out,`modal-top-${width}.png`)});records.push({width,case:'detail-content-and-fit',passed:true});
  const tail=dialog.locator('pre').last();await tail.evaluate(e=>{for(let n=e;n;n=n.parentElement)if(n.scrollHeight>n.clientHeight&&['auto','scroll'].includes(getComputedStyle(n).overflowY))n.scrollTop=n.scrollHeight;});const visibleTail=await tail.evaluate(e=>{const n=e.lastChild,r=document.createRange();r.setStart(n,Math.max(0,n.length-20));r.setEnd(n,n.length);const b=r.getBoundingClientRect();return b.top>=0&&b.bottom<=innerHeight;});assert(visibleTail);await p.screenshot({path:path.join(out,`modal-tail-${width}.png`)});records.push({width,case:'scroll-to-json-tail',passed:true});
  await dialog.getByRole('button',{name:'Đóng',exact:true}).click();records.push({width,case:'button-restores-focus',passed:await closed()});
  await open();await p.keyboard.press('Escape');records.push({width,case:'escape-restores-focus',passed:await closed()});
  await open();let b=await dialog.boundingBox(),outside={x:b.x/2,y:b.y+b.height/2},inside={x:b.x+b.width/2,y:b.y+35};
  await p.mouse.click(inside.x,inside.y);records.push({width,case:'inside-keeps-open',passed:await dialog.evaluate(e=>e.open)});
  await p.mouse.move(inside.x,inside.y);await p.mouse.down();await p.mouse.move(outside.x,outside.y,{steps:5});await p.mouse.up();records.push({width,case:'inside-to-outside-keeps-open',passed:await dialog.evaluate(e=>e.open)});
  await p.mouse.move(outside.x,outside.y);await p.mouse.down();await p.mouse.move(inside.x,inside.y,{steps:5});await p.mouse.up();records.push({width,case:'outside-to-inside-keeps-open',passed:await dialog.evaluate(e=>e.open)});
  await p.mouse.move(outside.x,outside.y);await p.mouse.down();await dialog.dispatchEvent('pointercancel',{pointerId:1});await p.mouse.up();records.push({width,case:'cancelled-pointer-keeps-open',passed:await dialog.evaluate(e=>e.open)});
  await p.mouse.click(outside.x,outside.y);records.push({width,case:'backdrop-restores-focus',passed:await closed()});
  if(await dialog.evaluate(e=>e.open))await p.keyboard.press('Escape');
  assert.deepEqual(errors,[]);assert(calls.every(c=>c.method==='GET'));records.push({width,case:'requests-remain-read-only',passed:true,calls,errors});
 }catch(e){records.push({width,case:'harness-or-product-error',passed:false,error:e.message,calls,errors});}finally{await context.close();}
}}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
const report={outcome:records.every(r=>r.passed)?'passed':'partial',records,assets:[...cache].map(([name,b])=>({name,sha256:crypto.createHash('sha256').update(b).digest('hex')})),externalWrites:0,limitations:['Synthetic Google session and API; actual auth/audit/protected payload not certified.','No OS browser or physical-device certification.']};await fs.writeFile(path.join(out,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({outcome:report.outcome,cases:records.length,failures:records.filter(r=>!r.passed)}));if(report.outcome!=='passed')process.exitCode=1;
