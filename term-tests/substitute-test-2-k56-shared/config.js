window.TERM_TEST_APP_CONFIG = Object.freeze({
  API_BASE_URL: 'https://izone-substitute-test-2-k56.wingsenglish90.chatgpt.site',
  AUTH_MODE: 'online-demo',
  GOOGLE_CLIENT_ID: '',
  LOCAL_DEMO_ONLY: true
});


if (location.pathname.includes('/substitute-test-2-k56-computer-based/')) {
  const onlineUrl = new URL(location.href);
  if (!onlineUrl.searchParams.has('demo')) onlineUrl.searchParams.set('demo', 'exam');
  if (!onlineUrl.searchParams.has('grading')) onlineUrl.searchParams.set('grading', 'server');
  history.replaceState(null, '', onlineUrl.href);
}
