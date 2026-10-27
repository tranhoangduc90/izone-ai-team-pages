import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {chromium}=createRequire('C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const papers=['term-test-1','term-test-2','mini-test-lesson-5','term-test-1-k56','term-test-2-k56','mini-test-k56'];
const cbt=[...papers.map(x=>x+'-computer-based'),...['1-k56','2-k56','1-k67','2-k67'].map(x=>'substitute-test-'+x+'-computer-based'),'term-test-2-rescue','term-test-1-listening-retake'];
let server,browser,base;
before(async()=>{
 server=createServer((req,res)=>{
  let p=path.resolve(root,'.'+decodeURI(new URL(req.url,'http://fixture').pathname));
  if(!p.startsWith(root+path.sep))return res.writeHead(403).end();
  try{if(fs.statSync(p).isDirectory())p=path.join(p,'index.html');
   res.setHeader('Content-Type',({'.html':'text/html;charset=UTF-8','.js':'text/javascript;charset=UTF-8','.mjs':'text/javascript;charset=UTF-8','.css':'text/css;charset=UTF-8','.json':'application/json'})[path.extname(p)]||'application/octet-stream');res.end(fs.readFileSync(p));
  }catch{res.writeHead(404).end();}
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({channel:'msedge',headless:true});
});
after(async()=>{await browser?.close();if(server)await new Promise(r=>server.close(r));});
const phones=[{name:'Android',userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36'},
 {name:'iPad desktop UA',userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',iPad:true}];
for(const device of phones)test(`${device.name}: all 12 CBT entries block before every exam or audio API request`,async()=>{
 const c=await browser.newContext({userAgent:device.userAgent,viewport:{width:390,height:844}}),external=[];
 if(device.iPad)await c.addInitScript(()=>{Object.defineProperty(navigator,'platform',{get:()=> 'MacIntel'});Object.defineProperty(navigator,'maxTouchPoints',{get:()=>5});});
 await c.route('**/*',r=>{if(new URL(r.request().url()).hostname==='127.0.0.1')return r.continue();external.push(r.request().url());return r.abort();});
 try{for(const entry of cbt){
   const p=await c.newPage();await p.goto(`${base}/term-tests/${entry}/?class=IC2213&mode=lis_first`);
   await p.getByRole('heading',{name:'Bài thi cần thực hiện trên máy tính',exact:true}).waitFor();
   assert.equal(await p.evaluate(()=>window.IZONE_EXAM_DEVICE_BLOCKED),true,entry);
   assert.deepEqual(external,[],`${entry} must not claim a session or request audio`);
   assert.equal(await p.evaluate(()=>localStorage.length),0,entry+' must not save exam state');
   if(entry==='term-test-2-computer-based'&&process.env.EXAM_DEVICE_EVIDENCE){fs.mkdirSync(process.env.EXAM_DEVICE_EVIDENCE,{recursive:true});await p.screenshot({path:path.join(process.env.EXAM_DEVICE_EVIDENCE,device.name.replaceAll(' ','-')+'.png')});}
   await p.close();
 }}finally{await c.close();}
});
test('all six backup answer sheets allow a phone; narrow desktop and Windows touch remain allowed',async()=>{
 const c=await browser.newContext({userAgent:phones[0].userAgent,viewport:{width:390,height:844}});
 await c.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 try{for(const entry of papers){const p=await c.newPage();await p.goto(`${base}/term-tests/${entry}/?class=IC2213`);
   assert.notEqual(await p.evaluate(()=>window.IZONE_EXAM_DEVICE_BLOCKED),true,entry);
   assert.equal(await p.getByRole('heading',{name:'Bài thi cần thực hiện trên máy tính',exact:true}).count(),0,entry);await p.close();
 }}finally{await c.close();}
 const desktop=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
 try{const p=await desktop.newPage();await p.goto(base+'/term-tests/shared/desktop-exam-guard.css');
   await p.addScriptTag({url:base+'/term-tests/shared/desktop-exam-guard.js'});assert.equal(await p.evaluate(()=>window.IZONE_EXAM_DEVICE_BLOCKED),false);
 }finally{await desktop.close();}
});
