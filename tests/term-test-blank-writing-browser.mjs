// Giao diện thật, bài và API giả; kiểm đủ hai Term/hai thứ tự, không ghi môi trường ngoài.
import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {serve,completedPage} from './helpers/result-details-browser-fixture.mjs';
const modules=process.env.CODEX_NODE_MODULES||resolve(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const {chromium}=createRequire(pathToFileURL(resolve(modules,'playwright/package.json')))('playwright');
let browser,server;
test.before(async()=>{server=await serve();browser=await chromium.launch({channel:'chrome',headless:true});});
test.after(async()=>{await browser?.close();await server?.close();});
const blank=n=>({taskNumber:n,taskScore:0,wordCount:0,gradingMethod:'blank_rule',criteria:[],report:'## Điểm theo quy tắc bài trắng\n\nKhông có nội dung bài làm.'});
for(const slug of ['term-test-1','term-test-2'])for(const mode of ['lis_first','read_first'])test(`${slug}/${mode}: hiển thị 0 và quy tắc bài trắng`,async()=>{
  const grading={ready:true,status:'ready',writingScore:0,task1Score:slug==='term-test-2'?0:null,task2Score:0,tasks:(slug==='term-test-2'?[1,2]:[2]).map(blank)};
  const f=await completedPage(browser,server.base,slug+'-computer-based',{writingResult:grading,examMode:mode,waitTimeout:15000});
  try{
    const button=f.page.getByRole('button',{name:/Writing Task 2/});
    await button.waitFor({state:'visible'});assert.match(await button.innerText(),/Band 0/);
    if(slug==='term-test-2')assert.match(await f.page.getByRole('button',{name:/Writing Task 1/}).innerText(),/Band 0/);
    await button.click();const dialog=f.page.getByRole('dialog');await dialog.waitFor({state:'visible'});
    const text=await dialog.innerText();assert.match(text,/Band 0/);assert.match(text,/Điểm theo quy tắc bài trắng/);
    assert.match(text,/Không có nội dung bài làm/);assert.doesNotMatch(text,/Chấm theo 4 tiêu chí/);
    assert.deepEqual(f.errors,[]);
  }finally{await f.close();}
});
for(const slug of ['term-test-1','term-test-2'])test(`${slug}: giảng viên mở bài trắng 0 không có nhận xét AI`,async()=>{
  const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage(),errors=[];
  page.setDefaultTimeout(15000);
  page.on('pageerror',e=>errors.push(e.message));
  const reviewer={email:'teacher@example.test',displayName:'Giảng viên giả',role:'admin',canAccessAllClasses:true};
  const cls={id:'1293',name:'IC2304',accessMode:'admin_override'},ref='11111111-1111-4111-8111-111111111111';
  const section={band:0,correct:0,total:40,details:[],typeStats:[]};
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    assert.ok(['GET','OPTIONS'].includes(route.request().method()));
    const headers={'access-control-allow-origin':route.request().headers().origin||new URL(server.base).origin,'access-control-allow-credentials':'true','access-control-allow-methods':'GET,OPTIONS','access-control-allow-headers':'Content-Type'};
    if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers,body:''});
    let data;
    if(path.endsWith('/api/auth/session'))data={ok:true,reviewer};
    else if(path.endsWith('/teacher/options'))data={ok:true,reviewer,classes:[cls],tests:[{slug,title:slug,version:1}]};
    else if(path.endsWith('/teacher/results'))data={ok:true,reviewer,class:cls,test:{slug,title:slug,version:1},students:[{ref,name:'Học viên giả',status:'completed',result:{listening:section,reading:section,typeStats:[],performance:{best:[],needsImprovement:[]}},writing:{status:'ready',task1State:'complete',task2State:'complete',task1Score:slug==='term-test-2'?0:null,task2Score:0,writingScore:0}}]};
    else if(path.endsWith('/teacher/writing-detail'))data={ok:true,studentName:'Học viên giả',writing:{...blank(2),prompt:'Đề giả',essay:''}};
    else throw Error('API ngoài fixture: '+path);
    await route.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify(data)});
  });
  try{
    await page.goto(server.base+`term-tests/teacher/?class=IC2304&test=${slug}&student=${ref}`);
    await page.getByRole('button',{name:/Writing Task 2/}).click();
    const text=await page.getByRole('dialog').innerText();assert.match(text,/Band 0/);assert.match(text,/Điểm theo quy tắc bài trắng/);assert.deepEqual(errors,[]);
  }finally{await context.close();}
});
