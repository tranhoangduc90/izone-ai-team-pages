const examLink = document.querySelector('#open-exam');
const resultsLink = document.querySelector('#open-results');

examLink.href = '/izone-ai-team-pages/term-tests/substitute-test-1-k56-computer-based/?demo=exam&grading=server';
resultsLink.href = '/izone-ai-team-pages/term-tests/substitute-test-1-k56-results/?test=substitute-test-1-k56';

fetch('https://izone-substitute-test-1-k56.wingsenglish90.chatgpt.site/api/test/catalog', { headers: { Accept: 'application/json' } })
  .then(response => response.ok ? response.json() : Promise.reject(new Error('Không tải được catalog.')))
  .then(catalog => {
    const test = catalog.tests[0];
    document.querySelector('#metric-tests').textContent = String(catalog.tests.length).padStart(2, '0');
    document.querySelector('#metric-students').textContent = String(test.studentCount).padStart(2, '0');
    document.querySelector('#metric-completed').textContent = String(test.completedCount).padStart(2, '0');
    document.querySelector('#metric-classes').textContent = String(catalog.classes.length).padStart(2, '0');
    document.querySelector('#record-count').textContent = `${catalog.tests.length} bài`;
  })
  .catch(() => {
    document.querySelector('#record-count').textContent = 'Dữ liệu demo';
  });
