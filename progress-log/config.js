// Local preview and GitHub Pages intentionally use the same backend.
// The browser never connects to PostgreSQL directly; the VPS API owns that connection.
const productionApi = 'https://ducizone.ddns.net/mapping-api';

window.PROGRESS_LOG_CONFIG = Object.freeze({
  API_BASE_URL: productionApi,
  STUDENT_MEMORY: Object.freeze({ enabled: true, allClasses: true }),
  GOOGLE_CLIENT_ID: '235597750133-urmb86ktf5recnvvtbghf13bktfv5rkj.apps.googleusercontent.com'
});
