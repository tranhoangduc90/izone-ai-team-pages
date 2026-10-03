// Kiểm thống kê bằng số kỳ vọng độc lập và thao tác Chrome thật; toàn bộ API là fixture.
// Bảo vệ: không đếm câu mở là sai, không gắn thiếu bài cho 31 buổi, không gửi dữ liệu vận hành.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import {demoCourse} from '../progress-log/reference-preview/fixture.js';
import {summarizeClass,sessionLabel} from '../progress-log/reference-preview/analytics.js';
const runtime=process.env.PLAYWRIGHT_PACKAGE||'C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json';
const {chromium}=createRequire(runtime)('playwright');
const root=fileURLToPath(new URL('../',import.meta.url));

test('Preview: xếp số học viên sai, mẫu số và câu không chấm độc lập',()=>{
  const result=summarizeClass(demoCourse,5);
  assert.deepEqual(result.questions.map(q=>q.counts.incorrect),[2,1,1]);
  assert.equal(result.questions[0].position,1);
  assert.equal(result.totals.correct,8);assert.equal(result.totals.incorrect,4);
  assert.equal(result.totals.ungraded,4);assert.equal(result.totals.submitted,4);
  assert.equal(result.students.find(s=>s.studentRef==='demo-student-0').incorrect,1);
  assert.equal(result.students.find(s=>s.studentRef==='demo-student-0').correct,2);
  const blank=summarizeClass(demoCourse,31);
  assert.equal(blank.graded,0);assert.equal(blank.totals.incorrect,0);
  assert.equal(sessionLabel({status:'no_assignment'}),'Chưa tạo Progress Log');
  assert.equal(sessionLabel({status:'test_pending'}),'Buổi Test · chưa có kết quả');
});

test('Preview: input trùng, ẩn và chờ chấm không tạo thêm người sai',()=>{
  const copy=structuredClone(demoCourse);
  copy.assignments=copy.assignments.slice(-1);
  const item=copy.assignments[0].analytics.items[0];
  item.students=item.students.slice(0,3);item.students[0].verdict='pending';
  item.counts={...item.counts,correct:2,incorrect:0,pending:1,graded:2,hidden:1,visible:3};item.errorRate=0;
  const result=summarizeClass(copy,5);
  assert.equal(result.students.find(s=>s.studentRef==='demo-student-0').pending,1);
  assert.equal(result.students.find(s=>s.studentRef==='demo-student-3').graded,2,'Người ở câu ẩn không có điểm câu đó');
  item.students.push(item.students[0]);assert.throws(()=>summarizeClass(copy,5),/đếm hai lần/);
  const duplicate=structuredClone(demoCourse);duplicate.assignments.push(duplicate.assignments[0]);
  assert.throws(()=>summarizeClass(duplicate),/trùng phiếu/);
});

test('Preview Chrome: bảng, drilldown, 31 buổi và quyền chỉ đọc trên 390/768/1440',{timeout:90000},async()=>{
  const server=createServer(async(req,res)=>{
    try{
      const pathname=new URL(req.url,'http://localhost').pathname;
      const name=resolve(root,'.'+decodeURIComponent(pathname)+(pathname.endsWith('/')?'index.html':''));
      if(!name.startsWith(resolve(root)+sep)){res.writeHead(403);res.end();return;}
      const body=await readFile(name);res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'}[extname(name)]||'application/octet-stream'));res.end(body);
    }catch{res.writeHead(404);res.end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const errors=[],requests=[];
  try{
    const context=await browser.newContext();
    let deny=false,holdOverview=false,delayResolve=null;
    await context.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url());
      if(url.origin===base)return route.continue();
      if(url.hostname==='accounts.google.com')return route.fulfill({contentType:'text/javascript',body:''});
      requests.push({method:request.method(),path:url.pathname});
      const json=body=>route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':base,'access-control-allow-credentials':'true'},body:JSON.stringify(body)});
      if(url.pathname.endsWith('/auth/session'))return json({ok:true,reviewer:{name:'Giảng viên giả'}});
      if(url.pathname.endsWith('/teacher/options'))return json({ok:true,classes:[{class_id:'1294',class_name:'IC2305'}],assignments:demoCourse.assignments.map(a=>({assignment_id:a.id,class_id:'1294',session_number:a.sessionNumber,title:a.title,status:a.status}))});
      if(url.pathname.endsWith('/overview')){
        if(holdOverview)await new Promise(r=>{delayResolve=r;});
        if(deny)return route.fulfill({status:403,contentType:'application/json',headers:{'access-control-allow-origin':base,'access-control-allow-credentials':'true'},body:JSON.stringify({ok:false,message:'Không có quyền xem lớp.'})});
        return json({ok:true,overview:{...demoCourse.overview,classId:'1294',className:'IC2305'}});
      }
      if(url.pathname.endsWith('/question-analytics')){
        const id=url.pathname.split('/').at(-2);return json({ok:true,analytics:demoCourse.assignments.find(a=>a.id===id).analytics});
      }
      if(url.pathname.endsWith('/dashboard')){
        const a=demoCourse.assignments.find(a=>a.id===url.searchParams.get('assignment'));
        return json({ok:true,dashboard:{assignmentId:a.id,definition:{blocks:a.blocks},blockReleases:a.releases}});
      }
      throw new Error('Request ngoài hợp đồng: '+url.pathname);
    });
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/progress-log/reference-preview/');
    for(const width of [390,768,1440]){
      await page.setViewportSize({width,height:900});
      await page.getByRole('button',{name:'Theo dõi lớp',exact:true}).click();
      assert.equal(await page.locator('.previewQuestionButton').count(),3);
      await page.locator('.previewQuestionButton').first().click();
      await page.locator('#detailDialog[open]').waitFor();assert.match(await page.locator('#detailContent').innerText(),/2\/4 học viên sai/);
      await page.keyboard.press('Escape');assert.equal(await page.locator('#detailDialog').getAttribute('open'),null);
      await page.getByRole('button',{name:'Đúng / sai từng học viên',exact:true}).click();
      assert.equal(await page.locator('.previewTable tbody tr').count(),4);
      await page.locator('#sessionSelect').selectOption('31');
      assert.match(await page.locator('.previewTable tbody').innerText(),/0/);
      await page.getByRole('button',{name:'Hành trình lớp',exact:true}).click();
      assert.equal(await page.locator('.previewTable th').count(),32);
      assert.equal(await page.locator('.previewCell').filter({hasText:'Chưa tạo Progress Log'}).count(),100);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Không tràn trang ngang');
      await page.getByRole('button',{name:'Học viên',exact:true}).click();
      assert.equal(await page.locator('.previewSessionCard').count(),31);
      await page.locator('[data-session-detail="1"]').click();
      assert.match(await page.locator('#detailContent').innerText(),/không được coi là thiếu bài hoặc vắng học/);
      await page.keyboard.press('Escape');
      await page.getByRole('button',{name:'Giáo viên',exact:true}).click();
      await page.locator('#sessionSelect').selectOption('5');
    }
    assert.equal(requests.length,0,'Mở minh họa không đọc lớp thật');
    await page.getByRole('button',{name:'Dữ liệu lớp của tôi',exact:true}).click();
    await page.locator('#notice').filter({hasText:'Đã đọc 4 phiếu'}).waitFor();
    assert.equal(await page.locator('#classSelect').inputValue(),'1294');
    assert.ok(requests.every(r=>r.method==='GET'),'Bản xem thử không có request ghi nghiệp vụ');
    // Đổi chế độ khi request của lớp thật còn bay: phản hồi cũ không được mở lại tên/bài.
    holdOverview=true;
    const pending=page.waitForRequest(req=>req.url().endsWith('/overview'));
    await page.getByRole('button',{name:'Đọc lại dữ liệu',exact:true}).click();await pending;
    await page.getByRole('button',{name:'Dùng dữ liệu minh họa',exact:true}).click();
    holdOverview=false;delayResolve?.();await page.waitForTimeout(100);
    assert.equal(await page.locator('#classSelect').inputValue(),'demo');
    assert.equal(await page.locator('#sourceLabel').textContent(),'DỮ LIỆU MINH HỌA');
    await page.getByRole('button',{name:'Dữ liệu lớp của tôi',exact:true}).click();
    await page.locator('#notice').filter({hasText:'Đã đọc 4 phiếu'}).waitFor();
    deny=true;
    await page.getByRole('button',{name:'Đọc lại dữ liệu',exact:true}).click();
    await page.locator('#notice').filter({hasText:'Không có quyền'}).waitFor();
    assert.equal(await page.locator('.previewTable').count(),0,'Hết quyền phải xóa dữ liệu lớp');
    assert.deepEqual(errors,[]);
    await context.close();
  }finally{await browser.close();await new Promise(r=>server.close(r));}
});
