// Metadata lớp thật không cần nhãn DEMO; giữ epoch, người học và nháp qua tải lại.
import fs from 'node:fs';import vm from 'node:vm';import test from 'node:test';import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../term-tests/substitute-shared/state.js',import.meta.url),'utf8');
const epoch='11111111-1111-4111-8111-111111111111';
for(const slug of ['substitute-test-1-k56','substitute-test-2-k56','substitute-test-1-k67','substitute-test-2-k67']){
 test(slug+': mở bằng danh sách chỉ có lớp thật và giữ nguyên định danh/nháp',async()=>{
  let request;
  const context={AbortController,setTimeout,clearTimeout,location:{search:'',href:'https://fixture.invalid/'},window:{addEventListener(){}},fetch:async(_url,options)=>{request=JSON.parse(options.body);return {ok:true,json:async()=>({testSlug:slug,historyEpoch:epoch,stateVersion:2,classes:[{code:'IC2264',name:'IC2264'}]})}}};
  vm.runInNewContext(source,context);const api=context.window.SUBSTITUTE_STATE;await api.initialize({slug},{API_BASE_URL:'https://fixture.invalid/gateway'});
  assert.equal(request.payload.excludeTestClasses,true);
  api.bind({classCode:'IC2264',studentRef:'123456',clientRunId:'22222222-2222-4222-8222-222222222222'});
  const draft=api.stamp({classCode:'IC2264',studentRef:'123456',drafts:{writing:{task2:'Nháp kiểm riêng'}}});
  assert.equal(api.accept(draft),true);assert.equal(api.payload({}).historyEpoch,epoch);
  assert.equal(draft.drafts.writing.task2,'Nháp kiểm riêng');
 });
}
