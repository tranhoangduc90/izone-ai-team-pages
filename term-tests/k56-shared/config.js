const requestedClass = new URLSearchParams(window.location.search).get('class')?.trim().toUpperCase();
const demoApi = 'https://ducizone.ddns.net/mapping-api-demo';
const k56Api = 'https://ducizone.ddns.net/mapping-api-k56';

window.TERM_TEST_APP_CONFIG = Object.freeze({
  API_BASE_URL: requestedClass === 'CODEXDEMO56' ? demoApi : k56Api,
  API_BASE_URLS: [demoApi, k56Api],
  API_BY_CLASS: Object.freeze({ CODEXDEMO56: demoApi, IC2264: k56Api }),
  API_FOR_CLASS: classCode => String(classCode || '').trim().toUpperCase() === 'CODEXDEMO56' ? demoApi : k56Api,
  AUTH_MODE: 'google',
  GOOGLE_CLIENT_ID: '235597750133-urmb86ktf5recnvvtbghf13bktfv5rkj.apps.googleusercontent.com'
});
