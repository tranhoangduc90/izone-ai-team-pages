/**
 * Nhận asset Pages local; dùng Chrome thật và webhook giả để kiểm trải nghiệm.
 * Bảo vệ tải lại/chờ lâu/mất ACK không tạo lượt mới và thiếu bài được chấm lại.
 * Không gọi production. Sai hành vi báo lỗi; không có export/cờ thử trong app.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require=createRequire('file:///C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const root=fileURLToPath(new URL('..',import.meta.url));
const server=createServer(async(q,r)=>{
  try{
    const pathname=new URL(q.url,'http://localhost').pathname;
    const file=resolve(root,'.'+pathname);
    if(!file.startsWith(resolve(root)+sep))throw Error('OUTSIDE_FIXTURE');
    let data=await readFile(file,'utf8');
    if(pathname==='/check-now-app.js'&&process.env.CHECK_NOW_APP_BASELINE)data=await readFile(process.env.CHECK_NOW_APP_BASELINE,'utf8');
    if(pathname==='/check-now-config.js')data=data.replace('timeoutMs: 240000','timeoutMs: 300').replace('pollEveryMs: 1300','pollEveryMs: 20');
    r.writeHead(200,{'Content-Type':extname(file)==='.html'?'text/html; charset=utf-8':extname(file)==='.js'?'text/javascript; charset=utf-8':'text/css; charset=utf-8'});r.end(data);
  }catch{r.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const start='https://ducizone.ddns.net/webhook/cham-ngay-reading-listening-67';
const progress='https://ducizone.ddns.net/webhook/tien-do-cham-reading-listening-67?*';
const doc='fixture_document_123456789012345';
const url=origin+'/check-now.html?documentId='+doc+'&assignmentCode=67-reading-02';
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'});
const result=[];
const reply=(route,body,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(body)});
async function pageFor(startHandler,statusHandler){
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.route('https://**/*',route=>route.abort());
  await page.route(start,startHandler);await page.route(progress,statusHandler);
  return page;
}
try{
  let posts=0,done=false;
  const ids=[];
  const page=await pageFor(async route=>{posts++;await reply(route,{job_id:'durable-job',stage:'reading'},202);},async route=>{ids.push(new URL(route.request().url()).searchParams.get('jobId'));await reply(route,done?{status:'done',stage:'done'}:{status:'processing',stage:'grading'});});
  await page.goto(url);
  await page.getByRole('button',{name:'Xem lại tiến độ'}).waitFor({timeout:4000});
  await page.reload();
  await page.getByRole('button',{name:'Xem lại tiến độ'}).waitFor({timeout:4000});
  assert.equal(posts,1,'Reload đã tạo thêm yêu cầu chấm');assert(ids.every(id=>id==='durable-job'));
  done=true;await page.getByRole('button',{name:'Xem lại tiến độ'}).click();
  await page.getByRole('heading',{name:'Đã xong!',exact:true}).waitFor();assert.equal(posts,1,'Xem tiến độ đã tạo lượt mới');
  await page.reload();await page.getByRole('heading',{name:'Đã xong!',exact:true}).waitFor();assert.equal(posts,1);
  result.push('reload_and_long_wait_keep_same_job');await page.close();

  const payloads=[];
  const incomplete=await pageFor(async route=>{payloads.push(JSON.parse(route.request().postData()));await reply(route,{job_id:'attempt-'+payloads.length,stage:'reading'},202);},async route=>{
    const id=new URL(route.request().url()).searchParams.get('jobId');
    await reply(route,id==='attempt-1'?{status:'warning',stage:'reading',message:'Chưa đủ 80%. Chưa ghi được cảnh báo vào Google Docs.',retryable:true}:{status:'done',stage:'done'});
  });
  await incomplete.goto(url);await incomplete.getByRole('button',{name:'Tôi đã làm đủ — chấm lại'}).waitFor();
  assert.match(await incomplete.locator('#warning-message').innerText(),/Chưa ghi được/);
  await incomplete.getByRole('button',{name:'Tôi đã làm đủ — chấm lại'}).click();await incomplete.getByRole('heading',{name:'Đã xong!',exact:true}).waitFor();
  assert.equal(payloads.length,2);assert.notEqual(payloads[0].requestId,payloads[1].requestId);assert.equal(payloads[1].documentId,doc);
  result.push('incomplete_retries_as_new_attempt');await incomplete.close();

  const requests=[];
  const ack=await pageFor(async route=>{requests.push(JSON.parse(route.request().postData()));if(requests.length===1)await route.abort('failed');else await reply(route,{job_id:'ack-job',stage:'reading'},202);},route=>reply(route,{status:'done',stage:'done'}));
  await ack.goto(url);await ack.getByRole('button',{name:'Thử chấm lại'}).waitFor();await ack.getByRole('button',{name:'Thử chấm lại'}).click();await ack.getByRole('heading',{name:'Đã xong!',exact:true}).waitFor();
  assert.equal(requests.length,2);assert.equal(requests[0].requestId,requests[1].requestId,'Mất ACK đã đổi định danh yêu cầu');
  result.push('lost_ack_reuses_request_identity');await ack.close();

  const review=await pageFor(route=>reply(route,{job_id:'review-job',stage:'reading'},202),route=>reply(route,{status:'needs_review',stage:'failed',message:'Cần đối chiếu kết quả trong Docs.',retryable:false}));
  await review.goto(url);await review.getByText('Cần đối chiếu kết quả trong Docs.',{exact:true}).waitFor();assert.equal(await review.locator('#retry-button').isVisible(),false);
  result.push('uncertain_write_does_not_invite_regrading');await review.close();

  let failurePosts=0;
  const failure=await pageFor(route=>{failurePosts++;return reply(route,{job_id:'offline-status-job',stage:'reading'},202);},route=>reply(route,{message:'Chưa đọc được tiến độ.'},503));
  await failure.goto(url);await failure.getByRole('button',{name:'Xem lại tiến độ'}).waitFor();await failure.getByRole('button',{name:'Xem lại tiến độ'}).click();await failure.getByRole('button',{name:'Xem lại tiến độ'}).waitFor();assert.equal(failurePosts,1);
  result.push('status_outage_preserves_accepted_job');await failure.close();
  console.log(JSON.stringify({ok:true,browser:'Chrome',cases:result.length,results:result,productionRequests:0}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
