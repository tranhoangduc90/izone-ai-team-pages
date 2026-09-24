const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/recordings/nightly-config.js'){res.setHeader('Content-Type','application/javascript');return res.end("window.RECORDING_NIGHTLY={dataUrl:'https://fixture.invalid/nightly',actionUrl:'https://fixture.invalid/action',recheckUrl:'https://fixture.invalid/recheck'};");}
  const file=path.join(root,pathname);if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  if(!fs.existsSync(file))return res.writeHead(404).end();
  res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'image/png');res.end(fs.readFileSync(file));
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try {
    const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('https://accounts.google.com/gsi/client',route=>route.fulfill({contentType:'application/javascript',body:"window.google={accounts:{id:{initialize:o=>window.fixtureLogin=o.callback,renderButton:()=>{},disableAutoSelect:()=>{}}}};"}));
    const session={id:'session:s1',kind:'session',classSessionId:'s1',className:'IC9001',lessonNumber:3,source:'Zoom 36',recordingStart:'2026-09-20T18:00:00+07:00',sessionStart:'2026-09-20T18:00:00+07:00',status:'missing_at_scan',reviewStatus:'pending',version:1,recordingIds:[]};
    let snapshot={date:'2026-09-20',scannedAt:'2026-09-20T23:00:00+07:00',mode:'observe',scanStatus:'completed',records:[session,{id:'pending',kind:'recording',type:'MP4',status:'completed',fileSize:24,recordingEnd:'2026-09-20T20:01:00+07:00',source:'Zoom 36',recordingFileId:'pending-file',recordingStart:'2026-09-20T20:00:00+07:00',reasons:['no_matching_session','short_clip'],errorCode:'DOWNLOAD_FAILED',version:1}]};let actions=0,scans=0,previews=0;const uploads=[];let rejectUpload=false;
    let video={id:'old',source:'Zoom 6',className:'IC9002',title:'IC9002 - Buổi 1',recordingStart:'2026-09-20T19:00:00+07:00',videoId:'abcdefghijk',playlistId:'PLfixture',playlistIndex:99,youtubeStatus:'uploaded',reviewStatus:'approved',version:1};
    const mutations=[];let failRename=true;
    await page.route('https://ducizone.ddns.net/**',async route=>{
      const req=route.request();const url=req.url();
      if(req.method()==='POST'){
        const b=JSON.parse(req.postData());if(b.expectedVersion!==video.version)return route.fulfill({status:409,json:{ok:false,error:'VERSION_CONFLICT'}});
        if(url.includes('recording-playlist-')){mutations.push('playlist');video={...video,playlistId:b.playlistId,title:'Tên tự động',version:2,reviewStatus:'needs_review'};return route.fulfill({json:{ok:true,record:video}});}
        if(url.includes('recording-rename-')){mutations.push('rename');if(failRename){failRename=false;return route.fulfill({status:500,json:{ok:false}});}video={...video,title:b.newTitle,version:3};return route.fulfill({json:{ok:true,record:video}});}
      }
      return route.fulfill({json:{ok:true,records:[video],yesterdayClasses:[],playlists:[{id:'PLfixture1234',title:'IC9002'},{id:'PLnew',title:'IC9003'}],yesterdayDate:'2026-09-20'}});
    });
    await page.route('https://fixture.invalid/**',async route=>{
      const url=route.request().url();
      if(url.includes('/action')){const b=JSON.parse(route.request().postData());if(b.action==='auth')return route.fulfill({json:{ok:true,actor:{verified:true,expiresAt:Date.now()+3600000}}});assert.equal(b.idToken,'fixture-token');if(b.action==='source_link')return route.fulfill({json:{ok:true,status:'available',url:'https://zoom.us/rec/play/fixture-source',scope:'file'}});if(b.action==='confirm_publish'){uploads.push(b);if(rejectUpload)return route.fulfill({status:409,json:{ok:false,error:'VERSION_CONFLICT'}});const row=snapshot.records[1];Object.assign(row,{version:2,proposedTitle:b.title,youtubeStatus:'uploading',errorCode:'',stage:'upload'});await new Promise(r=>setTimeout(r,200));return route.fulfill({json:{ok:true,record:row}});}if(b.action==='preview_file')return route.fulfill({contentType:'video/mp4',body:Buffer.from('fixture-video')});if(b.action==='preview'){previews++;return route.fulfill({json:previews===1?{ok:true,preview:{url:'https://zoom.us/rec/play/fixture'}}:{ok:false,error:'ZOOM_SOURCE_UNAVAILABLE'}});}if(b.action==='acknowledge_review'){const row=snapshot.records.find(r=>r.id===b.id);assert.equal(b.expectedVersion,row.version);row.version++;row.reviewStatus=b.approved?'approved':'pending';const {errorCode,...response}=row;return route.fulfill({json:{ok:true,record:response}});}actions++;assert.equal(b.expectedVersion,session.version);session.version++;session.reviewStatus='approved';session.exceptionStatus=b.action;session.exceptionReason=b.reason;return route.fulfill({json:{ok:true,record:session}});}
      if(url.includes('/recheck')){scans++;return route.fulfill({json:{message:'started'}});}
      return route.fulfill({json:{ok:true,snapshot}});
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/recordings/index.html`);
    await page.waitForFunction(()=>document.querySelectorAll('.review-section').length===2&&window.fixtureLogin);await page.evaluate(()=>window.fixtureLogin({credential:'fixture-token'}));await page.waitForFunction(()=>window.recordingAuth.isAuthenticated());
    await page.waitForSelector('[data-action="manual-upload"]');
    await page.click('[data-action="manual-upload"]');
    await page.waitForSelector('#manualUploadDialog[open]');
    assert.equal(await page.locator('#manualUploadForm label').count(),2);
    if(process.env.MANUAL_UPLOAD_SCREENSHOT)await page.screenshot({path:process.env.MANUAL_UPLOAD_SCREENSHOT});
    assert.equal(await page.locator('#manualUploadPlaylist option').count(),3);
    await page.fill('#manualUploadTitle','IC9002 - Buổi 4 - Phần 2 - 20/09/2026');
    await page.selectOption('#manualUploadPlaylist','PLfixture1234');
    await page.click('#manualUploadSubmit');
    await page.waitForFunction(()=>!document.getElementById('manualUploadDialog').open);
    assert.equal(uploads.length,1);assert.equal(uploads[0].title,'IC9002 - Buổi 4 - Phần 2 - 20/09/2026');
    assert.equal(uploads[0].playlistId,'PLfixture1234');assert.equal(uploads[0].expectedVersion,1);
    assert.equal(uploads[0].contentConfirmed,true);assert.equal(uploads[0].classSessionId,undefined);
    assert.equal(await page.locator('[data-action="manual-upload"]').count(),0);
    assert.ok((await page.locator('#toast').innerText()).includes('Đã gửi yêu cầu đăng'));
    assert.equal(scans,0);
    // Mở lại trang mô phỏng một yêu cầu bị xung đột phiên bản.
    Object.assign(snapshot.records[1],{youtubeStatus:'uploading',stage:'needs_attention',errorCode:'UPLOAD_REJECTED'});
    rejectUpload=true;
    await page.reload();await page.waitForFunction(()=>window.fixtureLogin);
    await page.evaluate(()=>window.fixtureLogin({credential:'fixture-token'}));
    await page.waitForFunction(()=>window.recordingAuth.isAuthenticated());
    await page.click('[data-action="manual-upload"]');await page.fill('#manualUploadTitle','Bài cần kiểm tra');await page.selectOption('#manualUploadPlaylist','PLfixture1234');
    await page.click('#manualUploadSubmit');await page.waitForFunction(()=>document.getElementById('manualUploadStatus').textContent.includes('Dữ liệu đã thay đổi'));
    assert.equal(await page.locator('#manualUploadSubmit').isDisabled(),true);
    assert.equal(uploads.length,2);
    await page.locator('#manualUploadDialog [data-close-dialog]').first().click();
    await page.getByRole('button',{name:'Làm mới',exact:true}).click();
    await page.waitForSelector('[data-action="manual-upload"]');
    assert.equal(await page.locator('[data-action="manual-upload"]').count(),1);
    await page.evaluate(()=>document.dispatchEvent(new Event('recording-auth-changed')));
    assert.deepEqual(errors,[]);console.log('PASS: manual upload modal, exact title/playlist, submit once, pending, version conflict, no rescan');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
