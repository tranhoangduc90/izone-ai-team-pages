const k56Api = 'https://ducizone.ddns.net/mapping-api-k56';
const demoApi = 'https://ducizone.ddns.net/mapping-api-demo';
const apiForClass = code => String(code || '').trim().toUpperCase() === 'CODEXDEMO56' ? demoApi : k56Api;

window.TERM_TEST_APP_CONFIG = Object.freeze({
  EXAM_JOURNAL_ENABLED: true,
  EXAM_JOURNAL_BUILD: 'exam-journal-production-20261024-r1',
  API_BASE_URL: apiForClass(new URLSearchParams(window.location.search).get('class')),
  API_FOR_CLASS: apiForClass,
  AUTH_MODE: 'google',
  GOOGLE_CLIENT_ID: ''
});
