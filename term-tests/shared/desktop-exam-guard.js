(function () {
  'use strict';
  if (window.IZONE_EXAM_DEVICE_CHECKED) return;
  window.IZONE_EXAM_DEVICE_CHECKED = true;
  const nav = window.navigator;
  const mobile = nav.userAgentData?.mobile === true || /Android|iPhone|iPad|iPod|IEMobile|Windows Phone|Mobile|Tablet/i.test(nav.userAgent || '')
    || (/Mac/i.test(nav.platform || '') && Number(nav.maxTouchPoints) > 1);
  window.IZONE_EXAM_DEVICE_BLOCKED = mobile;
  if (!mobile) return;
  const show = () => {
    const root = document.getElementById('app');
    if (!root) return;
    root.replaceChildren();
    const panel = document.createElement('section');
    panel.className = 'exam-device-notice';
    panel.setAttribute('role', 'alert');
    const title = document.createElement('h1');
    title.textContent = 'Bài thi cần thực hiện trên máy tính';
    const text = document.createElement('p');
    text.textContent = 'Bạn hãy mở lại đường link này bằng laptop hoặc máy tính để bàn. Việc mở link trên điện thoại chưa bắt đầu bài thi và không giữ quyền Listening.';
    panel.append(title, text);
    root.append(panel);
  };
  show();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show, {once: true});
}());
