window.TERM_TEST_APP_CONFIG = Object.freeze({
  API_BASE_URL: 'https://ducizone.ddns.net/webhook/substitute-test-1-k56-public-api',
  AUTH_MODE: 'online-demo',
  GOOGLE_CLIENT_ID: '',
  LOCAL_DEMO_ONLY: true,
  API_GATEWAY_MODE: true
});


if (location.pathname.includes('/substitute-test-1-k56-computer-based/')) {
  const onlineUrl = new URL(location.href);
  if (!onlineUrl.searchParams.has('demo')) onlineUrl.searchParams.set('demo', 'exam');
  if (!onlineUrl.searchParams.has('grading')) onlineUrl.searchParams.set('grading', 'server');
  history.replaceState(null, '', onlineUrl.href);
}
