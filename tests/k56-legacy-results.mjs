import test from 'node:test';import assert from 'node:assert/strict';
process.env.TERM2_FULL_ROUND='1';const{fixture,wait}=await import('./term2-offline-browser.mjs');
for(const product of [1,2])test(`Term${product}: kết quả lượt cũ giữ Task/điểm và không cấp offline mới`,{timeout:50000},async()=>{
 const f=await fixture('lis_first',{product}),p=f.page,taskNumber=product===1?2:1,past=new Date(Date.now()-7200000).toISOString();
 const section=n=>({correct:20,total:n,details:[{number:1,studentAnswer:'A',correctAnswer:'A',correct:true}],typeStats:[]});
 f.controls.preparedOverride={nextSection:'result',completed:true,listeningSubmitted:true,readingSubmitted:true,listeningStartedAt:past,readingStartedAt:past,writingStartedAt:past,writingSubmittedAt:past};
 const result={studentName:'Học viên giả Term 2',className:'IC5601',completed:true,portalSyncStatus:'synced',writing:{started:true,submitted:true,[`task${taskNumber}`]:'Historical canonical answer.',grading:{status:'processing',ready:false,tasks:[]}},result:{testTitle:`Term Test ${product}`,listening:section(40),reading:section(product===1?26:40)}};f.controls.resultResponse=result;
 try{await p.goto(f.url);await p.locator('#bootstrapStudent option[value="'+f.student+'"]').waitFor({state:'attached'});await p.selectOption('#bootstrapStudent',f.student);await p.click('#confirmIdentity');await p.getByText('Phần Writing của bạn đang được giáo viên chấm điểm, kết quả sẽ được hiển thị sau',{exact:true}).waitFor();assert.equal(f.calls.some(x=>x.includes('/offline/prepare')),false);
  const details=p.locator('#questionDetails details');await details.first().locator('summary').click();await p.waitForTimeout(16000);assert.equal(await details.first().evaluate(e=>e.open),true);
  result.writing.grading={ready:true,status:'ready',writingScore:6,tasks:[{taskNumber,taskScore:6,wordCount:4,report:'Synthetic historical report.',criteria:['TR','CC','LR','GRA'].map(code=>({code,bandScore:6,feedback:'Fixture',components:[]}))}]};
  const button=p.getByRole('button',{name:new RegExp(`Writing Task ${taskNumber}.*Band 6`)});await button.waitFor();await button.click();await p.getByRole('dialog').waitFor();assert.ok((await p.getByRole('dialog').innerText()).includes('Historical canonical answer.'));assert.deepEqual(f.errors,[]);assert.equal(f.calls.some(x=>x.includes('/offline/prepare')),false);
 }finally{await f.close();}
});
