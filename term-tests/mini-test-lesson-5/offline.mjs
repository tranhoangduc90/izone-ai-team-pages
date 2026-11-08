import { createOfflineRuntime } from '../k56-offline-shared/runtime.mjs?v=20261107-mini-v3';

export const BUILD = 'mini-k67-paper-offline-v1';

export async function openPaperRuntime({ apiBase, classCode, testConfig }) {
  if (!globalThis.isSecureContext || !navigator.locks || !navigator.serviceWorker
      || !globalThis.indexedDB || !globalThis.crypto?.subtle || !classCode) return null;

  const answerKeys = Object.fromEntries(['listening', 'reading'].map(section => [
    section, testConfig[section].controls.map(control => String(control.number))
  ]));
  const { ExamStore, OfflineRuntime } = createOfflineRuntime({
    slug: 'mini-test-lesson-5', policy: BUILD, build: BUILD, paper: true,
    dbName: 'izone-mini-k67-paper-v1', localPrefix: 'mini-k67-paper:',
    lockPrefix: 'mini-k67-paper:', runPrefix: 'mini-k67-paper-',
    filePrefix: 'Mini-Test-K67-Phieu-Giay', exportTitle: 'Bài làm Mini Test Buổi 5',
    pageTitle: 'Bài làm Mini Test Buổi 5 · Khóa 67', cause: 'mini_k67_paper_offline',
    answerKeys
  });
  class PaperRuntime extends OfflineRuntime {
    mount(options) {
      const mounted = Boolean(this.panel);
      super.mount(options);
      if (mounted || !this.panel) return;

      const card = document.getElementById('resultReadyView');
      const label = card.querySelector('.eyebrow');
      const heading = card.querySelector('h2');
      const detail = card.querySelector('h2 + p');
      const button = card.querySelector('#viewResult');
      const original = [label.textContent, heading.textContent, detail.textContent];
      let status = '';
      const render = () => {
        const { listening, reading } = this.record.sections;
        const next = listening?.sealed && reading?.sealed && this.pending
          ? (this.record.review ? 'review' : 'pending') : '';
        if (next === status) return;
        status = next;
        const copy = next === 'review'
          ? ['Đã lưu bài làm', 'Bài làm cần được đối soát', 'Bài làm đã lưu trên thiết bị. Hãy báo giảng viên để kiểm tra.']
          : next === 'pending'
            ? ['Đã lưu bài làm', 'Bài làm đang chờ đồng bộ', 'Bài làm đã lưu trên thiết bị. Bạn có thể xem kết quả sau khi máy chủ xác nhận đã nhận bài.']
            : original;
        [label.textContent, heading.textContent, detail.textContent] = copy;
        button.disabled = Boolean(next);
      };
      this.addEventListener('change', render);
      render();
    }

    async flush() {
      if (navigator.onLine === false) return;
      return super.flush();
    }
  }
  return new PaperRuntime({ apiBase, classCode, store: new ExamStore() }).open();
}
