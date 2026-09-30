// Nhận trạng thái có việc chờ và hàm tải tiến trình của phiên đang mở.
// Chỉ tải khi cần, chờ ít nhất 15 giây; lỗi mạng tăng đến 60 giây, tab ẩn tải chậm hơn.
// Học viên giữ link đã nhập và thấy lời báo kết nối khi máy chủ chưa trả kết quả.
export function createPendingPoller({ refresh, hasSession, isPending, onError }) {
  let timer = null;
  let delay = 15_000;
  let expected = false;
  let generation = 0;
  let running = false;
  function schedule() {
    if (timer || running || !hasSession() || (!expected && !isPending())) return;
    const revision = generation;
    timer = setTimeout(async () => {
      timer = null;
      if (revision !== generation || !hasSession()) return;
      running = true;
      try {
        await refresh();
        if (revision !== generation) return;
        expected = false;
        delay = 15_000;
      } catch (error) {
        if (revision !== generation) return;
        expected = true;
        delay = Math.min(delay * 2, 60_000);
        onError(error);
      } finally {
        running = false;
        if (revision === generation) schedule();
      }
    }, document.hidden ? Math.max(delay, 60_000) : delay);
  }
  return {
    expect() { expected = true; schedule(); },
    retry() { expected = true; delay = Math.min(delay * 2, 60_000); schedule(); },
    update() { schedule(); },
    settled() {
      expected = false;
      if (!isPending()) { clearTimeout(timer); timer = null; }
      schedule();
    },
    stop() { generation += 1; clearTimeout(timer); timer = null; expected = false; delay = 15_000; },
  };
}
