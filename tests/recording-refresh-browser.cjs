const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
  const file=path.join(root,new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return res.writeHead(404).end();
  if(file.endsWith('nightly-config.js'))return res.end("window.RECORDING_NIGHTLY={dataUrl:'https://fixture.invalid/nightly',actionUrl:'https://fixture.invalid/action',recheckUrl:'https://fixture.invalid/recheck'};");
  res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('https://accounts.google.com/gsi/client',route=>route.fulfill({contentType:'application/javascript',body:"window.google={accounts:{id:{initialize:o=>window.fixtureLogin=o.callback,renderButton:()=>{},disableAutoSelect:()=>{}}}};"}));
    const date='2026-09-24',time='2026-09-24T19:00:00+07:00';
    const zoom57=['MP4','CHAT','TRANSCRIPT','TIMELINE','CC'].map((type,i)=>({id:'Zoom 57:file'+i,kind:'recording',source:'Zoom 57',account:'Zoom 57',recordingFileId:'file'+i,type,status:'completed',recordingStart:time,recordingEnd:'2026-09-24T21:00:00+07:00',fileSize:1000,reviewStatus:'pending',version:1,...(type==='MP4'?{videoId:'fixture-video',youtubeStatus:'uploaded'}:{})}));
    const pending={id:'Zoom 55:pending',kind:'recording',source:'Zoom 55',account:'Zoom 55',meetingUuid:'known-meeting',recordingFileId:'pending',type:'',status:'processing',recordingStart:time,recordingEnd:'',fileSize:0,className:'IC2303',lessonNumber:2,reviewStatus:'pending',version:1,reasons:['processing']};
    const staleLegacy={...pending};
    const snapshot={date,scannedAt:'2026-09-24T23:00:00+07:00',scanStatus:'completed',accounts:[{account:'Zoom 55',status:'success'},{account:'Zoom 57',status:'success'}],records:[...zoom57,pending]};
    let refreshes=0,uploads=0,scans=0;
    await page.route('https://ducizone.ddns.net/**',route=>route.fulfill({json:{ok:true,records:[staleLegacy],playlists:[],yesterdayClasses:[],yesterdayDate:date}}));
    await page.route('https://fixture.invalid/**',route=>{
      const url=route.request().url();
      if(url.includes('/recheck')){scans++;return route.fulfill({json:{ok:true}});}
      if(url.includes('/nightly'))return route.fulfill({json:{ok:true,snapshot}});
      const body=JSON.parse(route.request().postData());
      if(body.action==='auth')return route.fulfill({json:{ok:true,actor:{verified:true,expiresAt:Date.now()+3600000}}});
      if(body.action==='source_link')return route.fulfill({json:{ok:true,status:'processing'}});
      if(body.action==='confirm_publish'){uploads++;return route.fulfill({status:500,json:{ok:false}});}
      if(body.action==='refresh_file'){
        refreshes++;assert.equal(body.id,'Zoom 55:pending');assert.equal(body.expectedVersion,1);
        Object.assign(pending,{id:'Zoom 55:ready',recordingFileId:'ready',type:'MP4',status:'completed',recordingEnd:'2026-09-24T21:00:00+07:00',fileSize:1000,version:2,sourceRefreshedAt:'2026-09-25T10:00:00+07:00',audit:[{action:'refresh_processing_source',previousRecordId:'Zoom 55:pending'}]});
        return route.fulfill({json:{ok:true,record:{id:pending.id,version:2,type:'MP4',status:'completed',fileSize:1000}}});
      }
      return route.fulfill({json:{ok:false,error:'UNKNOWN_ACTION'}});
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/recordings/index.html`);
    await page.waitForFunction(()=>document.querySelectorAll('.review-section tbody tr').length===2&&window.fixtureLogin);
    assert.equal(await page.locator('#totalCount').innerText(),'2');
    await page.evaluate(()=>window.fixtureLogin({credential:'fixture-token'}));
    await page.waitForFunction(()=>window.recordingAuth.isAuthenticated());
    await page.selectOption('[data-edit-id="Zoom 55:pending"]','refresh_file');
    await page.waitForSelector('[data-action="manual-upload"][data-id="Zoom 55:ready"]');
    assert.equal(refreshes,1);assert.equal(uploads,0);assert.equal(scans,0);
    assert.equal(await page.locator('#totalCount').innerText(),'2');
    assert.deepEqual(errors,[]);
    console.log('PASS: Zoom 57 một video, Zoom 55 kiểm tra lại tệp rồi mở nút đăng, không quét lại hay tự đăng');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
