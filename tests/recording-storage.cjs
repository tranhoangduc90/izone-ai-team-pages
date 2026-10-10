const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../recordings');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'');
const css=fs.readFileSync(path.join(root,'styles.css'),'utf8'),script=fs.readFileSync(path.join(root,'storage.js'),'utf8');
test('Storage dashboard: desktop/mobile, readback, quyền xem, lỗi mount và logout',async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.RECORDING_BROWSER?{executablePath:process.env.RECORDING_BROWSER}:{})});
  try{
    for(const width of [1280,390]){
      const page=await browser.newPage({viewport:{width,height:950}});
      await page.setContent(html);await page.addStyleTag({content:css});
      await page.evaluate(()=>{
        document.querySelector('h1').textContent='Recording — dữ liệu giả kiểm thử';
        window.fixture={deleted:false,canCleanup:false,mountError:false,authenticated:true};
        const snapshot=()=>({ok:true,diskFreeBytes:40*1024**3,recordingBytes:window.fixture.deleted?0:256*1024**2,eligibleBytes:128*1024**2,checkedAt:'2026-10-01T09:00:00Z',
          rows:[{recordId:'Zoom 36:video-mau',mp4Status:window.fixture.deleted?'deleted':'present',partCount:0,bytes:window.fixture.deleted?0:256*1024**2,reason:'ELIGIBLE',retainUntil:'2026-09-30T09:00:00Z',checkedAt:'2026-10-01T09:00:00Z'}]});
        window.recordingAuth={isAuthenticated:()=>window.fixture.authenticated,request:async body=>{
          let data;
          if(window.fixture.mountError)data={ok:false,errorCode:'MOUNT_CHANGED'};
          else if(body.action==='storage_read')data=body.refresh?{ok:true,runId:'read'}:snapshot();
          else if(body.action==='storage_preview')data={ok:true,runId:'preview'};
          else if(body.action==='storage_cleanup'){window.fixture.deleted=true;data={ok:true,runId:'cleanup'};}
          else if(body.action==='storage_run')data={ok:true,run:{runId:body.runId,status:'verified',deletedBytes:128*1024**2,diskFreeBefore:40*1024**3,diskFreeAfter:40*1024**3+128*1024**2,
            result:body.runId==='preview'?{ok:true,canCleanup:window.fixture.canCleanup,previewId:'preview-fixture',expiresAt:Date.now()+60000,eligibleBytes:128*1024**2,rows:[{recordId:'Zoom 36:video-mau',reason:'ELIGIBLE',fileCount:1,eligibleBytes:128*1024**2}]}:snapshot()}};
          else data={ok:true,runs:[]};
          return {ok:data.ok,json:async()=>data};
        }};
      });
      await page.addScriptTag({content:script});await page.locator('#recordingStorage summary').click();
      await page.locator('#storageRefresh').click();await page.waitForFunction(()=>document.querySelector('#storageRows').textContent.includes('Còn lưu'));
      assert.match(await page.locator('#storageSummary').textContent(),/40.00 GiB/);
      await page.locator('#storagePreviewButton').click();await page.waitForFunction(()=>document.querySelector('#storagePreview').textContent.includes('Dự kiến'));
      assert.equal(await page.locator('#storageCleanup').isDisabled(),true,'Viewer không được bật nút xóa');
      await page.evaluate(()=>window.fixture.canCleanup=true);await page.locator('#storagePreviewButton').click();await page.waitForFunction(()=>!document.querySelector('#storageCleanup').disabled);
      const out=process.env.RECORDING_STORAGE_SCREENSHOTS;
      if(out){fs.mkdirSync(out,{recursive:true});await page.locator('#recordingStorage').screenshot({path:path.join(out,`storage-${width}.png`)});}
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'Bảng chỉ cuộn trong panel trên mobile');
      page.once('dialog',dialog=>dialog.accept());await page.locator('#storageCleanup').click();await page.waitForFunction(()=>document.querySelector('#storageRows').textContent.includes('Đã xóa, đã xác minh'));
      await page.evaluate(()=>window.fixture.mountError=true);await page.locator('#storageRefresh').click();await page.waitForFunction(()=>document.querySelector('#storageStatus').textContent.includes('Chưa xác minh'));
      assert.equal(await page.locator('#storageCleanup').isDisabled(),true);
      await page.evaluate(()=>{window.fixture.authenticated=false;document.dispatchEvent(new Event('recording-auth-changed'));});
      assert.equal(await page.locator('#storageRows').textContent(),'');assert.doesNotMatch(await page.locator('#storageRunResult').textContent(),/video-mau/);
      await page.close();
    }
  }finally{await browser.close();}
});
