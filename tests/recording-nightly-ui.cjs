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
    const session={id:'session:s1',kind:'session',classSessionId:'s1',className:'IC9001',lessonNumber:3,source:'Zoom 36',recordingStart:'2026-09-20T18:00:00+07:00',sessionStart:'2026-09-20T18:00:00+07:00',status:'missing_at_scan',reviewStatus:'pending',version:1,recordingIds:[]};
    let snapshot={date:'2026-09-20',scannedAt:'2026-09-20T23:00:00+07:00',mode:'observe',scanStatus:'completed',records:[session]};let actions=0,scans=0;
    await page.route('https://ducizone.ddns.net/**',route=>route.fulfill({json:{ok:true,records:[{id:'old',source:'Zoom 6',className:'IC9002',title:'IC9002 - Buổi 1',recordingStart:'2026-09-20T19:00:00+07:00',videoId:'abcdefghijk',playlistId:'PLfixture',playlistIndex:99,youtubeStatus:'uploaded',reviewStatus:'approved'}],yesterdayClasses:[],playlists:[],yesterdayDate:'2026-09-20'}}));
    await page.route('https://fixture.invalid/**',async route=>{
      const url=route.request().url();
      if(url.includes('/action')){actions++;const b=JSON.parse(route.request().postData());assert.equal(b.expectedVersion,session.version);session.version++;session.reviewStatus='approved';session.exceptionStatus=b.action;session.exceptionReason=b.reason;return route.fulfill({json:{ok:true,record:session}});}
      if(url.includes('/recheck')){scans++;return route.fulfill({json:{message:'started'}});}
      return route.fulfill({json:{ok:true,snapshot}});
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/recordings/index.html`);
    await page.waitForFunction(()=>document.querySelectorAll('.class-folder').length===2);
    assert.equal(await page.locator('.class-folder').count(),2);
    assert.equal(await page.getByText('Chưa thấy recording tại lần quét',{exact:true}).count(),1);
    assert.match(await page.locator('.video-link').getAttribute('href'),/watch\?v=abcdefghijk&list=PLfixture$/);
    await page.getByRole('button',{name:'Làm mới',exact:true}).click();assert.equal(scans,0);
    await page.getByRole('button',{name:'Xử lý ngoại lệ'}).click();
    await page.locator('#exceptionAction').selectOption('accepted_missing');await page.locator('#exceptionReason').fill('Đã đối chiếu nguồn');
    await page.getByRole('button',{name:'Lưu trạng thái'}).click();await page.waitForFunction(()=>!document.querySelector('#exceptionDialog').open);
    assert.equal(actions,1);assert.equal(await page.locator('[data-class="IC9001"] .approved tbody tr').count(),1);
    await page.getByRole('button',{name:'Kiểm tra lại Zoom 36 và Zoom 6'}).click();await page.waitForTimeout(100);assert.equal(scans,1);
    assert.deepEqual(errors,[]);console.log('PASS: class folders, missing status, combined link, explicit scan, exception write/readback, no browser errors');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
