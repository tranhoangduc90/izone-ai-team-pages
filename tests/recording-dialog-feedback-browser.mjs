// Native Recording forms and API payloads; all services and recordings are local fixtures.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {serveDirectory} from './fixtures/static-ui-server.mjs';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const root=process.env.SOURCE_ROOT||resolve(fileURLToPath(new URL('../',import.meta.url)));
const out=process.env.RECORDING_FEEDBACK_EVIDENCE_DIR||resolve(root,'output/playwright/recording-feedback');
await fs.mkdir(out,{recursive:true});
const server=await serveDirectory(root),browser=await chromium.launch({channel:'chrome',headless:true}),records=[];
let release;
async function waitHeld(){const end=Date.now()+6000;while(!release&&Date.now()<end)await new Promise(r=>setTimeout(r,20));assert.equal(typeof release,'function','Fixture must receive the held request');}
function contrast(a,b){const lum=c=>c.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
function check(width,name,actual,expected=true){records.push({width,name,actual,expected,passed:JSON.stringify(actual)===JSON.stringify(expected)});}
try{
 for(const width of [1440,390,320]){
  const context=await browser.newContext({viewport:{width,height:width===1440?1000:568}}),page=await context.newPage();page.setDefaultTimeout(6000);
  const errors=[],writes=[];let mode='rename-fail';
  const video={id:'one',source:'Zoom 6',className:'IC9002',title:'Tên bản ghi giả',recordingStart:'2026-09-20T19:00:00+07:00',videoId:'abcdefghijk',playlistId:'PLold',playlistIndex:99,youtubeStatus:'uploaded',reviewStatus:'approved',version:1};
  const other={...video,id:'two',title:'Bản ghi thứ hai giả',videoId:'bcdefghijkl'};
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(u.hostname==='accounts.google.com')return route.fulfill({contentType:'text/javascript',body:'window.google={accounts:{id:{initialize(){},renderButton(){},disableAutoSelect(){}}}};'});
   if(u.hostname==='ducizone.ddns.net'){
    if(req.method()==='POST'){
     const body=req.postDataJSON();writes.push({path:u.pathname,body});
     if(u.pathname.includes('recording-rename-')){
      if(mode==='held')await new Promise(done=>release=done);
      if(mode!=='success')return route.fulfill({status:500,json:{ok:false,error:'FIXTURE_RENAME_ERROR'}});
      Object.assign(video,{title:body.newTitle,version:video.version+1});return route.fulfill({json:{ok:true,record:video}});
     }
     if(u.pathname.includes('recording-playlist-')){
      if(mode==='conflict')return route.fulfill({status:409,json:{ok:false,error:'VERSION_CONFLICT'}});
      Object.assign(video,{playlistId:body.playlistId,title:'Tên tự động giả',version:video.version+1});return route.fulfill({json:{ok:true,record:video}});
     }
     return route.fulfill({json:{ok:true,snapshot:{records:[]},reviews:[]}});
    }
    return route.fulfill({json:{ok:true,records:[video,other],yesterdayClasses:[],playlists:[{id:'PLold',title:'IC9002'},{id:'PLnew',title:'IC9003'}],yesterdayDate:'2026-09-20',snapshot:{records:[]}}});
   }
   if(u.origin===server.origin){
    if(process.env.RECORDING_BEFORE_OVERLAY){
     try{const file=resolve(process.env.RECORDING_BEFORE_OVERLAY,'.'+u.pathname),body=await fs.readFile(file);return route.fulfill({contentType:u.pathname.endsWith('.html')?'text/html; charset=utf-8':u.pathname.endsWith('.css')?'text/css':'text/javascript',body});}catch{}
    }
    return route.continue();
   }
   return route.abort();
  });
  await page.goto(server.origin+'/recordings/index.html');await page.locator('[data-edit-id="one"]').waitFor();
  async function open(kind,id='one'){await page.locator(`[data-edit-id="${id}"]`).selectOption(kind);await page.locator(`#${kind}Dialog[open]`).waitFor();}
  async function errorVisible(kind,text){const alert=page.locator(`#${kind}Dialog [role=alert]`).filter({hasText:text});return await alert.count()>0&&await alert.isVisible();}
  await open('rename');await page.fill('#renameTitle','Nháp đổi tên giữ nguyên');await page.click('#renameSubmit');
  await page.locator('#toast').filter({hasText:'Không đổi được'}).waitFor();await page.waitForTimeout(3400);
  check(width,'rename-error-survives-toast',await errorVisible('rename','Không đổi được'));
  check(width,'rename-keeps-draft',await page.inputValue('#renameTitle'),'Nháp đổi tên giữ nguyên');
  await page.screenshot({path:`${out}/rename-error-${width}.png`,fullPage:true});
  await page.keyboard.press('Escape');await open('rename');check(width,'reopen-clears-previous-error',await page.locator('#renameDialog [role=alert]:visible').count(),0);
  const cancel=page.locator('#renameDialog .secondary');await cancel.hover();
  const paint=await cancel.evaluate(e=>{const s=getComputedStyle(e);return {fg:s.color,bg:s.backgroundColor};});
  check(width,'cancel-hover-has-contrasting-colors',contrast(paint.fg,paint.bg)>=4.5);
  await page.keyboard.press('Escape');
  await open('playlist');await page.selectOption('#playlistSelect','PLnew');await page.fill('#playlistVideoTitle','Tên playlist giả được giữ');await page.click('#playlistSubmit');
  await page.locator('#toast').filter({hasText:'chưa lưu được tên'}).waitFor();await page.waitForTimeout(3400);
  check(width,'partial-error-survives-toast',await errorVisible('playlist','chưa lưu được tên'));
  check(width,'partial-keeps-title',await page.inputValue('#playlistVideoTitle'),'Tên playlist giả được giữ');
  check(width,'partial-keeps-open',await page.locator('#playlistDialog').evaluate(e=>e.open));
  check(width,'partial-error-and-submit-in-viewport',await page.locator('#playlistDialog').evaluate(dialog=>{
    const alert=dialog.querySelector('[role=alert]'),button=dialog.querySelector('button[type=submit]');
    if(!alert)return false;const a=alert.getBoundingClientRect(),b=button.getBoundingClientRect();
    return a.top>=0&&a.bottom<=innerHeight&&b.top>=0&&b.bottom<=innerHeight;
  }));
  await page.screenshot({path:`${out}/playlist-error-${width}.png`,fullPage:true});
  const before=writes.length;mode='success';await page.click('#playlistSubmit');await page.locator('#playlistDialog').waitFor({state:'hidden'});
  check(width,'retry-only-renames',writes.slice(before).map(w=>w.path.includes('recording-rename-')?'rename':'other'),['rename']);
  check(width,'retry-readback-title',video.title,'Tên playlist giả được giữ');
  mode='conflict';await open('playlist');await page.selectOption('#playlistSelect','PLold');await page.click('#playlistSubmit');await page.locator('#toast').filter({hasText:'người khác'}).waitFor();
  check(width,'conflict-stays-inside-dialog',await errorVisible('playlist','người khác'));
  await page.keyboard.press('Escape');
  mode='held';await open('rename');await page.fill('#renameTitle','Tên gửi trước');await page.click('#renameSubmit');await page.waitForFunction(()=>document.querySelector('#renameSubmit').disabled);
  await page.fill('#renameTitle','Nháp nhập sau');await page.focus('#renameTitle');await waitHeld();mode='rename-fail';release();release=null;
  await page.waitForFunction(()=>!document.querySelector('#renameSubmit').disabled);await page.waitForTimeout(70);
  check(width,'response-keeps-new-input',await page.inputValue('#renameTitle'),'Nháp nhập sau');
  check(width,'response-keeps-new-focus',await page.locator('#renameTitle').evaluate(e=>document.activeElement===e));
  mode='held';await page.click('#renameSubmit');await page.waitForFunction(()=>document.querySelector('#renameSubmit').disabled);await page.keyboard.press('Escape');await open('rename','two');await page.fill('#renameTitle','Nháp bản ghi thứ hai');await page.focus('#renameTitle');await waitHeld();mode='rename-fail';release();release=null;
  await page.waitForFunction(()=>!document.querySelector('#renameSubmit').disabled);await page.waitForTimeout(70);
  check(width,'late-response-not-in-other-record',await page.locator('#renameDialog [role=alert]:visible').count(),0);
  check(width,'late-response-keeps-other-record',await page.inputValue('#renameRecordId'),'two');
  check(width,'late-response-keeps-other-draft',await page.inputValue('#renameTitle'),'Nháp bản ghi thứ hai');
  check(width,'late-response-keeps-other-focus',await page.locator('#renameTitle').evaluate(e=>document.activeElement===e));
  check(width,'sent-title-is-original-draft',writes.at(-2).body.newTitle,'Tên gửi trước');
  assert.deepEqual(errors,[]);await fs.writeFile(`${out}/requests-${width}.json`,JSON.stringify(writes,null,2));await context.close();
 }
 assert.equal(records.length,54);const failed=records.filter(r=>!r.passed);await fs.writeFile(out+'/results.json',JSON.stringify({outcome:failed.length?'failed':'passed',records,externalWrites:0},null,2));console.log(JSON.stringify({passed:records.length-failed.length,total:records.length,failed}));if(failed.length)process.exitCode=1;
}finally{release?.();await browser.close();await server.close();}
