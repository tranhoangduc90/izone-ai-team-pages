import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile,mkdir} from 'node:fs/promises';
// Chạy UI thật với âm thanh/người/DB giả trên localhost; lỗi mạng/autoplay chỉ tiêm vào phiên thử.
const require=createRequire('file:///C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const base=process.env.K67_PREVIEW_URL||'http://127.0.0.1:8893';assert.equal(new URL(base).hostname,'127.0.0.1');
const out=process.env.K67_AUDIO_EVIDENCE_DIR||'E:/Codex-Data/incidents/ic2262-audio-20261014/acceptance';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.env.K67_BROWSER_CHANNEL||'chrome'}),ctx=await browser.newContext();
await ctx.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
const page=await ctx.newPage(),results=[],errors=[],dialogs=[];let leave='dismiss';
page.setDefaultNavigationTimeout(6000);page.setDefaultTimeout(15000);
page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{dialogs.push(d.type());if(d.type()==='beforeunload'&&leave==='dismiss')await d.dismiss();else await d.accept();});
const slug='term-test-1',key=`izone-test:${slug}:IC2304`,prefix=`/api/term-tests/${slug}`;
const state=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'{}'),key);
const readback=async()=>{const s=await state();return(await ctx.request.get(base+'/preview/audio-state?id='+s.examSessionToken)).json();};
async function cancelReload(section){
  const count=dialogs.filter(x=>x==='beforeunload').length;
  await page.reload().catch(()=>null);
  assert.equal(dialogs.filter(x=>x==='beforeunload').length,count+1,section+': phải hiện cảnh báo tải lại');
  assert.equal(await page.locator('#'+section+'View').isVisible(),true);
  results.push({case:section+' tải lại và chọn ở lại',status:'passed'});
}
try{
  const reset=await ctx.request.post(base+'/preview/reset',{data:{}});assert.equal(reset.status(),200);
  await page.goto(base+`/term-tests/${slug}-computer-based/?class=IC2304&mode=read_first`);
  await page.locator('#bootstrapStudent').selectOption('11111111-1111-4111-8111-111111111111');
  await page.getByRole('button',{name:'Xác nhận, tiếp tục',exact:true}).click();await page.locator('#startReading').click();
  await page.locator('#readingView').waitFor({state:'visible'});await cancelReload('reading');
  const n=dialogs.filter(x=>x==='beforeunload').length;await page.locator('#submitReading').click();
  await page.locator('#bootstrapPreview').waitFor({state:'visible'});
  assert.equal(dialogs.filter(x=>x==='beforeunload').length,n,'Nộp Reading tự chuyển trang không hỏi lại');
  results.push({case:'Reading đã nộp chuyển sang Listening không bị cảnh báo chặn',status:'passed'});
  await page.locator('#bootstrapPreview').click();await page.locator('#bootstrapStart').click();
  await page.locator('#listeningView').waitFor({state:'visible'});await page.waitForTimeout(6000);
  await cancelReload('listening');
  const before=await readback();assert.ok(Number(before.listening_audio_checkpoint_seconds)>0);
  let lost=false;const recoveries=[];
  await page.route('**/session/audio-progress',async r=>{
    const body=r.request().postDataJSON();if(body.state==='recovered'){recoveries.push(body);if(!lost){lost=true;await r.fetch();return r.abort('connectionreset');}}
    return r.continue();
  });
  await page.evaluate(()=>{
    const audio=[...document.querySelectorAll('audio')].find(a=>!a.paused);
    window.fixtureAudio=audio;window.fixturePlay=audio.play.bind(audio);
    audio.play=()=>Promise.reject(new DOMException('Autoplay thử bị chặn','NotAllowedError'));audio.pause();
  });
  await page.getByRole('button',{name:'Tiếp tục audio',exact:true}).waitFor({state:'visible'});await page.waitForTimeout(2500);
  await page.evaluate(()=>{window.fixtureAudio.play=window.fixturePlay;});
  await page.getByRole('button',{name:'Tiếp tục audio',exact:true}).click();
  await page.waitForFunction(()=>window.fixtureAudio&&!window.fixtureAudio.paused);
  await page.waitForTimeout(1200);
  const recovered=await readback();assert.ok(Number(recovered.listening_recovery_seconds)>=2);
  assert.ok(Number(recovered.listening_recovery_seconds)<=5);
  assert.ok(recoveries.length>=2);assert.deepEqual(recoveries[0],recoveries[1],'Mất ACK phải retry cùng mã/mốc');
  assert.equal(Date.parse(recovered.listening_deadline_at)-Date.parse(before.listening_deadline_at),Number(recovered.listening_recovery_seconds)*1000);
  results.push({case:'Autoplay bị chặn → nút tiếp tục; mất ACK khôi phục retry không bù lặp, readback DB đúng',status:'passed'});
  await page.unroute('**/session/audio-progress');
  const heard=Number(recovered.listening_audio_checkpoint_seconds);leave='accept';await page.reload();
  await page.locator('#bootstrapStart').waitFor({state:'visible'});leave='dismiss';
  // Trình duyệt chỉ cho hiện beforeunload sau thao tác thật trên tài liệu vừa tải.
  await page.locator('#bootstrapVolume').click();
  const lobbyCount=dialogs.filter(x=>x==='beforeunload').length;await page.reload().catch(()=>null);
  assert.equal(dialogs.filter(x=>x==='beforeunload').length,lobbyCount+1);assert.equal(await page.locator('#bootstrapStart').isVisible(),true);
  results.push({case:'Vào lại bài: phòng tải audio vẫn cảnh báo tải lại khi hạn đang chạy',status:'passed'});
  await page.locator('#bootstrapStart').click();await page.locator('#listeningView').waitFor({state:'visible'});
  const actual=await page.evaluate(()=>[...document.querySelectorAll('audio')].find(a=>!a.paused)?.currentTime);
  assert.ok(actual>=heard-0.1&&actual<=heard+8,`Resume ${actual} phải dùng mốc đã nghe ${heard}`);
  results.push({case:'Chấp nhận tải lại: audio tiếp tục từ mốc nghe, giữ cùng lượt',status:'passed'});
  leave='dismiss';const closeCount=dialogs.filter(x=>x==='beforeunload').length;await page.close({runBeforeUnload:true});await page.waitForTimeout(200);
  assert.equal(page.isClosed(),false);assert.equal(dialogs.filter(x=>x==='beforeunload').length,closeCount+1);
  results.push({case:'Đóng tab và chọn ở lại: trang vẫn mở',status:'passed'});
  await page.locator('#submitListening').click();await page.locator('#startWriting').waitFor({state:'visible'});await page.locator('#startWriting').click();
  await page.locator('#writingView').waitFor({state:'visible'});await cancelReload('writing');
  await page.locator('textarea[data-writing-task="task2"]').fill('Đây là bài Writing giả để kiểm nộp và cảnh báo rời trang.');
  await page.locator('#submitWriting').click();await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k)||'{}').writingSubmitted===true,key);
  const done=dialogs.filter(x=>x==='beforeunload').length;await page.reload();
  assert.equal(dialogs.filter(x=>x==='beforeunload').length,done,'Đã nộp hết bài thì không cảnh báo rời trang');
  results.push({case:'Đã nộp toàn bài: tải lại không cảnh báo thừa',status:'passed'});
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({ok:true,channel:process.env.K67_BROWSER_CHANNEL||'chrome',results}));
}catch(e){results.push({case:'failed',status:'failed',error:e.message,pageErrors:errors});if(!page.isClosed())await page.screenshot({path:out+'/failure.png',fullPage:true});throw e;}
finally{await writeFile(out+'/results-'+(process.env.K67_BROWSER_CHANNEL||'chrome')+'.json',JSON.stringify(results,null,2),'utf8');await browser.close();}
