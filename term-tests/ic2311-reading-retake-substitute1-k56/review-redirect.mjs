import { DurableStore } from './storage.mjs';

const finished = document.getElementById('finished');
const receipt = document.getElementById('receipt');
const result = new URL('../ic2311-retake-review/?skill=reading', location.href);
const automatic = new URLSearchParams(location.search).get('result') !== '0';
let checking = false;

async function showResult() {
  if (!finished || finished.hidden || !receipt?.textContent || checking) return;
  checking = true;
  try {
    const store = await new DurableStore().open();
    const state = await store.get('current');
    if (state?.phase !== 'submitted' || !state.serverConfirmed || state.pending ||
        state.identity?.classCode !== 'IC2311' || !state.permit || typeof state.receipt !== 'string') return;

    if (!document.getElementById('reading-review-link')) {
      const link = document.createElement('a');
      link.id = 'reading-review-link';
      link.className = 'button button-primary';
      link.href = result.href;
      link.textContent = 'Xem kết quả và giải thích';
      finished.querySelector('.transition-actions')?.append(link);
    }
    if (automatic && navigator.onLine && !state.storageFailed) location.replace(result.href);
  } catch {
    // The existing confirmation and its receipt stay visible if storage cannot be read.
  } finally {
    checking = false;
  }
}

if (finished && receipt) {
  const observer = new MutationObserver(showResult);
  observer.observe(finished, { attributeFilter: ['hidden'] });
  observer.observe(receipt, { childList: true, characterData: true, subtree: true });
  addEventListener('online', showResult);
  void showResult();
}

const preparationStatus = document.getElementById('prepare-status');
if (preparationStatus) {
  new MutationObserver(() => {
    if (!preparationStatus.textContent.includes('(ALREADY_SUBMITTED)')) return;
    preparationStatus.textContent = 'Bài này đã được nộp. Hãy mở lại bài trên đúng thiết bị và trình duyệt đã dùng để thi để xem kết quả.';
    const retry = document.getElementById('retry');
    if (retry) retry.hidden = true;
  }).observe(preparationStatus, { childList: true, subtree: true, characterData: true });
}
