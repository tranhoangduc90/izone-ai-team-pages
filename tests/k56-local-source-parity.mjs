import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

// Đầu vào: SHA-256 nội dung production Pages đã đọc lại ngày 23/09/2026.
// Việc chính: so bản branch sau khi chuẩn hóa CRLF/LF; không tải bài hay âm thanh riêng.
// Kết quả: báo đúng tệp lệch; khi lỗi, test dừng trước khi có thể phát hành.
const productionBaseline = [
  {
    route: 'term-test-1-k56-computer-based',
    content: '21a73e069ff239af7bf185cbc67fa507efa5f330570bee10659dc5985858e782',
    layout: 'e097fdb8a68a537a67c6c05cd5fc01397d40f2cf138c96a3bc3af9f5987e8351',
  },
  {
    route: 'term-test-2-k56-computer-based',
    content: '61653a59ae0b7427f5de300cbbc6ceb0121a668664811436802cdfa89a370aa5',
    layout: 'f4e81684b6a9c416b72bc7c3ceccdc2e39dda0d0c569f2cd11a6dd7daff3fe9a',
  },
];

const normalizedDigest = (relative) => {
  const content = readFileSync(path.join(root, relative), 'utf8').replace(/\r\n/g, '\n');
  return createHash('sha256').update(content, 'utf8').digest('hex');
};

for (const { route, content, layout } of productionBaseline) {
  const directory = `term-tests/${route}`;
  assert.equal(normalizedDigest(`${directory}/content.js`), content, `${route}: content khác mốc production`);
  assert.equal(normalizedDigest(`${directory}/layout-updates.css`), layout, `${route}: layout khác mốc production`);
  assert.match(readFileSync(path.join(root, directory, 'index.html'), 'utf8'), /layout-updates\.css/);
}

// Mốc mới chỉ phản ánh việc gỡ CSS nhãn pha Writing K56; nội dung đề và layout gốc vẫn theo 23/09.
assert.equal(
  normalizedDigest('term-tests/term-test-1-k56-computer-based/styles.css'),
  'ed33106da8cbd5f750721c7d23b5a22490393052c487eade4802a36ca38d56f6',
  'Term Test 1 K56: styles khác mốc production',
);

console.log('Bố cục và nội dung K56 giữ đúng mốc production Pages ngày 23/09/2026.');
