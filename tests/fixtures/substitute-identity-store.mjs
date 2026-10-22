// Kho giả chỉ trong RAM cho kiểm giao diện, không phải backend production.
// Nhận bài/phiên giả, giữ số lần nhận và trả biên nhận; không chấm hoặc ghi Portal.
import assert from 'node:assert/strict';
export const TESTS = Object.fromEntries(['substitute-test-1-k56','substitute-test-2-k56',
  'substitute-test-1-k67','substitute-test-2-k67'].map(slug => [slug, {
  readingMax: slug === 'substitute-test-1-k56' ? 26 : 40,
  taskNumber: slug === 'substitute-test-2-k56' ? 1 : 2
}]));
const epoch = '11111111-1111-4111-8111-111111111111';
const version = 'substitute-k67-test2-two-task-20261007-v1';
const key = input => JSON.stringify([input.testSlug,input.classCode,input.studentRef,input.clientRunId]);
export class SubstituteStore {
  constructor() {
    this.attempts = new Map(); this.exams = new Map(); this.sections = new Map();
    this.db = { prepare: sql => ({ get: skill => {
      if (sql === 'SELECT audio_ended_at FROM exam_session') return { audio_ended_at: null };
      if (sql === 'SELECT count(*) n FROM section_submission WHERE skill=?') return { n: [...this.sections.keys()].filter(k=>k.endsWith(skill)).length };
      assert.equal(sql, 'SELECT count(*) AS n FROM attempt'); return { n: this.attempts.size };
    } }) };
  }
  configureWritingRelease(slug, state) { assert.equal(slug,'substitute-test-2-k67'); assert.equal(state,'open'); }
  historyState(input) { return { testSlug: input.testSlug, historyEpoch: epoch, stateVersion: 2, maintenance: false }; }
  startWritingSession(input) {
    assert.equal(input.historyEpoch,epoch);
    return { ...input, examVersion: version, writingSessionId: input.clientRunId };
  }
  startExamSession(input) {
    assert.equal(input.historyEpoch,epoch);
    if (!this.exams.has(key(input))) this.exams.set(key(input), { ...input,
      timingVersion:'substitute-audio-transfer-20261014-v1', listeningStartedAt:new Date().toISOString(),
      listeningDeadlineAt:'', audioEndedAt:'', transferSeconds:300 });
    return { ...this.exams.get(key(input)), serverNow:new Date().toISOString() };
  }
  saveSectionSubmission(input) {
    assert.equal(input.historyEpoch,epoch); assert.ok(input.clientRunId);
    const index=key(input)+input.skill;
    if(!this.sections.has(index))this.sections.set(index,{persisted:true,snapshotHash:'a'.repeat(64),submittedAt:new Date().toISOString(),section:structuredClone(input.section)});
    return structuredClone(this.sections.get(index));
  }
  readSectionSubmission(input) {
    assert.equal(input.historyEpoch,epoch);assert.ok(this.exams.has(key(input)));
    const binding=Object.fromEntries(['testSlug','classCode','studentRef','clientRunId','historyEpoch','skill'].map(k=>[k,input[k]]));
    return {...binding,...structuredClone(this.sections.get(key(input)+input.skill)||{persisted:false})};
  }
  submit(input) {
    assert.equal(input.historyEpoch,epoch); assert.ok(input.clientRunId);
    if (input.examVersion) { assert.equal(input.examVersion,version); assert.equal(input.tasks.length,2);
      assert.ok(input.tasks.every(task=>task.essay.trim())); }
    else assert.ok(input.essay.trim());
    const index=key(input);
    if (!this.attempts.has(index)) this.attempts.set(index,{ ...input, status:'queued', submittedAt:new Date().toISOString() });
    return structuredClone(this.attempts.get(index));
  }
  read(input) { assert.ok(this.attempts.has(key(input))); return structuredClone(this.attempts.get(key(input))); }
  close() { this.attempts.clear(); this.exams.clear(); this.sections.clear(); }
}
export function gradingFromReadback(saved) {
  assert.equal(saved.status,'queued');
  return { status:'queued', ready:false, submittedAt:saved.submittedAt,
    taskStates:saved.examVersion?{task1:'queued',task2:'queued'}:{['task'+saved.taskNumber]:'queued'} };
}
