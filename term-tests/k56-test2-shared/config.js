const isLocalPreview = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const requestedClass = new URLSearchParams(window.location.search).get('class')?.trim().toUpperCase();

window.TERM_TEST_APP_CONFIG = Object.freeze({
  API_BASE_URL: isLocalPreview ? window.location.origin : (requestedClass === 'IC2264' ? 'https://ducizone.ddns.net/mapping-api-k56' : 'https://ducizone.ddns.net/mapping-api-demo'),
  AUTH_MODE: 'google',
  GOOGLE_CLIENT_ID: '',
  LOCAL_DEMO_ONLY: isLocalPreview
});
