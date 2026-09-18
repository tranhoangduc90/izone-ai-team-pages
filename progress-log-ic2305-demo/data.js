/* Dữ liệu nhận vào: trạng thái demo trong trình duyệt, không đọc hệ thống thật.
 * Việc chính: cấp 18 hồ sơ ẩn danh và 15 bài đã nộp để minh họa buổi 2.
 * Kết quả: hai giao diện dùng chung một kho demo; khi lỗi lưu, chỉ mất thay đổi demo.
 */
export const KEY = 'izone:progress-log:ic2305:demo:v1';
export const TITLE = 'ENTRANCE TICKET • WRITING 1';
export const CLASS = 'IC2305';
export const SESSION = 2;

export const BLOCKS = [
  { number: 1, title: 'NHÌN LẠI BÀI HỌC TRƯỚC', items: ['q1', 'q2'] },
  { number: 2, title: 'KIẾN THỨC TỔNG QUAN WRITING TASK 2', items: ['q3', 'q4', 'q5'] },
  { number: 3, title: 'CÁCH PHÁT TRIỂN Ý', items: ['q6'] }
];

export const QUESTIONS = {
  q1: { number: 1, type: 'long_text', prompt: 'Trong phần bài tập về nhà của bài trước, bài, câu hoặc dạng bài nào khiến em gặp khó khăn nhất? Theo em, điều gì khiến phần đó khó với em?' },
  q2: { number: 2, type: 'long_text', prompt: 'Em thấy nội dung nào trong buổi học trước hữu ích nhất đối với việc học hoặc làm bài của mình? Hãy nêu rõ kiến thức đó là gì.' },
  q3: { number: 3, type: 'choice', prompt: 'Đâu là thời gian và số lượng từ tối thiểu được yêu cầu để hoàn thành một bài Writing Task 2?', options: [
    ['A', '20 phút - 150 từ'], ['B', '40 phút - 250 từ'], ['C', '40 phút - 150 từ']
  ] },
  q4: { number: 4, type: 'sentence', prompt: 'Hãy điền các từ khóa chính để hoàn thiện phần giải thích 4 tiêu chí chấm điểm của bài thi Writing Task 2:', rows: [
    { title: 'Task Response:', parts: ['Yêu cầu người viết phải trả lời đúng ', ' và ', '.'] },
    { title: 'Coherence and Cohesion:', parts: ['Đảm bảo sự liên kết về ', ' (Coherence) và liên kết về ', ' (Cohesion).'] },
    { title: 'Lexical Resource:', parts: ['Sử dụng từ vựng đảm bảo tính ', ' và ', '.'] },
    { title: 'Grammatical Range and Accuracy:', parts: ['Sử dụng cấu trúc ngữ pháp đảm bảo tính ', ' và ', '.'] }
  ] },
  q5: { number: 5, type: 'choice', prompt: 'Theo nguyên tắc chung khi lập luận, đúng hay sai khi cho rằng: “Có những lập luận là nghiễm nhiên đúng nên người viết không cần phải làm rõ hay chứng minh thêm.”', options: [
    ['TRUE', 'Đúng'], ['FALSE', 'Sai']
  ] },
  q6: { number: 6, type: 'sentence', prompt: 'Dựa vào bài học, hãy nêu 2 cách cơ bản để làm rõ và chứng minh cho một lập luận.', rows: [
    { title: '', parts: ['', ' và ', '.'] }
  ] }
};

const examples = [
  ['Phần tìm ý cho bài tập về nhà khó vì em chưa phân biệt luận điểm với ví dụ.', 'Em thấy cách xác định đúng yêu cầu đề hữu ích nhất.'],
  ['Em mất nhiều thời gian để triển khai một luận điểm đủ rõ.', 'Em nhớ nguyên tắc mỗi ý chính cần được giải thích và chứng minh.'],
  ['Câu hỏi về tiêu chí chấm điểm khiến em nhầm giữa mạch ý và liên kết câu.', 'Em thấy việc lập dàn ý trước khi viết giúp bài có cấu trúc rõ hơn.'],
  ['Em chưa chắc nên dùng ví dụ cụ thể đến mức nào trong bài về nhà.', 'Em thấy phần phân biệt luận điểm và dẫn chứng rất hữu ích.']
];

function completedResponses(index) {
  const [q1, q2] = examples[index % examples.length];
  return {
    q1, q2, q3: 'B',
    q4: ['yêu cầu đề bài', 'phát triển ý đầy đủ', 'mạch ý', 'ngôn ngữ', 'phù hợp', 'linh hoạt', 'đa dạng', 'chính xác'],
    q5: index < 10 ? 'FALSE' : 'TRUE',
    q6: ['giải thích', 'đưa ví dụ cụ thể']
  };
}

export function seed() {
  const now = new Date().toISOString();
  return {
    schema: 1, releases: ['open', 'open', 'open'], updatedAt: now,
    students: Array.from({ length: 18 }, (_, index) => {
      const complete = index < 15;
      const typing = index === 15;
      return {
        id: `demo-${String(index + 1).padStart(2, '0')}`,
        name: `Học viên minh họa ${String(index + 1).padStart(2, '0')}`,
        responses: complete ? completedResponses(index) : typing ? { q1: 'Em đang xem lại bài tập về nhà và chuẩn bị ghi khó khăn của mình.' } : {},
        checkpoints: complete ? [1, 2, 3] : [],
        submitted: complete,
        attendance: complete ? 'self_confirmed' : 'pending_teacher',
        portalSync: complete ? 'demo_only' : null,
        revision: complete ? 4 : typing ? 1 : 0,
        updatedAt: complete || typing ? now : null,
        note: ''
      };
    })
  };
}

let inMemory = null;
export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.schema === 1 && Array.isArray(parsed.students) && parsed.students.length === 18) return parsed;
    }
    const initial = seed();
    localStorage.setItem(KEY, JSON.stringify(initial));
    return initial;
  } catch {
    inMemory ??= seed();
    return inMemory;
  }
}

export function save(data) {
  data.updatedAt = new Date().toISOString();
  try { localStorage.setItem(KEY, JSON.stringify(data)); }
  catch { inMemory = data; }
  window.dispatchEvent(new CustomEvent('demo-data-updated'));
}

export function reset() {
  const initial = seed();
  save(initial);
  return initial;
}

export function isPresent(question, value) {
  if (question.type === 'sentence') return Array.isArray(value) && value.length === question.rows.length * 2 && value.every(part => String(part ?? '').trim());
  return Boolean(String(value ?? '').trim());
}

export function isComplete(student) {
  return Object.entries(QUESTIONS).every(([key, question]) => isPresent(question, student.responses[key]));
}

export function answerText(key, value) {
  if (Array.isArray(value)) return value.map((part, index) => `${index + 1}. ${part || '—'}`).join('\n');
  if (key === 'q3' || key === 'q5') return QUESTIONS[key].options.find(option => option[0] === value)?.[1] || '—';
  return value || '—';
}
