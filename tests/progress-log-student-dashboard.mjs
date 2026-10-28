import test from 'node:test';
import assert from 'node:assert/strict';
import {latestAssignedSession,dashboardSessionState} from '../progress-log/student-session-dashboard.js';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const {chromium}=createRequire('C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
test('R03: buổi gần nhất theo lịch; thiếu ngày dùng số buổi; sửa/giao lại không đổi thứ tự',()=>{
  const sessions=[{assignmentId:'a',sessionNumber:1,sessionDate:'2026-10-20',updatedAt:'2030-01-01T00:00:00Z'},
    {assignmentId:'b',sessionNumber:2,sessionDate:'2026-10-22'}, {assignmentId:null,sessionNumber:3,sessionDate:'2026-10-24'}];
  assert.equal(latestAssignedSession(sessions).assignmentId,'b');
  assert.equal(latestAssignedSession([...sessions,{assignmentId:'c',sessionNumber:4,sessionDate:null}]).assignmentId,'c');
  assert.equal(latestAssignedSession([]),null);
  assert.equal(dashboardSessionState(sessions[2]).action,null);
  assert.equal(dashboardSessionState({...sessions[0],assignmentStatus:'published',submissionWindow:{canSubmit:false,reason:'manual_cutoff'}}).canLearn,false);
  assert.equal(dashboardSessionState({...sessions[0],completeness:'incomplete'}).readOnly,true);
});
test('R03/C20: cập nhật ba nhịp giữ node, cuộn và bôi chọn; thay người xóa danh sách cũ',{timeout:60000},async()=>{
  const server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://local').pathname;
    if(pathname==='/fixture'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end('<div id="before"></div><div style="height:1500px"></div><div id="after"></div>');}
    const file=resolve(root,'.'+pathname);if(!file.startsWith(resolve(root)+sep))throw Error('Denied');res.setHeader('Content-Type',extname(file)==='.js'?'text/javascript':'text/plain');res.end(await readFile(file));
  }catch{res.writeHead(404);res.end();}});await new Promise(done=>server.listen(0,'127.0.0.1',done));
  const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage();
  try{await page.goto('http://127.0.0.1:'+server.address().port+'/fixture');
    const result=await page.evaluate(async()=>{
      const {createStudentSessionDashboard}=await import('/progress-log/student-session-dashboard.js');
      const ui=createStudentSessionDashboard({before:document.querySelector('#before'),after:document.querySelector('#after'),onOpen:()=>{},onRetry:()=>{},onJourney:()=>{}});
      const data={class:{classId:'class'},student:{studentRef:'A'},sessions:[{assignmentId:'old',sessionNumber:1,sessionDate:'2026-01-01',title:'Bài cũ',assignmentStatus:'closed',completeness:'complete'},
        {assignmentId:'new',sessionNumber:2,sessionDate:'2026-01-02',title:'Bài mới',assignmentStatus:'published',submissionWindow:{canSubmit:true,serverNow:'2026-10-28T00:00:00Z'}},
        {sessionNumber:3,sessionDate:null,title:'Buổi 3'}]};
      ui.render(data,{currentId:'new'});const latest=document.querySelector('#before [data-session-number="2"]'),card=document.querySelector('#after [data-session-number="1"]'),text=card.querySelector('h3').firstChild;
      const range=document.createRange();range.selectNodeContents(text);getSelection().removeAllRanges();getSelection().addRange(range);scrollTo(0,500);const scroll=scrollY;
      for(let tick=1;tick<=3;tick++){const copy=structuredClone(data);copy.sessions[1].submissionWindow.serverNow='2026-10-28T00:00:0'+tick+'Z';ui.render(copy,{currentId:'new'});}
      const stable=latest===document.querySelector('#before [data-session-number="2"]')&&card===document.querySelector('#after [data-session-number="1"]')&&getSelection().toString()==='Bài cũ'&&scrollY===scroll;
      data.sessions[0].sessionComment={noteText:'Nhận xét vừa sửa',visibility:'visible',sessionNumber:1};ui.render(data,{currentId:'new'});
      const latestUnchanged=latest===document.querySelector('#before [data-session-number="2"]');
      ui.render({class:data.class,student:{studentRef:'B'},sessions:[]});const oldRemoved=!document.querySelector('[data-session-number]'),emptyText=document.querySelector('#before').textContent;
      const scheduled={class:data.class,student:{studentRef:'B'},sessions:[{assignmentId:'scheduled',sessionNumber:7,sessionDate:'2026-10-28',title:'Qua giờ mở',assignmentStatus:'published',submissionWindow:{canSubmit:true}}]};
      ui.render(scheduled,{now:Date.parse('2026-10-28T18:24:00+07:00')});const locked=document.querySelector('#before article'),before=locked.textContent;
      ui.render(scheduled,{now:Date.parse('2026-10-28T18:26:00+07:00')});const open=document.querySelector('#before article'),opened=open.textContent.includes('Mở phiếu');
      ui.render(scheduled,{now:Date.parse('2026-10-28T18:27:00+07:00')});return {stable,latestUnchanged,oldRemoved,text:emptyText,before,opened,clockChanged:locked!==open,clockStable:open===document.querySelector('#before article')};
    });assert.equal(result.stable,true);assert.equal(result.latestUnchanged,true);assert.equal(result.oldRemoved,true);assert.match(result.text,/Chưa có phiếu nào được giao/);
    assert.match(result.before,/Chưa đến buổi học/);assert.equal(result.opened,true);assert.equal(result.clockChanged,true);assert.equal(result.clockStable,true);
  }finally{await browser.close();await new Promise(done=>server.close(done));}
});
