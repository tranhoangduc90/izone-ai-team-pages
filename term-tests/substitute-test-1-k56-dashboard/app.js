const catalogUrls = [
  'https://izone-substitute-test-1-k56.wingsenglish90.chatgpt.site/api/test/catalog',
  'https://izone-substitute-test-2-k56.wingsenglish90.chatgpt.site/api/test/catalog'
];

Promise.all(catalogUrls.map(async url => {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Không tải được catalog.');
  return response.json();
}))
  .then(catalogs => {
    const tests = catalogs.flatMap(catalog => catalog.tests || []);
    const classes = new Set(catalogs.flatMap(catalog => catalog.classes || []).map(item => typeof item === 'string' ? item : item.code || item.id).filter(Boolean));
    const studentCount = tests.reduce((total, test) => total + Number(test.studentCount || 0), 0);
    const completedCount = tests.reduce((total, test) => total + Number(test.completedCount || 0), 0);
    document.querySelector('#metric-tests').textContent = String(tests.length).padStart(2, '0');
    document.querySelector('#metric-students').textContent = String(studentCount).padStart(2, '0');
    document.querySelector('#metric-completed').textContent = String(completedCount).padStart(2, '0');
    document.querySelector('#metric-classes').textContent = String(classes.size).padStart(2, '0');
    document.querySelector('#record-count').textContent = `${tests.length} bài`;
  })
  .catch(() => {
    document.querySelector('#record-count').textContent = '2 bài · Chưa tải thống kê';
  });
