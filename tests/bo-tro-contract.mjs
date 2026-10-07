// Kiểm hợp đồng gửi bài và các lỗi có thể làm gửi sai lớp, link hoặc trạng thái.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseLinks,buildPayload,sendSubmission} from '../bo-tro/contract.mjs';
test('một link lặp chỉ tạo một bài, bỏ phần query và fragment',()=>{
  assert.deepEqual(parseLinks('https://chatgpt.com/share/abc?utm=x\nhttps://chatgpt.com/share/abc#test'),['https://chatgpt.com/share/abc']);
});
test('chặn link riêng, domain giả, HTTP, credential và link không chia sẻ',()=>{
  for(const link of ['https://chatgpt.com/c/abc','https://chatgpt.com.evil.test/share/abc','http://chatgpt.com/share/abc','https://u:p@chatgpt.com/share/abc','https://example.com/share/abc','https://chatgpt.com/share/abc/extra'])assert.throws(()=>parseLinks(link));
});
test('giới hạn lượt gửi và chặn danh sách rỗng',()=>{
  assert.throws(()=>parseLinks(''));
  assert.throws(()=>parseLinks(Array.from({length:11},(_,i)=>'https://chatgpt.com/share/'+i).join('\n')));
});
test('giữ đúng lớp, tên tiếng Việt và ba trường của form cũ',()=>{
  assert.deepEqual(buildPayload('IC2314','  Học viên thử  ',['https://chatgpt.com/share/abc']),{records:[{fields:{'Lớp':'IC2314','Học viên':'Học viên thử','Bài luyện tập':'https://chatgpt.com/share/abc'}}]});
  assert.throws(()=>buildPayload('IC2270','Học viên thử',['https://chatgpt.com/share/abc']));
  assert.throws(()=>buildPayload('IC2314','<script>',['https://chatgpt.com/share/abc']));
});
test('gửi đúng payload tới receiver cũ, chỉ xác nhận nhận yêu cầu',async()=>{
  const payload=buildPayload('IC2314','Học viên thử',['https://chatgpt.com/share/abc']);
  const result=await sendSubmission(payload,async(url,options)=>{
    assert.equal(new URL(url).pathname,'/webhook/0510dc1f-669b-4fa8-be7a-31d596f562a9');
    assert.equal(options.method,'POST');assert.deepEqual(JSON.parse(options.body),payload);
    return {ok:true,text:async()=>'{"message":"Workflow was started"}'};
  });
  assert.deepEqual(result,{state:'received'});
});
test('HTTP lỗi hoặc lỗi nghiệp vụ không được báo nhận bài thành công',async()=>{
  for(const response of [{ok:false,status:500},{ok:true,text:async()=>'{"code":1254003}'},{ok:true,text:async()=>'{"ok":false}'}])await assert.rejects(sendSubmission({records:[]},async()=>response));
});
