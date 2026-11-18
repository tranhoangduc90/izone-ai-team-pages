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
  let outlineReads=0,outlineOffline=true,outlineVersionOverride;
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
    if(path===assignmentPath)return send({assignment,submission:null,draft:{text:'',revision:0},outlineConfirmation:confirmed});
    if(path===assignmentPath+'/handout'){
      outlineReads++;
      if(outlineOffline)return send({assignmentId,status:'source_unavailable',tables:[],outlinePreview:true,message:'Chưa đọc được dàn ý từ Handout.'});
      return send({assignmentId,status:'ready',sourceSessionRef:ref,sourceVersion:outlineVersionOverride??state.version,
        readMode:'api',outlineApproved:true,outlinePreview:true,tables:[{id:'body-2',title:'Thân bài 2',topicSentence:state.responses.topicSentence,outlineIdeas:[state.responses.idea1,state.responses.idea2],rows:[]}]});
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
  const retry=panel.locator('#reload-handout');
  const readsBeforeRetry=outlineReads;
  outlineOffline=false;
  outlineVersionOverride=state.version+1;
  await retry.click();
  await panel.getByText(/Dàn ý đã đổi/).first().waitFor();
  assert.equal(outlineReads,readsBeforeRetry+1);
  assert.equal(await panel.getByText('Thân bài 2',{exact:true}).count(),0);
  outlineVersionOverride=undefined;
  await retry.click();
  await panel.getByText('Thân bài 2',{exact:true}).waitFor();
  assert.equal(outlineReads,readsBeforeRetry+2);
  assert.equal(await panel.locator('#close-handout').count(),0);
  assert.equal(await toggle.innerText(),'Đóng dàn ý');
  await toggle.click();
  assert.equal(await panel.isVisible(),false);
  await toggle.click();
  await panel.getByRole('button',{name:'Về Handout Lesson 5',exact:true}).click();
  await page.getByRole('button',{name:'Tiếp tục viết Thân bài 2 →',exact:true}).waitFor();
  assert.equal(new URL(page.url()).searchParams.get('outline'),'review');
  assert.equal(checks,1);
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
