/* Chỉ trình bày màn đăng nhập Materials; xác thực và quyền vẫn do adapter chung/API.
   Gỡ lớp giao diện sau khi có quyền để trả nguyên màn bài/chọn học viên. */
(function () {
  'use strict';
  let header;
  let activeRoot;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  function clear() {
    document.body.classList.remove('materials-teacher-login');
    activeRoot?.classList.remove('materials-login-root');
    header?.remove();
    header = activeRoot = null;
  }

  function render(root, config) {
    clear();
    document.body.classList.add('materials-teacher-login');
    activeRoot = root;
    root.classList.add('materials-login-root');
    root.setAttribute('aria-busy', 'false');
    header = document.createElement('header');
    header.className = 'materials-login-header';
    const lesson=Number.isInteger(config.lesson)?config.lesson:10;
    const product=['tfng','green-roofs','matching_headings','matching_people'].includes(config.type)?'Reading Homework':'Reading Materials';
    header.innerHTML = '<a class="materials-login-brand" href="./teacher.html"><img class="m170-logo" src="../../shared/master170/assets/izone-logo-color.png" alt="IZONE — IELTS chiến lược" width="145" height="48"></a><h1>'+product+' · Buổi '+lesson+'</h1>';
    document.body.prepend(header);
    root.innerHTML = '<section class="materials-login-hero"><div><span class="materials-login-kicker">BUỔI '+lesson+' · GIẢNG VIÊN</span><h1>Đăng nhập để xem bài học viên</h1><p class="materials-login-title">' + escape(config.title) + '</p><p class="materials-login-copy">Dùng tài khoản Google đã có quyền lớp.</p></div></section>' +
      '<section class="materials-login-card"><label class="materials-login-remember"><input type="checkbox" id="teacher-remember" checked> Tự đăng nhập Google trên thiết bị này</label><div id="google-button"></div><p id="teacher-error" role="status" aria-live="polite"></p>' +
      (config.demoGoogle ? '<button class="primary" id="demo-teacher">Vào vai giảng viên thử</button>' : '') + '</section>';
  }

  window.MaterialsTeacherLogin = { render, clear };
}());
