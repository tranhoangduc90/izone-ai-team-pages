export function gradingStatus(attempt, {reading = false, reconnecting = false} = {}) {
  const stage = attempt.validationProgress;
  const raw = stage?.itemProgress;
  const count = Number.isSafeInteger(raw?.checkedItems) && Number.isSafeInteger(raw?.totalItems)
    && raw.checkedItems >= 0 && raw.totalItems > 0 && raw.checkedItems <= raw.totalItems ? raw : null;
  const label = reconnecting ? 'Đang kết nối lại · Bài đã lưu'
    : stage?.service_error ? 'Chờ dịch vụ chấm · Bài đã lưu'
    : count && count.checkedItems === count.totalItems ? 'Đã kiểm đủ · Đang lưu kết quả'
    : stage?.phase === 'review' ? 'Đang kiểm lại nhận xét'
    : stage?.phase === 'repair' ? 'Đang bổ sung nhận xét'
    : attempt.status === 'queued' ? 'Đã lưu bài · Chờ chấm'
    : reading ? 'Đang chấm bằng Read 67' : 'Đang đối chiếu câu trả lời';
  return {label, count, busy: !reconnecting && !stage?.service_error};
}

const views = new WeakMap();
const stylesheet = new URL('/izone-ai-team-pages/progress-log/releases/ecb70b8e95ca539a/shared/grading-status.css', import.meta.url).href;

export function renderGradingStatus(host, {label, busy = false, count = null}) {
  if (!host) return;
  let view = views.get(host);
  if (!view || view.root.parentNode !== host) {
    const doc = host.ownerDocument;
    if (!doc.getElementById('izone-grading-status-css')) {
      const css = doc.createElement('link');
      css.id = 'izone-grading-status-css';
      css.rel = 'stylesheet';
      css.href = stylesheet;
      doc.head.append(css);
    }
    const root = doc.createElement('span'), icon = doc.createElement('span');
    const text = doc.createElement('span'), meter = doc.createElement('progress'), counter = doc.createElement('span');
    root.className = 'izone-grading-status';
    icon.className = 'izone-grading-spinner';
    icon.setAttribute('aria-hidden', 'true');
    text.className = 'izone-grading-label';
    meter.setAttribute('aria-label', 'Số mục đã kiểm');
    counter.className = 'izone-grading-count';
    root.append(icon, text, meter, counter);
    host.replaceChildren(root);
    view = {root, icon, text, meter, counter};
    views.set(host, view);
  }
  const {root, icon, text, meter, counter} = view;
  if (text.textContent !== label) text.textContent = label;
  if (icon.hidden === busy) icon.hidden = !busy;
  if (meter.hidden === Boolean(count)) meter.hidden = !count;
  if (counter.hidden === Boolean(count)) counter.hidden = !count;
  if (count) {
    if (meter.max !== count.totalItems) meter.max = count.totalItems;
    if (meter.value !== count.checkedItems || !meter.hasAttribute('value')) meter.value = count.checkedItems;
    const number = count.checkedItems + '/' + count.totalItems;
    if (counter.textContent !== number) counter.textContent = number;
    const summary = label + ' · Đã kiểm ' + number + ' mục';
    if (root.title !== summary) root.title = summary;
  } else if (root.title !== label) root.title = label;
}
