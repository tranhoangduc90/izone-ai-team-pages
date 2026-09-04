import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function read(relative) {
  return fs.readFile(path.join(root, relative), 'utf8');
}

async function browserGlobal(relative, name) {
  const source = await read(relative);
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox, { filename: relative, timeout: 5_000 });
  return sandbox.window[name];
}

test('gói K56 có đúng cấu trúc đề và không chứa answer key', async () => {
  const config = await browserGlobal('term-tests/term-test-1-k56/test-config.js', 'TERM_TEST_CONFIG');
  const contentSource = await read('term-tests/term-test-1-k56-computer-based/content.js');
  const content = await browserGlobal('term-tests/term-test-1-k56-computer-based/content.js', 'K56_TERM_TEST_CONTENT');
  assert.equal(config.slug, 'term-test-1-k56');
  assert.equal(config.listening.totalQuestions, 40);
  assert.equal(config.reading.totalQuestions, 26);
  assert.equal(config.reading.durationMinutes, 40);
  assert.equal(config.writing.durationMinutes, 55);
  assert.equal(config.writing.planningMinutes, 15);
  assert.deepEqual(Array.from(content.writing.tasks, task => task.id), ['task2']);
  assert.equal(/listeningKey|readingKey|correctAnswer|acceptedAnswers/.test(contentSource), false);
});

test('K56 dùng lớp và API demo riêng, không kế thừa mã K67', async () => {
  const [bootstrap, config, landing] = await Promise.all([
    read('term-tests/term-test-1-k56-computer-based/bootstrap.js'),
    read('term-tests/k56-shared/config.js'),
    read('term-tests/k56-demo/index.html')
  ]);
  assert.equal(bootstrap.includes('CODEXDEMO806'), false);
  assert.equal((bootstrap.match(/Học viên Demo 0[1-3]/g) || []).length, 3);
  assert.match(config, /mapping-api-demo/);
  assert.match(landing, /term-test-1-k56-computer-based\/\?class=CODEXDEMO56/);
  assert.match(landing, /teacher-k56\/\?class=CODEXDEMO56&amp;test=term-test-1-k56/);
});

test('dashboard K56 tách riêng và các file K67 không đổi hành vi', async () => {
  const [app, k56Config, k67App, k67Config] = await Promise.all([
    read('term-tests/teacher-k56/app.js'),
    read('term-tests/k56-shared/config.js'),
    read('term-tests/teacher/app.js'),
    read('term-tests/shared/config.js')
  ]);
  assert.match(app, /scoreMode\(\) === 'raw'/);
  assert.match(app, /term-test-1-k56/);
  assert.match(k56Config, /mapping-api-demo/);
  assert.equal(k67App.includes('term-test-1-k56'), false);
  assert.equal(k67Config.includes('mapping-api-demo'), false);
  assert.match(k67Config, /mapping-api'/);
});
