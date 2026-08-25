/**
 * DÀNH CHO NGƯỜI VẬN HÀNH
 * - Nhận vào: một cặp Document ID–mã bài demo đã được cho phép.
 * - Việc chính: gửi hai yêu cầu cùng lúc, xác nhận chỉ một lượt được chấm, rồi thử lại sau khi lượt đầu kết thúc.
 * - Tạo ra: bản tóm tắt mã HTTP và trạng thái; không đọc hoặc in nội dung bài làm.
 * - Khi lỗi: dừng với lý do rõ ràng; khóa tự hết hạn sau mười phút nếu workflow chưa kịp mở lại.
 */
const documentId = process.env.CHECK_NOW_DOCUMENT_ID;
const assignmentCode = process.env.CHECK_NOW_ASSIGNMENT_CODE;
if (!/^[A-Za-z0-9_-]{20,}$/.test(documentId ?? '')) throw new Error('Thiếu Document ID demo hợp lệ');
if (!/^67-(reading|listening)-\d{2}$/.test(assignmentCode ?? '')) throw new Error('Thiếu mã bài demo hợp lệ');

const startUrl = 'https://ducizone.ddns.net/webhook/cham-ngay-reading-listening-67-demo';
const statusUrl = 'https://ducizone.ddns.net/webhook/tien-do-cham-reading-listening-67-demo';
const headers = { Origin: 'https://tranhoangduc90.github.io', 'Content-Type': 'text/plain;charset=UTF-8' };
const body = JSON.stringify({ documentId, assignmentCode });

const start = async () => {
  const response = await fetch(startUrl, { method: 'POST', headers, body });
  const data = await response.json();
  return { httpStatus: response.status, data };
};
const waitForTerminal = async (jobId) => {
  const deadline = Date.now() + 240000;
  while (Date.now() < deadline) {
    const url = new URL(statusUrl);
    url.searchParams.set('jobId', jobId);
    const response = await fetch(url, { headers: { Origin: headers.Origin }, cache: 'no-store' });
    const data = await response.json();
    if (['done', 'warning', 'failed'].includes(data.status)) return data.status;
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  throw new Error('Lượt chấm không kết thúc trong thời gian kiểm thử');
};

const pair = await Promise.all([start(), start()]);
const accepted = pair.find((item) => item.httpStatus === 202);
const blocked = pair.find((item) => item.httpStatus === 409);
if (!accepted?.data?.job_id) throw new Error('Hai yêu cầu đồng thời không có đúng một lượt được nhận');
if (blocked?.data?.status !== 'ALREADY_GRADING') throw new Error('Yêu cầu mở sau chưa bị chặn bằng trạng thái ALREADY_GRADING');
const firstTerminal = await waitForTerminal(accepted.data.job_id);
if (!['done', 'warning'].includes(firstTerminal)) throw new Error(`Lượt đầu kết thúc bất thường: ${firstTerminal}`);

const afterUnlock = await start();
if (afterUnlock.httpStatus !== 202 || !afterUnlock.data?.job_id) throw new Error('Tài liệu chưa được mở khóa sau khi lượt đầu kết thúc');
const secondTerminal = await waitForTerminal(afterUnlock.data.job_id);
if (!['done', 'warning'].includes(secondTerminal)) throw new Error(`Lượt chấm lại kết thúc bất thường: ${secondTerminal}`);

process.stdout.write(JSON.stringify({
  ok: true,
  assignmentCode,
  simultaneousStatuses: pair.map((item) => item.httpStatus).sort(),
  duplicateStatus: blocked.data.status,
  firstTerminal,
  afterUnlockStatus: afterUnlock.httpStatus,
  secondTerminal,
}, null, 2));
