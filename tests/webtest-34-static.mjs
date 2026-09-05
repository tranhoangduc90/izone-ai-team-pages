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
  const sandbox = { window: { location: { hostname: 'localhost' } } };
  vm.runInNewContext(source, sandbox, { filename: relative, timeout: 5_000 });
  return sandbox.window[name];
}

test('gói Webtest 34 có đúng cấu trúc 5 phần và không chứa answer key', async () => {
  const config = await browserGlobal('term-tests/34-test-config.js', 'TERM_TEST_CONFIG');
  const contentSource = await read('term-tests/34-test-content.js');
  const content = await browserGlobal('term-tests/34-test-content.js', 'TERM_TEST_DEMO_CONTENT');
  assert.equal(config.slug, 'webtest-34');
  assert.deepEqual([...config.parts.map(part => part.id)], ['vocabulary', 'listening', 'pronunciation', 'translation', 'writing']);
  assert.deepEqual([...config.parts.map(part => part.maxPoints)], [25, 15, 10, 32, 18]);
  assert.equal(config.demoClassCode, 'CODEXWEB34');
  // Nội dung công khai không được chứa đáp án thật (đề/đáp án khóa 34).
  assert.equal(/(?:^|[\s:{,])(?:answer|answers|expected|isTrue|order|correctIndex|listeningKey|readingKey|correctAnswer|acceptedAnswers|sampleAnswer)(?:\s*[:=])/.test(contentSource), false);
  for (const partId of ['vocabulary', 'listening', 'pronunciation', 'translation', 'writing']) {
    assert.ok(content[partId], `thiếu nội dung phần ${partId}`);
  }
});

test('cấu hình Webtest 34 giữ timer và audio chính thức', async () => {
  const [config, previewConfig] = await Promise.all([
    browserGlobal('term-tests/34-test-config.js', 'TERM_TEST_CONFIG'),
    browserGlobal('term-tests/webtest-34-demo/config.js', 'WEBTEST_34_PREVIEW_CONFIG')
  ]);
  assert.equal(config.durationSeconds, 120 * 60);
  assert.deepEqual(JSON.parse(JSON.stringify(previewConfig.AUDIO)), {
    soundcheck: {
      remote: 'https://pub-7406d9d7254a4ef7b5d1ad82edb9964b.r2.dev/Audiotest_webtest/soundcheck.mp3'
    },
    vocabulary: {
      remote: 'https://pub-7406d9d7254a4ef7b5d1ad82edb9964b.r2.dev/Audiotest_webtest/Test1_Vocab.mp3'
    },
    listening: {
      remote: 'https://pub-7406d9d7254a4ef7b5d1ad82edb9964b.r2.dev/Audiotest_webtest/Test1_Listening.mp3'
    }
  });
});

test('Webtest 34 yêu cầu preflight audio trước khi bắt đầu và không nghe thử trong phần thi', async () => {
  const index = await read('term-tests/webtest-34-demo/index.html');
  assert.match(index, /id=["']audioCheckScreen["']/);
  assert.match(index, /id=["']continueToAudio["']/);
  assert.match(index, /id=["']audioPreflight["']/);
  assert.match(index, /class=["']audio-preflight-featured["'][^>]*data-audio-preflight=["']soundcheck["']/);
  assert.match(index, /id=["']audioVolume["']/);
  assert.match(index, /id=["']audioVolumeValue["']/);
  assert.match(index, /audio\.volume = audioVolume/);
  assert.match(index, /\$\('#audioVolume'\)\.addEventListener\('input'/);
  assert.match(index, /class=["']btn btn-primary["'][^>]*id=["']soundcheckBtn["']/);
  assert.match(index, /id=["']startExam["']/);
  assert.match(index, /id=["']audioStartWarning["']/);
  assert.match(index, /setError\('audioStartWarning','Hãy bấm/);
  assert.match(index, /const ready = officialAudioKeys\.every\(key => audioReady\[key\]\)/);
  assert.match(index, /data-audio-preflight=["']vocabulary["']/);
  assert.match(index, /data-audio-preflight=["']listening["']/);
  assert.equal(index.includes('data-audio-preview'), false);
  assert.equal(index.includes('playPreview'), false);
  assert.equal(index.includes("audioFlag(key,'previewed')"), false);
  assert.ok(index.indexOf('id="audioCheckScreen"') < index.indexOf('id="audioPreflight"'));
  assert.match(index, /async function preloadAudioInOrder\(\)/);
  assert.match(index, /await retryAudio\('soundcheck'\)/);
  assert.match(index, /await retryAudio\('vocabulary'\)/);
  assert.match(index, /await retryAudio\('listening'\)/);
  assert.match(index, /audio\.src = src/);
  assert.equal(index.includes('const response = await fetch(src'), false);
  assert.ok(index.indexOf('const rosterData') < index.lastIndexOf('preloadAudioInOrder();'));
});

test('demo Webtest 34 dùng index.html làm nguồn prototype duy nhất', async () => {
  const index = await read('term-tests/webtest-34-demo/index.html');
  assert.match(index, /const sections = \[/);
  assert.match(index, /const vocab2Images =/);
  assert.match(index, /34-shared\/learning-key-map\.js/);
  const listeningTf = index.match(/const listeningTF = \[([\s\S]*?)\n  \];/);
  assert.ok(listeningTf);
  assert.equal((listeningTf[1].match(/'[^']+'/g) || []).length, 5);
  assert.equal(index.includes("['wastebasket','/ˈweɪstbɑːskɪt/','/ˈwɑːstbæskɪt/','/ˈweɪstbæskɪt/']"), true);
  assert.equal(index.includes('preview.html'), false);
});

test('route webtest-34 dùng class demo riêng và không kế thừa mã K56/K67', async () => {
  const [app, landing, indexHtml, test1Html] = await Promise.all([
    read('term-tests/webtest-34/app.js'),
    read('term-tests/webtest-34-demo/index.html'),
    read('term-tests/webtest-34/index.html'),
    read('term-tests/webtest-34/test-1/index.html')
  ]);
  assert.equal(app.includes('CODEXWEB34'), true);
  assert.equal(app.includes('CODEXDEMO56'), false);
  assert.equal(app.includes('mapping-api'), false);
  assert.match(landing, /const sections = \[/);
  assert.match(indexHtml, /test-1\//);
  assert.match(indexHtml, /catalog/);
  assert.equal(indexHtml.includes('Xem preview template'), false);
  assert.match(test1Html, /webtest-34-demo\/index\.html/);
  assert.equal(test1Html.includes('34-test-config.js'), false);
  assert.equal(test1Html.includes('../app.js'), false);
});

test('route Test 1 hiển thị đúng prototype preview làm nguồn duy nhất', async () => {
  const test1 = await read('term-tests/webtest-34/test-1/index.html');
  assert.match(test1, /src=["']\.\.\/\.\.\/webtest-34-demo\/index\.html["']/);
  assert.match(test1, /title=["']Webtest 34 preview["']/);
  assert.equal(test1.includes('preview.html'), false);
});

test('demo chỉ dùng index.html và chứa đủ ảnh Vocabulary của Test 1', async () => {
  const [index, test1] = await Promise.all([
    read('term-tests/webtest-34-demo/index.html'),
    read('term-tests/webtest-34/test-1/index.html')
  ]);
  assert.match(index, /vocab2Images/);
  assert.match(index, /assets\/test 1\/vocabulary\/image\$\{i\+1\}\.png/);
  assert.equal(index.includes('preview.html'), false);
  assert.equal(test1.includes('preview.html'), false);
});

test('learning answer map theo block để fixture local gửi đúng item Listening', async () => {
  const keyMap = await browserGlobal('term-tests/34-shared/learning-key-map.js', 'WEBTEST34_LEARNING_KEY_MAP');
  const responses = keyMap.buildResponses({
    blocks: [
      {
        title: 'Vocabulary',
        items: [
          { position: 1, pedagogicalTypeCode: 'vocabulary_listen_write', itemVersionId: '34000000-0000-4000-8000-000000000102' },
          { position: 2, pedagogicalTypeCode: 'vocabulary_picture_write', itemVersionId: '34000000-0000-4000-8000-000000000104' }
        ]
      },
      {
        title: 'Listening',
        items: [
          { position: 3, pedagogicalTypeCode: 'listening_choice', itemVersionId: '34000000-0000-4000-8000-000000000106' },
          { position: 4, pedagogicalTypeCode: 'listening_gap', itemVersionId: '34000000-0000-4000-8000-000000000108' }
        ]
      }
    ],
    answers: {
      vocab1_1: 'environment',
      vocab2_1: 'book',
      listen_p1_1: 'B',
      listen_p2_1: 'teacher'
    }
  });
  assert.deepEqual(JSON.parse(JSON.stringify(responses)), {
    '34000000-0000-4000-8000-000000000102': 'environment',
    '34000000-0000-4000-8000-000000000104': 'book',
    '34000000-0000-4000-8000-000000000106': 'B',
    '34000000-0000-4000-8000-000000000108': 'teacher'
  });
});

test('learning result group theo definition block và itemVersionId', async () => {
  const resultGrouper = await browserGlobal('term-tests/34-shared/learning-result.js', 'WEBTEST34_LEARNING_RESULT');
  const groups = resultGrouper.groupResultItems({
    blocks: [{
      blockId: '34000000-0000-4000-8000-000000000012',
      title: 'Listening',
      items: [
        { itemVersionId: '34000000-0000-4000-8000-000000000106' },
        { itemVersionId: '34000000-0000-4000-8000-000000000108' }
      ]
    }],
    sections: [{ id: 'listening', label: 'Listening', count: 15 }],
    items: [
      { itemVersionId: '34000000-0000-4000-8000-000000000106', verdict: 'correct', scoreEarned: 2, maxScore: 2 },
      { itemVersionId: '34000000-0000-4000-8000-000000000108', verdict: 'incorrect', scoreEarned: 0, maxScore: 2 }
    ]
  });
  assert.equal(groups.length, 1);
  assert.equal(groups[0].label, 'Listening');
  assert.equal(groups[0].items.length, 2);
  assert.equal(groups[0].correct, 1);
  assert.equal(groups[0].maxScore, 4);
});

test('canonical Webtest 34 có local-learning lifecycle và không rơi về submit localStorage-only', async () => {
  const [index, config, resultHelper] = await Promise.all([
    read('term-tests/webtest-34-demo/index.html'),
    browserGlobal('term-tests/webtest-34-demo/config.js', 'WEBTEST_34_PREVIEW_CONFIG'),
    read('term-tests/34-shared/learning-result.js')
  ]);
  assert.equal(config.LEARNING_PUBLIC_TOKEN, 'e4006177-1ef7-453b-a3b7-4fff12889e8e');
  assert.match(index, /\/api\/learning/);
  for (const endpoint of ['/assignments/open', '/attempts/start', '/attempts/draft', '/attempts/submit', '/attempts/result']) {
    assert.match(index, new RegExp(endpoint.replaceAll('/', '\\/')));
  }
  assert.match(index, /clientIdempotencyKey/);
  assert.match(index, /WEBTEST34_LEARNING_KEY_MAP/);
  assert.match(index, /34-shared\/learning-result\.js/);
  assert.match(index, /buildResponses\(\{blocks: definitionBlocks, answers: state\.answers\}\)/);
  assert.match(index, /groupResultItems\(\{/);
  assert.match(resultHelper, /itemVersionId/);
  assert.doesNotMatch(index, /const hardGroups =/);
  assert.doesNotMatch(index, /const values = \$\$\('\[data-answer\]'\)/);
  assert.doesNotMatch(index, /Prototype: bài đã được đánh dấu là đã nộp trên localStorage/);
});

test('canonical Webtest 34 lưu và render kết quả chấm cứng cho học viên', async () => {
  const index = await read('term-tests/webtest-34-demo/index.html');
  assert.match(index, /studentResult/);
  assert.match(index, /result\.items/);
  assert.match(index, /Đúng/);
  assert.match(index, /Sai/);
  assert.match(index, /Đang chờ chấm AI/);
  assert.doesNotMatch(index, /expectedAnswer/);
});

test('các route K56/K67 hiện có không bị thay đổi bởi gói 34', async () => {
  const [k67Config, k56Config, k67Landing, teacherApp] = await Promise.all([
    read('term-tests/shared/config.js'),
    read('term-tests/k56-shared/config.js'),
    read('term-tests/index.html'),
    read('term-tests/teacher/app.js')
  ]);
  assert.equal(k67Config.includes('webtest-34'), false);
  assert.equal(k56Config.includes('webtest-34'), false);
  assert.equal(k67Landing.includes('webtest-34'), false);
  assert.equal(teacherApp.includes('webtest-34'), false);
});
