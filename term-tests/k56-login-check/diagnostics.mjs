/* Trang chẩn đoán tái dùng phiên K56. Báo cáo chỉ giữ nhãn tuyến, trạng thái và thời lượng.
   Không đọc header, body, cookie hay URL query trong phần ghi yêu cầu. */
import { createAutoReport } from './auto-report.mjs?v=20261126-r2';

const BUILD = 'k56-login-check-20261126-r3';
const TARGET_CLASS = 'IC2367';
const $ = id => document.getElementById(id);
const apiUrls = window.TERM_TEST_APP_CONFIG.API_BASE_URLS;
const apiOrigin = new URL(apiUrls[0]).origin;
const report = { build: BUILD, classCode: TARGET_CLASS, runs: [] };
const automatic = createAutoReport({
  status: $('reportDelivery'), stop: $('stopReporting'), notice: $('autoNotice'), build: BUILD, classCode: TARGET_CLASS
});
const browserFetch = window.fetch.bind(window);
let currentRun;
let busy = false;
let googleLoaded = false;

const sessionSources = new Map([
  ['/reading-practice-api/api/teacher/shared-session', 'reading'],
  ['/listening-practice-api/api/teacher/shared-session', 'listening'],
  ['/writing-api/api/auth/session/shared-session', 'writing'],
  ['/mapping-api/api/auth/session/shared-session', 'mapping'],
  ['/term-mini-k67-api/api/auth/session/shared-session', 'term67'],
  ['/reading67-materials/api/reading-skills67/teacher/shared-session', 'materials'],
  ['/mapping-api-k56/api/auth/session/shared-session', 'k56'],
  ['/mapping-api-demo/api/auth/session/shared-session', 'demo'],
  ['/api/handout67/v1/teacher/shared-session', 'handout67'],
  ['/shops-writing-api/api/v1/auth/session/shared-session', 'shops']
]);

function requestLabel(input, options) {
  const url = new URL(typeof input === 'string' ? input : input.url || input, location.origin);
  if (url.origin !== apiOrigin) return null;
  const source = sessionSources.get(url.pathname);
  if (source) return 'Tìm phiên ở ' + source;
  const restoration = /^\/teacher-session-api\/v1\/restore\/(k56|k56demo)$/.exec(url.pathname);
  if (restoration) return 'Khôi phục phiên ' + restoration[1];
  const route = /^\/mapping-api-(k56|demo)\/(health|api\/auth\/session|api\/term-tests\/teacher\/options)$/.exec(url.pathname);
  if (!route) return null;
  const [, sourceId, endpoint] = route;
  const action = endpoint === 'health' ? 'Kết nối API'
    : endpoint.endsWith('/options') ? 'Đọc quyền lớp'
    : options?.method === 'POST' ? 'Đăng nhập Google vào API' : 'Đọc phiên';
  return action + ' · ' + sourceId;
}

function safeError(error) {
  if (error?.name === 'TimeoutError') return 'TIMEOUT';
  if (error?.name === 'AbortError') return 'ABORTED';
  if (error instanceof TypeError) return 'FETCH_FAILED';
  return 'ERROR';
}

// Cài trước khi import để quan sát các request gốc của bộ khôi phục phiên dùng chung.
window.fetch = async function (input, options) {
  const run = currentRun;
  const step = run ? requestLabel(input, options) : null;
  const start = performance.now();
  const record = result => {
    if (step) run.requests.push({ step, ...result, ms: Math.round(performance.now() - start) });
  };
  try {
    const response = await browserFetch(input, options);
    record({ http: response.status });
    return response;
  } catch (error) {
    record({ error: safeError(error) });
    throw error;
  }
};

const authModule = import('../k56-shared/teacher-session-client.js?rev=20261022-v1&startup=20261026-v2');
const stateModule = import('../../shared/teacher-auth-state.js?v=20261026-startup2');
const modules = Promise.all([authModule, stateModule]).catch(() => null);
const baseFetch = window.fetch;

function environment() {
  const ua = navigator.userAgent;
  const browser = /(?:EdgA?|EdgiOS|OPR|SamsungBrowser|YaBrowser|FxiOS|Firefox|CriOS)\/\d+(?:\.\d+)*/.exec(ua)?.[0]
    || /(?:Chrome|Chromium)\/\d+(?:\.\d+)*/.exec(ua)?.[0]
    || (/Safari\//.test(ua) ? /Version\/\d+(?:\.\d+)*/.exec(ua)?.[0]?.replace('Version/', 'Safari/') : null);
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Windows/.test(ua) ? 'Windows' : /Macintosh/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'unknown';
  return { browser: browser || 'unknown', os, online: navigator.onLine, cookiesEnabled: navigator.cookieEnabled, secureContext: window.isSecureContext };
}

function publishReport() {
  $('reportPanel').hidden = false;
  $('report').value = JSON.stringify(report, null, 2);
}

async function runCheck(action, operation) {
  if (busy) return;
  busy = true;
  $('check').disabled = true;
  $('googleSignInButton').hidden = true;
  $('showGoogle').hidden = true;
  $('signedInAccount').hidden = true;
  $('signedInAccount').textContent = '';
  $('copyStatus').textContent = '';
  const run = { action, utc: new Date().toISOString(), environment: environment(), requests: [] };
  currentRun = run;
  report.runs.push(run);
  if (report.runs.length > 8) report.runs.shift();
  try {
    await operation(run);
  } catch (error) {
    run.outcome = 'DIAGNOSTIC_ERROR';
    run.error = safeError(error);
    $('loginBadge').textContent = 'Chưa xác minh được phiên';
    $('loginStatus').textContent = 'Không hoàn tất được lần kiểm tra. Bạn vẫn có thể sao chép báo cáo bên dưới.';
  } finally {
    currentRun = null;
    busy = false;
    $('check').disabled = false;
    $('check').textContent = 'Kiểm tra lại';
    publishReport();
    void automatic.send({ run });
  }
}

function setupGoogle() {
  $('googleSignInButton').hidden = false;
  $('showGoogle').hidden = true;
  if (googleLoaded) return;
  googleLoaded = true;
  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  const googleUnavailable = result => {
    googleLoaded = false;
    script.remove();
    report.googleButton = result;
    void automatic.send({ googleButton: result });
    $('googleSignInButton').hidden = true;
    $('showGoogle').hidden = false;
    $('loginStatus').textContent = 'Không tải được nút Google. Bạn có thể thử lại hoặc sao chép báo cáo.';
    publishReport();
  };
  script.onload = () => {
    try {
      window.google.accounts.id.initialize({
        client_id: window.TERM_TEST_APP_CONFIG.GOOGLE_CLIENT_ID,
        auto_select: false,
        callback: ({ credential }) => {
          if (typeof credential === 'string' && credential) {
            void runCheck('google_sign_in', run => authenticate(run, credential));
          }
        }
      });
      window.google.accounts.id.renderButton($('googleSignInButton'), {
        type: 'standard', theme: 'outline', size: 'large', text: 'signin_with', shape: 'rectangular'
      });
      report.googleButton = 'RENDER_REQUESTED';
      void automatic.send({ googleButton: report.googleButton });
      publishReport();
    } catch {
      googleUnavailable('INIT_FAILED');
    }
  };
  script.onerror = () => googleUnavailable('LOAD_FAILED');
  document.head.append(script);
}

let authView;
const restore = () => runCheck('restore_session', run => authenticate(run));

async function authenticate(run, credential) {
  $('loginBadge').textContent = 'Đang xác minh đăng nhập…';
  $('loginStatus').textContent = 'Đang kiểm tra phiên và quyền lớp IC2367…';
  const loaded = await modules;
  if (!loaded) {
    run.outcome = 'AUTH_MODULE_LOAD_FAILED';
    $('loginBadge').textContent = 'Chưa xác minh được phiên';
    $('loginStatus').textContent = 'Không tải được mô-đun đăng nhập K56.';
    return;
  }
  const [{ createTeacherSessionClient, teacherSessionRequestOptions }, { createTeacherAuthState }] = loaded;
  authView ||= createTeacherAuthState({
    panel: $('googleSignInButton'), notice: $('loginStatus'), badge: $('loginBadge'), retry: restore
  });
  authView.checking();
  const health = Promise.allSettled(apiUrls.map(base => baseFetch(base + '/health', {
    cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(7000)
  })));
  try {
    const sessions = await Promise.allSettled(apiUrls.map(async base => {
      const client = createTeacherSessionClient({ apiBaseUrl: base, sessionPath: '/api/auth/session' });
      return (credential === undefined ? await client.restore() : await client.login(credential)) ? base : null;
    }));
    const accepted = sessions.filter(result => result.status === 'fulfilled' && result.value);
    if (!accepted.length) {
      const rejection = sessions.find(result => result.status === 'rejected');
      if (!rejection) {
        run.outcome = 'SIGNED_OUT';
        authView.signedOut();
        $('loginStatus').textContent = 'Chọn tài khoản Google đã được cấp quyền để tiếp tục phép kiểm.';
        setupGoogle();
      } else {
        const error = rejection.reason;
        run.outcome = 'SESSION_UNVERIFIED';
        authView.failed(Object.assign(new Error(safeError(error) === 'FETCH_FAILED'
          ? 'Trình duyệt không nhận được phản hồi khi xác minh phiên.'
          : 'Hãy xem mã phản hồi trong báo cáo.'), { status: error?.status }));
        if (automatic.active()) setupGoogle();
        else $('showGoogle').hidden = false;
      }
      return;
    }

    // Chỉ đọc quyền trên API lớp thật. Kết quả demo không quyết định quyền IC2367.
    if (!accepted.some(result => result.value === apiUrls[0])) {
      run.outcome = 'REAL_SESSION_UNVERIFIED';
      authView.failed(new Error('Khôi phục được phiên demo. Phiên lớp thật vẫn chưa xác minh được.'));
      if (automatic.active()) setupGoogle();
      else $('showGoogle').hidden = false;
      return;
    }
    try {
      const response = await fetch(apiUrls[0] + '/api/term-tests/teacher/options',
        teacherSessionRequestOptions({ cache: 'no-store', signal: AbortSignal.timeout(12000) }));
      if (!response.ok) throw Object.assign(new Error('Options failed'), { status: response.status });
      const result = await response.json();
      if (!result.ok || !Array.isArray(result.classes)) throw new Error('Invalid options');
      run.outcome = result.classes.some(item => item.name === TARGET_CLASS) ? 'CLASS_ACCESS_OK' : 'CLASS_NOT_GRANTED';
      authView.ready();
      $('loginBadge').textContent = 'Đã đăng nhập';
      $('loginStatus').textContent = run.outcome === 'CLASS_ACCESS_OK'
        ? 'Tài khoản này có quyền giảng viên với lớp IC2367.'
        : 'Tài khoản này chưa có quyền giảng viên với lớp IC2367.';
      if (typeof result.reviewer?.email === 'string') {
        $('signedInAccount').textContent = 'Tài khoản trên màn hình này: ' + result.reviewer.email;
        $('signedInAccount').hidden = false;
      }
      $('showGoogle').hidden = run.outcome === 'CLASS_ACCESS_OK';
    } catch (error) {
      run.outcome = 'CLASS_LOOKUP_FAILED';
      run.classError = Number.isInteger(error.status) ? error.status : safeError(error);
      authView.ready();
      $('loginBadge').textContent = 'Đã xác minh phiên';
      $('loginStatus').textContent = 'Chưa đọc được quyền lớp IC2367. Xem bước “Đọc quyền lớp” trong báo cáo.';
    }
  } finally {
    await health;
  }
}

$('showGoogle').addEventListener('click', setupGoogle);
$('check').addEventListener('click', restore);
$('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('report').value);
    $('copyStatus').textContent = 'Đã sao chép báo cáo.';
  } catch {
    $('report').focus();
    $('report').select();
    $('copyStatus').textContent = 'Báo cáo đã được chọn. Bạn có thể sao chép thủ công.';
  }
});
$('download').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([$('report').value], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'k56-kiem-tra-dang-nhap.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('check').disabled = false;
document.addEventListener('securitypolicyviolation', event => {
  if (!report.runs.length || !['frame-src', 'script-src-elem', 'connect-src'].includes(event.effectiveDirective)) return;
  let origin;
  try { origin = new URL(event.blockedURI).origin; } catch { return; }
  if (origin !== apiOrigin && origin !== 'https://accounts.google.com') return;
  const target = origin === apiOrigin ? 'k56_api' : 'google';
  const code = event.effectiveDirective + ':' + target;
  report.browserPolicy ||= [];
  if (!report.browserPolicy.includes(code)) {
    report.browserPolicy.push(code);
    void automatic.send({ browserPolicy: report.browserPolicy });
  }
  publishReport();
});

if (automatic.active()) setTimeout(() => {
  if (!automatic.active()) return;
  void automatic.send({ event: 'page_open' });
  void restore();
}, 900);
