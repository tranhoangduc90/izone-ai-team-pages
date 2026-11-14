import assert from 'node:assert/strict';
import test from 'node:test';
import {pathToFileURL} from 'node:url';
import {serve} from './helpers/result-details-browser-fixture.mjs';

const playwright = process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright';
const {chromium} = await import(playwright);
const grantId = 'a242b20f-cc9c-487f-a165-23cec623cddd';
const foreignId = '0519c666-140a-448c-aacb-5a3c98afe05b';
const studentRef = 'b90bba62-4c1f-41cc-800f-55522d781d1a';

test('Cấp, sao chép, bị từ chối và thu hồi link cùng grantId qua ba kỹ năng', async t => {
  const server = await serve();
  const browser = await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL || 'msedge',headless:true});
  t.after(async () => { await browser.close(); await server.close(); });
  const context = await browser.newContext({serviceWorkers:'block'});
  const page = await context.newPage();
  page.on('dialog', dialog => dialog.accept());
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const origin = process.env.TEACHER_AUDIO_PUBLIC_BASE || server.base;
  const entry = new URL('term-tests/teacher-k56/',origin).href;
  const module = new URL('term-tests/teacher-k56/term1-skill-manager.mjs?v=20261114-grant-log-v1',origin).href;
  await context.route('**/*', route => [module,entry].includes(route.request().url()) ? route.continue() : route.abort());
  assert.equal((await page.goto(entry)).status(),200);

  for (const [section,label] of [['listening','Listening'],['reading','Reading'],['writing','Writing']]) {
    await page.evaluate(async ({section,module,grantId,foreignId,studentRef}) => {
      const {openTerm1SkillManager,readTerm1SkillGrantJournal}=await import(module);
      let activeGrant;
      window.fixture={read:readTerm1SkillGrantJournal,revoke:'denied',requests:[]};
      Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{}}});
      const opener=document.createElement('button');
      document.body.append(opener);
      openTerm1SkillManager({section,opener,classCode:'IC9999',student:{ref:studentRef,name:'Tên giả cho fixture'},
        isCurrent:()=>true,request:async(path,options)=>{
          const action=path.split('/').at(-1), input=JSON.parse(options.body);
          fixture.requests.push({action,input});
          if(action==='manage')return {ok:true,issueEnabled:true,attemptExists:true,activeGrant};
          if(action==='issue'){
            activeGrant={grantId,state:'awaiting',expiresAt:'2026-11-14T09:00:00Z'};
            return {ok:true,section,grantId,token:'do-not-record-link',activationCode:'do-not-record-code'};
          }
          if(fixture.revoke==='denied')throw Object.assign(Error('fixture denied'),{status:403});
          if(fixture.revoke==='wrong')return {ok:true,section,grantId:foreignId};
          activeGrant=null;
          return {ok:true,section,grantId};
        },
      });
    },{section,module,grantId,foreignId,studentRef});
    const modal=page.getByRole('dialog');
    await modal.getByRole('button',{name:'Cấp link '+label}).click();
    await modal.getByRole('button',{name:'Sao chép link '+label.toLowerCase(),exact:true}).click();
    await page.waitForFunction(section=>fixture.read().some(row=>row.section===section&&row.action==='copy_link'),section);
    await modal.getByRole('button',{name:'Thu hồi link'}).click();
    await modal.getByRole('button',{name:'Kiểm tra trạng thái'}).click();
    await page.evaluate(()=>fixture.revoke='wrong');
    await modal.getByRole('button',{name:'Thu hồi link'}).click();
    await modal.getByRole('button',{name:'Kiểm tra trạng thái'}).click();
    await page.evaluate(()=>fixture.revoke='ok');
    await modal.getByRole('button',{name:'Thu hồi link'}).click();
    await modal.getByRole('button',{name:'Cấp link '+label}).waitFor();
    const rows=(await page.evaluate(()=>fixture.read())).filter(row=>row.section===section);
    assert.ok(rows.some(row=>row.action==='issue'&&row.outcome==='confirmed'&&row.grantId===grantId));
    assert.ok(rows.some(row=>row.action==='copy_link'&&row.outcome==='confirmed'&&row.grantId===grantId));
    assert.ok(rows.some(row=>row.action==='revoke'&&row.outcome==='denied'&&row.status===403&&row.grantId===grantId));
    assert.ok(rows.some(row=>row.action==='revoke'&&row.outcome==='unconfirmed'&&row.grantId===grantId));
    assert.equal(rows.filter(row=>row.action==='revoke'&&row.outcome==='confirmed'&&row.grantId===grantId).length,1);
    for(const privateValue of [studentRef,foreignId,'IC9999','Tên giả cho fixture','do-not-record'])assert.ok(!JSON.stringify(rows).includes(privateValue));
    await modal.getByRole('button',{name:'Đóng'}).click();
  }
  assert.deepEqual(errors,[]);
});
