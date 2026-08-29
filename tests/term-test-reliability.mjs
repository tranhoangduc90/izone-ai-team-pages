import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseRevision = '20260826-term-test-reliability-v1';
const termTest2ConfirmationRevision = '20260829-student-confirmation-v1';
const studentEntries = [
  'term-tests/term-test-1/index.html',
  'term-tests/term-test-2/index.html',
  'term-tests/mini-test-lesson-5/index.html',
  'term-tests/term-test-1-computer-based/index.html',
  'term-tests/term-test-2-computer-based/index.html',
  'term-tests/mini-test-lesson-5-computer-based/index.html'
];

test('mọi trang Term/Mini Test nạp đúng bản reliability và không thiếu tài nguyên local', async () => {
  for (const relativeEntry of studentEntries) {
    const entryPath = path.join(repoRoot, relativeEntry);
    const html = await readFile(entryPath, 'utf8');
    assert.match(html, new RegExp(`shared/styles\\.css\\?rev=${releaseRevision}`), relativeEntry);
    if (relativeEntry.includes('computer-based')) {
      const bootstrapRevision = relativeEntry.endsWith('term-test-2-computer-based/index.html')
        ? termTest2ConfirmationRevision
        : releaseRevision;
      assert.match(html, new RegExp(`bootstrap\\.js\\?rev=${bootstrapRevision}`), relativeEntry);
    } else {
      assert.match(html, new RegExp(`shared/app\\.js\\?rev=${releaseRevision}`), relativeEntry);
    }
    const localAssets = [...html.matchAll(/(?:src|href)="([^"#?]+)(?:\?[^"#]*)?"/g)]
      .map(match => match[1])
      .filter(value => !value.startsWith('data:') && !/^https?:/i.test(value));
    for (const asset of localAssets) {
      await access(path.resolve(path.dirname(entryPath), asset));
    }
  }
});

test('Term Test 2 computer-based bắt buộc xác nhận đúng tên và lớp trước khi chuẩn bị bài', async () => {
  const entry = await readFile(path.join(repoRoot, 'term-tests/term-test-2-computer-based/index.html'), 'utf8');
  const bootstrap = await readFile(path.join(repoRoot, 'term-tests/term-test-2-computer-based/bootstrap.js'), 'utf8');
  const styles = await readFile(path.join(repoRoot, 'term-tests/term-test-2-computer-based/styles.css'), 'utf8');
  const changeHandlerStart = bootstrap.indexOf("elements.bootstrapStudent.addEventListener('change'");
  const changeHandlerEnd = bootstrap.indexOf('function renderRosterOptions', changeHandlerStart);
  const changeHandler = bootstrap.slice(changeHandlerStart, changeHandlerEnd);

  assert.match(entry, new RegExp(`styles\\.css\\?rev=${termTest2ConfirmationRevision}`));
  assert.match(entry, new RegExp(`bootstrap\\.js\\?rev=${termTest2ConfirmationRevision}`));
  assert.match(bootstrap, /function confirmStudentIdentity\(student\)/);
  assert.match(bootstrap, /\['Họ và tên', student\.name\]/);
  assert.match(bootstrap, /\['Lớp', classConfirmationLabel\(\)\]/);
  assert.match(changeHandler, /await confirmStudentIdentity\(selectedStudent\)/);
  assert.match(changeHandler, /if \(!confirmed\)/);
  assert.ok(changeHandler.indexOf('await confirmStudentIdentity') < changeHandler.indexOf('saveState({'));
  assert.ok(changeHandler.indexOf('await confirmStudentIdentity') < changeHandler.indexOf('await prepareSelectedStudent()'));
  assert.match(styles, /\.cbt-identity-confirmation-dialog::backdrop/);
  assert.match(styles, /\.cbt-identity-confirmation-actions/);
});

test('answer sheet và computer-based dùng chung guard, revision và retry', async () => {
  const sharedApp = await readFile(path.join(repoRoot, 'term-tests/shared/app.js'), 'utf8');
  const bootstrap = await readFile(path.join(repoRoot, 'term-tests/term-test-2-computer-based/bootstrap.js'), 'utf8');
  const enhance = await readFile(path.join(repoRoot, 'term-tests/term-test-2-computer-based/enhance.js'), 'utf8');

  assert.match(sharedApp, /draftRevision:\s*Number\(state\.draftRevisions\.reading\)/);
  assert.match(sharedApp, /draftRevision:\s*Number\(state\.draftRevisions\.listening\)/);
  assert.match(sharedApp, /window\.TERM_TEST_DEADLINE_GUARD_ACTIVE = true/);
  assert.match(sharedApp, /window\.setTimeout\(\(\) => scheduleSectionDraft\(skill, 0\), 5000\)/);
  assert.match(sharedApp, /form\.requestSubmit\(submitButton\)/);
  assert.match(bootstrap, new RegExp(`shared/app\\.js\\?rev=${releaseRevision}`));
  assert.match(bootstrap, new RegExp(`enhance\\.js', '${releaseRevision}`));
  assert.match(bootstrap, /listeningDraftRevision/);
  assert.match(bootstrap, /readingDraftRevision/);
  assert.match(enhance, /if \(window\.TERM_TEST_DEADLINE_GUARD_ACTIVE\) return;/);
  assert.match(enhance, /term-test:draft-restored/);
});
