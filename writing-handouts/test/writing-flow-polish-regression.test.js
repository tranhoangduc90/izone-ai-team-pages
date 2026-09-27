import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('biểu đồ chuẩn hóa ngày API và không nối thêm giờ vào timestamp ISO', async () => {
  const script = await readFile(new URL('js/writing-flow.js', root), 'utf8');
  assert.match(script, /formatWritingDay/u);
  assert.doesNotMatch(script, /new Date\(`\$\{item\.day\}T00:00:00`\)/u);
});

test('thẻ lớp dùng trạng thái vận hành nên lớp CS hợp lệ không báo lỗi giả', async () => {
  const script = await readFile(new URL('js/writing-flow.js', root), 'utf8');
  assert.match(script, /item\.operational_state === 'active'/u);
  assert.doesNotMatch(script, /\['on_going', 'completed'\]\.includes\(item\.class_status\)/u);
});

test('bảng có sort, cuộn ngang, kéo cột, đặt lại độ rộng và nhãn Docs ngắn', async () => {
  const [html, script, ui, css, api] = await Promise.all([
    readFile(new URL('writing-flow.html', root), 'utf8'),
    readFile(new URL('js/writing-flow.js', root), 'utf8'),
    readFile(new URL('js/writing-flow-ui.js', root), 'utf8'),
    readFile(new URL('writing-flow.css', root), 'utf8'),
    readFile(new URL('js/api.js', root), 'utf8'),
  ]);
  assert.match(html, /id="flow-sort"/u);
  assert.match(html, /id="flow-reset-widths"/u);
  assert.match(script, /flow-column-resizer/u);
  assert.match(ui, /writing-flow:column-widths:v1/u);
  assert.match(script, /pointerdown/u);
  assert.match(script, /Mở Docs/u);
  assert.doesNotMatch(script, /Mở Google Docs/u);
  assert.match(css, /table-layout:\s*fixed/u);
  assert.match(css, /overflow-x:\s*auto/u);
  assert.match(api, /"sort"/u);
});

test('popup chi tiết đóng khi nhấn đúng nền ngoài và giải thích nguồn TRCC cứu hộ', async () => {
  const script = await readFile(new URL('js/writing-flow.js', root), 'utf8');
  assert.match(script, /isBackdropClick/u);
  assert.match(script, /trCcSource/u);
  assert.match(script, /bổ sung sau khi cứu TR\/CC/u);
});
