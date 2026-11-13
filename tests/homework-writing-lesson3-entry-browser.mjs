// Real Pages modules and navigation. All credentials and API responses are fixture-only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {serveDirectory} from './fixtures/static-ui-server.mjs';
import {createState} from '../writing-handouts/lesson5-demo/core.mjs';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const assignment='hw-k67-fast-food-intro-101',documentId='fixture-lesson3-document-000001';
const studentRef='00000000-0000-4000-8000-000000000201',ref='00000000-0000-4000-8000-000000000301';
const classRef='IC9999',classId='101',token='A'.repeat(43),handoutToken='B'.repeat(43);
const person={role:'student',id:'fixture-person',classId,label:'Học viên thử'};
const identity={ownerId:studentRef,courseId:classId,erpId:'201',name:person.label,className:classRef};
const lesson={activity:'lesson3',number:3,title:'Fast Food',topic:'Should fast food be banned?',classes:[classRef],
  workflowMode:'whole-chain-v1',handoutMode:'two-bodies-v1',outlineOnly:true,helpTitle:'Gợi ý',helpItems:[],description:'Chốt dàn ý.',ideaHint:'Viết ngắn gọn.'};
const outline={...createState(0,lesson),activity:'lesson3',outlineOnly:true,classRef,studentRef,ref,version:8,commentThreads:[]};
outline.responses.stance='disagree';
outline.responses.body1_topicSentence='Dàn ý đã lưu của đúng học viên';
for(const step of Object.values(outline.steps))Object.assign(step,{status:'passed',direction:'disagree'});
const assigned={id:assignment,experience:'fast-food-introduction-v1',classId,writingPart:'introduction',
  approvedOutlineRequired:true,question:lesson.topic,title:lesson.title,handoutRequired:false};
const query=new URLSearchParams({mode:'student',assignment,documentId,workspace:'k67'});
const base='/student/assignments/'+assignment,editor=base+'/handout-editor';

async function exercise(t,run){
  const server=process.env.LESSON3_SITE_ROOT?null:await serveDirectory(fileURLToPath(new URL('..',import.meta.url)));
  if(server)t.after(()=>server.close());
  const site=process.env.LESSON3_SITE_ROOT||server.origin;
  const siteOrigin=new URL(site).origin;
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  const page=await context.newPage(),calls=[],errors=[];
  const state={rosterError:0,wrongSession:false,returned:false,outline:structuredClone(outline),saves:[],saveDelay:0,reads:0};
  page.setDefaultTimeout(4500);
  const writing=site+'/homework-writing/?'+query;
  await context.addInitScript(()=>{
    window.entryVisible=false;
    new MutationObserver(()=>{
      const form=document.getElementById('identity');
      if(form&&!form.hidden&&form.getClientRects().length)window.entryVisible=true;
    }).observe(document,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  });
  page.on('pageerror',e=>errors.push(e.message));
  try{
    await context.route('**/*',async route=>{
      const req=route.request(),url=new URL(req.url());
      if(url.origin===siteOrigin)return route.continue();
      const prefix='/homework-writing67-api/api';
      const headers={'access-control-allow-origin':siteOrigin,'access-control-allow-credentials':'true',
        'access-control-allow-headers':'content-type,authorization,x-hw-access,x-hw-csrf,x-hw-student,x-hw-person,x-hw-document,x-hw-assignment,x-hw-handout,if-none-match',
        'access-control-allow-methods':'GET,POST,PUT,OPTIONS'};
      const send=(json,status=200)=>route.fulfill({headers,json,status});
      if(req.method()==='OPTIONS')return route.fulfill({headers,status:204});
      if(url.pathname.startsWith('/mapping-api/')){calls.push('mapping');return send({},503);}
      const standalone='/api/handout67/v1';
      if(url.pathname.startsWith(standalone)){
        const path=url.pathname.slice(standalone.length);
        calls.push('standalone:'+path);
        if(path==='/lessons/lesson3')return send({ok:true,lesson});
        if(path==='/roster')return send({ok:true,classes:[{classRef,className:classRef,students:[{studentRef,displayName:person.label}]}]});
        if(path==='/sessions')return send({ok:true,token:handoutToken,session:state.outline});
        return send({ok:false},404);
      }
      if(!url.pathname.startsWith(prefix))return route.abort();
      const p=url.pathname.slice(prefix.length),h=req.headers();calls.push(p);
      if(p==='/access/config')return send({version:1,product:'homework-writing-5667-local',mode:'online',teacherConsumer:'homeworkwriting',privateDocsEntry:true});
      if(h['x-hw-document']!==documentId||h['x-hw-assignment']!==assignment)return send({message:'Docs không khớp bài.'},403);
      if(p==='/access/student/link')return send({token,person,identity,csrf:'1'});
      if(h.authorization!=='Bearer '+token)return send({message:'Phiên không hợp lệ.'},401);
      if(p==='/session')return send({person,csrf:'1'});
      if(p==='/access/entry')return send({entry:{documentId,assignmentId:assignment,studentRef,classId}});
      if(p==='/access/identity/resolve')return send({ok:true,status:'unique',identity:{authority:'erp-contact',id:'201'},aliases:[{studentRef,classId,classCode:classRef,studentName:person.label}]});
      if(p==='/assignments')return send([assigned]);
      if(p===base)return send({assignment:assigned,submission:state.returned?{id:'fixture-submission',text:'Mở bài đã nộp.'}:null,draft:{text:'',revision:0}});
      if(p===base+'/handout')return send({assignmentId:assignment,sourceVersion:8,status:'ready',outlineApproved:true,outlinePreview:true,tables:[]});
      if(p===editor+'/lessons/lesson3')return send({ok:true,lesson});
      if(p===editor+'/roster'){
        if(state.rosterError)return send({ok:false,error:'ROSTER_UNAVAILABLE'},state.rosterError);
        return send({ok:true,classes:[{classRef,className:classRef,students:[{studentRef,displayName:person.label}]}]});
      }
      if(p===editor+'/sessions'){
        assert.deepEqual(req.postDataJSON(),{activity:'lesson3',classRef,studentRef});
        assert.equal(h['x-hw-csrf'],'1');
        return send({ok:true,token:handoutToken,session:{...state.outline,...(state.wrongSession?{studentRef:'another-person'}:{})}});
      }
      if(p===editor+'/sessions/'+ref+'/continue-writing'){
        assert.equal(h['x-hw-handout'],'Bearer '+handoutToken);
        assert.deepEqual(req.postDataJSON(),{baseVersion:8});
        return send({ok:true,url:writing});
      }
      if(p===editor+'/sessions/'+ref+'/responses'&&req.method()==='PUT'){
        assert.equal(h['x-hw-handout'],'Bearer '+handoutToken);
        const {baseVersion,responses}=req.postDataJSON();
        assert.equal(baseVersion,state.outline.version);
        state.saves.push({baseVersion,responses});
        await new Promise(resolve=>setTimeout(resolve,state.saveDelay));
        Object.assign(state.outline.responses,responses);
        state.outline.version++;
        return send({ok:true,session:state.outline});
      }
      if(p===editor+'/sessions/'+ref){
        state.reads++;
        return send({ok:true,session:state.outline});
      }
      return send({message:'Unmodeled fixture route'},404);
    });
    async function enter(){
      await page.goto(writing);
      await page.locator('#hw-entry-student').selectOption('0');
      await page.locator('#online-login').click();
      await page.waitForURL('**/writing-handouts/lesson3-writing/**');
    }
    await run({page,enter,calls,errors,state,writing,site});
  }catch(error){
    console.error({path:new URL(page.url()).pathname,calls,errors,message:(await page.locator('body').innerText()).slice(0,220)});
    throw error;
  }finally{await browser.close();}
}

test('Docs → Handout → Writing uses one identity confirmation even when Mapping is unavailable',async t=>exercise(t,async({page,enter,calls,errors})=>{
  await enter();
  await page.waitForFunction(()=>window.entryVisible||!document.getElementById('workspace')?.hidden&&!!document.getElementById('workspace'));
  assert.equal(await page.evaluate(()=>window.entryVisible),false,'The standalone Handout login appeared after Writing verified the owner');
  await page.locator('#workspace').waitFor();
  assert.equal(await page.locator('#learner-label').innerText(),person.label);
  assert.match(await page.locator('#workspace').textContent(),/Dàn ý đã lưu của đúng học viên/);
  await page.getByRole('button',{name:'Xác nhận',exact:true}).click();
  await page.locator('#essay').waitFor();
  assert.equal(calls.filter(p=>p===editor+'/sessions').length,1);
  assert.equal(calls.filter(p=>p==='/access/student/link').length,1);
  assert.equal(calls.includes('mapping'),false);
  assert.deepEqual(errors,[]);
}));

test('Handout retries a temporary roster failure and restores the same learner after reload',async t=>exercise(t,async({page,enter,calls,errors,state})=>{
  state.rosterError=503;
  await enter();
  await page.getByRole('alert').filter({hasText:'Chưa mở được dàn ý'}).waitFor();
  assert.equal(await page.locator('#workspace').isVisible(),false);
  assert.equal(calls.filter(p=>p===editor+'/sessions').length,0);
  state.rosterError=0;
  await page.getByRole('button',{name:'Thử lại',exact:true}).click();
  await page.locator('#workspace').waitFor();
  await page.reload();
  await page.locator('#workspace').waitFor();
  assert.equal(await page.evaluate(()=>window.entryVisible),false);
  assert.equal(await page.locator('#learner-label').innerText(),person.label);
  assert.equal(calls.filter(p=>p==='/access/student/link').length,1);
  assert.equal(calls.includes('mapping'),false);
  assert.deepEqual(errors,[]);
}));

test('Fast Food saves a focused blank outline field, keeps the caret through background reads, and restores both edits',async t=>exercise(t,async({page,enter,state,errors})=>{
  const field='body1_idea1';
  const first='Một ý đang được gõ thử';
  const continued=first+' tiếp tục';
  state.outline.steps.body1_topic.status='draft';
  state.outline.steps.body2_topic.status='pending';
  state.saveDelay=700;
  await enter();
  const input=page.locator('#field-'+field);
  await input.click();
  const original=await input.elementHandle();
  await page.keyboard.insertText(first);
  await page.waitForFunction(()=>document.getElementById('save-state').textContent==='Đã lưu trên máy chủ');
  assert.deepEqual(state.saves,[{baseVersion:8,responses:{[field]:first}}]);
  assert.equal(state.outline.responses[field],first);
  const checkFocusedValue=async()=>assert.deepEqual(await original.evaluate(node=>({
    value:node.value,focused:document.activeElement===node,selection:node.selectionStart,connected:node.isConnected
  })),{value:first,focused:true,selection:first.length,connected:true});
  await checkFocusedValue();

  state.outline.steps.body2_topic.status='passed';
  await page.waitForFunction(()=>document.getElementById('body2').dataset.status==='passed');
  await page.waitForTimeout(8500);
  assert.ok(state.reads>=3,'Wait through at least three background reads');
  await checkFocusedValue();
  assert.equal(await page.locator('#field-body1_topicSentence').inputValue(),'Dàn ý đã lưu của đúng học viên');

  await page.keyboard.insertText(' tiếp tục');
  await page.waitForFunction(()=>document.getElementById('save-state').textContent==='Đã lưu trên máy chủ');
  assert.deepEqual(state.saves.at(-1),{baseVersion:9,responses:{[field]:continued}});
  await page.reload();
  await input.waitFor();
  assert.equal(await input.inputValue(),continued);
  assert.deepEqual(errors,[]);
}));

test('A session for another learner fails closed before revealing a draft',async t=>exercise(t,async({page,enter,state,writing})=>{
  state.wrongSession=true;
  await enter();
  const recover=page.getByRole('link',{name:'Về cửa vào Writing'});
  await recover.waitFor();
  assert.equal(await recover.getAttribute('href'),writing);
  assert.equal(await page.locator('#workspace').isVisible(),false);
  assert.equal(await page.evaluate(()=>window.entryVisible),false);
}));

test('An expired Homework session offers the original Writing entry without exposing the Handout',async t=>exercise(t,async({page,enter,state,calls,writing})=>{
  state.rosterError=401;
  await enter();
  const recover=page.getByRole('link',{name:'Về cửa vào Writing'});
  await recover.waitFor();
  assert.equal(await recover.getAttribute('href'),writing);
  assert.equal(await page.locator('#workspace').isVisible(),false);
  assert.equal(calls.filter(p=>p===editor+'/sessions').length,0);
}));

test('A Docs link for a different owner must be confirmed again, and a wrong Docs is denied',async t=>exercise(t,async({page,enter,calls,writing})=>{
  await page.addInitScript(()=>{
    if(!localStorage.getItem('izone:student-identity:v1'))
      localStorage.setItem('izone:student-identity:v1',JSON.stringify({version:1,revision:'different-owner-001',identity:{authority:'erp-contact',id:'202'}}));
  });
  await enter();
  await page.locator('#workspace').waitFor();
  await page.goto(writing.replace(documentId,'wrong-fixture-docs-0000001'));
  await page.getByRole('alert').filter({hasText:'Docs không khớp bài.'}).waitFor();
  assert.equal(await page.locator('#hw-entry-student').count(),0);
  assert.equal(calls.filter(p=>p===editor+'/sessions').length,1);
}));

test('An already submitted introduction still opens in Writing without starting Handout',async t=>exercise(t,async({page,state,writing,calls})=>{
  state.returned=true;
  await page.goto(writing);
  await page.locator('#hw-entry-student').selectOption('0');
  await page.locator('#online-login').click();
  await page.locator('#essay').waitFor();
  assert.equal(await page.locator('#essay').inputValue(),'Mở bài đã nộp.');
  assert.equal(await page.locator('#essay').isEditable(),false);
  assert.equal(calls.some(p=>p.startsWith(editor)),false);
}));

test('Standalone Lesson 3 still requires class and name selection',async t=>exercise(t,async({page,site,calls,errors})=>{
  await page.goto(site+'/writing-handouts/lesson3/');
  await page.getByRole('heading',{name:'Bắt đầu bài học'}).waitFor();
  await page.locator('#student-select').selectOption(studentRef);
  await page.locator('#login-form button').click();
  await page.locator('#confirm-button').click();
  await page.locator('#workspace').waitFor();
  assert.equal(await page.locator('#learner-label').innerText(),person.label);
  assert.equal(calls.filter(p=>p==='standalone:/sessions').length,1);
  assert.deepEqual(errors,[]);
}));
