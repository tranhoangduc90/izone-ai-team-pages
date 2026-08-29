'use strict';

/**
 * DÀNH CHO NGƯỜI VẬN HÀNH
 * - Nhận vào: Document ID và mã bài nằm trong liên kết học viên vừa bấm.
 * - Việc chính: kiểm tra định dạng, xóa hai mã khỏi thanh địa chỉ, gửi yêu cầu chấm tới n8n và hỏi tiến độ định kỳ.
 * - Tạo ra: ba trạng thái Đọc → Chấm → Ghi và thông báo hoàn tất.
 * - Khi lỗi: dừng tiến độ, hiện lời nhắn an toàn cùng nút thử lại; bài làm không bị sửa dở từ phía giao diện.
 */
(() => {
  const config = window.GRADER_CONFIG;
  const params = new URLSearchParams(window.location.search);
  const documentId = String(
    params.get('documentId') ?? params.get('docId') ?? params.get('document_id') ?? '',
  ).trim();
  const assignmentCode = String(
    params.get('assignmentCode') ?? params.get('assignment_code') ?? params.get('code') ?? '',
  ).trim().toLowerCase();
  const localPreview = ['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? params.get('preview')
    : null;

  const stages = ['reading', 'grading', 'writing'];
  const stageProgress = { reading: 18, grading: 52, writing: 82, done: 100 };
  const minimumCompletionPercent = Number(config?.minimumCompletionPercent) || 80;
  const card = document.querySelector('.grader-card');
  const pageTitle = document.querySelector('#page-title');
  const progressFill = document.querySelector('#progress-fill');
  const lead = document.querySelector('#lead');
  const result = document.querySelector('#result');
  const warningBox = document.querySelector('#warning-box');
  const warningMessage = document.querySelector('#warning-message');
  const warningThreshold = document.querySelector('#warning-threshold');
  const errorBox = document.querySelector('#error-box');
  const errorMessage = document.querySelector('#error-message');
  const backLink = document.querySelector('#back-link');
  const retryButton = document.querySelector('#retry-button');
  const stepElements = new Map(
    [...document.querySelectorAll('.step')].map((element) => [element.dataset.stage, element]),
  );

  let activeJobId = '';
  let stopped = false;

  warningThreshold.textContent = `${minimumCompletionPercent}%`;

  // Hai mã chỉ cần ở lần tải đầu; xóa khỏi thanh địa chỉ để hạn chế bị sao chép hoặc lưu lại ngoài ý muốn.
  if ((documentId || assignmentCode) && !localPreview) {
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

  function showDone(message) {
    stopped = true;
    card.classList.remove('is-warning');
    pageTitle.textContent = 'Đang chấm bài của bạn';
    setStage('done');
    lead.textContent = message || 'Kết quả đã được ghi trực tiếp vào bài làm của bạn.';
    result.hidden = false;
    warningBox.hidden = true;
    errorBox.hidden = true;
    retryButton.hidden = true;
    retryButton.textContent = 'Thử chấm lại';
    backLink.hidden = false;
    backLink.textContent = 'Quay lại bài làm';
  }

  function showWarning(status) {
    stopped = true;
    document.querySelectorAll('.step.active').forEach((element) => element.classList.remove('active'));
    card.classList.add('is-warning');
    pageTitle.textContent = 'Bài chưa đủ điều kiện chấm';
    lead.textContent = `Bạn cần hoàn thành ít nhất ${minimumCompletionPercent}% bài tập trước khi chấm.`;
    result.hidden = true;
    errorBox.hidden = true;
    warningMessage.textContent = status?.message
      || `Bài làm hiện chưa đạt ngưỡng ${minimumCompletionPercent}% của khóa học.`;
    warningBox.hidden = false;
    retryButton.hidden = status?.retryable === false;
    retryButton.textContent = 'Tôi đã làm đủ — chấm lại';
    backLink.hidden = false;
    backLink.textContent = 'Quay lại bài làm ngay';
  }

  function showError(message, retryable = true) {
    stopped = true;
    card.classList.remove('is-warning');
    pageTitle.textContent = 'Đang chấm bài của bạn';
    document.querySelectorAll('.step.active').forEach((element) => element.classList.remove('active'));
    lead.textContent = 'Quá trình chấm đã dừng để bảo vệ bài làm của bạn.';
    result.hidden = true;
    warningBox.hidden = true;
    errorMessage.textContent = message || 'Hệ thống chưa thể chấm bài lúc này. Vui lòng thử lại sau.';
    errorBox.hidden = false;
    retryButton.hidden = !retryable;
    retryButton.textContent = 'Thử chấm lại';
    backLink.hidden = false;
    backLink.textContent = 'Quay lại bài làm';
  }

  function safeJson(text) {
    try { return JSON.parse(text); } catch { return null; }
  }

  async function requestJson(url, options = {}) {
    const response = await fetch(url, { cache: 'no-store', ...options });
    const text = await response.text();
    const data = safeJson(text);
    if (!response.ok) {
      const error = new Error(data?.message || `Yêu cầu không thành công (${response.status}).`);
      error.retryable = data?.retryable !== false;
      throw error;
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
        showDone(status.message);
        return;
      }
      if (status.status === 'warning') {
        showWarning(status);
        return;
      }
      if (status.status === 'failed') {
        showError(status.message, status.retryable !== false);
        return;
      }
      if (stages.includes(status.stage)) setStage(status.stage);
    } catch (error) {
      // Lỗi mạng tạm thời được thử lại; lỗi kéo dài sẽ chạm ngưỡng thời gian ở trên.
      if (Date.now() - startedAt > config.timeoutMs / 2) {
        showError(error.message, error.retryable !== false);
        return;
      }
    }

    window.setTimeout(() => pollStatus(startedAt), config.pollEveryMs);
  }

  async function startGrading() {
    stopped = false;
    activeJobId = '';
    card.classList.remove('is-warning');
    pageTitle.textContent = 'Đang chấm bài của bạn';
    result.hidden = true;
    warningBox.hidden = true;
    errorBox.hidden = true;
    retryButton.hidden = true;
    retryButton.textContent = 'Thử chấm lại';
    backLink.hidden = true;
    backLink.textContent = 'Quay lại bài làm';
    lead.textContent = 'Bạn cứ giữ trang này mở. Kết quả sẽ được ghi trực tiếp vào bài làm.';
    setStage('reading');

    if (!config?.startUrl || !config?.statusUrl) {
      showError('Trang chấm bài chưa được cấu hình đầy đủ.', false);
      return;
    }
    if (!/^[A-Za-z0-9_-]{20,}$/.test(documentId)) {
      showError('Liên kết bài làm không hợp lệ. Hãy quay lại Google Docs và bấm nút chấm bài lần nữa.', false);
      return;
    }
    if (!/^67-(reading|listening)-\d{2}$/.test(assignmentCode)) {
      showError('Mã bài trong liên kết không hợp lệ. Hãy quay lại Google Docs và bấm đúng nút chấm bài.', false);
      return;
    }

    try {
      const accepted = await requestJson(config.startUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({ documentId, assignmentCode }),
      });
      activeJobId = String(accepted.job_id ?? '');
      if (!/^[A-Za-z0-9_-]{1,100}$/.test(activeJobId)) {
        throw new Error('Không nhận được mã lượt chấm hợp lệ.');
      }
      if (stages.includes(accepted.stage)) setStage(accepted.stage);
      window.setTimeout(() => pollStatus(Date.now()), 400);
    } catch (error) {
      showError(error.message, error.retryable !== false);
    }
  }

  // Chế độ xem thử chỉ hoạt động ở localhost và không gửi dữ liệu ra ngoài.
  if (localPreview && ['reading', 'grading', 'writing', 'done', 'warning', 'failed'].includes(localPreview)) {
    if (localPreview === 'done') showDone();
    else if (localPreview === 'warning') showWarning({
      message: `Bạn chưa hoàn thành đủ ${minimumCompletionPercent}% bài tập. Hãy bổ sung các câu còn thiếu.`,
      retryable: true,
    });
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
