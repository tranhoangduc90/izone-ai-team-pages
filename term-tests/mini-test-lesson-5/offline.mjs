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
    async flush() {
      if (navigator.onLine === false) return;
      return super.flush();
    }
  }
  return new PaperRuntime({ apiBase, classCode, store: new ExamStore() }).open();
}
