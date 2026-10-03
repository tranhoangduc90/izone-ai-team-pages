// Kiểm các thiếu sót Đức đã chỉ ra bằng Chrome: tên nội dung và toàn bộ bài đã nộp.
// API là dữ liệu giả; chạy cùng test trên route cũ để giữ bằng chứng RED trước khi sửa.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
const {chromium}=createRequire(process.env.PLAYWRIGHT_PACKAGE||'C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const root=process.env.PREVIEW_ROOT||fileURLToPath(new URL('../',import.meta.url));
const routePath=process.env.PREVIEW_ROUTE||'reference-preview-v2';
async function harness(run,{beforeLoad,timezoneId}={}){
  const server=createServer(async(req,res)=>{
    try{const pathname=new URL(req.url,'http://localhost').pathname;
      const name=resolve(root,'.'+decodeURIComponent(pathname)+(pathname.endsWith('/')?'index.html':''));
      if(!name.startsWith(resolve(root)+sep)){res.writeHead(403);res.end();return;}
      res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'}[extname(name)]||'application/octet-stream'));res.end(await readFile(name));
    }catch{res.writeHead(404);res.end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{const page=await browser.newPage({viewport:{width:1440,height:900},timezoneId});
    if(beforeLoad)await beforeLoad(page);
    await page.route('https://accounts.google.com/**',r=>r.fulfill({body:''}));
    await page.goto('http://127.0.0.1:'+server.address().port+'/progress-log/'+routePath+'/');
    await page.getByRole('button',{name:'Học viên',exact:true}).click();
    await run(page);
  }finally{await browser.close();await new Promise(r=>server.close(r));}
}
test('V2 regression: thẻ buổi có tên nội dung theo mẫu',()=>harness(async page=>{
  const card=page.locator('[data-session-detail="3"]');
  assert.match(await card.innerText(),/Reading 3 \+ Writing 1/);
  assert.match(await card.innerText(),/BUỔI 03/);
  assert.equal(await card.locator('.studentSessionTop').count(),1);
}));
test('V2 regression: click buổi mở toàn bộ câu hỏi, câu trả lời và kết quả',()=>harness(async page=>{
  await page.locator('[data-session-detail="3"]').click();
  assert.equal(await page.locator('.studentDetailHeader h1').count(),1);
  assert.match(await page.locator('.studentDetailHeader h1').innerText(),/Reading 3 \+ Writing 1/);
  assert.equal(await page.locator('[data-review-item]').count(),8);
  assert.match((await page.locator('.studentAnswerReview').allTextContents()).join('\n'),/Lựa chọn của em/);
  assert.match((await page.locator('.studentAnswerReview').allTextContents()).join('\n'),/Đúng/);
  assert.match((await page.locator('.studentAnswerReview').allTextContents()).join('\n'),/Sai/);
  assert.match((await page.locator('.studentAnswerReview').allTextContents()).join('\n'),/Chưa chấm đúng\/sai/);
}));
export {harness};

test('V2 Chrome: responsive, đồng hồ, full bài thật giả lập, retry và context/quyền',{timeout:90000},()=>harness(async page=>{
  const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
  for(const width of [390,768,1440]){
    await page.setViewportSize({width,height:900});
    assert.equal(await page.locator('.studentSessionCard').count(),31);
    await page.locator('[data-clock="18:24"]').click();
    assert.match(await page.locator('[data-session-detail="7"]').innerText(),/Chưa đến buổi học/);
    await page.locator('[data-clock="18:25"]').click();
    assert.match(await page.locator('[data-session-detail="7"]').innerText(),/Nhấn để học buổi hôm nay/);
    assert.match(await page.locator('[data-session-detail="8"]').innerText(),/Chưa đến buổi học/);
    assert.match(await page.locator('[data-session-detail="3"]').innerText(),/Đã hoàn thành/);
    await page.locator('[data-session-detail="5"]').click();
    assert.equal(await page.locator('[data-review-item]').count(),10);
    assert.equal(await page.locator('.reviewBlank').count(),2);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.locator('[data-back-journey]').click();
    await page.getByRole('button',{name:'Giáo viên',exact:true}).click();
    await page.getByRole('button',{name:'Theo dõi lớp',exact:true}).click();
    await page.locator('#sessionSelect').selectOption('3');
    assert.match(await page.locator('.teacherSessionBar h1').innerText(),/Reading 3 \+ Writing 1/);
    assert.match(await page.locator('#sessionSelect option:checked').innerText(),/Reading 3 \+ Writing 1/);
    assert.ok((await page.locator('.previewQuestionButton .teacherEyebrow').allTextContents()).every(t=>t.includes('Reading 3 + Writing 1')));
    await page.locator('.previewQuestionButton').first().click();
    assert.match(await page.locator('#detailContent').innerText(),/Reading 3 \+ Writing 1/);await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Hành trình lớp',exact:true}).click();
    assert.match(await page.locator('.previewTable th').nth(3).innerText(),/Reading 3 \+ Writing 1/);
    await page.getByRole('button',{name:'Học viên',exact:true}).click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  const {demoCourse,demoDetail}=await import('../progress-log/reference-preview-v2/fixture.js');
  const base=new URL(page.url()).origin;let mismatch=false,deny=false,hold=false,release;
  await page.route('**/mapping-api/**',async route=>{
    const request=route.request(),url=new URL(request.url());requests.push({method:request.method(),path:url.pathname});
    const json=body=>route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':base,'access-control-allow-credentials':'true'},body:JSON.stringify(body)});
    if(url.pathname.endsWith('/auth/session'))return json({ok:true,reviewer:{name:'Giảng viên giả'}});
    if(url.pathname.endsWith('/teacher/options'))return json({ok:true,classes:[{class_id:'1294',class_name:'IC2305'}],assignments:demoCourse.assignments.map(a=>({assignment_id:a.id,class_id:'1294',session_number:a.sessionNumber,title:a.title,status:a.status,public_token:'fake-token-'+a.sessionNumber}))});
    if(url.pathname.endsWith('/overview'))return json({ok:true,overview:{...demoCourse.overview,classId:'1294',className:'IC2305'}});
    if(url.pathname.endsWith('/question-analytics'))return json({ok:true,analytics:demoCourse.assignments.find(a=>a.id===url.pathname.split('/').at(-2)).analytics});
    if(url.pathname.endsWith('/dashboard')){const a=demoCourse.assignments.find(a=>a.id===url.searchParams.get('assignment'));return json({ok:true,dashboard:{assignmentId:a.id,definition:{blocks:a.blocks},blockReleases:a.releases}});}
    if(url.pathname.includes('/students/')){
      if(hold)await new Promise(r=>{release=r;});
      if(deny)return route.fulfill({status:403,contentType:'application/json',headers:{'access-control-allow-origin':base,'access-control-allow-credentials':'true'},body:JSON.stringify({ok:false,message:'Không có quyền xem bài.'})});
      const number=Number(url.pathname.split('/sessions/')[1].split('/')[0]),ref=decodeURIComponent(url.pathname.split('/students/')[1]);
      const detail={...demoDetail(ref,number),classId:'1294'};if(mismatch)detail.student={...detail.student,studentRef:'different-person'};
      return json({ok:true,detail});
    }
    throw new Error('Request ngoài hợp đồng: '+url.pathname);
  });
  assert.equal(requests.length,0);
  await page.getByRole('button',{name:'Dữ liệu lớp của tôi',exact:true}).click();
  await page.locator('#notice').filter({hasText:'Đã đọc 6 phiếu'}).waitFor();
  assert.equal(await page.locator('.previewClock').count(),0,'Đồng hồ thử chỉ ở minh họa');
  await page.clock.setFixedTime(new Date(demoCourse.overview.sessions.find(s=>s.sessionNumber===7).sessionDate+'T18:25:00+07:00'));
  await page.getByRole('button',{name:'Học viên',exact:true}).click();
  assert.match(await page.locator('[data-session-detail="7"]').getAttribute('href'),/\#assignment=fake-token-7$/);
  assert.equal(await page.locator('[data-session-detail="8"]').getAttribute('href'),null);
  mismatch=true;await page.locator('[data-session-detail="3"]').click();
  await page.getByRole('alert').filter({hasText:'không khớp'}).waitFor();assert.equal(await page.locator('[data-review-item]').count(),0);
  mismatch=false;await page.locator('[data-retry-detail]').click();await page.locator('[data-review-item]').first().waitFor();
  assert.equal(await page.locator('[data-review-item]').count(),8);
  assert.equal(await page.locator('.reviewLearnLink').count(),0,'Bài đã nộp không mở attempt mới');
  await page.locator('[data-back-journey]').click();
  hold=true;const pending=page.waitForRequest(r=>r.url().includes('/sessions/5/students/'));
  await page.locator('[data-session-detail="5"]').click();await pending;
  assert.match(await page.locator('.previewEmpty').innerText(),/Đang đọc đầy đủ/);
  await page.locator('[data-back-journey]').click();await page.locator('#studentSelect').selectOption('demo-student-1');
  hold=false;release?.();await page.waitForTimeout(80);
  assert.equal(await page.locator('[data-review-item]').count(),0);
  await page.locator('[data-session-detail="3"]').click();await page.locator('[data-review-item]').first().waitFor();
  assert.match(await page.locator('.reviewPerson').innerText(),/Đức/);
  await page.locator('[data-back-journey]').click();deny=true;
  await page.locator('[data-session-detail="3"]').click();
  await page.locator('#access:not([hidden])').waitFor();assert.equal(await page.locator('[data-review-item]').count(),0);
  assert.equal(await page.locator('.studentSessionCard').count(),0);
  assert.ok(requests.every(r=>r.method==='GET'),'Không có POST ghi bài/điểm danh');
  assert.deepEqual(errors,[]);
}));

test('V2 Chrome lifecycle: tự đổi tại18:25 dù trình duyệt ở múi giờ Mỹ',{timeout:30000},()=>harness(async page=>{
  await page.clock.pauseAt(new Date('2026-10-03T11:24:59Z'));
  assert.match(await page.locator('[data-session-detail="7"]').innerText(),/Chưa đến buổi học/);
  await page.clock.runFor(1021);
  assert.match(await page.locator('[data-session-detail="7"]').innerText(),/Nhấn để học buổi hôm nay/);
  assert.match(await page.locator('[data-session-detail="8"]').innerText(),/Chưa đến buổi học/);
},{timezoneId:'America/New_York',beforeLoad:page=>page.clock.install({time:new Date('2026-10-03T11:20:00Z')})}));
