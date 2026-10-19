import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {serve} from './helpers/result-details-browser-fixture.mjs';

const imported=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const {chromium}=imported.chromium?imported:imported.default;
const A='20000000-0000-4000-8000-000000000001',B='20000000-0000-4000-8000-000000000002';
const extra='20000000-0000-4000-8000-000000000003',code='67-speaking-diem_giua';

// Kiểm các lỗi review bằng renderer thật, Google/API giả và đồng hồ ảo.
// Mọi đường ghi và audio bị chặn, không đọc hệ thống học viên.
async function fixture(t,{readiness=false,units=[A]}={}){
 const server=await serve(),browser=await chromium.launch({channel:'msedge',headless:true});
 t.after(async()=>{await browser.close();await server.close();});
 const context=await browser.newContext(),page=await context.newPage();page.setDefaultTimeout(5000);
 await page.clock.install();
 const stats={list:0,detail:0,forbidden:[],errors:[],failure:null};
 page.on('pageerror',error=>stats.errors.push(error.message));
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname;
  if(req.resourceType()==='media'||/\.(mp3|wav|ogg)(?:$|\?)/i.test(url.href)){stats.forbidden.push(path);return route.abort();}
  if(url.hostname==='127.0.0.1')return route.continue();
  if(url.hostname!=='ducizone.ddns.net'||req.method()!=='GET'){stats.forbidden.push(req.method()+' '+path);return route.abort();}
  if(path.endsWith('/classes'))return route.fulfill({json:{ok:true,classes:[{classId:'1293',classCode:'IC2304'}]}});
  if(path.endsWith('/entry'))return route.fulfill({json:{ok:true,code,classId:'1293',studentRef:A,unitIds:units}});
  if(path.endsWith('/students')){
   stats.list++;
   if(stats.failure){const status=stats.failure;stats.failure=null;return route.fulfill({status,json:{ok:false,message:'Mạng thử gián đoạn.'}});}
   return route.fulfill({json:{ok:true,assignment:{title:'Speaking thử'},students:[A,B].map((id,i)=>({studentRef:id,name:'Học viên '+(i?'B':'A'),active:true,
    ...(readiness?{sessions:[{}]}:{units:(i?[B]:units).map(id=>({id,status:'draft',sentLinks:1}))})}))}});
  }
  if(path.includes('/units/')||path.includes('/students/')){
   stats.detail++;const id=path.split('/').at(-1);
   return route.fulfill({json:readiness?{ok:true,student:{studentRef:id,name:'Học viên A'},sessions:[{viewId:'a'.repeat(64),writingText:'Nháp đã lưu'}]}:
    {ok:true,id,status:'draft',student:{name:'Học viên A',classCode:'IC2304'},assignment:{parts:[],requiredPracticeCount:2},
     links:[{kind:'practice',part:'practice_3',slot:3,status:'accepted',url:'https://chatgpt.com/share/extra-practice'}]}});
  }
  stats.forbidden.push(path);return route.abort();
 });
 const url=readiness?server.base+'term-tests/lam-quen-k67/teacher.html':server.base+'speaking-homework/teacher-progress.html?code='+code;
 return {page,stats,url,check:()=>{assert.deepEqual(stats.errors,[]);assert.deepEqual(stats.forbidden,[]);}};
}

test('Speaking hiện link Luyện thêm vượt số bài bắt buộc',async t=>{
 const f=await fixture(t);await f.page.goto(f.url);await f.page.getByRole('button',{name:'Xem bài →',exact:true}).first().click();
 await f.page.getByRole('heading',{name:'Học viên A',exact:true}).waitFor();
 assert.equal(await f.page.getByRole('link',{name:'Mở hội thoại học viên đã gửi ↗'}).count(),1);
 assert.match(await f.page.locator('#detail').innerText(),/Luyện thêm 3/);f.check();
});

for(const readiness of [false,true])test((readiness?'Làm quen':'Speaking')+': mạng hồi phục thì tự cập nhật tiếp; 403 ngừng đọc và ẩn dữ liệu',async t=>{
 const f=await fixture(t,{readiness}),{page,stats}=f;await page.goto(f.url);await page.locator('#rows button').first().waitFor();
 const before=stats.list;stats.failure=503;await page.clock.fastForward(31000);await page.getByText('Mạng thử gián đoạn.',{exact:false}).waitFor();
 assert.equal(stats.list,before+1);await page.clock.fastForward(31000);
 await page.waitForFunction(()=>!document.getElementById('notice').textContent.includes('Mạng thử gián đoạn.'));
 assert.equal(stats.list,before+2);stats.failure=403;await page.clock.fastForward(31000);
 await page.waitForFunction(()=>document.getElementById('workspace').hidden);const denied=stats.list;
 await page.clock.fastForward(61000);assert.equal(stats.list,denied);assert.equal(await page.locator('#rows button').count(),0);f.check();
});

for(const units of [[],[A,extra]])test('Speaking CTA cá nhân chọn đúng người với '+units.length+' lượt, giữ sau tải lại',async t=>{
 const f=await fixture(t,{units}),{page}=f;await page.goto(f.url+'&documentId=fixture-doc');await page.getByText('Học viên A',{exact:true}).waitFor();
 assert.equal(await page.getByText('Học viên B',{exact:true}).count(),0);
 assert.equal(await page.locator('#rows [data-unit]').count(),units.length);
 await page.reload();await page.getByText('Học viên A',{exact:true}).waitFor();assert.equal(await page.getByText('Học viên B',{exact:true}).count(),0);
 if(!units.length)assert.equal(f.stats.detail,0);
 await page.locator('#search').fill('');await page.locator('#search').dispatchEvent('input');await page.getByText('Học viên B',{exact:true}).waitFor();
 await page.reload();await page.getByText('Học viên B',{exact:true}).waitFor();f.check();
});
