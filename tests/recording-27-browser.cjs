const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
test('Bộ lọc đủ 27 nick khi rỗng; trạng thái chờ/thiếu đĩa rõ trên desktop và mobile',async()=>{
 const root=path.resolve(__dirname,'..');const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({channel:'chrome',headless:true});
 try{for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://accounts.google.com/**',r=>r.fulfill({contentType:'application/javascript',body:"window.google={accounts:{id:{initialize:()=>{},renderButton:()=>{},disableAutoSelect:()=>{}}}};"}));
  let empty=true;
  await page.route('https://ducizone.ddns.net/**',route=>{
   const base={kind:'recording',source:'Zoom 13',account:'Zoom 13',type:'MP4',status:'completed',recordingStart:'2026-10-09T11:00:00Z',recordingEnd:'2026-10-09T11:10:00Z',fileSize:24,version:1,reasons:[],youtubeStatus:'not_started'};
   const records=empty?[]:[{...base,id:'Zoom 13:waiting',recordingFileId:'waiting',stage:'queued',queueState:'waiting'},{...base,id:'Zoom 13:disk',recordingFileId:'disk',errorCode:'LOCAL_SPACE_INSUFFICIENT',queueState:'blocked_disk',stage:'needs_attention'}];
   const nightly=route.request().url().includes('recording_nightly_data');return route.fulfill({json:nightly?{ok:true,snapshot:{date:'2026-10-09',records,accounts:[],mode:'automatic'}}:{ok:true,records:[],playlists:[],yesterdayClasses:[]}});
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/recordings/index.html`);await page.waitForFunction(()=>document.querySelectorAll('#accountFilter option').length===28);
  const names=await page.locator('#accountFilter option').allTextContents();assert.equal(names[1],'Zoom 6');assert.equal(names.at(-1),'Zoom 57');assert.ok(names.includes('Zoom 56'));
  await page.selectOption('#accountFilter','Zoom 13');empty=false;await page.evaluate(()=>loadData(true));await page.waitForFunction(()=>document.querySelectorAll('tbody tr').length===2);
  assert.equal(await page.locator('#accountFilter').inputValue(),'Zoom 13');assert.match(await page.locator('body').innerText(),/Đang chờ hàng đợi truyền file/);assert.match(await page.locator('body').innerText(),/Thiếu dung lượng VPS/);
  const waiting=page.locator('tbody tr').filter({hasText:'Đang chờ hàng đợi truyền file'});assert.equal(await waiting.getByRole('button',{name:'Đăng lên YouTube'}).isDisabled(),true);assert.deepEqual(errors,[]);await page.close();
 }}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});
