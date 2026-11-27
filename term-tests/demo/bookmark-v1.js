(() => {
  const pagesOrigin = 'https://tranhoangduc90.github.io';
  const pagesPrefix = '/izone-ai-team-pages/term-tests/';
  if (location.origin !== pagesOrigin || !location.pathname.startsWith(pagesPrefix)) return;

  const courseCode = document.currentScript.dataset.demoClass;
  const params = new URLSearchParams(location.search);
  if (params.get('class')?.trim().toUpperCase() !== courseCode) return;

  const mode = params.get('mode') === 'read_first' ? 'read_first' : 'lis_first';
  const target = new URL('https://ducizone.ddns.net/exam-demo/term-tests/');
  target.pathname += location.pathname.slice(pagesPrefix.length);
  target.search = new URLSearchParams({ class: courseCode, mode }).toString();
  location.replace(target.href);
})();
