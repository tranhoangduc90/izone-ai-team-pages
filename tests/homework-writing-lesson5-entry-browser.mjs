import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { serveDirectory } from './fixtures/static-ui-server.mjs';
import { createState } from '../writing-handouts/lesson5-demo/core.mjs';

const {chromium}=createRequire(resolve(process.env.USERPROFILE,
  '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'))('playwright');
const assignmentId='hw-k67-writing-lesson5-1234';
const documentId='fixture-lesson5-docs-000001';
const studentRef='7cfd324f-4ed9-4d16-ac61-61bfdf214f37';
const ref='29fa15e6-2fbf-40ed-9879-ea16bbe559ec';
const classRef='IC9999';
const lesson={activity:'lesson5',number:5,body:2,title:'Mua sắm không cần thiết',topic:'Writing fixture prompt.',classes:[classRef],ideaHint:'Chọn tác hại.'};
const person={role:'student',id:'fixture-owner',classId:'1234',label:'Học viên thử'};
const identity={ownerId:studentRef,courseId:person.classId,erpId:'201',name:person.label,className:classRef};
const assignment={id:assignmentId,classId:person.classId,title:'Lesson 5 · Mua sắm không cần thiết',question:lesson.topic,
  writingPart:'body',bodyIndex:2,experience:'lesson5-consumerism-body-v1',approvedOutlineRequired:true,taskType:'task_2'};
const nativeToken='writing5-fixture-token';
const token='B'.repeat(43);

test('Lesson 5 link chung mở đúng bài đã xác minh, đạt X2 rồi tự sang viết, panel chỉ dùng nút Đóng dàn ý',async t=>{
  const local=await serveDirectory(resolve(import.meta.dirname,'..'));
  const site=local.origin;
  const browser=await chromium.launch({channel:'chrome',headless:true});
  t.after(async()=>{await browser.close();await local.close();});
  const page=await browser.newPage({viewport:{width:390,height:850},hasTouch:true});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  page.setDefaultTimeout(9000);
  const student={studentRef,displayName:person.label};
  const classes=[{classRef,className:classRef,students:[student]}];
  const state={...createState(0,lesson),ref,activity:'lesson5',classRef,studentRef,idea2Open:true,version:45,
    vocabulary:{},teacherComments:[],lesson5IdeaSource:{fields:['idea1','idea2'],status:'checked',sourceVersion:12}};
  Object.assign(state.responses,{idea1:'Thâm hụt tài chính',idea2:'Gây ô nhiễm',topicSentence:'Mua sắm thừa ảnh hưởng cá nhân và môi trường.',
    b1:'Nợ tăng',a1:'Mua quá mức',x1:'Vay tiền',b2:'Ô nhiễm',a2:'Bỏ đồ còn dùng được'});
  for(const step of ['topic','b1','a1','x1','b2','a2'])state.steps[step].status='passed';
  let confirmed=null,opens=0,checks=0,nativeOpens=0;
  let draft={text:'',revision:0},submission=null;
  let outlineReads=0,outlineOffline=true,hasRetainedOutline=false,outlineVersionOverride,transportFails=false,legacySnapshot=false;
  const rows=[1,2].map(n=>({id:'idea-'+n,label:'Ý '+n,...Object.fromEntries(['A','X','B'].map(point=>[
    point,{content:'Nội dung '+point+n,keywords:point==='B'&&n===2?[]:[{en:'Vocabulary '+point+n,vi:'Nghĩa '+point+n}],keywordStatus:point==='B'&&n===2?'failed':'ready'}
  ]))}));
  const writeUrl=site+'/homework-writing/?'+new URLSearchParams({mode:'student',assignment:assignmentId,documentId,workspace:'k67'});
  const headers={'access-control-allow-origin':site,'access-control-allow-credentials':'true',
    'access-control-allow-headers':'content-type,authorization,x-hw-access,x-hw-csrf,x-hw-student,x-hw-document,x-hw-assignment,x-hw-handout,x-hw-person,if-none-match',
    'access-control-allow-methods':'GET,POST,PUT,OPTIONS'};
  await page.context().route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin===site)return route.continue();
    if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
    const send=(json,status=200)=>route.fulfill({json,status,headers});
    if(url.pathname==='/api/handout67/v1/lessons/lesson5')return send({ok:true,lesson});
    if(url.pathname==='/api/handout67/v1/roster')return send({ok:true,classes});
    if(url.pathname==='/api/handout67/v1/sessions'){nativeOpens++;return send({ok:false,error:'LESSON5_HOMEWORK_AUTH_REQUIRED'},403);}
    const prefix='/homework-writing67-api/api';
    if(!url.pathname.startsWith(prefix))return route.abort();
    const path=url.pathname.slice(prefix.length);
    if(path==='/access/config')return send({product:'homework-writing-5667-local',version:1,mode:'online',teacherConsumer:'homeworkwriting',lesson5Writing:true});
    if(path==='/access/student/restore')return send({ok:true,token,person,identity,csrf:'1'});
    if(path==='/session')return send({person,csrf:'1'});
    if(path==='/access/student/lesson5-entry'){
      assert.deepEqual(request.postDataJSON(),{classRef,studentRef});
      assert.equal(request.headers().authorization,'Bearer '+token);
      return send({status:'ready',url:writeUrl});
    }
    if(path==='/access/entry')return send({entry:{assignmentId,documentId,studentRef,classId:identity.courseId}});
    if(path==='/assignments')return send([assignment]);
    const assignmentPath='/student/assignments/'+assignmentId;
    if(path===assignmentPath)return send({assignment,submission,draft,outlineConfirmation:confirmed});
    if(path===assignmentPath+'/draft'&&request.method()==='PUT'){
      draft={text:request.postDataJSON().text,revision:draft.revision+1};
      return send(draft);
    }
    if(path===assignmentPath+'/submit'&&request.method()==='POST'){
      assert.equal(request.postDataJSON().draftRevision,draft.revision);
      assert.ok(request.postDataJSON().idempotencyKey);
      submission={id:'fixture-lesson5-submission',text:draft.text,status:'queued'};
      return send(submission,201);
    }
    if(path===assignmentPath+'/handout'){
      outlineReads++;
      if(transportFails)return send({message:'Kết nối tạm gián đoạn.'},503);
      if(outlineOffline&&!hasRetainedOutline)return send({assignmentId,status:'source_unavailable',tables:[],outlinePreview:true,message:'Chưa đọc được dàn ý từ Handout.'});
      return send({assignmentId,status:'ready',sourceSessionRef:ref,sourceVersion:outlineVersionOverride??state.version,
        readMode:submission?'submission-snapshot':outlineOffline?'confirmed-outline':'api',outlineApproved:true,outlinePreview:true,tables:[{id:'body-2',title:'Thân bài 2',topicSentence:state.responses.topicSentence,outlineIdeas:[state.responses.idea1,state.responses.idea2],...(legacySnapshot?{}:{rows})}]});
    }
    const editor=assignmentPath+'/handout-editor';
    if(path===editor+'/lessons/lesson5')return send({ok:true,lesson});
    if(path===editor+'/roster')return send({ok:true,classes});
    if(path===editor+'/sessions'){
      opens++;
      assert.deepEqual(request.postDataJSON(),{activity:'lesson5',classRef,studentRef});
      return send({ok:true,token:nativeToken,session:state},201);
    }
    const session=editor+'/sessions/'+ref;
    if(path.startsWith(session))assert.equal(request.headers()['x-hw-handout'],'Bearer '+nativeToken);
    if(path===session)return send({ok:true,session:state});
    if(path===session+'/responses'){
      Object.assign(state.responses,request.postDataJSON().responses);state.version++;
      return send({ok:true,session:state});
    }
    if(path===session+'/checks'){
      assert.equal(request.postDataJSON().section,'x2');checks++;
      state.steps.x2.status='passed';state.version++;
      return send({ok:true,session:state},202);
    }
    if(path===session+'/continue-writing'){
      assert.equal(state.steps.x2.status,'passed');
      assert.equal(request.postDataJSON().baseVersion,state.version);
      confirmed={sessionRef:ref,version:state.version};
      return send({ok:true,url:writeUrl});
    }
    return send({error:'FIXTURE_NOT_FOUND'},404);
  });

  await page.goto(site+'/writing-handouts/lesson5/');
  await page.locator('#student-select').selectOption(studentRef);
  await page.locator('#login-form button[type=submit]').click();
  await page.locator('#confirm-button').click();
  const x2=page.locator('textarea[data-field=x2]');
  await x2.waitFor();
  assert.match(await page.locator('#homework-ideas-transfer').innerText(),/Homework Lesson 4/);
  assert.equal(opens,1);
  assert.equal(nativeOpens,0);
  await x2.fill('Rác tích tụ khiến đất và nước bị nhiễm bẩn.');
  await page.locator('[data-check=x2]').click();
  await page.getByRole('button',{name:'Nộp thân bài',exact:true}).waitFor();
  assert.equal(checks,1);
  assert.match(await page.locator('label[for=essay]').innerText(),/Thân bài 2 của em/);
  const panel=page.locator('#handout-preview');
  const toggle=page.locator('#toggle-handout');
  if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
  assert.match(await panel.locator('h2').innerText(),/Dàn ý từ Handout Lesson 5/);
  await panel.getByText('Chưa đọc được dàn ý từ Handout.',{exact:true}).waitFor({timeout:3000});
  hasRetainedOutline=true;
  await page.reload();
  await page.getByRole('button',{name:'Nộp thân bài',exact:true}).waitFor();
  if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();
  await panel.getByText('Thân bài 2',{exact:true}).waitFor();
  const table=panel.locator('.handout-summary-table');
  assert.equal(await table.locator('tbody td').count(),6);
  assert.equal(await table.locator('.handout-keyword').count(),5);
  assert.equal(await table.getByText('Nguồn chưa lấy được từ vựng.').count(),1);
  assert.match(await table.locator('tbody th').first().innerText(),/Thâm hụt tài chính/);
  await panel.getByRole('link',{name:'Ý 2',exact:true}).click();
  assert.equal(await page.evaluate(()=>document.activeElement.id),'handout-idea-2');
  await panel.locator('.handout-outline-end').click();
  assert.equal(await page.evaluate(()=>document.activeElement.id),'essay');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  for(const width of [1536,1280]){
    await page.setViewportSize({width,height:625});
    const divider=page.getByRole('separator');
    const ratio=Number(await divider.getAttribute('aria-valuenow'));
    await divider.press('ArrowRight');
    assert.ok(Number(await divider.getAttribute('aria-valuenow'))>ratio);
    await divider.press('Enter');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    const side=panel.locator('..');
    const scroll=await side.evaluate(el=>{el.scrollTop=150;return el.scrollTop;});
    assert.ok(scroll>0);
    await toggle.click();
    await toggle.click();
    assert.equal(await side.evaluate(el=>el.scrollTop),scroll);
  }
  await page.setViewportSize({width:390,height:850});
  await panel.getByRole('button',{name:'Thử lại kết nối',exact:true}).waitFor();
  assert.equal(await panel.locator('#handout-status').textContent(),'Đang xem dàn ý đã xác nhận');
  const retry=panel.locator('#reload-handout');
  const readsBeforeRetry=outlineReads;
  outlineOffline=false;
  outlineVersionOverride=state.version+1;
  await retry.click();
  await panel.getByText(/Dàn ý đã đổi/).first().waitFor();
  assert.equal(outlineReads,readsBeforeRetry+1);
  assert.equal(await table.locator('tbody td').count(),6);
  outlineVersionOverride=undefined;
  await retry.click();
  await panel.getByRole('button',{name:'Tải lại handout',exact:true}).waitFor();
  assert.equal(outlineReads,readsBeforeRetry+2);
  transportFails=true;
  await retry.click();
  await panel.locator('#handout-status').getByText(/Đang giữ dàn ý/).waitFor();
  assert.equal(await table.locator('tbody td').count(),6);
  transportFails=false;
  const essay=page.locator('#essay');
  await essay.fill('This draft stays in the editor.');
  await essay.evaluate(el=>el.setSelectionRange(5,9));
  assert.equal(await panel.locator('#close-handout').count(),0);
  assert.equal(await toggle.innerText(),'Đóng dàn ý');
  await toggle.click();
  assert.equal(await essay.inputValue(),'This draft stays in the editor.');
  assert.deepEqual(await essay.evaluate(el=>[el.selectionStart,el.selectionEnd]),[5,9]);
  assert.equal(await panel.isVisible(),false);
  await toggle.click();
  await panel.getByRole('button',{name:'Về Handout Lesson 5',exact:true}).click();
  await page.getByRole('button',{name:'Tiếp tục viết Thân bài 2 →',exact:true}).waitFor();
  assert.equal(new URL(page.url()).searchParams.get('outline'),'review');
  assert.equal(checks,1);
  await page.getByRole('button',{name:'Tiếp tục viết Thân bài 2 →',exact:true}).click();
  await page.locator('#essay').fill('Buying unnecessary products can create more waste and put pressure on household budgets.');
  await page.getByRole('button',{name:'Nộp thân bài',exact:true}).click();
  const confirmation=page.locator('.editor-card .notice-panel');
  await confirmation.waitFor();
  assert.equal(await confirmation.innerText(),'✓ Bài đã được nhận trên hệ thống');
  assert.equal(await confirmation.locator('strong').innerText(),'✓ Bài đã được nhận trên hệ thống');
  assert.doesNotMatch(await page.locator('#app').innerText(),/biên nhận|fixture-lesson5-submission/i);
  assert.ok((await confirmation.boundingBox()).width<390);
  await panel.getByText('Dàn ý lúc nộp',{exact:true}).waitFor();
  assert.equal(await table.locator('tbody td').count(),6);
  legacySnapshot=true;
  await page.reload();
  await panel.getByText('Bản này chưa có đủ nội dung A, X, B đã lưu.').waitFor();
  assert.equal(await table.count(),0);
  assert.equal(await panel.getByText(state.responses.topicSentence,{exact:true}).count(),1);
  assert.deepEqual(errors,[]);
});

test('Lesson 5 gives unverified learners a way back to their class and the existing outline',async t=>{
  const local=await serveDirectory(resolve(import.meta.dirname,'..'));
  const browser=await chromium.launch({channel:'chrome',headless:true});
  t.after(async()=>{await browser.close();await local.close();});
  const page=await browser.newPage({viewport:{width:390,height:850},hasTouch:true});
  await page.addInitScript(selection=>sessionStorage.setItem('izone:lesson5-entry-selection',JSON.stringify(selection)),{studentRef,classRef});
  const headers={'access-control-allow-origin':local.origin,'access-control-allow-credentials':'true',
    'access-control-allow-headers':'content-type,authorization,x-hw-access,x-hw-csrf,if-none-match',
    'access-control-allow-methods':'GET,POST,OPTIONS'};
  await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin===local.origin)return route.continue();
    if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
    if(url.pathname.endsWith('/access/config'))return route.fulfill({headers,json:{mode:'online',version:1,product:'homework-writing-5667-local'}});
    if(url.pathname.endsWith('/access/student/restore'))return route.fulfill({status:401,headers,json:{code:'STUDENT_LOGIN_REQUIRED'}});
    return route.abort();
  });
  await page.goto(local.origin+'/homework-writing/?mode=student&workspace=k67&lesson5=entry');
  const link=page.getByRole('link',{name:'Làm dàn ý trước',exact:true});
  await link.waitFor();
  const destination=new URL(await link.getAttribute('href'));
  assert.equal(destination.origin,local.origin);
  assert.equal(destination.pathname,'/writing-handouts/lesson5/');
  assert.deepEqual([...destination.searchParams],[['class',classRef],['outline','local']]);
  assert.equal(await page.locator('#essay').count(),0);
});
