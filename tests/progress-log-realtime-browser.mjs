// HTTP/SSE giả chỉ kiểm UI. Nộp, PostgreSQL, quyền và tải máy chủ được kiểm ở suite backend riêng.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const {chromium}=createRequire('C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const root=process.env.PROGRESS_LOG_BROWSER_ROOT||fileURLToPath(new URL('../',import.meta.url));
const uid=n=>`b0000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const assignmentId=uid(3),block=uid(4),item=uid(5);
async function until(check,message,timeout=3000){const start=performance.now();while(performance.now()-start<timeout){if(await check())return;await new Promise(done=>setTimeout(done,40));}assert.fail(message);}

async function fixture({libraryUnavailable=false,liveAllowed=true}={}){
  let count=14,revision=1,unavailable=false,breakNextRead=false,writeCount=0,draftText='Bản đầu';const streams=new Set(),requests=[];
  const students=()=>Array.from({length:17},(_,i)=>({studentRef:uid(100+i),name:`Học viên ${String(i+1).padStart(2,'0')}`,
    submissionId:i<count?uid(200+i):null,checkpoints:i<count?[{blockId:block}]:[],sessionComment:null,portalSync:null}));
  const definition={title:'Phiếu kiểm cập nhật',blocks:[{blockId:block,checkpoint:1,title:'Ôn tập',items:[
    {itemVersionId:item,position:1,prompt:'Chọn ý cần chú ý',interactionType:'single_choice',graderType:'exact_option',skillCodes:['listening'],maxScore:1,options:[{id:'A',label:'Ý A'},{id:'B',label:'Ý B'}]},
    {itemVersionId:uid(6),position:2,prompt:'Điều em đã học',interactionType:'long_text',graderType:'none',skillCodes:['reflection']}]}]};
  const dashboard=()=>({assignmentId,publicToken:assignmentId,classId:'1294',className:'IC2305',sessionNumber:11,title:definition.title,
    definition,journeyCommentsEnabled:true,students:students(),blockReleases:[{blockId:block,checkpoint:1,status:'open'}],classInsights:[]});
  const live=()=>({assignmentId,generatedAt:new Date().toISOString(),students:students().map((s,i)=>({studentRef:s.studentRef,attemptId:uid(400+i),draftRevision:revision,
    draftUpdatedAt:new Date().toISOString(),draftResponses:{[item]:'A',[uid(6)]:draftText},finalResponses:{[item]:'A',[uid(6)]:draftText},submissionId:s.submissionId,sessionComment:null}))});
  const analytics=()=>({assignmentId,submittedCount:count,rosterCount:17,items:definition.blocks[0].items.map((question,i)=>({
    ...question,objective:i===0,counts:{roster:17,submitted:count,visible:count,hidden:0,unanswered:0,answered:count,graded:i===0?count:0,correct:i===0?count-2:0,incorrect:i===0?2:0},choices:[],students:[]}))});
  const server=createServer(async(req,res)=>{
    const u=new URL(req.url,'http://localhost');
    const json=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
    try{
      if(u.pathname==='/progress-log/config.js'){res.setHeader('Content-Type','text/javascript');return res.end('window.PROGRESS_LOG_CONFIG={API_BASE_URL:location.origin};');}
      if(u.pathname==='/api/auth/session')return json({ok:true,reviewer:{email:'teacher@example.test'}});
      if(u.pathname.startsWith('/api/learning/')){
        const path=u.pathname.slice('/api/learning'.length);requests.push(path);
        if(req.method!=='GET')writeCount++;
        if(path.endsWith('/events')){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store'});res.write(`event: change\ndata: ${JSON.stringify({assignmentId,revision:String(revision)})}\n\n`);streams.add(res);res.on('close',()=>streams.delete(res));return;}
        if(path.endsWith('/live-updates')){
          if(breakNextRead){
            const mode=breakNextRead;breakNextRead=false;
            if(mode==='html'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<html>Phản hồi trung gian</html>');return;}
            // Headers 200 đã về nhưng kết nối đứt giữa body: fetch thành công, json() thất bại.
            res.writeHead(200,{'Content-Type':'application/json','Content-Length':'1000'});
            res.write('{"ok":true,"update":');if(mode!=='stall')setTimeout(()=>res.destroy(),30);return;
          }
          return unavailable?json({ok:false,message:'Nguồn cập nhật tạm lỗi'},503):json({ok:true,update:{assignmentId,revision:String(revision),generatedAt:new Date().toISOString(),full:true,changes:[],dashboard:dashboard(),live:live(),analytics:analytics()}});
        }
        if(path==='/teacher/options')return json({ok:true,reviewer:{name:'Giảng viên mẫu',email:'teacher@example.test'},capabilities:{liveUpdates:true},
          classes:[{class_id:'1294',class_name:'IC2305',class_status:'on_going'},{class_id:'1252',class_name:'IC2264',class_status:'on_going'},{class_id:'1001',class_name:'Lớp cũ',class_status:'completed'}],
          assignments:[{assignment_id:assignmentId,public_token:assignmentId,class_id:'1294',class_name:'IC2305',session_number:11,title:definition.title,status:'published',live_updates_enabled:liveAllowed}]});
        if(path==='/teacher/dashboard')return json({ok:true,dashboard:dashboard()});
        if(path==='/teacher/live-drafts')return json({ok:true,live:live()});
        if(path.endsWith('/question-analytics'))return json({ok:true,analytics:analytics()});
        if(path==='/teacher/question-library')return libraryUnavailable?json({ok:false,message:'Kho câu hỏi đang lỗi'},503):json({ok:true,items:[]});
        if(path==='/teacher/journey-plan')return json({ok:true,plan:{classId:'1294',className:'IC2305',totalSessions:11,highestKnownSession:11,revision:1,testSessionNumbers:[],testSources:[],sessionDates:[]}});
        if(path.endsWith('/management'))return json({ok:true,management:{assignmentId,status:'published',revision:0,submissionWindow:{}}});
        if(path.includes('form-drafts'))return json({ok:true,drafts:[]});
        if(path==='/teacher/form-library')return json({ok:true,entries:[]});
        return json({ok:false,message:'Ngoài fixture'},404);
      }
      const file=resolve(root,'.'+u.pathname);if(!file.startsWith(resolve(root)+sep))return json({},404);
      res.setHeader('Content-Type',{'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.woff2':'font/woff2'}[extname(file)]||'application/octet-stream');res.end(await readFile(file));
    }catch{if(!res.headersSent)res.writeHead(404);res.end();}
  });
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
  page.setDefaultTimeout(8000);page.on('pageerror',error=>errors.push(error.message));
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  return {page,origin,requests,errors,get writes(){return writeCount;},advance(value){count=value;revision++;draftText='Bản mới '+value;for(const stream of streams)stream.write(`event: change\ndata: ${JSON.stringify({assignmentId,revision:String(revision)})}\n\n`);},
    fail(value){unavailable=value;if(value)for(const stream of streams)stream.destroy();},
    breakNextRead(mode='truncated'){breakNextRead=mode;},
    async close(){await context.close();await browser.close();for(const stream of streams)stream.destroy();server.closeAllConnections();await new Promise(done=>server.close(done));}};
}

test('Live: 14 → 15 bài cập nhật trong panel, giữ nháp/câu chọn; Làm mới cố định và phục hồi lỗi',{timeout:45000},async()=>{
  const f=await fixture();try{
    await f.page.goto(f.origin+'/progress-log/teacher-thuy.html#assignment='+assignmentId);
    await f.page.locator('.thuy-roster tbody tr').first().waitFor();
    await f.page.locator('[data-thuy-mode=results]').click();
    await until(async()=>(await f.page.locator('#questionAnalytics').textContent()).includes('2/14 sai'),'Baseline 2/14 sai chưa tải');
    await f.page.locator('.thuy-question-select').nth(1).click();
    await f.page.getByRole('tab',{name:'Nhận xét cá nhân',exact:true}).click();
    await f.page.locator(`[data-student="${uid(100)}"]`).click();
    const draft=f.page.locator('#draftDialog .session-comment-editor textarea');await draft.fill('Nháp giáo viên đang viết');
    f.advance(15);
    await until(async()=>(await f.page.locator('#questionAnalytics').textContent()).includes('2/15 sai'),'Thống kê vẫn cũ sau khi máy chủ nhận bài mới',2500);
    assert.equal(await draft.inputValue(),'Nháp giáo viên đang viết');assert.equal(await draft.evaluate(e=>document.activeElement===e),true);
    assert.match(await f.page.locator('#draftAnswers').innerText(),/Bản mới 15/);
    assert.match(await f.page.locator('.thuy-question-detail').textContent(),/Điều em đã học/);
    await f.page.locator('#refreshDashboardButton').click();
    assert.equal(await f.page.locator('#draftDialog').isVisible(),true);
    assert.equal(await draft.inputValue(),'Nháp giáo viên đang viết');
    await f.page.evaluate(()=>scrollTo(0,1000));
    const rect=await f.page.locator('#refreshDashboardButton').boundingBox();assert.ok(rect.y>=0&&rect.y+rect.height<=60,'Nút phải giữ ở header');
    f.fail(true);await f.page.locator('#refreshDashboardButton').click();
    await until(async()=>['offline','partial','reconnecting'].includes(await f.page.locator('#teacherConnectionStatus').getAttribute('data-state')),'Không báo lỗi cập nhật');
    assert.match(await f.page.locator('#questionAnalytics').textContent(),/2\/15 sai/);
    assert.equal(await draft.inputValue(),'Nháp giáo viên đang viết');
    f.fail(false);f.advance(16);await f.page.locator('#refreshDashboardButton').click();
    await until(async()=>(await f.page.locator('#questionAnalytics').textContent()).includes('2/16 sai'),'Làm mới không phục hồi số liệu');
    assert.equal(f.writes,0);assert.deepEqual(f.errors,[]);
    if(process.env.THUY_EVIDENCE_DIR){await mkdir(process.env.THUY_EVIDENCE_DIR,{recursive:true});await f.page.evaluate(()=>scrollTo(0,0));await f.page.screenshot({path:resolve(process.env.THUY_EVIDENCE_DIR,'live-panel.png'),fullPage:true});}
  }finally{await f.close();}
});

// Ngân sách bao trùm khởi động/dọn Chrome; deadline đọc 15s và cửa sổ phục hồi 5s bên dưới giữ nguyên.
for(const mode of ['truncated','html'])test(`Phản hồi 200 lỗi ${mode}: giữ số cũ/nháp và tự đọc lại, không báo mã 200`,{timeout:90000},async()=>{
  const f=await fixture();try{
    await f.page.goto(f.origin+'/progress-log/teacher.html#assignment='+assignmentId);
    await f.page.locator('.thuy-roster tbody tr').first().waitFor();
    await f.page.locator('[data-thuy-mode=results]').click();
    await until(async()=>(await f.page.locator('#questionAnalytics').textContent()).includes('2/14 sai'),'Chưa có baseline');
    await f.page.getByRole('tab',{name:'Nhận xét cá nhân',exact:true}).click();
    await f.page.locator(`[data-student="${uid(100)}"]`).click();
    const comment=f.page.locator('#draftDialog .session-comment-editor textarea');
    await comment.fill('Nháp giữ qua lần đọc gián đoạn');
    f.breakNextRead(mode);f.advance(15);
    await until(async()=>(await f.page.locator('#teacherConnectionStatus').getAttribute('data-state'))==='partial','Không thấy lỗi body bị đứt');
    assert.match(await f.page.locator('#questionAnalytics').textContent(),/2\/14 sai/,'Chưa được áp dụng số liệu từ body lỗi');
    assert.doesNotMatch(await f.page.locator('#teacherConnectionStatus').getAttribute('title'),/mã 200/,'HTTP thành công không phải nguyên nhân đọc thất bại');
    await until(async()=>(await f.page.locator('#questionAnalytics').textContent()).includes('2/15 sai'),'Không tự đọc lại sau lỗi body trong khi SSE vẫn mở',5000);
    assert.equal(await comment.inputValue(),'Nháp giữ qua lần đọc gián đoạn');
    assert.equal(await f.page.locator('#draftDialog').isVisible(),true);
    assert.equal(f.writes,0);assert.deepEqual(f.errors,[]);
  }finally{await f.close();}
});

test('Body 200 treo quá 15 giây: phân biệt timeout và tự phục hồi, không kẹt cập nhật',{timeout:90000},async()=>{
  const f=await fixture();try{
    await f.page.goto(f.origin+'/progress-log/teacher.html#assignment='+assignmentId);
    await f.page.locator('.thuy-roster tbody tr').first().waitFor();
    f.breakNextRead('stall');f.advance(15);
    await until(async()=>(await f.page.locator('#teacherConnectionStatus').getAttribute('data-error-code'))==='READ_TIMEOUT','Không xác định được timeout khi body treo',19000);
    assert.match(await f.page.locator('#teacherConnectionStatus').getAttribute('title'),/Đọc dữ liệu quá lâu/);
    await until(async()=>(await f.page.locator('#teacherConnectionStatus').getAttribute('data-state'))==='connected','Timeout không tự phục hồi',5000);
    assert.equal(await f.page.locator('#teacherConnectionStatus').getAttribute('data-error-code'),null);
    assert.equal(f.writes,0);assert.deepEqual(f.errors,[]);
  }finally{await f.close();}
});

test('Lớp ngoài đợt thí điểm giữ đường đọc hiện hành và nút Làm mới, không mở SSE',{timeout:90000},async()=>{
  const f=await fixture({liveAllowed:false});try{
    await f.page.goto(f.origin+'/progress-log/teacher.html#assignment='+assignmentId);
    await f.page.locator('.thuy-roster tbody tr').first().waitFor();
    assert.ok(f.requests.includes('/teacher/dashboard'));
    assert.ok(!f.requests.some(path=>path.endsWith('/events')||path.endsWith('/live-updates')));
    const before=f.requests.filter(path=>path==='/teacher/dashboard').length;
    await f.page.locator('#refreshDashboardButton').click();
    await until(()=>f.requests.filter(path=>path==='/teacher/dashboard').length>before,'Làm mới vẫn phải dùng được ngoài pilot');
    assert.equal(f.writes,0);assert.deepEqual(f.errors,[]);
  }finally{await f.close();}
});

test('Cổng chung: vào danh sách đúng quyền, không đợi kho câu hỏi; lớp chưa có phiếu vẫn mở được',{timeout:30000},async()=>{
  const f=await fixture({libraryUnavailable:true});try{
    await f.page.goto(f.origin+'/progress-log/teacher.html');
    await f.page.locator('#teacherClassPortal .thuy-class-card').first().waitFor();
    assert.equal(await f.page.locator('.thuy-class-card').count(),2);
    assert.ok(f.page.url().endsWith('/teacher.html'));assert.ok(!f.requests.includes('/teacher/question-library'));
    await f.page.getByRole('button',{name:'Lịch sử (1)',exact:true}).click();assert.equal(await f.page.locator('.thuy-class-card').count(),1);
    await f.page.getByRole('button',{name:'Đang học (2)',exact:true}).click();
    await f.page.locator('.thuy-class-card').filter({hasText:'IC2264'}).click();
    await f.page.getByText('Chưa có phiếu để theo dõi',{exact:true}).waitFor();
    await f.page.locator('.thuy-side').getByRole('button',{name:'Quản lý lớp',exact:true}).click();
    await f.page.locator('.thuy-class-card').filter({hasText:'IC2305'}).click();await f.page.locator('.thuy-roster tbody tr').first().waitFor();
    assert.ok(f.page.url().includes('#assignment='+assignmentId));
    await f.page.reload();await f.page.locator('.thuy-roster tbody tr').first().waitFor();
    assert.equal(f.writes,0);assert.deepEqual(f.errors,[]);
    if(process.env.THUY_EVIDENCE_DIR){await f.page.setViewportSize({width:390,height:844});await f.page.screenshot({path:resolve(process.env.THUY_EVIDENCE_DIR,'live-mobile.png'),fullPage:true});}
  }finally{await f.close();}
});
