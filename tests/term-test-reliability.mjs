import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseRevision = '20260826-term-test-reliability-v1';
const allStudentConfirmationRevision = '20260829-all-student-confirmation-v2';
const computerBasedLayoutRevision = '20260904-matching-layout-cleanup-v5';
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
    const entryRevision = relativeEntry.includes('term-test-')
      ? allStudentConfirmationRevision
      : releaseRevision;
    assert.match(html, new RegExp(`shared/styles\\.css\\?rev=${entryRevision}`), relativeEntry);
    if (relativeEntry.includes('computer-based')) {
      assert.match(html, new RegExp(`bootstrap\\.js\\?rev=${computerBasedLayoutRevision}`), relativeEntry);
    } else {
      assert.match(html, new RegExp(`shared/app\\.js\\?rev=${entryRevision}`), relativeEntry);
    }
    const localAssets = [...html.matchAll(/(?:src|href)="([^"#?]+)(?:\?[^"#]*)?"/g)]
      .map(match => match[1])
      .filter(value => !value.startsWith('data:') && !/^https?:/i.test(value));
    for (const asset of localAssets) {
      await access(path.resolve(path.dirname(entryPath), asset));
    }
  }
});

test('hai bản Term Test computer-based bắt buộc xác nhận đúng tên và lớp trước khi chuẩn bị bài', async () => {
  const termTest1Entry = await readFile(path.join(repoRoot, 'term-tests/term-test-1-computer-based/index.html'), 'utf8');
  const entry = await readFile(path.join(repoRoot, 'term-tests/term-test-2-computer-based/index.html'), 'utf8');
  const bootstrap = await readFile(path.join(repoRoot, 'term-tests/term-test-2-computer-based/bootstrap.js'), 'utf8');
  const styles = await readFile(path.join(repoRoot, 'term-tests/term-test-2-computer-based/styles.css'), 'utf8');
  const changeHandlerStart = bootstrap.indexOf("elements.bootstrapStudent.addEventListener('change'");
  const changeHandlerEnd = bootstrap.indexOf('function renderRosterOptions', changeHandlerStart);
  const changeHandler = bootstrap.slice(changeHandlerStart, changeHandlerEnd);

  assert.match(termTest1Entry, new RegExp(`styles\\.css\\?rev=${computerBasedLayoutRevision}`));
  assert.match(termTest1Entry, new RegExp(`bootstrap\\.js\\?rev=${computerBasedLayoutRevision}`));
  assert.match(entry, new RegExp(`styles\\.css\\?rev=${computerBasedLayoutRevision}`));
  assert.match(entry, new RegExp(`bootstrap\\.js\\?rev=${computerBasedLayoutRevision}`));
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

test('hai answer sheet Term Test chỉ lưu và nối lượt sau khi học viên xác nhận', async () => {
  const termTest1Entry = await readFile(path.join(repoRoot, 'term-tests/term-test-1/index.html'), 'utf8');
  const termTest2Entry = await readFile(path.join(repoRoot, 'term-tests/term-test-2/index.html'), 'utf8');
  const sharedApp = await readFile(path.join(repoRoot, 'term-tests/shared/app.js'), 'utf8');
  const sharedStyles = await readFile(path.join(repoRoot, 'term-tests/shared/styles.css'), 'utf8');
  const changeHandlerStart = sharedApp.indexOf("elements.studentSelect.addEventListener('change'");
  const changeHandlerEnd = sharedApp.indexOf("elements.temporaryStudentForm?.addEventListener", changeHandlerStart);
  const changeHandler = sharedApp.slice(changeHandlerStart, changeHandlerEnd);

  for (const entry of [termTest1Entry, termTest2Entry]) {
    assert.match(entry, new RegExp(`shared/styles\\.css\\?rev=${allStudentConfirmationRevision}`));
    assert.match(entry, new RegExp(`shared/app\\.js\\?rev=${allStudentConfirmationRevision}`));
  }
  assert.match(sharedApp, /function confirmStudentIdentity\(student\)/);
  assert.match(changeHandler, /testConfig\.slug\.startsWith\('term-test-'\)/);
  assert.match(changeHandler, /await confirmStudentIdentity\(student\)/);
  assert.match(changeHandler, /if \(!confirmed\)/);
  assert.ok(changeHandler.indexOf('await confirmStudentIdentity') < changeHandler.indexOf('state.studentRef ='));
  assert.ok(changeHandler.indexOf('await confirmStudentIdentity') < changeHandler.indexOf('saveSession()'));
  assert.ok(changeHandler.indexOf('await confirmStudentIdentity') < changeHandler.indexOf('await resumeActiveAttemptForSelectedStudent()'));
  assert.match(sharedStyles, /\.cbt-identity-confirmation-dialog::backdrop/);
  assert.match(sharedStyles, /\.cbt-identity-confirmation-actions/);
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
  assert.match(bootstrap, new RegExp(`shared/app\\.js\\?rev=${allStudentConfirmationRevision}`));
  assert.match(bootstrap, new RegExp(`enhance\\.js', '${computerBasedLayoutRevision}`));
  assert.match(bootstrap, /listeningDraftRevision/);
  assert.match(bootstrap, /readingDraftRevision/);
  assert.match(enhance, /if \(window\.TERM_TEST_DEADLINE_GUARD_ACTIVE\) return;/);
  assert.match(enhance, /term-test:draft-restored/);
});
