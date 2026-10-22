const k56Api = 'https://ducizone.ddns.net/teacher-login-preview-api/mapping-api-k56';
const demoApi = 'https://ducizone.ddns.net/teacher-login-preview-api/mapping-api-demo';
const apiForClass = code => String(code || '').trim().toUpperCase() === 'CODEXDEMO56' ? demoApi : k56Api;

window.TERM_TEST_APP_CONFIG = Object.freeze({
  API_BASE_URL: apiForClass(new URLSearchParams(window.location.search).get('class')),
  API_BASE_URLS: [k56Api, demoApi],
  API_BY_CLASS: Object.freeze({ IC2264: k56Api, CODEXDEMO56: demoApi }),
  API_FOR_CLASS: apiForClass,
  AUTH_MODE: 'google',
  GOOGLE_CLIENT_ID: '235597750133-urmb86ktf5recnvvtbghf13bktfv5rkj.apps.googleusercontent.com'
});
