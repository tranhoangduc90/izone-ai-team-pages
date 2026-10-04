import assert from 'node:assert/strict';
import { checkSubmission } from '../speaking-homework/checker.mjs';

// Dữ liệu giả: một chu trình chỉ được tính khi có câu hỏi và câu trả lời thật.
function conversation(cycles, speaking = false) {
  const messages = [];
  const completed = [];
  for (let number = 1; number <= cycles; number += 1) {
    const questionMessage = messages.push({ role: 'assistant', text: `Question ${number}?` });
    const answerMessage = messages.push({ role: 'user', text: `Answer ${number} with enough words.` });
    if (speaking) {
      const feedbackMessage = messages.push({ role: 'assistant', text: `Feedback ${number}.` });
      const repeatMessage = messages.push({ role: 'user', text: `Full improved answer ${number}.` });
      completed.push({ questionMessage, answerMessage, feedbackMessage, repeatMessage });
    } else {
      completed.push({ questionMessage, answerMessage });
    }
  }
  return { source: 'direct', messages, completed };
}

const shareUrl = 'https://chatgpt.com/share/test-conversation-id';
const paraphrase = conversation(5);
let readCalls = 0;
const accepted = await checkSubmission(
  { section: 'paraphrase', url: shareUrl },
  {
    readShare: async () => { readCalls += 1; return paraphrase; },
    analyze: async () => ({ completed: paraphrase.completed, confidence: 0.92, typingEvidence: [] }),
  },
);
assert.equal(readCalls, 1, 'Xác nhận phải đọc link thật qua máy chủ');
assert.equal(accepted.kind, 'pass');
assert.equal(accepted.count, 5);
assert.equal(accepted.source, 'direct');
assert.match(accepted.fingerprint, /^[0-9a-f]{64}$/);

const shortConversation = conversation(4);
const short = await checkSubmission(
  { section: 'paraphrase', url: shareUrl },
  { readShare: async () => shortConversation, analyze: async () => ({ completed: shortConversation.completed, confidence: 0.9, typingEvidence: [] }) },
);
assert.equal(short.kind, 'blocked');
assert.match(short.message, /4\/5/);

const repeatedSameQuestion = await checkSubmission(
  { section: 'paraphrase', url: shareUrl },
  { readShare: async () => paraphrase, analyze: async () => ({
    completed: paraphrase.completed.map((item) => ({ ...item, questionMessage: 1 })),
    confidence: 0.9, typingEvidence: [],
  }) },
);
assert.equal(repeatedSameQuestion.kind, 'blocked', 'Nhiều câu trả lời cho một câu hỏi chỉ tính một lần');
assert.equal(repeatedSameQuestion.count, 1);

const speaking = conversation(3, true);
speaking.messages[1].text = 'I said spekaing twice: spekaing.';
const warning = await checkSubmission(
  { section: 'speaking', url: shareUrl },
  { readShare: async () => speaking, analyze: async () => ({ completed: speaking.completed, confidence: 0.88, typingEvidence: [{ quote: 'spekaing', reason: 'Lỗi chữ lặp lại' }] }) },
);
assert.equal(warning.kind, 'pass');
assert.doesNotMatch(warning.message, /giọng nói|spekaing/);

const inventedEvidence = await checkSubmission(
  { section: 'speaking', url: shareUrl },
  { readShare: async () => speaking, analyze: async () => ({ completed: speaking.completed, confidence: 0.88, typingEvidence: [{ quote: 'invented typo', reason: 'Đoán' }] }) },
);
assert.equal(inventedEvidence.kind, 'pass', 'Không hiện cảnh báo với bằng chứng không có trong chat');

const privateLink = await checkSubmission(
  { section: 'speaking', url: shareUrl },
  { readShare: async () => { throw new Error('HTTP 404'); }, analyze: async () => { throw new Error('Không được gọi AI'); } },
);
assert.equal(privateLink.kind, 'blocked');

const aiFailure = await checkSubmission(
  { section: 'paraphrase', url: shareUrl },
  { readShare: async () => paraphrase, analyze: async () => { throw new Error('AI timeout'); } },
);
assert.equal(aiFailure.kind, 'error', 'AI lỗi không được nhận bài');

const wrongLink = await checkSubmission(
  { section: 'paraphrase', url: 'https://chatgpt.com/c/private' },
  { readShare: async () => { throw new Error('Không được đọc'); }, analyze: async () => ({}) },
);
assert.equal(wrongLink.kind, 'blocked');

// Lesson 3 có bốn link riêng; cấp 1 cần đủ ba loại từ, Freestyle cần hai chu trình.
const levelOne = conversation(3);
const categories = ['noun', 'verb', 'adjective'];
const fullLevelOne = await checkSubmission(
  { section: 'clarify_1', url: shareUrl },
  { readShare: async () => levelOne, analyze: async () => ({
    completed: levelOne.completed.map((item, index) => ({ ...item, category: categories[index] })),
    confidence: 0.9, typingEvidence: [],
  }) },
);
assert.equal(fullLevelOne.kind, 'pass');
const missingAdjective = await checkSubmission(
  { section: 'clarify_1', url: shareUrl },
  { readShare: async () => levelOne, analyze: async () => ({
    completed: levelOne.completed.map((item, index) => ({ ...item, category: categories[Math.min(index, 1)] })),
    confidence: 0.9, typingEvidence: [],
  }) },
);
assert.equal(missingAdjective.kind, 'blocked');
assert.match(missingAdjective.message, /Tính từ/);
for (const section of ['clarify_2', 'clarify_3']) {
  const two = conversation(2);
  const result = await checkSubmission({ section, url: shareUrl },
    { readShare: async () => two, analyze: async () => ({ completed: two.completed, confidence: 0.9, typingEvidence: [] }) });
  assert.equal(result.kind, 'pass', section);
}
const freestyle = conversation(2, true);
const completeFreestyle = await checkSubmission({ section: 'freestyle', url: shareUrl },
  { readShare: async () => freestyle, analyze: async () => ({ completed: freestyle.completed, confidence: 0.9, typingEvidence: [] }) });
assert.equal(completeFreestyle.kind, 'pass');

console.log('Speaking Homework: kiểm link thật, khối lượng, cảnh báo và lỗi đạt.');
