const isLocalPreview = ['localhost', '127.0.0.1'].includes(window.location.hostname);

window.PROGRESS_LOG_CONFIG = Object.freeze({
  API_BASE_URL: isLocalPreview ? window.location.origin : 'https://ducizone.ddns.net/mapping-api',
  GOOGLE_CLIENT_ID: '235597750133-urmb86ktf5recnvvtbghf13bktfv5rkj.apps.googleusercontent.com'
});
