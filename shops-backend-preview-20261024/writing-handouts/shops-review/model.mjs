import { WHOLE, available, ideaPassed, vocabEligible } from '../shared/workflow.mjs';

export const ACTIVITY = 'writing-task2-public-health-ban';
export const STORAGE = 'izone:shops-review:20261024:v1';
export const STATEMENT = 'Shops should be banned from selling any food or drink that has been scientifically proven to be damaging to public health. Do you agree or disagree?';
export const LABELS = {
  topicSentence: 'Topic Sentence', idea1: 'Idea 1', idea2: 'Idea 2',
  a1: 'A1 · Điểm đầu', x1: 'X1 · Cầu nối', b1: 'B1 · Điểm cuối',
  a2: 'A2 · Điểm đầu', x2: 'X2 · Cầu nối', b2: 'B2 · Điểm cuối',
  draft1: 'Draft 1', draft2: 'Draft 2',
};
export const SECTIONS = { topic: 'Ý tưởng & Topic Sentence', si1: 'Lập luận ý 1', si2: 'Lập luận ý 2', draft: 'Draft' };
export const STATUS = { draft: 'Chưa Check', revision: 'Cần sửa', passed: 'Đã thông qua', pending: 'Đang xử lý', technical_error: 'Lỗi xử lý' };
export const PEOPLE = [
  { id: 'sample-a', name: 'Học viên mẫu A', classCode: 'CS.070626', scenario: 'revision' },
  { id: 'sample-b', name: 'Học viên mẫu B', classCode: 'CS.070626', scenario: 'draft' },
  { id: 'sample-c', name: 'Học viên mẫu C', classCode: 'CS.070626', scenario: 'fresh' },
  { id: 'sample-d', name: 'Học viên mẫu D', classCode: 'CS.160826', scenario: 'error' },
  { id: 'sample-e', name: 'Học viên mẫu E', classCode: 'CS.160826', scenario: 'result' },
  { id: 'sample-f', name: 'Học viên mẫu F', classCode: 'CS.160826', scenario: 'idea2' },
];
export const SCENARIOS = {
  revision: 'Ý 1 cần sửa', fresh: 'Bắt đầu từ đầu', topic: 'Chuẩn bị Topic',
  idea2: 'Đang làm ý 2', summary: 'Nội dung & từ vựng', draft: 'Đang viết Draft',
  result: 'Đã có kết quả', error: 'Lỗi Check & thử lại', support: 'Cần hỗ trợ sau 3 lần',
  vocab_error: 'Lỗi lấy từ vựng', vocab_pending: 'Đang tạo từ vựng',
};
const EXAMPLE = {
  body1_message: 'Lệnh cấm có thể bảo vệ sức khỏe cộng đồng.',
  body1_idea1: 'Giảm khả năng tiếp cận thực phẩm, đồ uống gây hại.',
  body1_idea2: 'Giảm gánh nặng lên hệ thống y tế trong dài hạn.',
  body2_message: 'Một lệnh cấm toàn bộ vẫn có những hạn chế cần cân nhắc.',
  body2_idea1: 'Quyền lựa chọn của người tiêu dùng có thể bị thu hẹp.',
  body2_idea2: 'Giáo dục và quản lý mức tiêu thụ cũng có thể giúp giảm tác hại.',
  topicSentence: 'Banning the sale of harmful products could bring substantial benefits to public health.',
  idea1: 'Giảm khả năng tiếp cận thực phẩm, đồ uống gây hại.',
  idea2: 'Giảm gánh nặng lên hệ thống y tế trong dài hạn.',
  a1: 'Các cửa hàng không còn được bán những sản phẩm đã được chứng minh gây hại.',
  x1: 'Khi ít có cơ hội mua và sử dụng các sản phẩm này, người tiêu dùng có thể giảm mức tiêu thụ.',
  b1: 'Mức độ tiếp xúc với những sản phẩm gây hại được giảm xuống.',
  a2: 'Việc giảm tiêu thụ các sản phẩm gây hại có thể làm giảm số ca bệnh liên quan.',
  x2: 'Khi ít người cần điều trị dài hạn hơn, bệnh viện có thể dành nguồn lực cho các nhu cầu khác.',
  b2: 'Áp lực lên hệ thống y tế có thể giảm trong dài hạn.',
  draft1: 'Banning the sale of harmful products could bring substantial benefits to public health. When these products are no longer available in shops, consumers may buy and consume less of them. This could reduce their exposure to substances that damage their health. In addition, lower consumption may reduce the number of related illnesses. As fewer people need long-term treatment, hospitals could direct more resources towards other patients.',
  draft2: 'Banning the sale of harmful products could bring substantial benefits to public health. First, removing these products from shops would limit consumers’ access to them, potentially reducing consumption and the associated health risks. Second, fewer cases of preventable illness could ease pressure on healthcare services. With fewer patients requiring long-term treatment, hospitals could allocate more resources to other essential care.',
};
const makeId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
const step = () => ({ status: 'draft', history: [], edited: false });
export const fieldsFor = section => section === 'topic'
  ? ['body1_message', 'body1_idea1', 'body1_idea2', 'body2_message', 'body2_idea1', 'body2_idea2', 'topicSentence', 'idea1', 'idea2']
  : section === 'draft' ? ['draft2'] : ['a', 'x', 'b'].map(p => p + section.slice(-1));
export const snapshotFor = (s, section) => Object.fromEntries(fieldsFor(section).map(k => [k, s.responses[k]]));
export const signature = value => JSON.stringify(value);
export const canOpen = (s, section) => ['topic', 'si1', 'si2'].includes(section)
  ? available(s, section) : ['summary', 'draft', 'result'].includes(section) && vocabEligible(s, 0)
    && (section !== 'result' || s.steps.draft.status === 'passed');
export const completeCount = s => ['topic', 'si1', 'si2'].filter(k => s.steps[k].status === 'passed').length;
export const wordCount = text => String(text || '').trim().split(/\s+/).filter(Boolean).length;

export function fixture(person, scenario = person.scenario) {
  const s = {
    activity: ACTIVITY, workflowMode: WHOLE, workflowVersion: 1,
    id: person.id, instance: makeId(), person, revision: 0, updatedAt: new Date().toISOString(),
    responses: Object.fromEntries(Object.keys(EXAMPLE).map(k => [k, ''])), bodyChoice: 'body1',
    steps: { topic: step(), si1: step(), si2: step(), draft: step() },
    idea2Open: false, draft2Open: false, threads: [], events: [], view: 'topic',
  };
  if (scenario === 'fresh') return s;
  s.responses = { ...EXAMPLE, draft1: '', draft2: '' };
  if (scenario === 'topic') return s;
  seedPass(s, 'topic');
  s.view = 'si1';
  if (['revision', 'error', 'support'].includes(scenario)) {
    if (scenario !== 'error') s.responses.x1 = 'Mọi người sẽ khỏe mạnh hơn.';
    s.steps.si1.status = scenario === 'error' ? 'technical_error' : 'revision';
    s.steps.si1.history.push({ status: s.steps.si1.status, at: s.updatedAt, snapshot: snapshotFor(s, 'si1'), feedback: feedbackFor('si1', s.steps.si1.status) });
    s.steps.si1.submitted = true;
    if (scenario === 'error') s.steps.si1.history = [];
    if (scenario === 'support') s.steps.si1.history = Array.from({length:3},()=>({status:'revision',at:s.updatedAt,snapshot:snapshotFor(s,'si1'),feedback:feedbackFor('si1','revision')}));
    if (scenario === 'revision') {
      s.threads.push({ id: 'sample-thread-1', field: 'x1', quote: s.responses.x1, source: s.responses.x1, resolved: false, messages: [{ actor: 'teacher', text: 'Từ việc không còn bán đến việc giảm tiêu thụ có những bước nào? Em thử làm rõ cầu nối này nhé.', at: s.updatedAt }] });
    }
    return s;
  }
  seedPass(s, 'si1'); s.idea2Open = true; s.view = 'si2';
  if (scenario === 'idea2') return s;
  seedPass(s, 'si2'); s.view = 'summary';
  if (['vocab_error', 'vocab_pending'].includes(scenario)) { s.vocabStatus = scenario === 'vocab_error' ? 'failed' : 'pending'; return s; }
  if (scenario === 'summary') return s;
  s.responses.draft1 = EXAMPLE.draft1; s.responses.draft2 = EXAMPLE.draft2;
  s.draft2Open = true; s.view = 'draft';
  if (scenario === 'result') { seedPass(s, 'draft'); s.view = 'result'; }
  return s;
}
function seedPass(s, section) {
  s.steps[section].status = 'passed';
  s.steps[section].history.push({ status: 'passed', at: s.updatedAt, snapshot: snapshotFor(s, section), feedback: feedbackFor(section, 'passed') });
}
export function feedbackFor(section, status) {
  if (status === 'technical_error') return 'Chưa nhận được kết quả kiểm tra. Nội dung đang viết được giữ lại; bạn có thể thử lại. Đây là tình huống lỗi mô phỏng.';
  if (status === 'passed') return section === 'topic'
    ? 'Ví dụ phản hồi đạt: Topic Sentence bao quát hai Idea của thân bài đã chọn và thể hiện hướng lập luận nhất quán.'
    : 'Ví dụ phản hồi đạt: các điểm A–X–B liên kết rõ và cùng hỗ trợ Idea. Bạn có thể tiếp tục bước kế tiếp.';
  return section === 'topic'
    ? 'Ví dụ phản hồi cần sửa: hai Idea đã hỗ trợ cùng một thông điệp chưa? Topic Sentence có bao quát cả hai và bám vào việc cấm bán không?'
    : 'Ví dụ phản hồi cần sửa: X đã giải thích rõ vì sao A dẫn đến B chưa? Em thử nêu bước trung gian còn thiếu và kiểm lại chuỗi, thay vì chỉ lặp kết quả cuối.';
}

// Preview chỉ nhận dữ liệu giả, giữ snapshot mỗi lần Check. Kết quả do người xem chọn,
// không đánh giá chất lượng bài và không gửi dữ liệu tới AI hoặc hệ thống học viên thật.
export function startCheck(s, section, outcome) {
  if (!['passed', 'revision', 'technical_error'].includes(outcome)) throw new Error('Kết quả mẫu không hợp lệ.');
  if (!canOpen(s, section)) throw new Error('Phần này chưa mở.');
  if (s.steps[section].status === 'pending') throw new Error('Yêu cầu này đang xử lý.');
  if (s.steps[section].status === 'passed' && !s.steps[section].edited) throw new Error('Phần này đã thông qua. Chọn Sửa nội dung để kiểm lại.');
  if (section === 'draft' && (!s.draft2Open || !s.responses.draft1.trim())) throw new Error('Hãy viết Draft 1 rồi chuyển sang Draft 2.');
  const snapshot = snapshotFor(s, section);
  if (Object.values(snapshot).some(v => !v.trim())) throw new Error('Hãy điền đủ các ô của phần này trước khi Check.');
  const job = { id: makeId(), instance: s.instance, section, outcome, snapshot, at: new Date().toISOString() };
  s.steps[section].submitted = true;
  s.steps[section].attemptCount = (s.steps[section].attemptCount || s.steps[section].history.length) + 1;
  s.steps[section].status = 'pending'; s.steps[section].job = job;
  return job;
}
export function finishCheck(s, job) {
  const part = s.steps[job.section];
  if (s.instance !== job.instance || part.job?.id !== job.id) return false;
  if (signature(snapshotFor(s, job.section)) !== signature(job.snapshot)) {
    part.status = 'draft'; delete part.job; return false;
  }
  const result = { status: job.outcome, at: new Date().toISOString(), snapshot: job.snapshot, feedback: feedbackFor(job.section, job.outcome) };
  if (result.status !== 'technical_error') part.history.push(result);
  part.status = result.status; part.edited = false; delete part.job;
  delete part.approval;
  s.events.unshift({ text: `${SECTIONS[job.section]} · ${STATUS[result.status]} (mô phỏng)`, at: result.at,
    kind:result.status==='technical_error'?'job_failed':'job_completed',event_at:result.at,section:job.section,job_ref:job.id,snapshot:job.snapshot,feedback:result.feedback,status:result.status });
  return true;
}
export function recoverPending(s) {
  for (const part of Object.values(s.steps)) if (part.status === 'pending') {
    part.status = 'technical_error'; delete part.job;
  }
  return s;
}
export function editSection(s, section) {
  if (s.steps[section].status === 'pending') throw new Error('Chờ lần Check đang xử lý kết thúc.');
  s.steps[section].edited = true;
}
export function attest(s, section) {
  const part = s.steps[section];
  if (!['topic', 'si1', 'si2'].includes(section) || !canOpen(s, section) || !part.history.length && !part.job && !part.submitted) throw new Error('Cần gửi Check phần này ít nhất một lần trước khi xác nhận.');
  part.status = 'passed'; part.edited = false; delete part.job;
  part.approval = { source: 'student_attestation', at: new Date().toISOString() };
  s.events.unshift({kind:'student_attested_teacher_permission',event_at:part.approval.at,section,details:{source:'student_attestation'}});
}
export function setField(s, key, value) {
  if (!(key in s.responses)) throw new Error('Ô viết không hợp lệ.');
  const section = ['topicSentence', 'idea1', 'idea2'].includes(key) || key.startsWith('body') ? 'topic' : key.startsWith('draft') ? 'draft' : 'si' + key.slice(-1);
  if (s.steps[section].status === 'pending') throw new Error('Phần này đang được Check.');
  if (s.responses[key] === value) return;
  const before = s.responses[key];
  s.responses[key] = value;
  if (key === `${s.bodyChoice}_idea1`) s.responses.idea1 = value;
  if (key === `${s.bodyChoice}_idea2`) s.responses.idea2 = value;
  if (['idea1', 'idea2'].includes(key)) s.responses[`${s.bodyChoice}_${key}`] = value;
  s.steps[section].edited = true;
  if (s.steps[section].status === 'passed') s.events.unshift({kind:'content_edited',event_at:new Date().toISOString(),section,details:{before:{[key]:before},after:{[key]:value}}});
}
export function selectBody(s, value) {
  if (!['body1', 'body2'].includes(value)) throw new Error('Thân bài không hợp lệ.');
  if (s.steps.topic.status === 'pending') throw new Error('Topic đang được Check.');
  s.bodyChoice = value;
  s.responses.idea1 = s.responses[`${value}_idea1`]; s.responses.idea2 = s.responses[`${value}_idea2`];
  // Chuyển đối tượng luyện cần kiểm lại, nhưng vẫn giữ bài và mọi lịch sử cũ.
  for (const part of Object.values(s.steps)) { part.status = 'draft'; part.edited = true; delete part.job; }
  s.idea2Open = false; s.view = 'topic';
}
export function openIdea2(s) {
  if (!ideaPassed(s, 1)) throw new Error('Ý 1 cần thông qua trước.');
  s.idea2Open = true; s.view = 'si2';
}
export function copyDraft(s) {
  if (!canOpen(s, 'draft') || !s.responses.draft1.trim()) throw new Error('Hãy hoàn thiện lập luận và viết Draft 1 trước.');
  s.responses.draft2 = s.responses.draft1; s.draft2Open = true; s.steps.draft.edited = true;
}
export function addThread(s, { field, text, quote = '' }) {
  if (!(field in LABELS) || !text.trim()) throw new Error('Chọn phần bài và nhập góp ý.');
  if (quote && !s.responses[field].includes(quote)) throw new Error('Đoạn chọn đã thay đổi. Hãy chọn lại trên bài hiện tại.');
  const thread = { id: makeId(), field, quote, source: s.responses[field], resolved: false, messages: [{ actor: 'teacher', text: text.trim(), at: new Date().toISOString() }] };
  s.threads.push(thread); return thread;
}
export function reply(s, id, actor, text) {
  const thread = s.threads.find(t => t.id === id);
  if (!thread || !['teacher', 'student'].includes(actor) || !text.trim()) throw new Error('Không gửi được câu trả lời trống.');
  thread.messages.push({ actor, text: text.trim(), at: new Date().toISOString() });
  if (actor === 'student') thread.resolved = false;
}
export function dashboardState(s) {
  if (Object.values(s.steps).some(p => p.status === 'technical_error')) return 'error';
  if (s.threads.some(t => !t.resolved) || Object.values(s.steps).some(p => p.status === 'revision')) return 'support';
  if (s.steps.draft.status === 'passed' && !s.steps.draft.edited) return 'complete';
  if (Object.values(s.steps).some(p => p.status === 'pending')) return 'pending';
  if (!Object.values(s.responses).some(Boolean)) return 'fresh';
  return 'working';
}
export function saveSession(storage, s) {
  const next = { ...s, revision: s.revision + 1, updatedAt: new Date().toISOString() };
  const key = `${STORAGE}:${s.id}`;
  storage.setItem(key, JSON.stringify(next));
  if (storage.getItem(key) !== JSON.stringify(next)) throw new Error('Chưa xác nhận được bản lưu trên thiết bị.');
  return next;
}
export function loadSession(storage, person) {
  const value = storage.getItem(`${STORAGE}:${person.id}`);
  if (!value) return fixture(person);
  const s = JSON.parse(value);
  if (s.activity !== ACTIVITY || s.id !== person.id || s.workflowMode !== WHOLE) throw new Error('Bản lưu mẫu không khớp người hoặc bài.');
  return s;
}
export const VOCABULARY = [
  ['Ý 1 · A', 'ban the sale of', 'cấm bán', 'a sales ban', 'một lệnh cấm bán'],
  ['Ý 1 · X', 'limit access to', 'hạn chế khả năng tiếp cận', 'reduce consumption', 'giảm mức tiêu thụ'],
  ['Ý 1 · B', 'health risks', 'rủi ro sức khỏe', 'reduce exposure to', 'giảm tiếp xúc với'],
  ['Ý 2 · A', 'preventable illness', 'bệnh có thể phòng tránh', 'related conditions', 'các bệnh liên quan'],
  ['Ý 2 · X', 'long-term treatment', 'điều trị dài hạn', 'allocate resources', 'phân bổ nguồn lực'],
  ['Ý 2 · B', 'ease pressure on', 'giảm áp lực lên', 'healthcare services', 'dịch vụ y tế'],
];
