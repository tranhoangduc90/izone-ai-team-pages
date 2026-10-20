import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {demoContext,loadStudents,resetStudent,clearStudentStorage} from '../term-tests/demo/model.js';

// Bảo vệ ranh giới thật của reset: định danh, phản hồi, mạng lỗi và dữ liệu người khác.
const a='5f33ab0b-26fb-48d5-a11f-157327018001',b='5f33ab0b-26fb-48d5-a11f-157327018002';
test('Chỉ reset đúng lớp giả, đúng bài và học viên đã yêu cầu',async()=>{
  for(const course of ['56','67'])for(const key of ['term1','term2','mini']){
    const ctx=demoContext(course,key);let calls=0;
    const result=await resetStudent(ctx,a,async(url,options)=>{
      calls++;assert.equal(url,ctx.api+'/api/term-tests/demo/reset');
      assert.deepEqual(JSON.parse(options.body),{classCode:ctx.code,testSlug:ctx.slug,studentRef:a,confirmation:'RESET_DEMO_STUDENT'});
      return {ok:true,json:async()=>({ok:true,reset:{attempts:2,sessions:1}})};
    });assert.equal(calls,1);assert.equal(result.attempts,2);
  }
});
test('Từ chối reset lớp thật hoặc định danh sai trước khi gọi mạng',async()=>{
  let calls=0;const request=()=>{calls++;};
  for(const ctx of [{...demoContext('56','term1'),code:'IC2264'},{...demoContext('67','term1'),api:'https://example.invalid'},{...demoContext('56','term1'),slug:'term-test-1'}])await assert.rejects(resetStudent(ctx,a,request));
  await assert.rejects(resetStudent(demoContext('67','mini'),'wrong',request));assert.equal(calls,0);
});
test('Mất ACK hoặc HTTP lỗi không được báo reset thành công và không tự retry',async()=>{
  for(const response of [{ok:false,json:async()=>({ok:true,reset:{attempts:0,sessions:0}})},{ok:true,json:async()=>({ok:true})},{ok:true,json:async()=>({ok:true,reset:{attempts:-1,sessions:0}})}]){
    let calls=0;await assert.rejects(resetStudent(demoContext('67','mini'),a,async()=>{calls++;return response;}));assert.equal(calls,1);
  }
  let calls=0;await assert.rejects(resetStudent(demoContext('67','mini'),a,async()=>{calls++;throw new Error('network');}));assert.equal(calls,1);
});
test('Roster sai lớp, trùng học viên hoặc rỗng không mở đường vào bài',async()=>{
  const ctx=demoContext('67','term1');
  for(const data of [{ok:true,class:{name:'IC2304'},students:[{ref:a,name:'Demo'}]},{ok:true,class:{name:ctx.code},students:[]},{ok:true,class:{name:ctx.code},students:[{ref:a,name:'A'},{ref:a,name:'B'}]}])await assert.rejects(loadStudents(ctx,async()=>({ok:true,json:async()=>data})));
  assert.deepEqual(await loadStudents(ctx,async()=>({ok:true,json:async()=>({ok:true,class:{name:ctx.code},students:[{ref:a,name:'Học viên demo 01'}]})})),[{ref:a,name:'Học viên demo 01'}]);
});
test('Reset cục bộ giữ người khác, bài khác và danh tính dùng chung',()=>{
  const ctx=demoContext('67','term1'),key=`izone-test:${ctx.slug}:${ctx.code}`;
  const map=new Map([[key,JSON.stringify({studentRef:a})],[key+':student-b',JSON.stringify({studentRef:b})],[key+'X',JSON.stringify({studentRef:a})],['izone-test:term-test-2:CODEXDEMO806',JSON.stringify({studentRef:a})],['student-identity','keep'],[key+':broken','{']]);
  const storage={get length(){return map.size},key:i=>[...map.keys()][i],getItem:k=>map.get(k),removeItem:k=>map.delete(k)};
  clearStudentStorage(ctx,a,[storage]);assert.equal(map.has(key),false);assert.equal(map.size,5);assert.ok(map.has(key+':student-b'));assert.ok(map.has(key+'X'));
});
test('Cấu hình K56 chỉ chuyển đúng CODEXDEMO56 sang kho riêng',async()=>{
  for(const config of ['k56-shared','k56-test2-shared','k56-mini-shared']){
    const code=await readFile(new URL(`../term-tests/${config}/config.js`,import.meta.url),'utf8');
    for(const classCode of ['IC2264','IC2304','CODEXDEMO56','CODEXDEMO56X','']){
      const location={search:'?class='+classCode},window={location};vm.runInNewContext(code,{window,location,URLSearchParams});
      assert.equal(window.TERM_TEST_APP_CONFIG.API_BASE_URL,'https://ducizone.ddns.net/'+(classCode==='CODEXDEMO56'?'mapping-api-demo':'mapping-api-k56'));
    }
  }
});
test('Reset Mini giấy bỏ nháp đúng người, giữ người khác và bài khác',()=>{
  const ctx=demoContext('67','mini'),prefix=`izone-mini-answer:v2:${ctx.slug}:${ctx.code}:`;
  const own=prefix+a+':session',other=prefix+b+':session',otherTest=`izone-mini-answer:v2:term-test-1:${ctx.code}:${a}:session`;
  const map=new Map([[own,JSON.stringify({studentRef:a,drafts:{reading:{1:'old'}}})],[other,JSON.stringify({studentRef:b})],[otherTest,JSON.stringify({studentRef:a})],[prefix+a+':mismatch',JSON.stringify({studentRef:b})]]);
  const storage={get length(){return map.size},key:i=>[...map.keys()][i],getItem:k=>map.get(k),removeItem:k=>map.delete(k)};
  clearStudentStorage(ctx,a,[storage]);assert.equal(map.has(own),false);assert.equal(map.size,3);
  assert.ok(map.has(other));assert.ok(map.has(otherTest));assert.ok(map.has(prefix+a+':mismatch'));
});
