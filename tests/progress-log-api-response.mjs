import test from 'node:test';
import assert from 'node:assert/strict';
import {readLearningResponse} from '../progress-log/api-response.js';

test('Chỉ nhận JSON có xác nhận ok; giữ lỗi đọc body khác với HTTP 200',async()=>{
  assert.deepEqual(await readLearningResponse(Response.json({ok:true,value:17})),{ok:true,value:17});
  const broken=new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('{"ok":'));controller.error(new TypeError('connection reset'));}}),{status:200});
  await assert.rejects(readLearningResponse(broken),e=>e.code==='INCOMPLETE_RESPONSE'&&e.retryable&&e.status===undefined&&!e.message.includes('200'));
  for(const body of ['<html>proxy</html>','{"ok":', 'null','[]','{}'])
    await assert.rejects(readLearningResponse(new Response(body,{status:200})),e=>['INVALID_JSON','INVALID_RESPONSE'].includes(e.code)&&e.retryable);
});

test('Phân biệt timeout/hủy và quyền; không coi JSON hỏng là đăng nhập thành công',async()=>{
  for(const reason of [new DOMException('deadline','TimeoutError'),new DOMException('context changed','AbortError')]){
    const abort=new AbortController();abort.abort(reason);
    await assert.rejects(readLearningResponse({ok:true,status:200,json:async()=>{throw reason;}},{signal:abort.signal}),
      e=>e.code===(reason.name==='TimeoutError'?'READ_TIMEOUT':'READ_ABORTED')&&e.status===undefined);
  }
  for(const status of [401,403,404,429,503])
    await assert.rejects(readLearningResponse(new Response('<html>error</html>',{status})),e=>e.status===status&&e.retryable===(status>=500||status===429));
  await assert.rejects(readLearningResponse(Response.json({ok:false,error:'READ_DENIED',message:'Không có quyền'},{status:403})),
    e=>e.status===403&&e.code==='READ_DENIED'&&e.message==='Không có quyền'&&!e.retryable);
  await assert.rejects(readLearningResponse(Response.json({ok:false})),e=>e.status===200&&!e.message.includes('200')&&!e.retryable);
});
