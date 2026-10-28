// Các module thật với dữ liệu giả; không mở API thật, không tạo lượt/điểm danh học viên.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const {chromium}=createRequire('C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
test('R09/R10/R27/C20: nội dung/đáp án đúng thứ tự, khảo sát không chấm và ba nhịp giữ vùng đang đọc',{timeout:60000},async()=>{
  const server=createServer(async(req,res)=>{try{
    const pathname=new URL(req.url,'http://local').pathname;
    if(pathname==='/fixture'){res.setHeader('Content-Type','text/html');return res.end('<main id="analytics"></main><section id="feedback"></section>');}
    const file=resolve(root,'.'+pathname);if(!file.startsWith(resolve(root)+sep))throw Error('Denied');
    res.setHeader('Content-Type',{'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css'}[extname(file)]||'text/plain');res.end(await readFile(file));
  }catch{res.writeHead(404);res.end();}});
  await new Promise(done=>server.listen(0,'127.0.0.1',done));const origin='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto(origin+'/fixture');
    const result=await page.evaluate(async()=>{
      const {renderThuyAnalytics}=await import('/progress-log/thuy-live/question-analytics.js');
      const {partFeedback}=await import('/progress-log/thuy-live/part-feedback.js');
      const {renderThuyRoster}=await import('/progress-log/thuy-live/teacher-view.js');
      const {createFormLibrary}=await import('/progress-log/teacher-form-library.js');
      const root=document.querySelector('#analytics'),source={itemVersionId:'a',position:1,prompt:'Câu hỏi nguồn',options:[{id:'A',label:'Một'},{id:'B',label:'Hai'}]};
      const counts={submitted:3,visible:3,answered:3,graded:3,incorrect:2,pending:0,manual:0,ungraded:0,hidden:0};
      const analytics={rosterCount:3,submittedCount:3,items:[{...source,objective:true,counts,correctAnswer:['Hai']}]};
      const definition={blocks:[{items:[source]}]};renderThuyAnalytics(root,analytics,{definition});
      const card=root.querySelector('.thuy-question-card'),text=card.querySelector('h3').firstChild,range=document.createRange();range.selectNodeContents(text);
      getSelection().removeAllRanges();getSelection().addRange(range);const selected=getSelection().toString();
      for(let i=0;i<3;i++)renderThuyAnalytics(root,{...structuredClone(analytics),capturedAt:new Date(Date.now()+i*1000).toISOString()},{definition});
      const stable=card===root.querySelector('.thuy-question-card')&&selected===getSelection().toString();
      const beforeText=card.textContent;
      const changed=structuredClone(analytics);changed.items[0].counts.incorrect=1;renderThuyAnalytics(root,changed,{definition});
      const updated=root.querySelector('.thuy-question-card').textContent.includes('1/3 học viên');
      const survey={kind:'survey',items:[{...source,interactionConfig:{}}]},grade={answerRelease:'hidden',items:[{itemVersionId:'a',maxScore:0,verdict:'ungraded',rawAnswer:'A',expectedAnswer:['Nội dung đối chiếu']} ]};
      const feedback=partFeedback(survey,grade);document.querySelector('#feedback').append(feedback);
      const noRef=partFeedback(survey,{...grade,items:[{...grade.items[0],expectedAnswer:null}]});
      const roster=document.createElement('section');document.body.append(roster);
      const dashboard={assignmentId:'assignment-a',definition:{blocks:[{blockId:'part',items:[source]}]},students:[
        {studentRef:'s1',name:'Học viên A',checkpoints:[]},{studentRef:'s2',name:'Học viên B',checkpoints:[]}]};
      const settings={dashboard,liveByStudent:new Map(),onQuery:()=>{},onFilter:()=>{},onOpen:()=>{}};
      renderThuyRoster(roster,settings);const first=roster.querySelector('tbody tr');
      for(let i=0;i<3;i++)renderThuyRoster(roster,{...settings,dashboard:structuredClone(dashboard)});
      const rosterStable=first===roster.querySelector('tbody tr');
      const next=structuredClone(dashboard);next.students[1].checkpoints=[{blockId:'part'}];renderThuyRoster(roster,{...settings,dashboard:next});
      const rowOnly=first===roster.querySelector('tbody tr')&&roster.querySelectorAll('tbody tr')[1].textContent.includes('Đã nộp');
      const libraryHost=document.createElement('section');document.body.append(libraryHost);let fromSource=false,assigned;
      const done=new Promise(resolve=>{
        const entry={id:'snapshot-v1',title:'Bản chụp V1',sourceDraftId:'draft',sourceRevision:1};
        const library=createFormLibrary({host:libraryHost,request:async(path)=>{
          if(path.includes('?scope='))return {entries:path.endsWith('izone')?[entry]:[]};
          if(path==='/teacher/form-library/snapshot-v1')return {entry:{...entry,definition:{formVersionId:'same-version-id',blocks:[]}}};
          if(path==='/teacher/form-publications/from-source'){fromSource=true;return {publication:{id:'publication-v1',libraryEntryId:entry.id,revision:1,formVersionId:'pinned-v1'}};}
          throw Error('Unexpected '+path);
        },onAssign:full=>{assigned=full.publication.id;resolve();}});
        library.setPublications([{id:'publication-v2',draftId:'draft',revision:2,formVersionId:'same-version-id'}]);
        void library.refresh().then(()=>libraryHost.querySelector('tbody button.primary').click());
      });await done;
      return {stable,updated,beforeText,feedback:feedback.textContent,noRef:noRef===null,obsolete:root.textContent.includes('Xem phân bố và học viên'),rosterStable,rowOnly,fromSource,assigned};
    });
    assert.equal(result.stable,true);assert.equal(result.updated,true);assert.equal(result.obsolete,false);
    assert.equal(result.rosterStable,true);assert.equal(result.rowOnly,true);
    assert.equal(result.fromSource,true);assert.equal(result.assigned,'publication-v1');
    assert.ok(result.beforeText.indexOf('Đáp án đúng')<result.beforeText.indexOf('2/3 học viên'));
    assert.match(result.feedback,/Đáp án tham khảo: Nội dung đối chiếu/);assert.doesNotMatch(result.feedback,/✕ Sai|✓ Đúng/);assert.equal(result.noRef,true);
    assert.deepEqual(errors,[]);
  }finally{await browser.close();await new Promise(done=>server.close(done));}
});
