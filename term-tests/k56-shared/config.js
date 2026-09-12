const requestedClass = new URLSearchParams(window.location.search).get('class')?.trim().toUpperCase();
const demoApi = 'https://ducizone.ddns.net/mapping-api-demo';
const ic2264Api = 'https://ducizone.ddns.net/mapping-api-k56';

window.TERM_TEST_APP_CONFIG = Object.freeze({
  API_BASE_URL: requestedClass === 'IC2264' ? ic2264Api : demoApi,
  API_BASE_URLS: [demoApi, ic2264Api],
  API_BY_CLASS: Object.freeze({ IC2264: ic2264Api }),
  AUTH_MODE: 'google',
  GOOGLE_CLIENT_ID: '235597750133-urmb86ktf5recnvvtbghf13bktfv5rkj.apps.googleusercontent.com'
});
