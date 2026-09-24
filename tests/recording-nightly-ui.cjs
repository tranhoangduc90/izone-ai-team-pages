const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const playwrightModule = process.env.PLAYWRIGHT_MODULE
  || (process.env.CODEX_NODE_MODULES ? path.join(process.env.CODEX_NODE_MODULES, 'playwright') : 'playwright');
const {chromium}=require(playwrightModule);
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/recordings/nightly-config.js'){res.setHeader('Content-Type','application/javascript');return res.end("window.RECORDING_NIGHTLY={dataUrl:'https://fixture.invalid/nightly',actionUrl:'https://fixture.invalid/action',recheckUrl:'https://fixture.invalid/recheck'};");}
  const file=path.join(root,pathname);if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  if(!fs.existsSync(file))return res.writeHead(404).end();
  res.setHeader('Content-Type',file.endsWith('.ttf')?'font/ttf':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'image/png');res.end(fs.readFileSync(file));
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try {
    const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('https://accounts.google.com/gsi/client',route=>route.fulfill({contentType:'application/javascript',body:"window.google={accounts:{id:{initialize:o=>window.fixtureLogin=o.callback,renderButton:()=>{},disableAutoSelect:()=>{}}}};"}));
    const session={id:'session:s1',kind:'session',classSessionId:'s1',className:'IC9001',lessonNumber:3,source:'Zoom 36',recordingStart:'2026-09-20T18:00:00+07:00',sessionStart:'2026-09-20T18:00:00+07:00',status:'missing_at_scan',reviewStatus:'pending',version:1,recordingIds:[]};
    let snapshot={date:'2026-09-20',scannedAt:'2026-09-20T23:00:00+07:00',mode:'observe',scanStatus:'completed',records:[session,{id:'pending',kind:'recording',type:'MP4',status:'completed',recordingEnd:'2026-09-20T20:01:00+07:00',source:'Zoom 36',recordingFileId:'pending-file',recordingStart:'2026-09-20T20:00:00+07:00',reasons:['no_matching_session','short_clip'],errorCode:'DOWNLOAD_FAILED',version:1}]};let actions=0,scans=0,previews=0;
    let video={id:'old',source:'Zoom 6',className:'IC9002',title:'IC9002 - Buổi 1',recordingStart:'2026-09-20T19:00:00+07:00',videoId:'abcdefghijk',playlistId:'PLfixture',playlistIndex:99,youtubeStatus:'uploaded',reviewStatus:'approved',version:1};
    const mutations=[];let failRename=true;
    await page.route('https://ducizone.ddns.net/**',async route=>{
      const req=route.request();const url=req.url();
      if(req.method()==='POST'){
        const b=JSON.parse(req.postData());if(b.expectedVersion!==video.version)return route.fulfill({status:409,json:{ok:false,error:'VERSION_CONFLICT'}});
        if(url.includes('recording-playlist-')){mutations.push('playlist');video={...video,playlistId:b.playlistId,title:'Tên tự động',version:2,reviewStatus:'needs_review'};return route.fulfill({json:{ok:true,record:video}});}
        if(url.includes('recording-rename-')){mutations.push('rename');if(failRename){failRename=false;return route.fulfill({status:500,json:{ok:false}});}video={...video,title:b.newTitle,version:3};return route.fulfill({json:{ok:true,record:video}});}
      }
      return route.fulfill({json:{ok:true,records:[video],yesterdayClasses:[],playlists:[{id:'PLfixture',title:'IC9002'},{id:'PLnew',title:'IC9003'}],yesterdayDate:'2026-09-20'}});
    });
    await page.route('https://fixture.invalid/**',async route=>{
      const url=route.request().url();
      if(url.includes('/action')){const b=JSON.parse(route.request().postData());if(b.action==='auth')return route.fulfill({json:{ok:true,actor:{verified:true,expiresAt:Date.now()+3600000}}});assert.equal(b.idToken,'fixture-token');if(b.action==='source_link')return route.fulfill({json:b.id==='pending'?{ok:false,status:'deleted'}:{ok:true,status:'available',url:'https://zoom.us/rec/play/fixture-source',scope:'file'}});if(b.action==='preview_file')return route.fulfill({contentType:'video/mp4',body:Buffer.from('fixture-video')});if(b.action==='preview'){previews++;return route.fulfill({json:previews===1?{ok:true,preview:{url:'https://zoom.us/rec/play/fixture'}}:{ok:false,error:'ZOOM_SOURCE_UNAVAILABLE'}});}if(b.action==='acknowledge_review'){const row=snapshot.records.find(r=>r.id===b.id);assert.equal(b.expectedVersion,row.version);row.version++;row.reviewStatus=b.approved?'approved':'pending';const {errorCode,...response}=row;return route.fulfill({json:{ok:true,record:response}});}actions++;assert.equal(b.expectedVersion,session.version);session.version++;session.reviewStatus='approved';session.exceptionStatus=b.action;session.exceptionReason=b.reason;return route.fulfill({json:{ok:true,record:session}});}
      if(url.includes('/recheck')){scans++;return route.fulfill({json:{message:'started'}});}
      return route.fulfill({json:{ok:true,snapshot}});
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/recordings/index.html`);
    await page.waitForFunction(()=>document.querySelectorAll('.review-section').length===2&&window.fixtureLogin);await page.evaluate(()=>window.fixtureLogin({credential:'fixture-token'}));await page.waitForFunction(()=>window.recordingAuth.isAuthenticated());
    await page.waitForSelector('.zoom-source-link');assert.equal(await page.locator('.zoom-source-link').getAttribute('href'),'https://zoom.us/rec/play/fixture-source');assert.ok((await page.locator('.pending').innerText()).includes('Recording đã được xóa trong Zoom'));
    assert.equal(await page.locator('.class-folder').count(),0);assert.equal(await page.locator('.scan-panel').count(),0);assert.equal(await page.locator('#recordingDecisionDialog').count(),0);assert.equal(await page.getByRole('button',{name:'Xử lý recording',exact:true}).count(),0);assert.ok((await page.locator('.pending').innerText()).includes('Lý do cần duyệt:'));assert.ok((await page.locator('.pending').innerText()).includes('DOWNLOAD_FAILED'));
    assert.ok((await page.locator('.pending').innerText()).includes('Chưa thấy recording tại lần quét'));
    assert.deepEqual(await page.locator('.pending thead th').allTextContents(),['Lớp / Zoom','Recording','Thời gian học','Link recording','Chỉnh sửa','Link YouTube','Đã duyệt']);
    assert.equal(await page.locator('.pending tbody tr').first().locator('td').count(),7);
    assert.deepEqual(await page.locator('[data-edit-id="old"] option').allTextContents(),['Chọn thao tác','Đổi tên video','Đổi playlist']);
    assert.match(await page.locator('.video-link[href]:not(.zoom-source-link)').getAttribute('href'),/watch\?v=abcdefghijk&list=PLfixture$/);
    await page.evaluate(()=>document.fonts.ready);
    assert.ok(await page.evaluate(()=>document.fonts.check('400 16px "Source Sans Pro"')&&document.fonts.check('700 16px "Source Sans Pro"')));
    assert.ok((await page.locator('body').evaluate(el=>getComputedStyle(el).fontFamily)).includes('Source Sans Pro'));
    for(const link of await page.locator('.external-link-icon').all()) {assert.equal((await link.innerText()).trim(),'');assert.equal(await link.locator('svg').count(),1);assert.ok(await link.getAttribute('aria-label'));}
    assert.equal(await page.locator('[data-edit-id="old"]').count(),1);
    assert.equal(await page.locator('.manual-upload-disabled').isDisabled(),true);
    if(process.env.RECORDING_UI_SCREENSHOT) {
      await page.screenshot({path:process.env.RECORDING_UI_SCREENSHOT,fullPage:true});
      await page.setViewportSize({width:390,height:844});
      await page.screenshot({path:process.env.RECORDING_UI_SCREENSHOT.replace('.png','-mobile.png'),fullPage:true});
      await page.setViewportSize({width:1280,height:720});
    }

    await page.locator('[data-edit-id="old"]').selectOption('rename');
    assert.equal(await page.locator('#renameTitle').inputValue(),video.title);
    await page.locator('#renameDialog [data-close-dialog]').first().click();
    await page.setViewportSize({width:1440,height:1000});
    if(process.env.RECORDING_QA_DIR)await page.screenshot({path:process.env.RECORDING_QA_DIR+'/table-desktop.png',fullPage:true});
    await page.setViewportSize({width:390,height:844});
    assert.ok(await page.locator('.pending .table-wrap').evaluate(e=>e.scrollWidth>e.clientWidth));
    if(process.env.RECORDING_QA_DIR)await page.screenshot({path:process.env.RECORDING_QA_DIR+'/table-mobile.png',fullPage:true});
    await page.setViewportSize({width:1440,height:1000});
    assert.equal(await page.getByRole('button',{name:'Xem recording gốc',exact:true}).count(),0);
    assert.equal(await page.locator('.zoom-source-link svg').count(),1);
    await page.evaluate(()=>window.recordingAuth.clear());assert.equal(await page.locator('.zoom-source-link').count(),0);
    await page.evaluate(()=>window.fixtureLogin({credential:'fixture-token'}));await page.waitForFunction(()=>window.recordingAuth.isAuthenticated());
    assert.equal(previews,0);assert.equal(actions,0);
    await page.getByRole('button',{name:'Làm mới',exact:true}).click();assert.equal(scans,0);
    await page.locator('[data-action="nightly-review"] + span').click();await page.waitForFunction(()=>document.querySelector('.approved [data-action="nightly-review"]')?.checked);assert.ok((await page.locator('.approved').innerText()).includes('DOWNLOAD_FAILED'));
    await page.locator('[data-action="nightly-review"] + span').click();await page.waitForFunction(()=>document.querySelector('.pending [data-action="nightly-review"]')&&!document.querySelector('.pending [data-action="nightly-review"]').disabled);
    await page.getByRole('button',{name:'Xử lý ngoại lệ'}).click();
    await page.locator('#exceptionAction').selectOption('accepted_missing');await page.locator('#exceptionReason').fill('Đã đối chiếu nguồn');
    await page.getByRole('button',{name:'Lưu trạng thái'}).click();await page.waitForFunction(()=>!document.querySelector('#exceptionDialog').open);
    assert.equal(actions,1);assert.equal(await page.locator('.approved tbody tr').count(),2);
    await page.locator('[data-edit-id="old"]').selectOption('playlist');
    const labels=await page.locator('#playlistForm > label').allTextContents();assert.ok(labels[0].startsWith('Playlist chuyển vào'));assert.ok(labels[1].startsWith('Tên video sau khi chuyển'));
    await page.locator('#playlistSelect').selectOption('PLnew');await page.locator('#playlistVideoTitle').fill('IC9003 - Buổi 2');
    await page.locator('#playlistSubmit').click();await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('chưa lưu được tên'));assert.deepEqual(mutations,['playlist','rename']);assert.equal(await page.locator('#playlistDialog').evaluate(e=>e.open),true);
    await page.locator('#playlistSubmit').click();await page.waitForFunction(()=>!document.querySelector('#playlistDialog').open);assert.deepEqual(mutations,['playlist','rename','rename']);assert.equal(video.title,'IC9003 - Buổi 2');assert.equal(scans,0);
    await page.locator('[data-edit-id="old"]').selectOption('playlist');video.version=4;
    await page.locator('#playlistVideoTitle').fill('Tên không được ghi đè');await page.locator('#playlistSubmit').click();await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('người khác'));assert.equal(video.title,'IC9003 - Buổi 2');
    await page.locator('#playlistDialog [data-close-dialog]').first().click();
    snapshot={...snapshot,scanStatus:'failed',errorCode:'SOURCE_OR_STORAGE_UNAVAILABLE',records:[]};await page.getByRole('button',{name:'Làm mới',exact:true}).click();await page.waitForSelector('.pending [role="alert"]');assert.ok((await page.locator('#yesterdayClasses').innerText()).includes('Chưa đọc đủ'));
    assert.deepEqual(errors,[]);console.log('PASS: two sections, inline reasons, no redundant panel/dialog, playlist then rename, partial failure retry, exception readback, no Zoom scan');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
