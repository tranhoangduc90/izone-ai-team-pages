import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseRevision = '20260826-term-test-reliability-v1';
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
      assert.match(html, new RegExp(`bootstrap\\.js\\?rev=${releaseRevision}`), relativeEntry);
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
