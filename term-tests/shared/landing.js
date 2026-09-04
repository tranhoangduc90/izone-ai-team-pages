/*
 * Dữ liệu nhận vào: mã lớp nhập tay hoặc danh sách lớp API trả sau khi Google xác thực giảng viên.
 * Xử lý: chỉ hiện lớp đã được backend cấp quyền, xếp mã mới trước và tạo đúng link bài test.
 * Kết quả: giảng viên chọn lớp rồi mở bản computer-based, answer sheet hoặc trang kết quả.
 * Khi lỗi: giữ ô nhập tay, không hiện dữ liệu lớp và báo rõ để người dùng thử đăng nhập lại.
 */

import { createSessionStore } from '../teacher/auth-session.js?rev=20260903-remember-login-v1';
import { sortClassesNewestFirst } from './landing-model.js?rev=20260904-landing-google-auth-v1';

const appConfig = window.TERM_TEST_APP_CONFIG || {};
const input = document.getElementById('classCode');
const classSelect = document.getElementById('classSelect');
const classHelp = document.getElementById('classHelp');
const loginBadge = document.getElementById('loginBadge');
const loginStatus = document.getElementById('loginStatus');
const googleSignInButton = document.getElementById('googleSignInButton');
const logoutButton = document.getElementById('logoutButton');
const sessionStore = createSessionStore({
  apiBaseUrl: appConfig.API_BASE_URL,
  clientId: appConfig.GOOGLE_CLIENT_ID,
  getStorage: () => window.sessionStorage
});

let idToken = '';
let loginGeneration = 0;

function selectedClassCode() {
  const value = classSelect.hidden ? input.value : classSelect.value;
  return String(value || '').trim().toUpperCase();
}

function validClassCode(value) {
  return /^[A-Z0-9_-]{2,32}$/.test(value);
}

function showManualEntry(message = 'Bạn vẫn có thể nhập mã lớp khi chưa đăng nhập.') {
  input.hidden = false;
  classSelect.hidden = true;
  classSelect.replaceChildren();
  classHelp.textContent = message;
  loginBadge.textContent = 'Giảng viên chưa đăng nhập';
  logoutButton.hidden = true;
  googleSignInButton.hidden = false;
}

function showAuthorizedClasses(payload) {
  const classes = sortClassesNewestFirst(payload.classes || []);
  if (!classes.length) throw new Error('Tài khoản chưa được cấp quyền cho lớp nào.');
  const requested = input.value.trim().toUpperCase();
  classSelect.replaceChildren(...classes.map(item => {
    const option = document.createElement('option');
    option.value = item.name;
    option.textContent = item.name;
    return option;
  }));
  const matchingClass = classes.find(item => item.name.toUpperCase() === requested);
  classSelect.value = matchingClass?.name || classes[0].name;
  input.hidden = true;
  classSelect.hidden = false;
  classHelp.textContent = 'Chỉ hiển thị các lớp tài khoản này được cấp quyền; lớp mới hơn nằm trên.';
  const reviewerName = payload.reviewer?.displayName || payload.reviewer?.email || 'Giảng viên';
  loginBadge.textContent = `Đã đăng nhập: ${reviewerName}`;
  loginStatus.textContent = `Đã tải ${classes.length} lớp.`;
  logoutButton.hidden = false;
  googleSignInButton.hidden = true;
}

async function loadAuthorizedClasses() {
  if (!appConfig.API_BASE_URL) throw new Error('Chưa cấu hình địa chỉ API.');
  if (!sessionStore.usable(idToken)) throw new Error('Phiên Google đã hết hạn; hãy đăng nhập lại.');
  const generation = loginGeneration;
  const response = await fetch(`${appConfig.API_BASE_URL}/api/term-tests/teacher/options`, {
    headers: { Authorization: `Bearer ${idToken}` },
    cache: 'no-store'
  });
  const payload = await response.json().catch(() => null);
  if (generation !== loginGeneration) return;
  if (!response.ok || !payload?.ok) {
    const error = new Error(payload?.message || (response.status === 401
      ? 'Phiên Google đã hết hạn; hãy đăng nhập lại.'
      : `Không tải được danh sách lớp (mã ${response.status}).`));
    error.status = response.status;
    throw error;
  }
  showAuthorizedClasses(payload);
  sessionStore.save(idToken);
}

function resetLogin({ clearSession = true } = {}) {
  loginGeneration += 1;
  if (clearSession) sessionStore.clear();
  idToken = '';
  showManualEntry();
}

async function connectWithToken(token, restoring = false) {
  idToken = token;
  loginStatus.textContent = restoring ? 'Đang khôi phục phiên đăng nhập...' : 'Đang tải các lớp được cấp quyền...';
  try {
    await loadAuthorizedClasses();
  } catch (error) {
    const authenticationRejected = error.status === 401 || error.status === 403;
    resetLogin({ clearSession: !restoring || authenticationRejected });
    loginStatus.textContent = `Không thể tải danh sách lớp: ${error.message}`;
  }
}

function setupGoogleSignIn() {
  if (!appConfig.GOOGLE_CLIENT_ID) {
    loginStatus.textContent = 'Chưa cấu hình Google OAuth Client ID.';
    return;
  }
  const renderButton = () => {
    window.google.accounts.id.initialize({
      client_id: appConfig.GOOGLE_CLIENT_ID,
      auto_select: false,
      callback: response => {
        resetLogin();
        connectWithToken(response.credential || '');
      }
    });
    window.google.accounts.id.renderButton(googleSignInButton, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      shape: 'rectangular'
    });
  };
  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.defer = true;
  script.onload = renderButton;
  script.onerror = () => { loginStatus.textContent = 'Không tải được nút đăng nhập Google.'; };
  document.head.append(script);
}

document.querySelectorAll('[data-test]').forEach(button => {
  button.addEventListener('click', () => {
    const classCode = selectedClassCode();
    if (!validClassCode(classCode)) {
      input.setCustomValidity('Hãy nhập hoặc chọn mã lớp hợp lệ.');
      input.reportValidity();
      return;
    }
    input.setCustomValidity('');
    window.location.href = `${button.dataset.test}/?class=${encodeURIComponent(classCode)}`;
  });
});

document.getElementById('teacherDashboard')?.addEventListener('click', () => {
  const classCode = selectedClassCode();
  const query = validClassCode(classCode) ? `?class=${encodeURIComponent(classCode)}` : '';
  window.location.href = `teacher/${query}`;
});

logoutButton.addEventListener('click', () => {
  resetLogin();
  loginStatus.textContent = 'Đã đăng xuất. Bạn có thể nhập mã lớp hoặc đăng nhập tài khoản khác.';
});

showManualEntry();
setupGoogleSignIn();
const rememberedToken = sessionStore.read();
if (rememberedToken) connectWithToken(rememberedToken, true);
