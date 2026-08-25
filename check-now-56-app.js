'use strict';

/** Giao diện chấm riêng khóa 56; không dùng chung cấu hình hoặc mã allow-list của khóa 67. */
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
    setStage('done');
    lead.textContent = message || 'Kết quả đã được ghi trực tiếp vào bài làm của bạn.';
    result.hidden = false;
    errorBox.hidden = true;
    retryButton.hidden = true;
    backLink.hidden = false;
  }

  function showError(message, retryable = true) {
    stopped = true;
    document.querySelectorAll('.step.active').forEach((element) => element.classList.remove('active'));
    lead.textContent = 'Quá trình chấm đã dừng để bảo vệ bài làm của bạn.';
    result.hidden = true;
    errorMessage.textContent = message || 'Hệ thống chưa thể chấm bài lúc này. Vui lòng thử lại sau.';
    errorBox.hidden = false;
    retryButton.hidden = !retryable;
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
      const error = new Error(data?.message || `Yêu cầu không thành công (${response.status}).`);
      error.retryable = data?.retryable !== false;
      throw error;
    }
    if (!data || typeof data !== 'object') throw new Error('Máy chủ trả về dữ liệu không hợp lệ.');
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
      if (status.status === 'done') { showDone(status.message); return; }
      if (status.status === 'failed' || status.status === 'warning') {
        showError(status.message, status.retryable !== false);
        return;
      }
      if (stages.includes(status.stage)) setStage(status.stage);
    } catch (error) {
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
    result.hidden = true;
    errorBox.hidden = true;
    retryButton.hidden = true;
    backLink.hidden = true;
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
    if (!/^56-(reading-0[1-6]|listening-0[1-5]|vocab-(?:0[1-9]|1[0-9]|2[0-3]))$/.test(assignmentCode)) {
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
      if (!/^[A-Za-z0-9_-]{1,100}$/.test(activeJobId)) throw new Error('Không nhận được mã lượt chấm hợp lệ.');
      if (stages.includes(accepted.stage)) setStage(accepted.stage);
      window.setTimeout(() => pollStatus(Date.now()), 400);
    } catch (error) {
      showError(error.message, error.retryable !== false);
    }
  }

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
