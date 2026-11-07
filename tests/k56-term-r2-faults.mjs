import assert from 'node:assert/strict';
import test from 'node:test';

process.env.K56_FIXTURE_IMPORT_ONLY='1';
const {fixture}=await import('./term2-offline-browser.mjs');

for(const product of [1,2]){
 for(const scenario of ['corrupt','sources unavailable','native denied']){
  test(`Term ${product} R2 · ${scenario}`,{timeout:100000},async()=>{
   const f=await fixture('lis_first',{product});
   try{
    f.controls.r2Audio=true;
    f.controls.corruptR2=scenario==='corrupt';
    f.controls.primaryAudioFail=scenario==='sources unavailable';
    f.controls.pagesAudioFail=f.controls.primaryAudioFail;
    f.controls.denyOfflinePrepare=scenario==='native denied';
    const p=f.page;
    await p.goto(f.url);
    await p.locator('#bootstrapStudent option[value="'+f.student+'"]').waitFor({state:'attached'});
    await p.selectOption('#bootstrapStudent',f.student);
    await p.click('#confirmIdentity');
    await p.waitForFunction(({product,scenario})=>{
     const runtime=window['K56_TERM'+product+'_OFFLINE'];
     const notice=document.getElementById('bootstrapNotice')?.textContent||'';
     if(scenario==='corrupt')return runtime?.active;
     if(scenario==='native denied')return notice.includes('Fixture từ chối');
     return document.getElementById('bootstrapDownloadStep')?.dataset.state==='error';
    },{product,scenario},{timeout:65000});
    const hosts=f.controls.audioCalls.map(url=>new URL(url).hostname);
    if(scenario==='native denied')assert.deepEqual(hosts,[]);
    else{
     assert.match(hosts[0],/\.r2\.cloudflarestorage\.com$/);
     assert.ok(hosts.slice(1).length&&hosts.slice(1).every(host=>host==='tranhoangduc90.github.io'));
    }
    assert.equal(await p.locator('#bootstrapStart').isDisabled(),true);
    assert.equal(await p.evaluate(product=>Boolean(window['K56_TERM'+product+'_OFFLINE']?.record?.sections.listening?.startedAt),product),false);
    assert.deepEqual(f.errors,[]);
   }finally{await f.close();}
  });
 }
}
