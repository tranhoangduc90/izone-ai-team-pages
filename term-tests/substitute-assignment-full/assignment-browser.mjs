function element(tag, text, props = {}) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  Object.assign(node, props);
  return node;
}

const statusText = {
  pending:'Chờ giao', assigned:'Đã giao', starting:'Đang xác nhận lượt',
  running:'Đang làm', submitted:'Đã nộp',
};
const blockedText = {
  TEST_SELECTION_INVALID:'Bài thi không hợp lệ', COURSE_LABEL_MISMATCH:'Không khớp khóa',
  ROSTER_MISMATCH:'Không khớp danh sách lớp', DUPLICATE_REVIEW:'Cần xử lý đăng ký trùng',
  PART_REQUIRED:'Chưa chọn phần thi',
};

export function assignmentClient(baseUrl) {
  return async (route, { query, body, token, signal } = {}) => {
    const url = new URL(route, baseUrl);
    if (query) url.search = new URLSearchParams(query);
    const headers = {};
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      headers['X-Izone-Csrf'] = '1';
    }
    if (token) headers.Authorization = 'Bearer ' + token;
    const response = await fetch(url, { method:body === undefined ? 'GET' : 'POST',
      credentials:route.startsWith('teacher/') ? 'include' : 'omit',
      cache:'no-store', headers, signal:signal ?? AbortSignal.timeout(10000),
      body:body === undefined ? undefined : JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.code ?? 'ASSIGNMENT_UNAVAILABLE');
    return result;
  };
}

export function mountAssignmentDashboard(target, { api }) {
  const filter = element('select',undefined, { ariaLabel:'Bài, lớp và ca thi' });
  const notify = element('p',''); notify.setAttribute('aria-live','polite');
  const rows = element('div');
  const action = element('button','Giao bài đã chọn',{type:'button',disabled:true});
  const reload = element('button','Cập nhật',{type:'button'});
  target.replaceChildren(filter,reload,action,notify,rows);
  const selected = new Map();
  let scopes = [];
  let busy = false, revision = 0;
  const keyFor = scope => JSON.stringify([scope.sittingId,scope.testId,scope.classCode]);
  const selection = () => {
    const s = scopes.find(scope=>keyFor(scope) === filter.value);
    return s ? { sittingId:s.sittingId,testId:s.testId,classCode:s.classCode } : null;
  };
  async function update(refreshCatalog = false) {
    const request = ++revision;
    selected.clear(); action.disabled = true; rows.replaceChildren();
    notify.textContent = 'Đang tải danh sách…';
    try {
      if (refreshCatalog) {
        const { scopes: current } = await api('teacher/scopes');
        if (request !== revision) return;
        const previous = filter.value;
        scopes = current;
        filter.replaceChildren(...scopes.map(scope=>element('option',scope.label,{value:keyFor(scope)})));
        if (scopes.some(scope=>keyFor(scope) === previous)) filter.value = previous;
      }
      const scope = selection();
      if (!scope) { notify.textContent = 'Chưa có ca thi trong phạm vi của tài khoản này.'; return; }
      const data = await api('teacher/list',{query:scope});
      if (request !== revision) return;
      notify.textContent = data.rows.length ? '' : 'Chưa có đăng ký đủ điều kiện.';
      for (const row of data.rows) {
        const entry = element('section');
        const label = element('strong',row.name || 'Hồ sơ cần đối chiếu');
        entry.append(label,element('span',' · ' + (statusText[row.state] || row.state)));
        if (row.active && row.state === 'pending' && row.sessions.length) {
          const session = element('select',undefined,{ariaLabel:'Mã phiên đang chờ của ' + (row.name ?? '')});
          session.append(element('option','Chọn phiên đã đối chiếu',{value:''}));
          for (const pair of row.sessions) session.append(element('option',pair.reference,{value:pair.id}));
          const check = element('input',undefined,{type:'checkbox',disabled:true});
          const confirm = element('label');
          confirm.append(check,document.createTextNode(' Đã xác nhận trực tiếp'));
          session.onchange = () => {
            check.checked = false; check.disabled = !session.value;
            selected.delete(row.id); action.disabled = !selected.size;
          };
          check.onchange = () => {
            const pair = row.sessions.find(s=>s.id===session.value);
            if (check.checked && pair) selected.set(row.id,{id:row.id,version:row.version,sessionId:pair.id,
              reference:pair.reference,verifiedInPerson:true});
            else selected.delete(row.id);
            action.disabled = !selected.size;
          };
          entry.append(session,confirm);
        }
        if (row.active && row.state === 'assigned') {
          const undo = element('button','Thu hồi',{type:'button'});
          undo.onclick = () => perform('revoke',[{id:row.id,version:row.version}]);
          entry.append(undo);
        }
        rows.append(entry);
      }
      for (const item of data.blocked) rows.append(element('p',`Dòng ${item.row} · ${blockedText[item.code] ?? item.code}`));
    } catch {
      if (request === revision) notify.textContent = 'Không tải được danh sách. Hãy kiểm tra phiên giảng viên và thử lại.';
    }
  }
  async function perform(kind, items) {
    if (busy || !items.length) return;
    busy = true; action.disabled = true; filter.disabled = true; reload.disabled = true;
    try {
      const res = await api('teacher/actions',{body:{scope:selection(),action:kind,operationId:crypto.randomUUID(),items}});
      await update();
      const failures = res.results.filter(r=>r.code);
      const failed = failures.map(r=>r.id.slice(0,8)+' · '+r.code).join(', ');
      notify.textContent = `Đã cập nhật ${res.results.length - failures.length}/${items.length} hồ sơ.` +
        (failed ? ' Cần kiểm tra lại ' + failed : '');
    } catch {
      await update();
      notify.textContent = 'Chưa xác nhận được thao tác. Đã đọc lại danh sách trước khi thử tiếp.';
    } finally {
      busy = false; filter.disabled = false; reload.disabled = false;
    }
  }
  filter.onchange = () => update();
  reload.onclick = () => update(true);
  action.onclick = () => perform('assign',[...selected.values()]);
  return update(true);
}

export async function mountAssignmentSelector(target, { api, testId, start }) {
  const classes = element('select',undefined,{ariaLabel:'Lớp',disabled:true});
  const names = element('select',undefined,{ariaLabel:'Họ và tên',disabled:true});
  const state = element('div');
  const classLabel = element('label','Lớp');
  const nameLabel = element('label','Họ và tên');
  classLabel.append(classes);
  nameLabel.append(names);
  target.replaceChildren(classLabel,nameLabel,state);
  const choose = (label,disabled = false) => element('option',label,{value:'',disabled});
  let choices, halt, generation = 0;
  names.replaceChildren(choose('Chọn lớp trước'));
  try {
    const data = await api('student/classes',{query:{testId}});
    choices = new Map(data.classes.map(scope=>[scope.sittingId,scope]));
    classes.replaceChildren(choose(choices.size?'Chọn lớp':'Chưa có ca đang mở'),
      ...data.classes.map(scope=>element('option',scope.label,{value:scope.sittingId})));
    classes.disabled = !choices.size;
  } catch {
    classes.replaceChildren(choose('Chưa tải được danh sách lớp'));
    return;
  }
  classes.onchange = async () => {
    const current = ++generation;
    halt?.();
    state.replaceChildren();
    names.disabled = true;
    const chosen = choices.get(classes.value);
    if (!chosen) { names.replaceChildren(choose('Chọn lớp trước')); return; }
    names.replaceChildren(choose('Đang tải danh sách…'));
    try {
      const { students } = await api('student/roster',{query:{
        testId,sittingId:chosen.sittingId,classCode:chosen.classCode,
      }});
      if (current !== generation) return;
      names.replaceChildren(choose(students.length?'Chọn họ và tên':'Chưa có học viên đủ điều kiện'),
        ...students.map(student=>element('option',student.name,{value:student.studentRef})));
      names.disabled = !students.length;
    } catch {
      if (current === generation) names.replaceChildren(choose('Chưa tải được danh sách học viên'));
    }
  };
  names.onchange = async () => {
    const current = ++generation;
    halt?.();
    state.replaceChildren();
    const chosen = choices.get(classes.value);
    if (!chosen || !names.value) return;
    const scope = {testId,sittingId:chosen.sittingId,classCode:chosen.classCode,studentRef:names.value};
    const stop = await mountAssignmentWaiting(state,{api,scope,start});
    if (current === generation) halt = stop;
    else stop();
  };
}

export async function mountAssignmentWaiting(target, { api, scope, start, storage = sessionStorage }) {
  const key = 'substitute-assignment:'+[scope.sittingId,scope.testId,scope.classCode,scope.studentRef].join(':');
  const message = element('p','Đang mở phiên chờ…'); message.setAttribute('aria-live','polite');
  const reference = element('p','');
  const button = element('button','Bắt đầu',{type:'button',disabled:true});
  target.replaceChildren(message,reference,button);
  let token = storage.getItem(key), timer, closed = false, failures = 0, busy = false;
  const stop = () => { closed = true; clearTimeout(timer); };
  async function refresh() {
    if (closed || busy) return;
    if (document.hidden) { timer = setTimeout(refresh,5000); return; }
    try {
      const status = await api('student/status',{body:scope,token});
      if (closed) return;
      failures = 0;
      message.textContent = statusText[status.state] ?? 'Chờ giao';
      reference.textContent = 'Phiên đang chờ ' + status.reference;
      button.disabled = !['assigned','starting','running'].includes(status.state);
      button.textContent = status.state === 'running' ? 'Tiếp tục' : 'Bắt đầu';
      if (status.state === 'submitted') { stop(); return; }
    } catch {
      if (closed) return;
      failures++;
      button.disabled = true;
      message.textContent = 'Chưa kiểm tra được quyền bắt đầu. Đang thử lại…';
    }
    timer = setTimeout(refresh, Math.min(30000,5000 * 2 ** Math.min(failures,3)));
  }
  button.onclick = async () => {
    if (busy || button.disabled || closed) return;
    busy = true; button.disabled = true; clearTimeout(timer);
    try {
      await start({scope,token});
      stop();
    } catch {
      message.textContent = 'Chưa xác nhận được lượt thi. Đang kiểm tra lại…';
      busy = false;
      await refresh();
    }
  };
  try {
    if (!token) {
      const session = await api('student/join',{body:scope});
      token = session.token; storage.setItem(key,token);
    }
    await refresh();
  } catch {
    message.textContent = 'Chưa mở được phiên chờ. Hãy kiểm tra lớp, tên và ca thi với người vận hành.';
  }
  return stop;
}
