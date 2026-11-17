import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { createState } from '../writing-handouts/lesson5-demo/core.mjs';
import { lessonEntryClass } from '../writing-handouts/shared/test-class-entry.mjs';
import { serveDirectory } from './fixtures/static-ui-server.mjs';

const { chromium } = createRequire(resolve(process.env.USERPROFILE,
  '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'))('playwright');
const assignment = 'hw-k67-writing-lesson4-101';
const documentId = 'fixture-lesson4-docs-000001';
const studentRef = 'fixture-student';
const classRef = 'IC9999';
const title = 'Chuẩn bị ý tưởng · Mua sắm không cần thiết';
const lesson = {
  activity: 'lesson4', number: 4, title, topic: 'Synthetic topic for browser testing.', classes: [classRef],
  workflowMode: 'whole-chain-v1', handoutMode: 'two-bodies-v1', outlineOnly: true, ideaHint: 'Chốt dàn ý.',
};
const person = { role: 'student', id: 'fixture-person', classId: '101', label: 'Học viên thử' };
const identity = { ownerId: studentRef, courseId: person.classId, erpId: '201', name: person.label, className: classRef };
const editor = '/student/assignments/' + assignment + '/handout-editor';
const token = 'A'.repeat(43);
const challenge = 'M'.repeat(43);
const csrf = '1';

test('Lesson 5 shows the course roster on its plain link and retains exact class links', () => {
  const expanded = {activity:'lesson5',classes:['IC2304','IC2363'],defaultClass:'IC2304'};
  assert.equal(lessonEntryClass(expanded),'');
  assert.equal(lessonEntryClass(expanded,'?class=ic2363'),'IC2363');
  assert.throws(()=>lessonEntryClass(expanded,'?class=IC9999'),/CLASS_NOT_OPEN/);
  assert.equal(lessonEntryClass({...expanded,classes:['IC2304']}),'IC2304');
});

async function exercise(t, options, verify) {
  const server = process.env.LESSON4_ENTRY_SITE ? null : await serveDirectory(resolve(import.meta.dirname, '..'));
  const site = process.env.LESSON4_ENTRY_SITE || server.origin;
  const origin = new URL(site).origin;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  t.after(async () => { await browser.close(); await server?.close(); });
  const context=await browser.newContext({hasTouch:!!options.mobile,viewport:{width:options.mobile?390:1360,height:850}});
  const page=await context.newPage();
  page.setDefaultTimeout(6000);
  const calls = [];
  const confirmed = [];
  let rosterFailures = options.retry ? 1 : 0;
  await page.addInitScript(() => {
    const nodes = new WeakSet();
    window.openingMessages = [];
    new MutationObserver(() => {
      for (const host of document.querySelectorAll('#lesson-access p[role=status], #verified-handout-opening:not([hidden]) p')) {
        if (!nodes.has(host) && /^(Đang kiểm tra quyền|Đang mở)/.test(host.textContent)) {
          nodes.add(host);
          window.openingMessages.push(host.textContent);
        }
      }
    }).observe(document, { subtree: true, childList: true, attributes: true });
  });
  const extraClass='IC9998';
  const targetLesson={activity:'lesson5',number:5,body:2,title:'Luyện thử Lesson 5',topic:'Synthetic topic.',classes:[classRef,extraClass],defaultClass:classRef,ideaHint:'Chọn tác hại.'};
  const target={...createState(0,targetLesson),ref:'lesson5-fixture-session',activity:'lesson5',classRef,studentRef,vocabulary:{},teacherComments:[]};
  const teacherData={extraRows:[],sent:[]};
  let lastSaved=null;
  await page.context().route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    const headers = {
      'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true',
      'access-control-allow-headers': 'content-type,authorization,x-hw-access,x-hw-csrf,x-hw-student,x-hw-document,x-hw-assignment,x-hw-handout,x-handout67-csrf,if-none-match',
      'access-control-allow-methods': 'GET,POST,PUT,OPTIONS',
    };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const send = (json, status = 200) => route.fulfill({ json, status, headers });
    if (options.transfer && url.pathname === '/teacher-session-api/v1/restore/handout67') {
      return send({ ok: true });
    }
    if(options.transfer&&url.pathname.startsWith('/api/handout67/v1')){
      const path=url.pathname.slice('/api/handout67/v1'.length);
      const students=[{studentRef,displayName:person.label}];
      const classes=[{classRef,className:classRef,students},{classRef:extraClass,className:extraClass,students:[]}];
      if(path==='/lessons/lesson5')return send({ok:true,lesson:targetLesson});
      if(path==='/roster')return send({ok:true,classes});
      if(path==='/sessions'){
        const input=request.postDataJSON();
        if(input.lesson5IdeaTicket){
          assert.equal(input.studentRef,studentRef);
          assert.equal(input.lesson5IdeaTicket,'verified-lesson4-fixture-ticket');
          Object.assign(target.responses,{idea1:'Tiền sinh hoạt thiếu hụt',idea2:'Tăng rác điện tử'});
          target.lesson5IdeaSource={fields:['idea1','idea2'],status:'draft',sourceVersion:4};
          lastSaved=new Date().toISOString();
        }
        if(target.lesson5IdeaSource&&!input.lesson5IdeaTicket&&request.headers().authorization!=='Bearer writing5-fixture')
          return send({ok:false,error:'LESSON5_HOMEWORK_AUTH_REQUIRED'},403);
        return send({ok:true,session:target,token:target.lesson5IdeaSource?'writing5-fixture':'manual-fixture'});
      }
      if(path==='/sessions/'+target.ref+'/responses'){
        Object.assign(target.responses,request.postDataJSON().responses);
        target.version++;lastSaved=new Date().toISOString();
        return send({ok:true,session:target});
      }
      if(path==='/sessions/'+target.ref+'/checks'){
        assert.equal(request.postDataJSON().section,'topic');
        target.submittedSections=['topic'];
        target.steps.topic={status:'passed',history:[],approval:{source:'ai'}};
        return send({ok:true,session:target},202);
      }
      if(path==='/sessions/'+target.ref||path==='/teacher/sessions/'+target.ref)return send({ok:true,session:target});
      if(path==='/teacher/session')return send({ok:true,reviewer:{email:'teacher@example.test'}});
      if(path==='/teacher/classes')return send({ok:true,classes});
      if(path==='/teacher/students')return send({ok:true,students:[{...students[0],sessionRef:target.ref,updatedAt:lastSaved,passed:0},...teacherData.extraRows]});
      if(path==='/teacher/sessions/'+target.ref+'/activity')return send({ok:true,events:[]});
      if(path==='/teacher/sessions/'+target.ref+'/comments'&&request.method()==='POST'){
        const input=request.postDataJSON();
        assert.equal(input.expectedVersion,target.version);
        teacherData.sent.push(input);
        target.teacherComments.push({...input,authorName:'Giảng viên thử',snapshot:{...target.responses}});
        return send({ok:true,session:target});
      }
      return send({ok:false},404);
    }
    const prefix = '/homework-writing67-api/api';
    if (!url.pathname.startsWith(prefix)) return route.abort();
    const path = url.pathname.slice(prefix.length);
    calls.push(path);
    if (options.slow) await new Promise(resolve => setTimeout(resolve, 160));
    if (path === '/access/config') return send({ version: 1, product: 'homework-writing-5667-local', mode: 'online',
      teacherConsumer: 'homeworkwriting', privateDocsEntry: true });
    if (path === '/access/student/link') {
      const input = request.postDataJSON();
      if (!input.selfMatchToken) return send({ choiceRequired: true, selfMatch: { token: challenge, account: 'fixture@example.test' },
        choices: [{ studentRef, classId: person.classId, classCode: classRef, name: person.label }] });
      confirmed.push(input);
      return send({ token, person, identity, csrf });
    }
    if (path === '/session') return send({ person, csrf });
    if (path === '/access/entry') return send({ entry: { documentId, assignmentId: assignment, studentRef, classId: person.classId } });
    if (path === '/access/identity/resolve') return send({ ok: true, status: 'unique', identity: { authority: 'erp-contact', id: '201' },
      aliases: [{ studentRef, classId: person.classId, classCode: classRef, studentName: person.label }] });
    assert.equal(request.headers().authorization, 'Bearer ' + token);
    if (path === editor + '/lessons/lesson4') return send({ ok: true, lesson });
    if (path === editor + '/roster') {
      if (rosterFailures > 0) { rosterFailures--; return send({ ok: false, error: 'ROSTER_UNAVAILABLE' }, 503); }
      return send({ ok: true, classes: [{ classRef, className: classRef, students: [
        { studentRef: options.wrong ? 'another-student' : studentRef, displayName: person.label },
      ] }] });
    }
    if (path === editor + '/sessions') {
      assert.deepEqual(request.postDataJSON(), { activity: 'lesson4', classRef, studentRef });
      assert.equal(request.headers()['x-hw-csrf'], csrf);
      const s={...createState(0,lesson),activity:'lesson4',outlineOnly:true,classRef,studentRef,ref:'fixture-session'};
      if(options.transfer){
        s.lesson5IdeaAvailable=true;
        Object.assign(s.responses,{body1_idea1:'Bị quảng cáo hấp dẫn',body2_idea1:'Tiền sinh hoạt thiếu hụt',body2_idea2:'Tăng rác điện tử'});
      }
      return send({ok:true,token:'B'.repeat(43),session:s});
    }
    if(path===editor+'/sessions/fixture-session'&&options.transfer)return send({ok:true,
      lesson5IdeaTicket:'verified-lesson4-fixture-ticket',session:{ref:'fixture-session'}});
    if (path === editor + '/sessions/fixture-session/practice') return send({ ok: true, practice: { status: options.transfer?'accepted':'not_started' } });
    return send({ ok: false }, 404);
  });

  const query = new URLSearchParams({ mode: 'student', assignment, documentId, workspace: 'k67' });
  await page.goto(site + '/writing-handouts/lesson4/?' + query);
  await page.locator('#hw-entry-student').selectOption('0');
  await verify({page,calls,confirmed,site,target,teacherData});
}

test('Lesson 4 asks for name confirmation once, then restores without remounting the waiting card', async t => {
  await exercise(t, { slow: true, mobile: true }, async ({ page, calls, confirmed }) => {
    const host = await page.locator('#lesson-access').elementHandle();
    assert.equal(await page.locator('#lesson-access h1').innerText(), title);
    await page.getByRole('button', { name: 'Xác nhận và vào bài' }).click();
    await page.locator('.share-practice').waitFor();
    assert.equal(await page.locator('#hw-entry-confirm[open]').count(), 0);
    assert.deepEqual(confirmed, [{ classId: person.classId, studentRef, selfMatchToken: challenge }]);
    assert.equal(calls.filter(path => path === editor + '/sessions').length, 1);
    assert.equal(await host.evaluate(el => el.isConnected && el.hidden), true);
    assert.deepEqual(await page.evaluate(() => window.openingMessages), ['Đang mở bài của bạn…']);
    calls.length = 0;
    await page.reload();
    await page.locator('.share-practice').waitFor();
    assert.deepEqual(await page.evaluate(() => window.openingMessages), ['Đang mở bài của bạn…']);
    assert.equal(calls.includes('/access/student/link'), false);
    assert.equal(await page.locator('#identity').isVisible(), false);
    assert.equal(await page.locator('#confirm').isVisible(), false);
  });
});

test('Lesson 5 keeps the reading position, teacher comments and verified Homework transfer',async t=>{
  await exercise(t,{transfer:true,mobile:true},async({page,site,target,teacherData})=>{
    await page.getByRole('button',{name:'Xác nhận và vào bài'}).click();
    const manual=await page.context().newPage();
    await manual.goto(site+'/writing-handouts/lesson5/');
    await manual.locator('#student-select option[value="'+studentRef+'"]').waitFor({state:'attached'});
    assert.equal(await manual.locator('#class-select option').count(),2);
    if(await manual.locator('#identity').isVisible()){
      await manual.locator('#student-select').selectOption(studentRef);
      await manual.locator('#login-form button[type=submit]').click();
      await manual.locator('#confirm-button').click();
    }
    await manual.locator('#field-idea1').waitFor();
    assert.equal(await manual.locator('#field-idea1').inputValue(),'');
    await manual.close();
    const classLink=await page.context().newPage();
    await classLink.goto(site+'/writing-handouts/lesson5/?class=ic9998');
    await classLink.locator('#class-select option[value="IC9998"]').waitFor({state:'attached'});
    assert.deepEqual(await classLink.locator('#class-select option').evaluateAll(options=>options.map(option=>option.value)),['IC9998']);
    await classLink.close();
    await page.getByRole('button',{name:'Dùng idea ở Lesson 5'}).click();
    await page.waitForURL('**/writing-handouts/lesson5/');
    await page.locator('#field-idea1').waitFor();
    assert.equal(await page.locator('#field-idea1').inputValue(),'Tiền sinh hoạt thiếu hụt');
    assert.equal(await page.locator('#field-idea2').inputValue(),'Tăng rác điện tử');
    assert.equal(await page.locator('#field-topicSentence').inputValue(),'');
    assert.match(await page.locator('#homework-ideas-transfer').innerText(),/nháp Homework Lesson 4/);
    await page.locator('#field-idea1').fill('Nháp mới của học viên');
    await page.locator('#field-topicSentence').fill('Chi tiêu thừa gây hại cho tài chính và môi trường.');
    await page.waitForFunction(()=>document.getElementById('save-state')?.textContent==='Đã lưu trên máy chủ');
    assert.equal(target.responses.idea1,'Nháp mới của học viên');
    assert.equal(target.steps.topic.status,'draft');
    const teacher=await page.context().newPage();
    teacherData.extraRows=Array.from({length:12},(_,index)=>({studentRef:'student-'+index,displayName:'Học viên '+index}));
    await teacher.goto(site+'/writing-handouts/lesson5/teacher.html');
    const studentCard=teacher.locator('[data-student="'+studentRef+'"]');
    await studentCard.waitFor();
    const refresh=teacher.getByRole('button',{name:'Cập nhật',exact:true});
    for(const width of [390,1440]){
      await teacher.setViewportSize({width,height:560});
      await teacher.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
      const before=await refresh.boundingBox();
      assert.ok(before.width<=145&&before.height>=44&&before.height<=54);
      await teacher.evaluate(()=>scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));
      assert.ok(await teacher.evaluate(()=>scrollY>0));
      assert.deepEqual(await refresh.boundingBox(),before);
      const card=await studentCard.elementHandle();
      await Promise.all([
        teacher.waitForResponse(response=>response.url().includes('/teacher/students?')&&response.ok()),
        width===390?refresh.tap():refresh.click(),
      ]);
      assert.equal(await card.evaluate(element=>element.isConnected),true);
      assert.deepEqual(await refresh.boundingBox(),before);
    }
    await teacher.setViewportSize({width:390,height:660});
    await studentCard.evaluate(card=>scrollBy({top:card.getBoundingClientRect().top-100,behavior:'instant'}));
    const beforeChange=(await studentCard.boundingBox()).y;
    teacherData.extraRows.unshift({studentRef:'new-priority',displayName:'Vừa cần hỗ trợ',sessionRef:'another-session',dashboard:{priority:0,state:'support',activity:{},stepStates:{}}});
    await refresh.tap();
    await teacher.locator('[data-student=new-priority]').waitFor({state:'attached'});
    assert.ok(Math.abs((await studentCard.boundingBox()).y-beforeChange)<=2);
    await teacher.setViewportSize({width:1440,height:560});
    await studentCard.click();
    await teacher.locator('#lesson5-outline-source').waitFor();
    assert.match(await teacher.locator('#lesson5-outline-source').innerText(),/Homework Lesson 4.*Cập nhật/);
    assert.match(await teacher.locator('[data-field-read=idea1]').innerText(),/Nháp mới của học viên/);
    assert.equal(await teacher.locator('#comment-form').isVisible(),true);
    const notes=teacher.locator('#comment-text');
    const note='Em giải thích thêm hậu quả của ý thứ nhất nhé.';
    await notes.fill(note);
    await notes.evaluate(input=>input.setSelectionRange(4,12));
    const reads=[];
    teacher.on('request',request=>{if(request.url().includes('/teacher/'))reads.push(new URL(request.url()).pathname);});
    const dialog=teacher.locator('#detail'), detailButton=teacher.locator('#detail-refresh');
    for(const width of [1440,390]){
      await teacher.setViewportSize({width,height:620});
      await dialog.evaluate(node=>node.scrollTop=node.scrollHeight);
      assert.equal(await detailButton.evaluate(button=>{
        const {x,y,width,height}=button.getBoundingClientRect();
        return button.contains(document.elementFromPoint(x+width/2,y+height/2));
      }),true);
      const detailBefore=await dialog.evaluate(node=>node.scrollTop);
      try {
        await Promise.all([
          teacher.waitForResponse(response=>response.url().includes('/activity?')&&response.ok(),{timeout:10000}),
          width===390?detailButton.tap():detailButton.click(),
        ]);
      } catch(error) {
        const screen=await teacher.evaluate(()=>({hidden:document.hidden,open:document.querySelector('#detail').open,
          error:document.querySelector('#error').hidden?'':document.querySelector('#error').textContent}));
        throw Error(JSON.stringify({reads,screen}),{cause:error});
      }
      assert.equal(await dialog.evaluate(node=>node.scrollTop),detailBefore);
      assert.equal(await notes.inputValue(),note);
      assert.deepEqual(await notes.evaluate(input=>[input.selectionStart,input.selectionEnd]),[4,12]);
    }
    const content=await teacher.locator('[data-field-read=idea1]').elementHandle();
    for(let i=0;i<3;i++)await teacher.waitForResponse(response=>response.url().includes('/teacher/sessions/'+target.ref)&&response.ok(),{timeout:8000});
    assert.equal(await content.evaluate(el=>el.isConnected),true);
    await teacher.locator('#comment-submit').click();
    await teacher.waitForFunction(()=>document.querySelector('#comment-status').textContent.includes('Đã lưu góp ý'));
    assert.deepEqual(teacherData.sent.map(input=>[input.section,input.feedback]),[['topic',note]]);
    await teacher.close();
    await page.getByRole('button',{name:'Check chất lượng Topic Sentence'}).click();
    await page.locator('#field-b1').waitFor();
    await page.reload();
    await page.locator('#field-b1').waitFor();
    assert.equal(target.steps.topic.status,'passed');
  });
});

test('Lesson 4 retries transient roster errors inside the same card', async t => {
  await exercise(t, { retry: true, slow: true }, async ({ page, calls }) => {
    await page.getByRole('button', { name: 'Xác nhận và vào bài' }).click();
    await page.locator('#lesson-access').getByRole('button', { name: 'Thử lại' }).click();
    await page.locator('.share-practice').waitFor();
    assert.equal(calls.filter(path => path === '/access/config').length, 1);
    assert.equal(calls.filter(path => path === editor + '/roster').length, 2);
    assert.equal(calls.filter(path => path === editor + '/sessions').length, 1);
  });
});

test('Lesson 4 denies a mismatched Docs owner before opening a Handout session', async t => {
  await exercise(t, { wrong: true }, async ({ page, calls }) => {
    await page.getByRole('button', { name: 'Xác nhận và vào bài' }).click();
    const error = page.locator('#lesson-access').getByRole('alert');
    await error.waitFor();
    assert.match(await error.innerText(), /Docs cá nhân/);
    assert.equal(calls.includes(editor + '/sessions'), false);
    assert.equal(await page.locator('#workspace').isVisible(), false);
    assert.equal(await page.getByRole('button', { name: 'Thử lại' }).count(), 0);
  });
});
