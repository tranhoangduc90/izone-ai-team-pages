import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('dashboard chỉ chứa cấu hình trình duyệt công khai', async () => {
  const raw = await readFile(new URL('writing-flow-config.json', root), 'utf8');
  const config = JSON.parse(raw);
  assert.deepEqual(Object.keys(config).sort(), ['apiBase', 'googleClientId']);
  assert.equal(config.apiBase, 'https://ducizone.ddns.net/writing-api/');
  assert.match(config.googleClientId, /^[0-9a-z-]+\.apps\.googleusercontent\.com$/u);
  assert.doesNotMatch(raw, /token|secret|password|credential/iu);
});

test('dashboard có các view quen thuộc, lọc lớp và giảng viên, cùng retry đúng bước', async () => {
  const [html, script] = await Promise.all([
    readFile(new URL('writing-flow.html', root), 'utf8'),
    readFile(new URL('js/writing-flow.js', root), 'utf8'),
  ]);
  assert.doesNotMatch(html, /Bản thử nghiệm/u);
  assert.match(html, /\.\/js\/writing-flow\.js/u);
  assert.match(script, /\.\/writing-flow-config\.json/u);
  assert.match(script, /Chạy lại từ bước này/u);
  assert.match(script, /Đọc lại nguồn/u);
  assert.match(script, /retryWritingSourceIssue/u);
  assert.match(script, /không sửa Lark Base/u);
  assert.match(html, /Độ phủ lớp đang vận hành/u);
  assert.match(script, /writingClassCoverage/u);
  assert.match(html, /data-view="overview"/u);
  for (const stage of ['intake', 'precheck', 'main', 'critic', 'arbiter', 'render', 'deliver']) {
    assert.match(html, new RegExp(`data-view="${stage}"`, 'u'));
  }
  assert.match(html, /data-view="review"/u);
  assert.match(html, /data-view="source"/u);
  assert.match(html, /data-view="skipped"/u);
  assert.match(html, /id="flow-manual-form"/u);
  assert.match(html, /id="flow-manual-name"/u);
  assert.match(html, /id="flow-manual-url"/u);
  assert.match(script, /addWritingManualSource/u);
  assert.match(script, /skipWritingPair/u);
  assert.match(script, /restoreWritingPair/u);
  assert.match(script, /retryWritingPairStage/u);
  assert.match(script, /writingPairDetail/u);
  assert.match(html, /id="flow-teacher"/u);
  assert.match(script, /teacher_names/u);
  assert.match(html, /id="remember-flow-login"/u);
  assert.match(html, /id="flow-logout"/u);
  assert.match(script, /createTeacherSessionClient/u);
  assert.doesNotMatch(script, /window\.sessionStorage|Bearer\s/u);
  assert.match(script, /createTeacherLoginPreference/u);
  assert.match(script, /auto_select: loginPreference\.read\(\)/u);
  assert.match(script, /globalThis\.google\.accounts\.id\.prompt\(\)/u);
});
