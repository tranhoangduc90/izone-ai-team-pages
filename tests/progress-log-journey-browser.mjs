// Phiếu/roster giả và API bị trì hoãn trong Chrome thật. Kiểm loading, timeout 15 giây,
// retry và quay về; mọi lần xem chỉ đọc, không tạo phiên/nộp/điểm danh.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const root=fileURLToPath(new URL('../',import.meta.url));
const {chromium}=createRequire(process.env.PLAYWRIGHT_PACKAGE||'C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');

test('J01–J03: Chrome báo chờ tức thì, deadline thật/retry/back, không tạo bài/điểm danh',{timeout:90000},async()=>{
  const server=createServer(async(req,res)=>{
    try{const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(resolve(root)+sep))throw new Error('Denied');
      res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'}[extname(file)]||'text/plain'));res.end(await readFile(file));
    }catch{res.writeHead(404);res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({channel:'chrome',headless:true});
  let release=null,mode='hold';const reads=[],unexpected=[],errors=[];
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(5000);page.on('pageerror',error=>errors.push(error.message));
    const studentRef='11111111-1111-4111-8111-111111111111';
    await page.route('**/*',async route=>{
      const req=route.request(),url=new URL(req.url()),json=value=>route.fulfill({contentType:'application/json',body:JSON.stringify(value)});
      if(url.pathname.endsWith('/progress-log/config.js'))return route.fulfill({contentType:'text/javascript',body:`window.PROGRESS_LOG_CONFIG={API_BASE_URL:'${origin}'};`});
      if(url.pathname.endsWith('/assignments/open'))return json({ok:true,assignment:{assignmentId:'assignment-fixture',sessionNumber:2,title:'Phiếu thử',
        class:{id:'1294',name:'IC2305 · Lớp thử'},roster:[{studentRef,name:'Học viên giả'}],definition:{blocks:[]}}});
      if(url.pathname.endsWith('/student/course-journey')) {
        reads.push(req.postDataJSON());
        if(mode==='hold')await new Promise(resolve=>{release=resolve;});
        if(mode==='fail')return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,message:'Nguồn tạm lỗi.'})});
        return json({ok:true,journey:{student:{studentRef,name:'Học viên giả'},class:{classId:'1294',name:'IC2305 · Lớp thử'},
          summary:{attendedSessions:0,submittedComplete:0,availableReports:0},sessions:[],reports:[],coverage:{}}});
      }
      if(url.origin===origin&&req.method()==='GET')return route.continue();
      unexpected.push(url.pathname);return route.abort();
    });
    await page.goto(origin+'/progress-log/index.html#assignment=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    await page.locator('#studentSelect').selectOption(studentRef);await page.locator('#chooseStudentButton').click();
    await page.locator('#journeyButton').click();await page.locator('#journeyLoadingView').waitFor({state:'visible'});
    assert.equal(await page.locator('#journeyLoadingView').getAttribute('aria-busy'),'true');
    assert.match(await page.locator('#journeyButton').textContent(),/Đang tải/);assert.equal(await page.locator('#journeyButton').isDisabled(),true);
    assert.equal(await page.locator('#journeySpinner').isVisible(),true);assert.equal(reads.length,1);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await mkdir(resolve(root,'output/playwright'),{recursive:true});await page.screenshot({path:resolve(root,'output/playwright/progress-journey-loading-390.png')});
    await page.locator('#journeyLoadingBackButton').click();assert.equal(await page.locator('#confirmView').isVisible(),true);
    mode='ready';release?.();await page.waitForTimeout(100);assert.equal(await page.locator('#journeyView').isVisible(),false);
    mode='fail';await page.locator('#journeyButton').click();await page.locator('#journeyLoadingStatus').filter({hasText:'Nguồn tạm lỗi'}).waitFor();
    assert.equal(await page.locator('#journeyRetryButton').isVisible(),true);
    mode='hold';await page.locator('#journeyRetryButton').click();
    await page.locator('#journeyLoadingStatus').filter({hasText:'Kết nối mất nhiều thời gian'}).waitFor({timeout:18000});
    assert.equal(await page.locator('#journeyRetryButton').isVisible(),true);mode='ready';release?.();
    await page.locator('#journeyRetryButton').click();await page.locator('#journeyView').waitFor({state:'visible'});
    await page.locator('#journeyBackButton').click();assert.equal(await page.locator('#confirmView').isVisible(),true);
    assert.ok(reads.every(body=>body.studentRef===studentRef&&body.identityConfirmed===true));
    assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);
  }finally{release?.();await browser.close();await new Promise(resolve=>server.close(resolve));}
});
