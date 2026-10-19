// Nhận phiên và điều kiện đã xác minh của renderer; tự nộp, đọc lại khi mất phản hồi.
// Chỉ báo thành công với biên nhận. Mỗi vòng tối đa ba lần gửi, không ghi trùng ở client.
export function createAutoSubmit({ key, ready, submitted, busy, send, readBack, onSubmitted, onState }) {
  let scope = '', generation = 0, active = false, timer = null, attempts = 0, exhausted = false;
  let mustRead = false;
  function clearTimer() { clearTimeout(timer); timer = null; }
  function reset() {
    generation += 1; clearTimer(); scope = ''; active = false;
    attempts = 0; exhausted = false; mustRead = false;
    onState('idle');
  }
  function definitive(error) {
    return [400, 401, 403, 404, 409, 422].includes(error.status);
  }
  async function run() {
    if (active || submitted() || !ready() || busy()) return;
    active = true;
    attempts += 1;
    const turn = generation, expected = scope;
    const current = () => turn === generation && expected === key();
    try {
      // Sau timeout hoặc nút thử lại, luôn đọc biên nhận trước khi gửi thêm.
      if (mustRead) {
        onState('verifying');
        await readBack();
        if (!current()) return;
        if (submitted()) { onSubmitted(); return; }
        if (!ready()) { exhausted = true; onState('failed'); return; }
        mustRead = false;
      }
      onState('sending');
      const response = await send();
      if (!current()) return;
      if (!response.receipt?.id) throw new Error('Máy chủ chưa trả biên nhận.');
      onSubmitted(response.receipt);
    } catch (error) {
      if (!current()) return;
      if (definitive(error)) { exhausted = true; onState('failed', error); return; }
      mustRead = true;
      onState('verifying');
      try {
        await readBack();
        if (!current()) return;
        if (submitted()) { onSubmitted(); return; }
      } catch (readError) {
        if (!current()) return;
        if (definitive(readError)) { exhausted = true; onState('failed', readError); return; }
      }
      if (!current()) return;
      if (!ready() || attempts >= 3) { exhausted = true; onState('failed', error); return; }
      onState('waiting');
      // Không dùng sự kiện online để bỏ giới hạn hoặc tạo một lượt gửi song song.
      timer = setTimeout(() => { timer = null; if (current()) void run(); },
        Math.max(attempts <= 1 ? 15_000 : 30_000, error.retryAfterMs || 0));
    } finally { if (turn === generation) active = false; }
  }
  return {
    consider() {
      const next = key();
      if (next !== scope) { reset(); scope = next; }
      if (!next || submitted()) { clearTimer(); return; }
      if (!ready()) { clearTimer(); if (!active) { attempts = 0; exhausted = false; mustRead = false; onState('idle'); } return; }
      if (!active && !timer && !exhausted && !busy()) void run();
    },
    retry() {
      if (active || submitted() || !ready() || busy()) return;
      clearTimer(); attempts = 0; exhausted = false; mustRead = true;
      void run();
    },
    reset,
  };
}
