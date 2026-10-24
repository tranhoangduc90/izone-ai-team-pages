const isLocalPreview = ['localhost', '127.0.0.1'].includes(window.location.hostname);

window.TERM_TEST_APP_CONFIG = Object.freeze({
  EXAM_JOURNAL_ENABLED: true,
  EXAM_JOURNAL_BUILD: 'exam-journal-production-20261024-r1',
  API_BASE_URL: 'https://ducizone.ddns.net/mapping-api',
  AUTH_MODE: 'google',
  GOOGLE_CLIENT_ID: '235597750133-urmb86ktf5recnvvtbghf13bktfv5rkj.apps.googleusercontent.com'
});
