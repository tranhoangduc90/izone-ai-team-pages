// Duyệt bốn bảng kỹ năng bằng dữ liệu giả có nhãn; không kết nối máy chủ thật.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const {chromium}=createRequire('C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
const people=[['a','Học viên A',4,6],['b','Học viên B',5,3]].map(([studentRef,name,term1,term2])=>({studentRef,name,cells:[['Mini Test',0],['Term Test 1',term1],['Term Test 2',term2]].map(([title,score],index)=>({sessionNumber:8+index,status:'test_result',testResult:{testSlug:title,title,writing:{score,tasks:{1:{feedback:'Task 1 · '+name+' · '+title+' · Nhận xét giả để duyệt giao diện. '.repeat(15)},2:{feedback:'Task 2 · '+name+' · '+title}}}}}))}));
const overview={classId:'1294',sessions:[1,2,3,8,9,10].map(sessionNumber=>({sessionNumber,sessionDate:'2026-10-22'})),students:people};
const forms=[1,2,3].map(sessionNumber=>({sessionNumber,definition:{blocks:[{items:[{itemVersionId:'score',interactionType:'number_score',skillCodes:['listening']},{itemVersionId:'speaking',interactionType:'multi_choice_group',graderType:'none',skillCodes:['speaking'],options:[{id:'vocab',label:'Thiếu từ vựng để diễn đạt ý'}]}]}]},dashboard:{students:people.map(person=>({...person,sessionComment:person.studentRef==='a'?{visibility:'visible',noteText:'Nhận xét Speaking giả buổi '+sessionNumber}:null}))},live:{students:[{studentRef:'a',submissionId:'s'+sessionNumber,finalResponses:{score:{correct:sessionNumber+2,total:10},speaking:['vocab']}}]}}));
test('Thủy kỹ năng UI: bốn tab, ưu tiên, thiếu khác 0, hai chiều Term Test, Đọc đủ và tổng quan',{timeout:60000},async()=>{
 const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://local').pathname;
  if(path==='/fixture.json'){res.setHeader('content-type','application/json');return res.end(JSON.stringify({overview,forms}));}
  if(path==='/fixture.html'){res.setHeader('content-type','text/html; charset=utf-8');return res.end(`<!doctype html><html><head><link rel="stylesheet" href="/progress-log/thuy-live/styles.css"></head><body class="thuy-live"><main style="max-width:1152px;margin:auto;padding:24px"><p>Dữ liệu giả để kiểm giao diện</p><div id="course"></div><div id="person"></div></main><script type="module">import{buildSkillCourse,renderTeacherSkills,renderPersonSkills}from'/progress-log/thuy-live/course-skills.js';const data=await(await fetch('/fixture.json')).json(),course=buildSkillCourse(data.overview,data.forms);renderTeacherSkills(document.querySelector('#course'),course,{onSummary:person=>renderPersonSkills(document.querySelector('#person'),course,person,{onOpen:(...value)=>window.opened=value}),onOpen:(...value)=>window.opened=value});</script></body></html>`);}
  const file=resolve(root,'.'+path);if(!file.startsWith(resolve(root)+sep))throw Error('Denied');res.setHeader('content-type',{'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.woff2':'font/woff2'}[extname(file)]||'application/octet-stream');res.end(await readFile(file));
 }catch{res.writeHead(404);res.end();}});
 await new Promise(done=>server.listen(0,'127.0.0.1',done));const origin=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(8000);await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 try{
  await page.goto(origin+'/fixture.html');await page.getByText('Ưu tiên xem · TB 3 buổi: 40%',{exact:true}).waitFor();
  await page.getByLabel('Lọc dữ liệu kỹ năng',{exact:true}).selectOption('priority');assert.equal(await page.locator('#course tbody tr').count(),1);
  await page.locator('.thuy-skill-tabs').getByRole('button',{name:'Reading',exact:true}).click();await page.getByLabel('Lọc dữ liệu kỹ năng',{exact:true}).selectOption('missing');assert.equal(await page.locator('#course tbody tr').count(),2);
  await page.locator('.thuy-skill-tabs').getByRole('button',{name:'Writing',exact:true}).click();
  const firstName=()=>page.locator('#course tbody tr').first().locator('td').first().innerText();
  for(const [order,name]of [['test-low-1','Học viên A'],['test-high-1','Học viên B'],['test-low-2','Học viên B'],['test-high-2','Học viên A']]){await page.getByLabel('Sắp xếp kỹ năng',{exact:true}).selectOption(order);assert.equal(await firstName(),name);}
  assert.equal(await page.locator('#course tbody tr').first().locator('td').nth(1).locator('b').innerText(),'0');
  await page.locator('#course tbody tr').first().getByRole('button',{name:'Đọc đủ',exact:true}).nth(1).click();await page.locator('dialog').getByText('Task 2: Task 2 · Học viên A · Term Test 1',{exact:true}).waitFor();await page.keyboard.press('Escape');await page.locator('dialog').waitFor({state:'detached'});
  await page.locator('.thuy-skill-tabs').getByRole('button',{name:'Speaking',exact:true}).click();await page.getByText('1 học viên · 3 phiếu có phản hồi',{exact:true}).waitFor();await page.getByText('Thiếu từ vựng: 3',{exact:true}).waitFor();
  await page.locator('#course tbody tr').first().getByRole('button',{name:'Học viên A',exact:true}).click();assert.equal(await page.locator('#person .thuy-four-skills>.card').count(),4);
  await page.locator('#person').getByRole('button',{name:/Buổi 8/}).click();assert.deepEqual(await page.evaluate(()=>window.opened),['a',8]);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(done=>server.close(done));}
});
