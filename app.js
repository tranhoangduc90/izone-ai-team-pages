'use strict';

/**
 * DÀNH CHO NGƯỜI VẬN HÀNH
 * - Nhận vào: Document ID và số bài Vocab nằm trong liên kết học viên vừa bấm.
 * - Việc chính: xóa ID khỏi thanh địa chỉ, gửi yêu cầu chấm tới n8n và hỏi tiến độ định kỳ.
 * - Tạo ra: ba trạng thái Đọc → Chấm → Ghi và thông báo hoàn tất.
 * - Khi lỗi: dừng tiến độ, hiện thông báo an toàn cùng nút thử lại.
 */
(() => {
  const config = window.GRADER_CONFIG;
  const params = new URLSearchParams(window.location.search);
  const documentId = String(
    params.get('documentId') ?? params.get('docId') ?? params.get('document_id') ?? '',
  ).trim();
  const homework = Number(
    params.get('homework') ?? params.get('vocab') ?? config?.defaultHomework ?? 0,
  );
  const allowedHomeworks = Array.isArray(config?.allowedHomeworks)
    ? config.allowedHomeworks.map(Number)
    : [3];
  const localPreview = ['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? params.get('preview')
    : null;

  const stages = ['reading', 'grading', 'writing'];
  const stageProgress = { reading: 18, grading: 52, writing: 82, done: 100 };
  const progressFill = document.querySelector('#progress-fill');
  const lead = document.querySelector('#lead');
  const result = document.querySelector('#result');
  const errorBox = document.querySelector('#error-box');
  const errorMessage = document.querySelector('#error-message');
  const backLink = document.querySelector('#back-link');
  const retryButton = document.querySelector('#retry-button');
  const stepElements = new Map(
    [...document.querySelectorAll('.step')].map((element) => [element.dataset.stage, element]),
  );

  let activeJobId = '';
  let stopped = false;

  const homeworkLabel = `Vocab ${String(homework || 0).padStart(2, '0')}`;
  document.querySelectorAll('[data-homework-label]').forEach((element) => {
    element.textContent = homeworkLabel;
  });
  if (homework) document.title = `Chấm bài ${homeworkLabel}`;

  // Hai mã chỉ cần ở lần tải đầu; xóa khỏi thanh địa chỉ để hạn chế bị sao chép hoặc lưu lại ngoài ý muốn.
  if ((documentId || homework) && !localPreview) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  function setStage(stage) {
    const activeIndex = stages.indexOf(stage);
    stages.forEach((name, index) => {
      const element = stepElements.get(name);
      element.classList.toggle('done', stage === 'done' || index < activeIndex);
      element.classList.toggle('active', stage !== 'done' && index === activeIndex);
    });
    progressFill.style.width = `${stageProgress[stage] ?? 8}%`;
  }

  function showDone() {
    stopped = true;
    setStage('done');
    lead.textContent = 'Kết quả đã được ghi trực tiếp vào bài làm của bạn.';
    result.hidden = false;
    errorBox.hidden = true;
    retryButton.hidden = true;
    backLink.hidden = false;
  }

  function showError(message) {
    stopped = true;
    document.querySelectorAll('.step.active').forEach((element) => element.classList.remove('active'));
    lead.textContent = 'Quá trình chấm đã dừng để bảo vệ bài làm của bạn.';
    result.hidden = true;
    errorMessage.textContent = message || 'Hệ thống chưa thể chấm bài lúc này. Vui lòng thử lại sau.';
    errorBox.hidden = false;
    retryButton.hidden = false;
    backLink.hidden = false;
  }

  function safeJson(text) {
    try { return JSON.parse(text); } catch { return null; }
  }

  async function requestJson(url, options = {}) {
    const response = await fetch(url, { cache: 'no-store', ...options });
    const text = await response.text();
    const data = safeJson(text);
    if (!response.ok) {
      throw new Error(data?.message || `Yêu cầu không thành công (${response.status}).`);
    }
    if (!data || typeof data !== 'object') {
      throw new Error('Máy chủ trả về dữ liệu không hợp lệ.');
    }
    return data;
  }

  async function pollStatus(startedAt) {
    if (stopped) return;
    if (Date.now() - startedAt > config.timeoutMs) {
      showError('Việc chấm bài mất nhiều thời gian hơn dự kiến. Vui lòng thử lại.');
      return;
    }

    try {
      const url = new URL(config.statusUrl);
      url.searchParams.set('jobId', activeJobId);
      const status = await requestJson(url.toString());
      if (status.status === 'done') {
        showDone();
        return;
      }
      if (status.status === 'failed') {
        showError(status.message);
        return;
      }
      if (stages.includes(status.stage)) setStage(status.stage);
    } catch (error) {
      // Lỗi mạng tạm thời được thử lại; lỗi kéo dài sẽ chạm ngưỡng thời gian ở trên.
      if (Date.now() - startedAt > config.timeoutMs / 2) {
        showError(error.message);
        return;
      }
    }

    window.setTimeout(() => pollStatus(startedAt), config.pollEveryMs);
  }

  async function startGrading() {
    stopped = false;
    activeJobId = '';
    result.hidden = true;
    errorBox.hidden = true;
    retryButton.hidden = true;
    backLink.hidden = true;
    lead.textContent = 'Bạn cứ giữ trang này mở. Kết quả sẽ được ghi trực tiếp vào bài làm.';
    setStage('reading');

    if (!config?.startUrl || !config?.statusUrl) {
      showError('Trang chấm bài chưa được cấu hình đầy đủ.');
      return;
    }
    if (!/^[A-Za-z0-9_-]{20,}$/.test(documentId)) {
      showError('Liên kết bài làm không hợp lệ. Hãy quay lại Google Docs và bấm nút chấm bài lần nữa.');
      return;
    }
    if (!allowedHomeworks.includes(homework)) {
      showError('Số bài Vocab trong liên kết chưa được hệ thống hỗ trợ. Hãy báo giáo viên kiểm tra.');
      return;
    }

    try {
      const accepted = await requestJson(config.startUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({ documentId, homework }),
      });
      activeJobId = String(accepted.job_id ?? '');
      if (!/^[A-Za-z0-9_-]{1,80}$/.test(activeJobId)) {
        throw new Error('Không nhận được mã lượt chấm hợp lệ.');
      }
      window.setTimeout(() => pollStatus(Date.now()), 400);
    } catch (error) {
      showError(error.message);
    }
  }

  // Chế độ này chỉ chạy ở localhost để kiểm tra giao diện, không gửi dữ liệu ra ngoài.
  if (localPreview && ['reading', 'grading', 'writing', 'done', 'failed'].includes(localPreview)) {
    if (localPreview === 'done') showDone();
    else if (localPreview === 'failed') showError('Hệ thống chưa thể đọc bài làm. Vui lòng thử lại.');
    else setStage(localPreview);
  } else {
    startGrading();
  }

  backLink.href = documentId
    ? `https://docs.google.com/document/d/${encodeURIComponent(documentId)}/edit`
    : 'https://docs.google.com/';
  retryButton.addEventListener('click', startGrading);
})();
