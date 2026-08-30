/*
 * Dữ liệu nhận vào: Google ID token và dữ liệu vận hành từ API production.
 * Việc chính: giữ token trong RAM, tải dashboard, lọc lịch sử và gửi các thay đổi có lý do/audit.
 * Kết quả: người vận hành xem và điều chỉnh hệ thống mà không phải nhập mã kỹ thuật.
 * Khi lỗi: giao diện giữ dữ liệu cũ, hiện thông báo rõ; phiên hết hạn sẽ quay về màn hình đăng nhập.
 */
const config = window.AI_GATEWAY_DASHBOARD_CONFIG || {};
const $ = id => document.getElementById(id);
const colors = { google_1:'#2878d0', google_2:'#16a085', google_3:'#f39c12', google_4:'#8e5bb7' };
const statusText = { success:'Thành công', failed:'Thất bại', running:'Đang chạy' };
const state = { idToken:'', operator:null, workers:[], billing:[], shares:{}, summary:{} };

function node(tag, className, textValue) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (textValue !== undefined) element.textContent = textValue;
  return element;
}

function money(value) {
  return new Intl.NumberFormat('vi-VN', { style:'currency', currency:'USD', maximumFractionDigits:2 }).format(Number(value || 0));
}

function when(value) {
  return value ? new Intl.DateTimeFormat('vi-VN', { dateStyle:'short', timeStyle:'medium' }).format(new Date(value)) : '—';
}

function seconds(value) {
  return value === null || value === undefined ? '—' : `${(Number(value) / 1000).toFixed(1)} giây`;
}

function toast(message) {
  const box = $('toast');
  box.textContent = message;
  box.style.display = 'block';
  window.setTimeout(() => { box.style.display = 'none'; }, 3600);
}

function friendlyError(code, fallback) {
  const messages = {
    google_login_required:'Bạn cần đăng nhập Google.',
    google_token_invalid:'Phiên Google đã hết hạn. Hãy đăng nhập lại.',
    google_account_not_allowed:'Tài khoản Google này chưa được cấp quyền.',
    dashboard_origin_forbidden:'Trang hiện tại không được phép gọi dashboard.',
    google_dashboard_auth_not_configured:'Backend chưa hoàn tất cấu hình Google Auth.',
  };
  return messages[code] || fallback || code || 'Không tải được dữ liệu.';
}

async function api(path, { method='GET', body, reason } = {}) {
  if (!state.idToken) throw new Error('Bạn chưa đăng nhập Google.');
  const headers = { Authorization:`Bearer ${state.idToken}` };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (reason) {
    headers['x-change-reason'] = encodeURIComponent(reason);
    headers['x-idempotency-key'] = crypto.randomUUID();
  }
  const response = await fetch(`${config.API_BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const code = payload?.error?.code;
    if (response.status === 401) showLogin();
    throw new Error(friendlyError(code, `API trả về mã ${response.status}.`));
  }
  return payload;
}

function showLogin(message='') {
  state.idToken = '';
  state.operator = null;
  $('dashboardView').hidden = true;
  $('operatorBadge').hidden = true;
  $('logoutButton').hidden = true;
  $('loginView').hidden = false;
  $('loginNotice').textContent = message;
}

function showDashboard() {
  $('loginView').hidden = true;
  $('dashboardView').hidden = false;
  $('operatorBadge').textContent = `Đã đăng nhập: ${state.operator?.name || state.operator?.email || ''}`;
  $('operatorBadge').hidden = false;
  $('logoutButton').hidden = false;
}

function renderSummary(data) {
  state.workers = data.workers || [];
  state.billing = data.billing || [];
  state.shares = data.shares || {};
  state.summary = data.summary || {};
  $('kpiTotal').textContent = String(state.summary.total || 0);
  $('kpiSuccess').textContent = `${(Number(state.summary.success_rate || 0) * 100).toFixed(1)}%`;
  $('kpiP50').textContent = (Number(state.summary.p50_latency_ms || 0) / 1000).toFixed(1);
  $('kpiP95').textContent = (Number(state.summary.p95_latency_ms || 0) / 1000).toFixed(1);
  $('kpiFallback').textContent = String(state.summary.fallback_count || 0);
  renderBilling(state.billing);
  renderWorkers(state.workers, state.shares);

  const workerSelector = $('credentialWorker');
  const selectedWorker = workerSelector.value;
  workerSelector.replaceChildren();
  for (const worker of state.workers) {
    const option = node('option', '', worker.display_name);
    option.value = worker.id;
    workerSelector.append(option);
  }
  if (state.workers.some(worker => worker.id === selectedWorker)) workerSelector.value = selectedWorker;

  const accountSelector = $('usageAccount');
  const selectedAccount = accountSelector.value;
  while (accountSelector.options.length > 1) accountSelector.remove(1);
  for (const account of state.billing) {
    const option = node('option', '', account.display_name);
    option.value = account.id;
    accountSelector.append(option);
  }
  accountSelector.value = state.billing.some(account => account.id === selectedAccount) ? selectedAccount : 'all';
}

function renderBilling(accounts) {
  const container = $('billingAccounts');
  container.replaceChildren();
  for (const account of accounts) {
    const card = node('article', 'account');
    card.append(node('h3', '', account.display_name));
    card.append(node('div', 'money', money(account.estimated_remaining)));
    card.append(node('div', 'meta', 'Còn lại ước tính'));
    const progress = node('div', 'progress');
    const bar = node('i');
    const initial = Number(account.initial_credit || 0);
    bar.style.width = `${initial > 0 ? Math.max(0, Math.min(100, Number(account.estimated_remaining || 0) / initial * 100)) : 0}%`;
    progress.append(bar);
    card.append(progress);
    card.append(node('div', 'meta', `Đã dùng ${money(account.credits_used)} · hết hạn ${when(account.expires_at)}`));
    const syncLabel = account.sync_status === 'success' ? 'đã đồng bộ Billing Export' : account.sync_status === 'failed' ? 'đồng bộ lỗi' : 'chưa có Billing Export';
    card.append(node('div', 'meta', `Ước tính — cập nhật ${when(account.last_synced_at)} · ${syncLabel}`));
    container.append(card);
  }
}

function renderWorkers(workers, shares) {
  const container = $('workers');
  container.replaceChildren();
  for (const worker of workers) {
    const card = node('article', 'worker');
    card.append(node('h3', '', worker.display_name));
    card.append(node('div', 'meta', worker.billing_account_name));
    const share = node('div', 'share', `Tỷ lệ lượt đầu dự kiến: ${(Number(shares[worker.id] || 0) * 100).toFixed(1)}%`);
    share.dataset.share = worker.id;
    card.append(share);
    const fields = node('div', 'worker-fields');
    const weightLabel = node('label', '', 'Trọng số');
    const weight = document.createElement('input');
    Object.assign(weight, { type:'number', min:'0', max:'100', value:worker.weight });
    weight.dataset.weight = worker.id;
    weightLabel.append(weight);
    const limitLabel = node('label', '', 'Giới hạn cùng lúc');
    const limit = document.createElement('input');
    Object.assign(limit, { type:'number', min:'1', max:'500', value:worker.max_concurrency });
    limit.dataset.limit = worker.id;
    limitLabel.append(limit);
    fields.append(weightLabel, limitLabel);
    card.append(fields);
    const toggle = node('label', 'toggle');
    const enabled = document.createElement('input');
    enabled.type = 'checkbox';
    enabled.checked = worker.enabled;
    enabled.dataset.enabled = worker.id;
    toggle.append(enabled, document.createTextNode(' Cho máy này nhận việc'));
    card.append(toggle);
    const save = node('button', '', 'Lưu trọng số');
    save.dataset.save = worker.id;
    card.append(save);
    container.append(card);
  }
  container.querySelectorAll('input').forEach(input => input.addEventListener('input', previewShares));
  container.querySelectorAll('button[data-save]').forEach(button => button.addEventListener('click', event => void saveWorker(event)));
}

function previewShares() {
  const values = state.workers.map(worker => ({
    id:worker.id,
    weight:Number(document.querySelector(`[data-weight="${worker.id}"]`).value || 0),
    enabled:document.querySelector(`[data-enabled="${worker.id}"]`).checked,
  }));
  const total = values.reduce((sum, item) => sum + (item.enabled ? Math.max(0, item.weight) : 0), 0);
  for (const item of values) {
    const percent = total && item.enabled ? item.weight / total * 100 : 0;
    document.querySelector(`[data-share="${item.id}"]`).textContent = `Tỷ lệ lượt đầu dự kiến: ${percent.toFixed(1)}%`;
  }
}

async function saveWorker(event) {
  const button = event.currentTarget;
  const id = button.dataset.save;
  button.disabled = true;
  try {
    const body = {
      weight:Number(document.querySelector(`[data-weight="${id}"]`).value),
      max_concurrency:Number(document.querySelector(`[data-limit="${id}"]`).value),
      enabled:document.querySelector(`[data-enabled="${id}"]`).checked,
    };
    await api(`/workers/${encodeURIComponent(id)}`, { method:'PATCH', body, reason:`Cập nhật trọng số hoặc trạng thái máy ${id}` });
    toast(`Đã lưu cấu hình ${id}.`);
    await loadSummary();
  } catch (error) { toast(`Lỗi: ${error.message}`); }
  finally { button.disabled = false; }
}

function renderCredentials(items) {
  const container = $('credentials');
  container.replaceChildren();
  $('credentialEmpty').style.display = items.length ? 'none' : 'block';
  for (const item of items) {
    const card = node('article', 'credential');
    card.append(
      node('h3', '', `${item.display_name} · bản ${item.version}`),
      node('div', 'meta', `${item.worker_name} · ${item.project_id}`),
      node('div', 'meta', item.client_email_masked),
      node('div', 'meta', `Dấu vân tay ${item.private_key_fingerprint}`),
      node('div', 'meta', `Trạng thái: ${item.status} · kiểm tra: ${item.test_status}`),
    );
    const actions = node('div', 'actions');
    const testButton = node('button', 'secondary', 'Kiểm tra');
    testButton.dataset.testCredential = item.id;
    actions.append(testButton);
    if (item.test_status === 'success' && item.status !== 'active') {
      const activate = node('button', '', 'Kích hoạt');
      activate.dataset.activateCredential = item.id;
      actions.append(activate);
    }
    card.append(actions);
    container.append(card);
  }
  container.querySelectorAll('[data-test-credential]').forEach(button => button.addEventListener('click', event => void testCredential(event)));
  container.querySelectorAll('[data-activate-credential]').forEach(button => button.addEventListener('click', event => void activateCredential(event)));
}

async function loadCredentials() {
  const data = await api('/credentials');
  renderCredentials(data.items || []);
}

async function uploadCredential() {
  const file = $('credentialFile').files[0];
  if (!file) throw new Error('Hãy chọn file JSON service account.');
  if (file.size > 1024 * 1024) throw new Error('File credential lớn bất thường; hãy kiểm tra lại.');
  let credential;
  try { credential = JSON.parse(await file.text()); }
  catch { throw new Error('File credential không phải JSON hợp lệ.'); }
  const worker = $('credentialWorker').value;
  await api('/credentials', {
    method:'POST',
    body:{ worker_id:worker, display_name:$('credentialName').value.trim(), credential },
    reason:`Tải credential mới cho ${worker}`,
  });
  $('credentialFile').value = '';
  toast('Đã lưu bản credential mới; cần kiểm tra trước khi kích hoạt.');
  await loadCredentials();
}

async function testCredential(event) {
  const id = event.currentTarget.dataset.testCredential;
  try {
    const data = await api(`/credentials/${encodeURIComponent(id)}/test`, { method:'POST', body:{}, reason:'Kiểm tra credential trước khi kích hoạt' });
    toast(data.ok ? 'Kết nối Google thành công.' : 'Kết nối Google thất bại.');
    await loadCredentials();
  } catch (error) { toast(`Lỗi: ${error.message}`); }
}

async function activateCredential(event) {
  const id = event.currentTarget.dataset.activateCredential;
  try {
    await api(`/credentials/${encodeURIComponent(id)}/activate`, { method:'POST', body:{}, reason:'Kích hoạt credential đã kiểm tra' });
    toast('Đã kích hoạt credential mới.');
    await loadCredentials();
  } catch (error) { toast(`Lỗi: ${error.message}`); }
}

function drawAxes(context, width, height, maxValue, labelFormatter) {
  context.clearRect(0, 0, width, height);
  context.strokeStyle = '#dce5ec';
  context.fillStyle = '#66788a';
  context.font = '11px Segoe UI';
  context.lineWidth = 1;
  for (let index = 0; index <= 4; index += 1) {
    const y = 20 + (height - 55) * (index / 4);
    context.beginPath(); context.moveTo(44, y); context.lineTo(width - 12, y); context.stroke();
    context.fillText(labelFormatter(maxValue * (1 - index / 4)), 4, y + 4);
  }
}

function drawCostChart(rows) {
  const canvas = $('costChart');
  const context = canvas.getContext('2d');
  const dates = [...new Set(rows.map(row => row.date))];
  const byDate = new Map();
  for (const row of rows) {
    if (!byDate.has(row.date)) byDate.set(row.date, {});
    byDate.get(row.date)[row.account_id] = Number(row.gross_cost);
  }
  const max = Math.max(1, ...dates.map(date => Object.values(byDate.get(date) || {}).reduce((a, b) => a + b, 0))) * 1.15;
  drawAxes(context, canvas.width, canvas.height, max, value => `$${value.toFixed(1)}`);
  if (!dates.length) return;
  const plotWidth = canvas.width - 62;
  const barWidth = Math.max(4, Math.min(34, plotWidth / dates.length * .68));
  dates.forEach((date, index) => {
    let y = canvas.height - 35;
    const x = 48 + (index + .5) * (plotWidth / dates.length) - barWidth / 2;
    for (const account of Object.keys(colors)) {
      const value = byDate.get(date)?.[account] || 0;
      const height = value / max * (canvas.height - 55);
      y -= height;
      context.fillStyle = colors[account];
      context.fillRect(x, y, barWidth, height);
    }
    if (index === 0 || index === dates.length - 1 || index % Math.ceil(dates.length / 6) === 0) {
      context.save(); context.translate(x, canvas.height - 19); context.rotate(-.5); context.fillStyle = '#66788a'; context.fillText(date.slice(5), 0, 0); context.restore();
    }
  });
}

function drawRequestChart(rows) {
  const canvas = $('requestChart');
  const context = canvas.getContext('2d');
  const max = Math.max(1, ...rows.map(row => Number(row.requests))) * 1.2;
  drawAxes(context, canvas.width, canvas.height, max, value => String(Math.round(value)));
  if (!rows.length) return;
  const x = index => 48 + index * ((canvas.width - 64) / Math.max(1, rows.length - 1));
  const y = value => 20 + (canvas.height - 55) * (1 - value / max);
  context.strokeStyle = '#2878d0'; context.lineWidth = 3; context.beginPath();
  rows.forEach((row, index) => index ? context.lineTo(x(index), y(row.requests)) : context.moveTo(x(index), y(row.requests))); context.stroke();
  context.strokeStyle = '#d92d20'; context.lineWidth = 2; context.beginPath();
  rows.forEach((row, index) => index ? context.lineTo(x(index), y(row.failed)) : context.moveTo(x(index), y(row.failed))); context.stroke();
  rows.forEach((row, index) => {
    context.beginPath(); context.fillStyle = '#2878d0'; context.arc(x(index), y(row.requests), 3.5, 0, Math.PI * 2); context.fill();
    if (Number(row.failed) > 0) { context.beginPath(); context.fillStyle = '#d92d20'; context.arc(x(index), y(row.failed), 3, 0, Math.PI * 2); context.fill(); }
    if (index === 0 || index === rows.length - 1 || index % Math.ceil(rows.length / 6) === 0) { context.fillStyle = '#66788a'; context.font = '11px Segoe UI'; context.fillText(row.date.slice(5), Math.max(44, x(index) - 14), canvas.height - 20); }
  });
  context.fillStyle = '#66788a'; context.font = '11px Segoe UI'; context.fillText('Xanh: tổng request · Đỏ: lỗi', 48, canvas.height - 8);
}

function renderInsights(data) {
  const container = $('usageInsights');
  container.replaceChildren();
  const rows = data.billing || [];
  const total = rows.reduce((sum, row) => sum + Number(row.gross_cost), 0);
  const dates = [...new Set(rows.map(row => row.date))];
  const average = dates.length ? total / dates.length : 0;
  const accountTotals = {};
  const daily = {};
  for (const row of rows) {
    accountTotals[row.account_name] = (accountTotals[row.account_name] || 0) + Number(row.gross_cost);
    daily[row.date] = (daily[row.date] || 0) + Number(row.gross_cost);
  }
  const leader = Object.entries(accountTotals).sort((a, b) => b[1] - a[1])[0] || ['Chưa có dữ liệu', 0];
  const peak = Object.entries(daily).sort((a, b) => b[1] - a[1])[0] || ['—', 0];
  const remaining = state.billing.reduce((sum, item) => sum + Number(item.estimated_remaining), 0);
  const projectedDays = average > 0 ? Math.floor(remaining / average) : null;
  const insights = [
    ['Tốc độ dùng credit', `${money(average)} mỗi ngày trong phạm vi đang xem.`],
    ['Tài khoản dùng nhiều nhất', `${leader[0]} · ${money(leader[1])}.`],
    ['Ngày cao nhất', `${peak[0]} · ${money(peak[1])}.`],
    ['Ước tính thời gian còn lại', projectedDays === null ? 'Chưa đủ dữ liệu.' : `${projectedDays} ngày nếu tốc độ không đổi.`],
    ['Tình trạng fallback', `${state.summary.fallback_count || 0} request đã chuyển sang OpenAI trong 14 ngày.`],
    ['Độ mới dữ liệu', 'Billing có độ trễ; luôn kiểm dòng “cập nhật” trước khi ra quyết định.'],
  ];
  for (const [title, body] of insights) {
    const box = node('div', 'insight');
    box.append(node('strong', '', title), node('span', '', body));
    container.append(box);
  }
}

async function loadUsage() {
  const days = $('usageDays').value;
  const account = $('usageAccount').value;
  const data = await api(`/usage?days=${encodeURIComponent(days)}&account=${encodeURIComponent(account)}`);
  drawCostChart(data.billing || []);
  drawRequestChart(data.requests || []);
  renderInsights(data);
}

async function loadHistory() {
  const params = new URLSearchParams({
    days:'14', status:$('filterStatus').value, product:$('filterProduct').value,
    model:$('filterModel').value, source:$('filterSource').value, account:'', limit:'100',
  });
  const data = await api(`/requests?${params}`);
  const body = $('historyBody');
  body.replaceChildren();
  $('historyEmpty').style.display = data.items?.length ? 'none' : 'block';
  for (const item of data.items || []) {
    const row = document.createElement('tr');
    row.tabIndex = 0;
    const source = document.createElement('td');
    source.append(node('div', 'source-name', item.source_machine_name || 'Chưa đặt tên'), node('div', 'source-ip', item.source_ip));
    const status = node('span', `status status-${item.status}`, statusText[item.status] || item.status);
    const values = [when(item.received_at), source, item.product_id, item.model_id, status, item.final_provider === 'openai' ? 'OpenAI fallback' : (item.worker_name || '—'), seconds(item.latency_ms), `${item.operation_id.slice(0, 8)}…`];
    for (const value of values) {
      const cell = document.createElement('td');
      if (value instanceof Node) cell.append(value); else cell.textContent = value;
      row.append(cell);
    }
    row.addEventListener('click', () => void openDetail(item.operation_id));
    row.addEventListener('keydown', event => { if (event.key === 'Enter') void openDetail(item.operation_id); });
    body.append(row);
  }
}

async function saveSourceMachine() {
  const body = { ip_address:$('sourceIp').value.trim(), display_name:$('sourceName').value.trim(), product_hint:$('sourceProduct').value.trim() };
  await api('/sources', { method:'POST', body, reason:`Đặt tên máy gọi theo IP ${body.ip_address}` });
  toast('Đã lưu tên máy và cập nhật lịch sử theo IP.');
  $('filterSource').value = body.display_name;
  await loadHistory();
}

async function openDetail(operationId) {
  try {
    const data = await api(`/requests/${encodeURIComponent(operationId)}`);
    const container = $('detailBody');
    container.replaceChildren();
    const grid = node('div', 'detail-grid');
    const details = [
      ['Mã request', data.operation_id],
      ['Nguồn gọi', `${data.source_machine_name || 'Chưa đặt tên'} · ${data.source_ip}`],
      ['Sản phẩm', data.product_id], ['Model', `${data.model_id} · ${data.thinking_level}`],
      ['Kết quả', statusText[data.status] || data.status],
      ['Tuyến cuối', data.final_provider === 'openai' ? 'OpenAI fallback' : (data.worker_name || '—')],
      ['Nhận lúc', when(data.received_at)], ['Hoàn tất', when(data.completed_at)], ['Độ trễ', seconds(data.latency_ms)],
    ];
    for (const [label, value] of details) {
      const item = node('div', 'detail-item');
      item.append(node('span', '', label), node('strong', '', String(value)));
      grid.append(item);
    }
    container.append(grid, node('h3', '', 'Timeline từng lần thử'));
    const timeline = node('div', 'timeline');
    for (const attempt of data.attempts || []) {
      const box = node('div', 'attempt');
      const description = node('div');
      description.append(node('strong', '', attempt.provider === 'openai' ? `OpenAI · ${attempt.provider_model}` : (attempt.worker_name || attempt.worker_id)), node('div', 'meta', `${statusText[attempt.status] || attempt.status}${attempt.error_code ? ` · ${attempt.error_code}` : ''}`));
      box.append(node('div', 'num', String(attempt.attempt_no)), description, node('div', 'meta', seconds(attempt.latency_ms)));
      timeline.append(box);
    }
    container.append(timeline, node('p', 'payload-note', 'Nội dung dưới đây có thể chứa dữ liệu học viên. Lượt xem này đã được ghi audit.'));
    container.append(node('h3', '', 'Request đầy đủ'));
    const requestPre = document.createElement('pre'); requestPre.textContent = JSON.stringify(data.request_payload, null, 2); container.append(requestPre);
    container.append(node('h3', '', 'Response đầy đủ'));
    const responsePre = document.createElement('pre'); responsePre.textContent = JSON.stringify(data.response_payload, null, 2); container.append(responsePre);
    $('detailDialog').showModal();
  } catch (error) { toast(`Lỗi: ${error.message}`); }
}

async function loadSummary() {
  renderSummary(await api('/summary'));
}

async function refreshAll() {
  const button = $('refreshAll');
  button.disabled = true;
  try {
    await loadSummary();
    await Promise.all([loadUsage(), loadHistory(), loadCredentials()]);
  } catch (error) { toast(`Lỗi: ${error.message}`); }
  finally { button.disabled = false; }
}

async function connectAfterGoogleLogin() {
  const me = await api('/me');
  state.operator = me.operator;
  showDashboard();
  await refreshAll();
}

function initializeGoogle(attempt = 0) {
  if (!config.API_BASE_URL || !config.GOOGLE_CLIENT_ID) {
    showLogin('Trang chưa được cấu hình đầy đủ.');
    return;
  }
  if (!window.google?.accounts?.id) {
    if (attempt < 40) window.setTimeout(() => initializeGoogle(attempt + 1), 200);
    else showLogin('Không tải được nút đăng nhập Google.');
    return;
  }
  window.google.accounts.id.initialize({
    client_id:config.GOOGLE_CLIENT_ID,
    auto_select:false,
    cancel_on_tap_outside:false,
    callback:response => {
      state.idToken = response.credential || '';
      $('loginNotice').textContent = '';
      if (!state.idToken) { showLogin('Google không trả về phiên đăng nhập.'); return; }
      void connectAfterGoogleLogin().catch(error => showLogin(error.message));
    },
  });
  window.google.accounts.id.renderButton($('googleSignInButton'), { type:'standard', theme:'outline', size:'large', shape:'pill', text:'signin_with', locale:'vi' });
}

$('logoutButton').addEventListener('click', () => {
  window.google?.accounts?.id?.disableAutoSelect();
  showLogin('Bạn đã đăng xuất khỏi dashboard.');
});
$('refreshAll').addEventListener('click', () => void refreshAll());
$('applyUsage').addEventListener('click', () => void loadUsage().catch(error => toast(`Lỗi: ${error.message}`)));
$('applyHistory').addEventListener('click', () => void loadHistory().catch(error => toast(`Lỗi: ${error.message}`)));
$('saveSource').addEventListener('click', () => void saveSourceMachine().catch(error => toast(`Lỗi: ${error.message}`)));
$('uploadCredential').addEventListener('click', () => void uploadCredential().catch(error => toast(`Lỗi: ${error.message}`)));
$('closeDialog').addEventListener('click', () => $('detailDialog').close());
window.addEventListener('resize', () => { if (state.idToken) void loadUsage().catch(() => undefined); });

showLogin();
initializeGoogle();
