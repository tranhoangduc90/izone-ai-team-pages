const k56Api = 'https://ducizone.ddns.net/mapping-api-k56';

window.TERM_TEST_APP_CONFIG = Object.freeze({
  API_BASE_URL: k56Api,
  API_BASE_URLS: [k56Api],
  API_BY_CLASS: Object.freeze({ IC2264: k56Api }),
  API_FOR_CLASS: () => k56Api,
  AUTH_MODE: 'google',
  GOOGLE_CLIENT_ID: '235597750133-urmb86ktf5recnvvtbghf13bktfv5rkj.apps.googleusercontent.com'
});
