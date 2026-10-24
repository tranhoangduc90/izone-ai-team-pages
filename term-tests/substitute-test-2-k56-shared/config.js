window.TERM_TEST_APP_CONFIG = Object.freeze({
  EXAM_JOURNAL_ENABLED: true,
  EXAM_JOURNAL_BUILD: 'exam-journal-production-20261024-r1',
  API_BASE_URL: 'https://ducizone.ddns.net/webhook/substitute-test-2-k56-public-api',
  AUTH_MODE: 'online-demo',
  GOOGLE_CLIENT_ID: '',
  LOCAL_DEMO_ONLY: true,
  API_GATEWAY_MODE: true
});

if (location.pathname.includes('/substitute-test-2-k56-computer-based/')) {
  const onlineUrl = new URL(location.href);
  if (!onlineUrl.searchParams.has('demo')) onlineUrl.searchParams.set('demo', 'exam');
  if (!onlineUrl.searchParams.has('grading')) onlineUrl.searchParams.set('grading', 'server');
  history.replaceState(history.state, '', onlineUrl.href);
}
