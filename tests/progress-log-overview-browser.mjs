// Nhận source hiện tại và DTO giả đúng cấu trúc; kiểm giao diện trên trình duyệt Chrome sạch.
// Toàn bộ API/Google được chặn hoặc trả fixture. Không ghi lớp thật, roster hoặc điểm danh Portal.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
const runtime=process.env.PLAYWRIGHT_PACKAGE||'C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json';
const {chromium}=createRequire(runtime)('playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
const studentRef='21000000-0000-4000-8000-000000000003';
const student2='21000000-0000-4000-8000-000000000004';
const plan={classId:'1294',className:'IC2305 · Lớp giả',highestKnownSession:0,totalSessions:31,
  testSessionNumbers:[16,31],testSources:[],sessionDates:[],revision:0};
const schedule={classId:'1294',fingerprint:'a'.repeat(64),assignmentSessionNumbers:[],
  sessions:Array.from({length:31},(_,i)=>({erpSessionId:String(100+i),erpSessionNumber:i+1,numberSource:'proposal',proposalEligible:true,
    date:new Date(Date.UTC(2026,9,1+i*3)).toISOString().slice(0,10),status:1}))};
function overview(classId='1294') {
  const sessions=schedule.sessions.map((s,i)=>({sessionNumber:i+1,sessionDate:s.date,sessionKind:[16,31].includes(i+1)?'test':'lesson',assignments:[]}));
  const students=[studentRef,student2].map((ref,index)=>({studentRef:ref,name:'Học viên trùng tên · Nội dung tiếng Việt dài để kiểm bố cục',
    discriminator:'Học viên '+(index+1),current:true,completeCount:0,cells:sessions.map(s=>({sessionNumber:s.sessionNumber,
      assignmentId:null,status:s.sessionKind==='test'?'test_pending':'no_assignment',testResult:null}))}));
  return {classId,className:classId==='1294'?'IC2305 · Lớp giả':'Lớp mới chưa có phiếu',totalSessions:31,
    sessions,students,counts:{students:2,currentStudents:2,assignments:0,complete:0},testCoverage:'not_mapped'};
}

test('E01/E02/O01/O04: Hành trình lớp, lịch ERP và chi tiết trên 390/768/1440 px; API cũ không đổi lớp', {timeout:60000},async()=>{
  const server=createServer(async(req,res)=>{
    try {
      const name=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
      if(!name.startsWith(resolve(root)+sep)) {res.writeHead(403);res.end();return;}
      const body=await readFile(name);
      res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'}[extname(name)]||'application/octet-stream'));
      res.end(body);
    } catch {res.writeHead(404);res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const errors=[],external=[],calls=[];
  let releaseOld=null,delayOld=false,failSchedule=false,conflictPlan=false,latestRevision=0;
  try {
    const context=await browser.newContext();
    const page=await context.newPage();page.setDefaultTimeout(5000);
    page.on('pageerror',error=>errors.push(error.message));
    await context.route('**/*',async route=>{
      const req=route.request(),url=new URL(req.url());
      const json=body=>route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':base,
        'access-control-allow-credentials':'true'},body:JSON.stringify(body)});
      if(url.origin===base) return route.continue();
      if(url.hostname==='accounts.google.com') return route.fulfill({contentType:'text/javascript',body:''});
      if(url.hostname!=='ducizone.ddns.net') {external.push(req.url());return route.abort();}
      if(req.method()==='OPTIONS') return route.fulfill({status:204,headers:{'access-control-allow-origin':base,
        'access-control-allow-credentials':'true','access-control-allow-headers':'x-izone-csrf,content-type','access-control-allow-methods':'GET,PUT,POST,DELETE'}});
      calls.push({path:url.pathname,method:req.method(),query:url.search});
      if(url.pathname.endsWith('/api/auth/session')) return json({ok:true,reviewer:{email:'teacher@example.test'}});
      if(url.pathname.endsWith('/teacher/options')) return json({ok:true,reviewer:{name:'Giảng viên thử'},
        classes:[{class_id:'1294',class_name:'IC2305 · Lớp giả'},{class_id:'2139',class_name:'Lớp mới chưa có phiếu'}],assignments:[]});
      if(url.pathname.endsWith('/teacher/question-library')) return json({ok:true,items:[]});
      if(url.pathname.includes('/teacher/form-drafts'))return json({ok:true,drafts:[]});
      if(url.pathname.endsWith('/journey-plan')) {
        if(req.method()==='PUT') {
          if(conflictPlan){latestRevision=2;return route.fulfill({status:409,contentType:'application/json',headers:{'access-control-allow-origin':base,'access-control-allow-credentials':'true'},body:JSON.stringify({ok:false,message:'Kế hoạch đã đổi'})});}
          return json({ok:true,plan:{...plan,...req.postDataJSON(),revision:latestRevision+1}});
        }
        return json({ok:true,plan:{...plan,revision:latestRevision,classId:url.searchParams.get('classId')}});
      }
      if(url.pathname.endsWith('/erp-schedule')) {
        if(failSchedule)return route.abort();
        return json({ok:true,schedule:{...schedule,classId:url.searchParams.get('classId')||'1294'}});
      }
      if(url.pathname.endsWith('/overview')) {
        const classId=url.pathname.split('/').at(-2);
        if(delayOld&&classId==='1294') await new Promise(resolve=>{releaseOld=resolve;});
        return json({ok:true,overview:overview(classId)});
      }
      if(url.pathname.includes('/sessions/')) return json({ok:true,detail:{classId:'1294',sessionNumber:16,
        student:{studentRef,name:'Học viên thử'},status:'test_result',responses:{},gradingItems:[],
        testResult:{title:'Term Test',reading:{correct:28,total:40},writing:{status:'pending',score:null}},testCoverage:'connected'}});
      external.push(req.url());return route.abort();
    });
    await page.goto(base+'/progress-log/teacher.html');
    await page.locator('#teacherWorkspace').waitFor({state:'visible'});
    await page.getByRole('button',{name:'Hành trình lớp',exact:true}).click();
    await page.locator('#overviewStatus').filter({hasText:'IC2305'}).waitFor();
    assert.equal(await page.locator('.overview-table tbody tr').count(),2);
    assert.equal(await page.locator('.overview-table tbody td').count(),62);
    assert.equal(await page.locator('.overview-table th').filter({hasText:'Buổi 31'}).count(),1);
    await page.locator('#journeyPlanDatesDetails summary').click();
    await page.locator('#journeyErpScheduleStatus').filter({hasText:'Đã đọc 31'}).waitFor();
    assert.equal(await page.locator('#journeyPlanDates select').count(),31);
    assert.equal(await page.locator('#journeyPlanDates input[type=date]').count(),0);
    const text=await page.locator('#journeyPlanDates').innerText();
    assert.match(text,/T5 01\/10\/2026/u);assert.doesNotMatch(text,/18:30|dòng 100/u);
    assert.equal(calls.filter(c=>c.method==='PUT').length,0);
    const reads=calls.filter(c=>c.path.endsWith('/erp-schedule')).length;
    await page.getByRole('button',{name:'Đọc lại lịch học của lớp',exact:true}).click();
    await page.waitForFunction(()=>document.getElementById('loadJourneyErpScheduleButton').disabled===false);
    assert.equal(calls.filter(c=>c.path.endsWith('/erp-schedule')).length,reads+1);
    await mkdir(resolve(root,'output/playwright'),{recursive:true});
    for(const width of [390,768,1440]) {
      await page.setViewportSize({width,height:900});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Tràn ngang '+width);
      assert.equal(await page.locator('.overview-mobile-list').isVisible(),width===390);
      await page.screenshot({path:resolve(root,'output/playwright/progress-overview-'+width+'.png'),fullPage:true});
    }
    await page.locator('.overview-table tbody tr').first().getByRole('button',{name:/Buổi 16/}).click();
    await page.locator('#journeyDetailContent').filter({hasText:'Writing: đã nộp, đang chờ điểm'}).waitFor();
    assert.match(await page.locator('#journeyDetailContent').innerText(),/Reading: 28\/40/u);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#journeyDetailDialog').isVisible(),false);
    delayOld=true;
    await page.getByRole('button',{name:'Làm mới hành trình',exact:true}).click();
    await page.waitForFunction(()=>document.getElementById('courseOverview').getAttribute('aria-busy')==='true');
    await page.locator('#overviewClassSelect').selectOption('2139');
    await page.locator('#overviewStatus').filter({hasText:'Lớp mới chưa có phiếu'}).waitFor();
    releaseOld?.();
    await page.waitForTimeout(100);
    assert.match(await page.locator('#overviewStatus').innerText(),/Lớp mới chưa có phiếu/u);
    delayOld=false;
    await page.locator('#overviewClassSelect').selectOption('1294');
    await page.locator('#journeyPlanStatus').filter({hasText:'khôi phục'}).waitFor();
    assert.equal(await page.locator('#journeyPlanDates select').last().inputValue(),'130');
    failSchedule=true;await page.getByRole('button',{name:'Đọc lại lịch học của lớp',exact:true}).click();
    await page.locator('#journeyErpScheduleStatus').filter({hasText:'Bản chỉnh vẫn được giữ'}).waitFor();
    assert.equal(await page.locator('#journeyPlanDates select').last().inputValue(),'130');
    failSchedule=false;await page.getByRole('button',{name:'Đọc lại lịch học của lớp',exact:true}).click();
    await page.locator('#journeyErpScheduleStatus').filter({hasText:'Đã đọc 31'}).waitFor();
    conflictPlan=true;await page.locator('#saveJourneyPlanButton').click();
    await page.getByText('Đối chiếu kế hoạch mới nhất',{exact:true}).waitFor();
    assert.equal(await page.locator('#journeyPlanDates select').last().inputValue(),'130');
    page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Giữ phần chỉnh để xác nhận lại',exact:true}).click();
    await page.locator('#journeyErpScheduleStatus').filter({hasText:'Đã đọc 31'}).waitFor();
    conflictPlan=false;await page.locator('#saveJourneyPlanButton').click();
    await page.locator('#journeyPlanStatus').filter({hasText:'sửa lần 3'}).waitFor();
    assert.equal(errors.length,0,errors.join('\n'));assert.deepEqual(external,[]);
  } finally {releaseOld?.();await browser.close();await new Promise(resolve=>server.close(resolve));}
});
