// Nạp renderer đang dùng chung theo thứ tự; chỉ fixture và lớp màu thuộc demo.
(async () => {
  const q = new URLSearchParams(location.search), tests = ['term-test-1', 'term-test-2', 'mini-test-lesson-5'];
  const test = tests.includes(q.get('test')) ? q.get('test') : 'term-test-1';
  q.set('test', test); q.set('class', 'DEMO67'); history.replaceState(null, '', '?' + q.toString());
  document.title = (test === 'mini-test-lesson-5' ? 'Mini Test · Buổi 5' : test === 'term-test-2' ? 'Term Test 2' : 'Term Test 1') + ' · Demo màu';
  const load = src => new Promise((resolve, reject) => { const s = document.createElement('script'); s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('Không tải được ' + src)); document.body.append(s); });
  try {
    await load('../' + test + '/test-config.js'); await load('demo-content.js'); await load('demo-runtime.js');
    if (q.get('screen') === 'lobby') { await load('../term-test-2-computer-based/audio-loader.js'); await load('../term-test-2-computer-based/bootstrap.js'); }
    else { await load('../shared/attempt-review.js'); await load('../shared/writing-planning.js'); await load('../shared/app.js'); if (q.get('screen') !== 'answer-sheet') { await load('../term-test-2-computer-based/enhance.js'); await load('../term-test-2-computer-based/interaction-tools.js'); } }
    await load('presentation.js'); await load('demo-ui.js'); await load('color-lab.js');
  } catch (e) { document.getElementById('app').textContent = 'Demo chưa tải được. Hãy tải lại trang. ' + e.message; }
})();
