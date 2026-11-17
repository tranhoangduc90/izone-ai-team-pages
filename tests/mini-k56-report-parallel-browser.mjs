import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import test from 'node:test';
process.env.K56_FIXTURE_IMPORT_ONLY='1';
const {fixture,wait}=await import('./term2-offline-browser.mjs');
const output=process.env.TERM2_EVIDENCE;assert.ok(output);
const move=async(p,seconds)=>{
 await p.evaluate(async seconds=>{const a=window.K56_MINI_OFFLINE.player;const ready=new Promise(ok=>a.addEventListener('seeked',ok,{once:true}));a.currentTime=seconds;await ready;},seconds);
 await wait(p,()=>{const a=window.K56_MINI_OFFLINE?.player;return a?.readyState>=3&&!a.paused&&!a.seeking;},'Real Mini media ready');
 await p.waitForFunction(seconds=>window.K56_MINI_OFFLINE.player.currentTime>seconds+.15,seconds);
};
for(const [issue,label] of [['no_sound',null],['wired_headphones','Headphone có dây'],['wireless_headphones','Headphone không dây'],['external_speaker','Loa ngoài']]){
 test('Mini T3 '+issue+' keeps the native interruption route and its next section',{timeout:70000},async()=>{
  const f=await fixture('lis_first',{product:'mini'}),p=f.page;
  f.controls.r2Audio=true;f.controls.preparedOverride={miniCbtParallelEntry:true};
  try{
   await p.goto(f.url);await p.locator('#bootstrapStudent option[value="'+f.student+'"]').waitFor({state:'attached'});
   await p.selectOption('#bootstrapStudent',f.student);await p.click('#confirmIdentity');
   await wait(p,()=>window.K56_MINI_OFFLINE?.record?.ready,'Mini parallel shell prepared');
   await p.evaluate(()=>{const r=window.K56_MINI_OFFLINE,observe=r.observe.bind(r);window.__miniReports=[];r.observe=(action,detail,...rest)=>{
    if(action==='mini_player_observation'&&(/report/.test(detail?.phase||'')))window.__miniReports.push(structuredClone(detail));return observe(action,detail,...rest);};});
   await p.click('#bootstrapPreview');await p.click('#bootstrapStart');
   await wait(p,()=>window.K56_MINI_OFFLINE?.player?.currentTime>1,'Mini audio advancing at 1×');
   const field=p.locator('#listeningQuestions input[data-number]').first();await field.fill('Mini report keeps the current answer');
   if(issue==='no_sound'){
    await p.getByRole('button',{name:'Báo lỗi âm thanh',exact:true}).click();
    await p.locator('#k67ListeningReportChoices').waitFor({state:'visible'});
    await p.screenshot({path:resolve(output,'MINI_REPORT_CHOICES.png'),fullPage:true});
    await p.getByRole('button',{name:'Cancel',exact:true}).click();
    assert.equal(await field.inputValue(),'Mini report keeps the current answer');
    assert.equal(await p.evaluate(()=>Boolean(window.K56_MINI_OFFLINE.record.sections.listening?.interrupted)),false);
    await move(p,20);await p.getByRole('button',{name:'Báo lỗi âm thanh',exact:true}).click();
    await p.locator('.substitute-listening-report').filter({hasText:'khoảng im lặng'}).waitFor({state:'visible'});
    assert.equal(await p.locator('#k67ListeningReportChoices').count(),0);
    assert.equal(await p.evaluate(()=>Boolean(window.K56_MINI_OFFLINE.record.sections.listening?.interrupted)),false);
    await move(p,46);
   }
   await p.getByRole('button',{name:'Báo lỗi âm thanh',exact:true}).click();
   if(issue==='wired_headphones')await p.screenshot({path:resolve(output,'MINI_REPORT_CHOICES_STYLED.png'),fullPage:true});
   await p.getByRole('button',{name:label?'Tôi nghe thấy âm thanh nhưng bị rè':'Tôi không nghe thấy âm thanh',exact:true}).click();
   if(label){
    await p.getByText('Bạn đang dùng thiết bị âm thanh nào?',{exact:true}).waitFor();
    if(issue==='wired_headphones')await p.screenshot({path:resolve(output,'MINI_REPORT_DEVICES.png'),fullPage:true});
    await p.getByRole('button',{name:label,exact:true}).click();
   }
   await p.getByRole('dialog',{name:'Listening gián đoạn',exact:true}).waitFor();
   await wait(p,()=>window.K56_MINI_OFFLINE?.pending===0,'One native-style interrupt receipt');
   const button=p.getByRole('button',{name:'Tôi đã hiểu. Đến phần thi tiếp theo.',exact:true});
   const box=await button.boundingBox();await p.mouse.move(box.x+box.width/2,box.y+box.height-1);
   const frames=await p.evaluate(()=>new Promise(ok=>{const a=[],b=document.querySelector('#offlineListeningInterrupted button');const frame=()=>{a.push(b.getBoundingClientRect().y);a.length<20?requestAnimationFrame(frame):ok(a);};requestAnimationFrame(frame);}));
   assert.equal(new Set(frames).size,1);await button.click();
   await p.locator('#k56SectionReady button').click();
   await p.locator('#readingQuestions input[data-number]').first().fill('Reading after '+issue);
   assert.equal([...f.receipts.values()].filter(row=>row.kind==='interrupt').length,1);
   const rows=await p.evaluate(()=>window.__miniReports);
   assert.ok(rows.some(r=>r.phase==='report_interruption_device_saved'&&r.operationId));
   if(label)assert.ok(rows.some(r=>r.phase==='report_device_selected'&&r.device===issue));
   else{
    assert.ok(rows.some(r=>r.phase==='report_cancelled'));
    assert.ok(rows.some(r=>r.phase==='manual_report_classified'&&r.decision==='planned_silence'));
   }
   if(issue==='external_speaker'){
    const before=await p.evaluate(()=>({scope:window.K56_MINI_OFFLINE.scope,section:window.K56_MINI_OFFLINE.record.sections.reading}));
    f.disconnected=true;await f.context.setOffline(true);await p.reload();
    await wait(p,()=>window.K56_MINI_APP_READY,'Mini Reading restores offline after speaker report');
    assert.equal(await p.locator('#readingQuestions input[data-number]').first().inputValue(),'Reading after '+issue);
    assert.deepEqual(await p.evaluate(()=>({scope:window.K56_MINI_OFFLINE.scope,section:window.K56_MINI_OFFLINE.record.sections.reading})),before);
   }
   assert.deepEqual(f.errors,[]);
   await writeFile(resolve(output,'MINI_REPORT_'+issue+'.json'),JSON.stringify({issue,oneInterruptionReceipt:true,readingOpened:true,stableButtonFrames:frames,observations:rows,
    offlineReadingRestored:issue==='external_speaker',boundary:'Real isolated browser and media with synthetic API; selected media positions, no device sound/Collector/Telegram/production write claim'},null,2));
  }finally{await f.close();}
 });
}
