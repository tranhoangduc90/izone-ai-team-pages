import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(process.env.K56_DRAFT_SOURCE || 'term-tests/k56-mini-shared/app.js', 'utf8');
function fixture() {
  const start = source.indexOf('  const sectionDraftTimers =');
  const end = source.indexOf('  function setAnswerControlsLocked(', start);
  assert.ok(start >= 0 && end > start);
  const timers = new Map(), requests = [];
  let next = 0, online = true, transport = async body => ({ accepted: true, revision: body.revision, draft: body.answers });
  const state = { studentRef: 'fake-a', attemptToken: 'fake-attempt', examSessionToken: 'fake-session',
    listeningStartedAt: '2026-10-08T00:00:00Z', readingStartedAt: '2026-10-08T00:00:00Z',
    drafts: { listening: { 1: 'new-L' }, reading: { 1: 'new-R' } },
    draftRevisions: { listening: 3, reading: 3 }, draftAckRevisions: { listening: 1, reading: 1 } };
  const node = skill => ({ skill, querySelectorAll: () => [] });
  const context = vm.createContext({ state, demoMode: '', paperMini: false, paperConfirmed: false, paperEpoch: 0,
    testConfig: { slug: 'mini-test-k56' }, elements: { listeningQuestions: node('listening'), readingQuestions: node('reading') },
    navigator: { get onLine() { return online; } },
    window: { clearTimeout(id) { timers.delete(id); }, setTimeout(fn, delay) { timers.set(++next, { fn, delay }); return next; } },
    collectAnswers: node => ({ ...state.drafts[node.skill] }), saveSession() {}, updateAnswerCount() {},
    async apiRequest(path, options) { const body = JSON.parse(options.body); requests.push({ path, body }); return transport(body); }
  });
  vm.runInContext(source.slice(start, end), context);
  return { state, requests, timers, run: code => vm.runInContext(code, context),
    online(value) { online = value; }, reply(value) { transport = value; },
    async tick() { const [id, item] = timers.entries().next().value || []; assert.ok(item, 'Phải có lần gửi lại đang chờ'); timers.delete(id); item.fn(); for (let i=0;i<10;i++) await new Promise(r=>setImmediate(r)); }
  };
}
test('D02 Mini: lỗi mạng tự gửi lại mà không cần gõ thêm', async () => {
  const h = fixture(); let calls = 0;
  h.reply(async body => { if (++calls === 1) throw Error('offline'); return { accepted: true, revision: body.revision, draft: body.answers }; });
  h.run("scheduleSectionDraft('reading',0)"); await h.tick(); await h.tick();
  assert.equal(h.requests.length,2); assert.equal(h.state.draftAckRevisions.reading,3); assert.equal(h.timers.size,0);
});
test('D02 Mini: chỉ gửi một request mỗi skill, ACK muộn không bỏ mất chỉnh sửa mới', async () => {
  const h = fixture(); let finish;
  h.reply(body=>new Promise(r=>finish=()=>r({accepted:true,revision:body.revision,draft:body.answers})));
  h.run("scheduleSectionDraft('reading',0)"); await h.tick();
  h.state.drafts.reading[1]='newer-R'; h.state.draftRevisions.reading=4;
  h.run("scheduleSectionDraft('reading',0)"); await h.tick(); assert.equal(h.requests.length,1);
  finish(); for(let i=0;i<10;i++)await new Promise(r=>setImmediate(r));
  h.reply(async body=>({accepted:true,revision:body.revision,draft:body.answers})); await h.tick();
  assert.equal(h.requests[1].body.answers[1],'newer-R'); assert.equal(h.state.draftAckRevisions.reading,4);
});
test('D02 Mini: sau nộp hoặc đổi owner không retry/ACK request của người trước', async () => {
  const h = fixture(); let finish;
  h.reply(body=>new Promise(r=>finish=()=>r({accepted:true,revision:body.revision,draft:body.answers})));
  h.run("scheduleSectionDraft('reading',0)"); await h.tick();
  h.state.studentRef='fake-b';h.state.attemptToken='other-attempt';h.state.draftAckRevisions.reading=0;h.state.readingSubmitted=true;
  finish();for(let i=0;i<10;i++)await new Promise(r=>setImmediate(r));
  assert.equal(h.state.draftAckRevisions.reading,0);assert.equal(h.timers.size,0);
  h.run("scheduleSectionDraft('reading',0)");assert.equal(h.timers.size,0);
});
test('D02 Mini: lỗi lặp có backoff và giữ nháp; offline không tạo vòng request', async () => {
  const h = fixture();h.reply(async()=>{throw Error('503');});h.run("scheduleSectionDraft('listening',0)");
  await h.tick();const first=[...h.timers.values()][0].delay;await h.tick();const second=[...h.timers.values()][0].delay;
  assert.ok(first>=1000&&second>first&&second<=15000);assert.equal(h.state.drafts.listening[1],'new-L');
  h.online(false);await h.tick();assert.equal(h.timers.size,0);assert.equal(h.requests.length,2);
});
test('D04 Mini L/R: ACK thiếu/sai revision hoặc draft không đánh dấu nháp đã lưu', async () => {
  for (const skill of ['listening','reading']) for (const reply of [
    {}, {accepted:true,revision:3}, {accepted:true,revision:'3',draft:{1:'wrong'}},
    {accepted:true,revision:4,draft:{1:'wrong'}}, {accepted:true,revision:3,draft:{1:'wrong'}},
    {accepted:false,revision:3,draft:null}, {accepted:false,revision:2,draft:{}},
    {accepted:false,revision:3,draft:{1:42}}
  ]) {
    const h=fixture(), before={...h.state.drafts[skill]};
    h.reply(async()=>reply);h.run(`scheduleSectionDraft('${skill}',0)`);await h.tick();
    assert.equal(h.state.draftAckRevisions[skill],1,JSON.stringify(reply));
    assert.deepEqual(h.state.drafts[skill],before);
    assert.ok([...h.timers.values()][0]?.delay>=1000,'ACK sai phải được retry có backoff');
  }
});
