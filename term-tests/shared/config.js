const isLocalPreview = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const requestedTest = new URLSearchParams(window.location.search).get('test');
const isK56Demo = requestedTest === 'term-test-1-k56'
  || window.location.pathname.includes('/term-test-1-k56-computer-based/');

window.TERM_TEST_APP_CONFIG = Object.freeze({
  API_BASE_URL: isLocalPreview
    ? window.location.origin
    : isK56Demo
      ? 'https://ducizone.ddns.net/mapping-api-demo'
      : 'https://ducizone.ddns.net/mapping-api',
  AUTH_MODE: 'google',
  GOOGLE_CLIENT_ID: '235597750133-urmb86ktf5recnvvtbghf13bktfv5rkj.apps.googleusercontent.com'
});
