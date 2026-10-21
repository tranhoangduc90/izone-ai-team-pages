// Chạy máy chủ thử trên cổng riêng, kiểm đúng người và dữ liệu gốc trước/sau thao tác.
// Chỉ dùng bản chụp riêng tư do PROGRESS_DEMO_SNAPSHOT chỉ định; không gọi production.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const snapshot=process.env.PROGRESS_DEMO_SNAPSHOT;
test('Hành vi demo với bản chụp thật', {skip:!snapshot}, async t=>{
  const before=await readFile(snapshot),hash=v=>createHash('sha256').update(v).digest('hex');
  const server=spawn(process.execPath,[new URL('./server.mjs',import.meta.url).pathname.replace(/^\/(\w:)/,'$1')],{env:{...process.env,PORT:'7164'},stdio:['ignore','pipe','pipe']});
  t.after(()=>server.kill());
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Máy chủ thử không khởi động.')),10000);server.stdout.once('data',()=>{clearTimeout(timer);resolve();});server.once('exit',code=>reject(new Error('Máy chủ thử đã dừng: '+code)));});
  const base='http://127.0.0.1:7164';
  async function request(route,body){const r=await fetch(base+route,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});return {status:r.status,data:await r.json()};}
  const teacher=(await request('/api/teacher')).data,s=teacher.sessions[0];
  const action=body=>request('/api/demo',{number:s.number,generation:s.generation,...body});
  await t.test('Máy chủ local tải được mô-đun học viên giả nhưng không đưa giả vào API lớp',async()=>{
    for(const [path,name] of [['journey-scenarios.mjs','journeyScenarios'],['test-scenarios.mjs','testScenario']]){
      const response=await fetch(base+'/'+path);
      assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/javascript/);
      assert.ok((await response.text()).includes(name));
    }
    assert.equal(teacher.people.length,18);
    assert.ok(teacher.people.every(p=>!p.studentRef.startsWith('journey-scenario-')));
  });
  await t.test('Danh sách đủ ba buổi; giảng viên có đáp án, học viên chỉ nhận khi được mở',async()=>{
    assert.deepEqual(teacher.sessions.map(v=>[v.number,v.students.length,v.students.filter(p=>p.submitted).length]),[[10,17,14],[9,17,15],[8,18,2]]);
    assert.deepEqual(teacher.sessions.map(v=>v.definition.blocks.flatMap(b=>b.items).length),[10,9,11]);
    assert.doesNotMatch(JSON.stringify(teacher),/publicToken|public_token|privateKey/);
    assert.ok(Object.keys(s.answerKey).length>0);
    const learner=(await request(`/api/student?number=${s.number}&ref=demo-a`)).data;
    assert.doesNotMatch(JSON.stringify(learner),/expectedOptionId|publicToken|privateKey/);
  });
  await t.test('Không phục vụ snapshot, source máy chủ hay đường dẫn ngoài danh sách',async()=>{
    for(const route of ['/snapshot.private.json','/server.mjs','/server.test.mjs','/../snapshot.private.json']) assert.equal((await request(route)).status,404);
    const r=await fetch(base+'/api/demo',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://outside.example'},body:JSON.stringify({action:'reset'})});assert.equal(r.status,403);
  });
  await t.test('Giữ nháp theo đúng người; lỗi lưu không ghi đè nháp đã có',async()=>{
    const id=s.definition.blocks[0].items[0].itemVersionId;
    assert.equal((await action({action:'draft',ref:'demo-a',responses:{[id]:'Bản nháp A'}})).status,200);
    assert.equal((await action({action:'draft',ref:'demo-b',responses:{[id]:'Bản nháp B'}})).status,200);
    assert.equal((await action({action:'draft',ref:'demo-a',responses:{[id]:'Không được lưu'},failSave:true})).status,400);
    assert.equal((await request(`/api/student?number=${s.number}&ref=demo-a`)).data.responses[id],'Bản nháp A');
    assert.equal((await request(`/api/student?number=${s.number}&ref=demo-b`)).data.responses[id],'Bản nháp B');
  });
  await t.test('Nộp phần trống ghi nhận tham gia ngay; không bịa trạng thái Portal',async()=>{
    const result=await action({action:'checkpoint',ref:'demo-b',blockId:s.definition.blocks[1].blockId,responses:{}});
    assert.equal(result.status,200);
    const person=(await request(`/api/student?number=${s.number}&ref=demo-b`)).data;
    assert.equal(person.participated,true);assert.equal(person.submitted,false);assert.equal(person.portal,'simulated');assert.equal(person.checkpoints.length,1);
    assert.equal(person.gradingItems.length,0);
  });
  await t.test('Nháp Speaking không lộ; bản công bố cũ giữ nguyên khi đang sửa',async()=>{
    await action({action:'feedbackDraft',ref:'demo-a',text:'Đang viết dở'});
    assert.equal((await request(`/api/student?number=${s.number}&ref=demo-a`)).data.publishedFeedback,'');
    await action({action:'feedbackPublish',ref:'demo-a',text:'Bản hoàn chỉnh'});
    await action({action:'feedbackDraft',ref:'demo-a',text:'Sửa chưa xong'});
    const student=(await request(`/api/student?number=${s.number}&ref=demo-a`)).data;
    assert.equal(student.publishedFeedback,'Bản hoàn chỉnh');assert.doesNotMatch(JSON.stringify(student),/Sửa chưa xong/);
  });
  await t.test('Nộp cuối trống được nhận và khóa sửa bài',async()=>{
    assert.equal((await action({action:'final',ref:'demo-a',responses:{}})).status,200);
    const person=(await request(`/api/student?number=${s.number}&ref=demo-a`)).data;
    assert.equal(person.submitted,true);assert.equal(person.completeness,'partial');
    assert.equal((await action({action:'draft',ref:'demo-a',responses:{}})).status,400);
  });
  await t.test('Thu hồi giữ lịch sử, bài mới sạch, đường cũ không mở bài thu hồi',async()=>{
    assert.equal((await action({action:'replace',template:9})).status,200);
    const current=(await request('/api/teacher')).data.sessions[0];
    assert.equal(current.retired.length,1);assert.equal(current.retired[0].students.filter(p=>p.submitted).length,14);
    assert.equal(current.students.filter(p=>p.submitted).length,0);
    assert.equal((await request(`/api/student?number=${s.number}&ref=demo-a&generation=0`)).status,410);
    const person=(await request(`/api/student?number=${s.number}&ref=demo-a`)).data;
    assert.deepEqual(person.responses,{});assert.equal(person.publishedFeedback,'');assert.equal(person.retired,undefined);
    assert.equal((await action({action:'draft',ref:'demo-a',responses:{}})).status,400);
  });
  await t.test('Bản chụp riêng tư không đổi sau mọi thao tác',async()=>{assert.equal(hash(await readFile(snapshot)),hash(before));});
});
