import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// Nhận cấu hình công khai của từng bài, không tải đáp án hoặc dữ liệu học viên.
// Kiểm định tuyến, số câu và phạm vi lưu bài; lỗi sẽ hiện thành test đỏ.
const read = relative => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const exams = [
  { slug: 'term-test-1-k56', config: 'term-test-1-k56', questions: [40, 26, 1] },
  { slug: 'term-test-2-k56', config: 'term-test-2-k56', questions: [40, 40, 1] },
  { slug: 'mini-test-k56', config: 'mini-test-k56', questions: [10, 13, 1] },
  { slug: 'substitute-test-1-k56', config: 'substitute-test-1-k56', questions: [40, 26, 1] },
  { slug: 'substitute-test-2-k56', config: 'substitute-test-2-k56', questions: [40, 40, 1] }
];

function examConfig(slug) {
  const context = { window: {} };
  vm.runInNewContext(read(`term-tests/${slug}/test-config.js`), context);
  return context.window.TERM_TEST_CONFIG;
}

for (const exam of exams) {
  test(`${exam.slug}: định danh và số câu đúng riêng bài`, () => {
    const config = examConfig(exam.config);
    assert.equal(config.slug, exam.slug);
    assert.deepEqual(
      [config.listening.totalQuestions, config.reading.totalQuestions, config.writing.totalQuestions],
      exam.questions
    );
    for (const skill of ['listening', 'reading']) {
      const numbers = Array.from(config[skill].controls, control => control.number);
      assert.equal(numbers.length, config[skill].totalQuestions);
      assert.deepEqual(numbers, Array.from({ length: numbers.length }, (_, index) => index + 1));
    }
    assert.doesNotMatch(read(`term-tests/${exam.slug}/test-config.js`), /answerKey|correctAnswer|acceptedAnswers|private_key|client_secret/iu);
  });
}

test('Term/Mini K56: demo và lớp thật không được chuyển nhầm sang nhau', () => {
  for (const shared of ['k56-shared', 'k56-test2-shared', 'k56-mini-shared']) {
    for (const [classCode, endpoint] of [
      ['CODEXDEMO56', 'mapping-api-demo'],
      ['IC2264', 'mapping-api-k56'],
      ['IC2175', 'mapping-api-k56'],
      ['IC2180', 'mapping-api-k56']
    ]) {
      const window = { location: { search: `?class=${classCode}` } };
      vm.runInNewContext(read(`term-tests/${shared}/config.js`), { window, URLSearchParams });
      const config = window.TERM_TEST_APP_CONFIG;
      assert.equal(
        config.API_BY_CLASS?.[classCode] || config.API_BASE_URL,
        `https://ducizone.ddns.net/${endpoint}`,
        `${shared}/${classCode} phải định tuyến đúng môi trường`
      );
    }
  }
});

test('Substitute K56: hai bài đi hai gateway riêng và không mượn backend Term/Mini', () => {
  for (const number of [1, 2]) {
    const context = {
      window: { TERM_TEST_APP_CONFIG: null },
      location: { pathname: '/not-the-exam/', href: 'https://example.test/not-the-exam/' },
      history: { replaceState() {} },
      URL
    };
    const shared = number === 1 ? 'substitute-k56-shared' : 'substitute-test-2-k56-shared';
    vm.runInNewContext(read(`term-tests/${shared}/config.js`), context);
    const config = context.window.TERM_TEST_APP_CONFIG;
    assert.equal(config.API_BASE_URL, `https://ducizone.ddns.net/webhook/substitute-test-${number}-k56-public-api`);
    assert.equal(config.API_GATEWAY_MODE, true);
    assert.equal(config.AUTH_MODE, 'online-demo');
  }
});

test('Năm bài giữ khóa lưu và endpoint theo đúng slug, tránh lẫn kết quả giữa bài', () => {
  for (const exam of exams) {
    const sub = exam.slug.startsWith('substitute');
    const app = sub
      ? exam.slug.includes('test-1') ? 'substitute-k56-shared' : 'substitute-test-2-k56-shared'
      : exam.slug.includes('term-test-1') ? 'k56-shared'
        : exam.slug.includes('term-test-2') ? 'k56-test2-shared' : 'k56-mini-shared';
    const source = read(`term-tests/${app}/app.js`);
    assert.match(source, /izone-test:\$\{testConfig\.slug\}:/u, `${exam.slug}: storage phải gắn slug`);
    assert.match(source, /testConfig\.slug/u, `${exam.slug}: request phải gắn bài thi`);
  }
});
