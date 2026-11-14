import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {extname} from 'node:path';
import {createRequire} from 'node:module';
import {startThe20Server,a} from './fixtures/progress-the20-server.mjs';
const {chromium}=createRequire('C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
test('Phiếu mở bản Pages trước API phiên bản; tab mở lâu cập nhật, giữ người/URL và không ghi bài',{timeout:120000},async()=>{
 const release=JSON.parse(await readFile(new URL('../progress-log/release.json',import.meta.url))),old=release.version,next=old==='eeeeeeeeeeeeeeee'?'dddddddddddddddd':'eeeeeeeeeeeeeeee';let active=old;
 const fixture=await startThe20Server();let versionReads=0,openingReads=0;
 const fakeToken='f1000000-0000-4000-8000-000000000001';
 const server=createServer(async(req,res)=>{try{
  const pathname=new URL(req.url,'http://local').pathname,relative=pathname.replace(/^\/izone-ai-team-pages\//,'');if(relative.includes('..'))throw Error('Denied');
  const version=relative.match(/releases\/([a-f0-9]{16})\//)?.[1],file=relative.replace('/'+next+'/', '/'+old+'/');
  let body=await readFile(new URL('../'+file,import.meta.url));
  if(['.js','.mjs','.html','.css'].includes(extname(file)))body=Buffer.from(body.toString().replaceAll(old,version||old));
  if(file.endsWith('/app.js'))body=Buffer.concat([Buffer.from('document.body.dataset.servedVersion='+JSON.stringify(version)+';\n'),body]);
  res.writeHead(200,{'content-type':{'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.png':'image/png','.woff2':'font/woff2'}[extname(file)]||'application/octet-stream','cache-control':'public,max-age=600'});res.end(body);
 }catch{res.writeHead(404);res.end();}});await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const origin='http://progress-release.localhost:'+server.address().port,browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin===origin)return route.continue();
  if(url.pathname.endsWith('/api/learning/frontend-release')){
   versionReads++;
   if(versionReads===1)await new Promise(done=>setTimeout(done,1800));
   return route.fulfill({json:{ok:true,version:active},headers:{'cache-control':'no-store'}}).catch(()=>{});
  }
  if(url.pathname.endsWith('/api/learning/assignments/open')&&route.request().postDataJSON()?.publicToken===fakeToken){
   openingReads++;
   return route.fulfill({json:{ok:true,assignment:{assignmentId:fakeToken,publicToken:fakeToken,
    class:{id:'2',name:'Lớp giả'},definition:{title:'Phiếu khởi động',blocks:[]},roster:[],sessionNumber:1}}});
  }
  if(url.origin==='https://ducizone.ddns.net'){
   const path=url.pathname.replace(/^\/mapping-api/,'');const response=await route.fetch({url:fixture.origin+path});return route.fulfill({response});
  }
  return route.abort();
 });
 try{
  const requests=[];
  page.on('request',request=>requests.push(new URL(request.url()).pathname));
  // A stale route stylesheet must not hold up the redirect to the immutable package.
  await page.route(/\/progress-log\/styles\.css\?/,async route=>{
   if(new URL(route.request().url()).pathname.endsWith('/progress-log/styles.css')){
    await new Promise(done=>setTimeout(done,7000));
    return route.abort().catch(()=>{});
   }
   return route.continue();
  });
  await page.goto(origin+'/izone-ai-team-pages/progress-log/index.html#assignment='+fakeToken);
  await page.locator('#identityView').waitFor({state:'visible',timeout:5000});
  assert.equal(openingReads,1);
  const openingRequest=requests.findIndex(path=>path.endsWith('/assignments/open'));
  const versionRequestOnWorksheet=requests.findIndex(path=>path.endsWith('/frontend-release'));
  assert.ok(openingRequest>=0&&openingRequest<versionRequestOnWorksheet,'Mở phiếu bắt đầu trước kiểm phiên bản nền');
  assert.ok(await page.locator('link[rel=modulepreload][href$="/session-review.js"]').count(),
   'Chrome được phát hiện các module con cùng lúc với app.js');
  requests.length=0;
  await page.goto(origin+'/izone-ai-team-pages/progress-log/student.html?release-test=1');await page.locator('#portalClass:not([disabled])').selectOption('1294');await page.locator('#portalStudent:not([disabled])').selectOption(a);await page.locator('#portalContinue').click();
  const packageRequest=requests.findIndex(path=>path.includes('/releases/'+old+'/'));
  const versionRequest=requests.findIndex(path=>path.endsWith('/frontend-release'));
  assert.ok(packageRequest>=0&&versionRequest>packageRequest,'API phiên bản phải chạy sau khi vào gói Pages');
  await page.locator('#thuyStudentSkills h2').waitFor();assert.equal(await page.evaluate(()=>window.PROGRESS_LOG_RELEASE.version),old);
  const stable=page.url();active=next;await page.reload();
  await page.locator('.progress-release-notice').getByRole('button',{name:'Cập nhật'}).click();
  await page.waitForFunction(v=>window.PROGRESS_LOG_RELEASE?.version===v,next,{timeout:12000});
  await page.locator('#thuyStudentSkills h2').waitFor();
  assert.equal(page.url(),stable);assert.equal(await page.evaluate(()=>window.PROGRESS_LOG_RELEASE.version),next);assert.equal(await page.locator('body').getAttribute('data-served-version'),next);
  active=old;await page.evaluate(()=>window.progressLogCheckUpdate());
  await page.locator('.progress-release-notice').getByRole('button',{name:'Cập nhật'}).click();
  await page.waitForFunction(v=>window.PROGRESS_LOG_RELEASE?.version===v,old,{timeout:12000});
  await page.locator('#thuyStudentSkills h2').waitFor();assert.equal(page.url(),stable);
  assert.equal(fixture.calls.filter(c=>/attempts\/(start|draft|submit)|checkpoints\/submit/.test(c.path)).length,0);assert.deepEqual(errors,[]);
 }finally{await browser.close();await fixture.close();await new Promise(done=>server.close(done));}
});
