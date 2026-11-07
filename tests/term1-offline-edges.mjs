import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';
process.env.TERM2_FULL_ROUND='1';const{fixture,wait}=await import('./term2-offline-browser.mjs');
async function ready(f){const p=f.page;await p.goto(f.url);await p.locator('#bootstrapStudent option[value="'+f.student+'"]').waitFor({state:'attached'});await p.selectOption('#bootstrapStudent',f.student);await p.click('#confirmIdentity');await wait(p,()=>window.K56_TERM1_OFFLINE?.active&&window.K56_TERM1_APP_READY,'Ready Reading');}
test('IDB còn hoạt động sau Ready: native mirror lỗi vẫn R40/W55, hết hạn khóa đủ bài',{timeout:100000},async()=>{
 const f=await fixture('read_first',{product:1}),p=f.page;try{await ready(f);f.disconnected=true;await f.context.setOffline(true);
 await p.evaluate(()=>{Storage.prototype.getItem=function(){throw Error('Fixture native mirror blocked');};Storage.prototype.setItem=function(){throw Error('Fixture quota');};});
 await p.getByRole('button',{name:'Bắt đầu Reading',exact:false}).first().click();await p.locator('#readingQuestions input[data-number]').first().fill('IDB-only reading');
 const r=await p.evaluate(()=>{const r=window.K56_TERM1_OFFLINE,s=r.record.sections.reading;return {minutes:(Date.parse(s.deadlineAt)-Date.parse(s.startedAt))/60000,clock:document.querySelector('.cbt-reading-clock').dataset.seconds};});assert.equal(r.minutes,40);assert.ok(Number(r.clock)>=2395);
 await p.evaluate(()=>{const r=window.K56_TERM1_OFFLINE;r.clockServer=Date.parse(r.record.sections.reading.deadlineAt)-100;r.clockMono=performance.now();});await wait(p,()=>window.K56_TERM1_OFFLINE.record.sections.reading.sealed,'IDB-only R hết hạn');
 await wait(p,()=>Boolean(document.getElementById('bootstrapPreview')),'Listening lobby');await p.click('#bootstrapPreview');await p.waitForTimeout(11000);await p.click('#bootstrapStart');await wait(p,()=>window.K56_TERM1_OFFLINE.playerReady,'Listening');await p.click('#submitListening');
 await p.click('#startWriting');await p.locator('[data-writing-task="task2"]').fill('IDB-only Writing — <unsafe>');
 const w=await p.evaluate(()=>{const r=window.K56_TERM1_OFFLINE,s=r.record.sections.writing;return {minutes:(Date.parse(s.deadlineAt)-Date.parse(s.startedAt))/60000,clock:document.querySelector('.cbt-writing-clock').dataset.seconds};});assert.equal(w.minutes,55);assert.ok(Number(w.clock)>=3295);
 await p.evaluate(()=>{const r=window.K56_TERM1_OFFLINE;r.clockServer=Date.parse(r.record.sections.writing.deadlineAt)-100;r.clockMono=performance.now();});await wait(p,()=>window.K56_TERM1_OFFLINE.record.sections.writing.sealed,'IDB-only W hết hạn');
 const d=p.waitForEvent('download');await p.getByRole('button',{name:'Tải bài làm về máy'}).click();const file=await(await d).path(),html=await readFile(file,'utf8');assert.ok(html.includes('IDB-only Writing — &lt;unsafe&gt;'));assert.ok(html.includes('IDB-only reading'));assert.ok(html.includes('32a'));assert.ok(html.includes('32b'));assert.ok(!html.includes('fixture-permit'));assert.deepEqual(f.errors,[]);
 }catch(e){console.error('EDGE_FAILURE',e.message,(await p.locator('body').innerText()).slice(-1700),JSON.stringify(f.errors));throw e;}finally{await f.close();}
});
test('Audio đủ byte nhưng thời lượng không khớp đề không được Ready hoặc chạy giờ',{timeout:40000},async()=>{
 const f=await fixture('lis_first',{product:1}),p=f.page;f.controls.preparedOverride={timing:{listeningDurationSeconds:90,listeningReviewSeconds:0,readingDurationMinutes:40,writingDurationMinutes:55}};
 try{await p.goto(f.url);await p.locator('#bootstrapStudent option[value="'+f.student+'"]').waitFor({state:'attached'});await p.selectOption('#bootstrapStudent',f.student);await p.click('#confirmIdentity');await p.getByText(/Thời lượng audio chưa khớp đề/).waitFor();assert.equal(await p.locator('#bootstrapStart').isDisabled(),true);assert.equal(await p.evaluate(()=>window.K56_TERM1_OFFLINE.active),false);assert.deepEqual(await p.evaluate(()=>window.K56_TERM1_OFFLINE.record.sections),{});
 }finally{await f.close();}
});
test('Nghe thử bị khựng vẫn mở Start sau đủ 10 giây media đã phát',{timeout:50000},async()=>{
 const f=await fixture('lis_first',{product:1}),p=f.page;try{await p.goto(f.url);await p.locator('#bootstrapStudent option[value="'+f.student+'"]').waitFor({state:'attached'});await p.selectOption('#bootstrapStudent',f.student);await p.click('#confirmIdentity');await wait(p,()=>window.K56_TERM1_OFFLINE?.active,'Ready');await p.click('#bootstrapPreview');await p.waitForTimeout(2000);
 await p.locator('audio').evaluate(a=>a.pause());await p.waitForTimeout(4000);assert.equal(await p.locator('#bootstrapStart').isDisabled(),true);
 await p.locator('audio').evaluate(a=>a.play());await wait(p,()=>!document.getElementById('bootstrapStart').disabled,'Đủ thời gian media dù có đoạn khựng',18000);assert.ok(await p.locator('audio').evaluate(a=>a.currentTime)>=10);
 }finally{await f.close();}
});
test('ended giả và seek sát EOF không tự khóa Listening chưa nghe hết',{timeout:50000},async()=>{
 const f=await fixture('lis_first',{product:1}),p=f.page;try{await p.goto(f.url);await p.locator('#bootstrapStudent option[value="'+f.student+'"]').waitFor({state:'attached'});await p.selectOption('#bootstrapStudent',f.student);await p.click('#confirmIdentity');await wait(p,()=>window.K56_TERM1_OFFLINE?.active,'Ready');await p.click('#bootstrapPreview');await p.waitForTimeout(11000);await p.click('#bootstrapStart');await wait(p,()=>window.K56_TERM1_OFFLINE.playerReady,'Player');
 await p.evaluate(()=>{const r=window.K56_TERM1_OFFLINE;r.player.dispatchEvent(new Event('ended'));});assert.equal(await p.evaluate(()=>window.K56_TERM1_OFFLINE.record.sections.listening.sealed),false);
 await p.evaluate(()=>{const r=window.K56_TERM1_OFFLINE;r.player.pause();r.player.currentTime=r.player.duration-.1;});await p.waitForTimeout(300);await p.evaluate(()=>window.K56_TERM1_OFFLINE.player.dispatchEvent(new Event('ended')));await p.waitForTimeout(300);
 assert.equal(await p.evaluate(()=>window.K56_TERM1_OFFLINE.record.player.ended),false);assert.equal(await p.evaluate(()=>window.K56_TERM1_OFFLINE.record.sections.listening.sealed),false);assert.deepEqual(f.errors,[]);
 }finally{await f.close();}
});
test('Đổi người sau Ready nhả latest/lock, giữ nguyên run và câu trả lời cũ',{timeout:50000},async()=>{
 const f=await fixture('read_first',{product:1}),p=f.page;try{await ready(f);await p.getByRole('button',{name:'Bắt đầu Reading',exact:false}).first().click();const field=p.locator('#readingQuestions input[data-number]').first(),answerKey=await field.getAttribute('data-number');await field.fill('Answer of prior owner');
 const key=await p.evaluate(async()=>{const r=window.K56_TERM1_OFFLINE;await r.persist();await r.store.queue;return r.key;});
 await p.getByRole('button',{name:'Đổi người học',exact:true}).click();await wait(p,()=>Boolean(document.getElementById('bootstrapStudent'))&&!window.K56_TERM1_OFFLINE?.active,'Chọn người mới');
 const previous=await p.evaluate(async key=>{const r=window.K56_TERM1_OFFLINE;return {latest:await r.store.get('latest:IC5601'),old:await r.store.get(key)};},key);assert.equal(previous.latest.key,null);assert.equal(previous.old.snapshot.drafts.reading[answerKey],'Answer of prior owner');assert.equal(previous.old.sections.reading.sealed,false);assert.deepEqual(f.errors,[]);
 }finally{await f.close();}
});
