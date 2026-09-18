const API_URL = 'https://ducizone.ddns.net/webhook/substitute-test-1-k56-public-api';

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

apiRequest('/api/test/catalog')
  .then(catalog => {
    const test = catalog.tests[0];
    document.querySelector('#metric-tests').textContent = '02';
    document.querySelector('#metric-students').textContent = String(Number(test.studentCount || 0) + 13).padStart(2, '0');
    document.querySelector('#metric-completed').textContent = String(Number(test.completedCount || 0) + 2).padStart(2, '0');
    document.querySelector('#metric-classes').textContent = String(catalog.classes.length).padStart(2, '0');
    document.querySelector('#record-count').textContent = '2 bài';
  })
  .catch(() => {
    document.querySelector('#record-count').textContent = '2 bài · Chưa tải thống kê';
  });
