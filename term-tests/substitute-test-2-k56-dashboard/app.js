const examLink = document.querySelector('#open-exam');
const resultsLink = document.querySelector('#open-results');
const API_URL = 'https://ducizone.ddns.net/webhook/substitute-test-2-k56-public-api';

async function apiRequest(route, payload = {}) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({ route, payload })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Không tải được dữ liệu.');
  return data;
}

examLink.href = '/izone-ai-team-pages/term-tests/substitute-test-2-k56-computer-based/?demo=exam&grading=server';
resultsLink.href = '/izone-ai-team-pages/term-tests/substitute-test-2-k56-results/?test=substitute-test-2-k56';

apiRequest('/api/test/catalog')
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
