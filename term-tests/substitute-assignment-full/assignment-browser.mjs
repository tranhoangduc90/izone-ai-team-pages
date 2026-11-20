import { findAssignmentTest } from './assignment-catalog.mjs';

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

export function mountAssignmentDashboard(target, { api, onScope = () => {} }) {
  const makeButton = (text, kind='secondary') => element('button',text,{type:'button',className:'button '+kind});
  const filter=element('select',undefined,{ariaLabel:'Ca thi và bài',className:'assignment-select'});
  const course=element('select',undefined,{ariaLabel:'Khóa',className:'assignment-select'});
  course.append(...[['','Tất cả khóa'],['56','Khóa 56'],['67','Khóa 67']]
    .map(([value,label])=>element('option',label,{value})));
  const search=element('input',undefined,{type:'search',placeholder:'Tìm học viên hoặc lớp',
    ariaLabel:'Tìm học viên hoặc lớp',className:'assignment-select'});
  const tabs=element('div',undefined,{className:'assignment-status-filters',ariaLabel:'Trạng thái giao bài'});
  const toolbar=element('div',undefined,{className:'assignment-v2-toolbar'});
  toolbar.append(filter,course,search,tabs);
  const actions=element('div',undefined,{className:'assignment-v2-actions'});
  const count=element('p','Chưa chọn học viên');
  count.setAttribute('aria-live','polite');
  const clear=makeButton('Bỏ chọn');
  const reload=makeButton('Cập nhật');
  const group=makeButton('Giao bài đã chọn','primary');
  actions.append(count,clear,reload,group);
  const feedback=element('p','',{className:'assignment-feedback'});
  feedback.setAttribute('role','status');
  const table=element('table',undefined,{className:'assignment-table assignment-v2-table',hidden:true});
  table.setAttribute('aria-label','Danh sách học viên đăng ký');
  const header=table.createTHead().insertRow();
  const selectAll=element('input',undefined,{type:'checkbox',ariaLabel:'Chọn tất cả dòng có thể giao'});
  const selectHeader=element('th',undefined,{scope:'col'}); selectHeader.append(selectAll);
  header.append(selectHeader,...['Học viên','Bài đăng ký','Trạng thái','Thao tác']
    .map(title=>element('th',title,{scope:'col'})));
  const body=table.createTBody();
  const reviews=element('ul',undefined,{className:'assignment-review',hidden:true});
  target.replaceChildren(toolbar,actions,feedback,table,reviews);

  const chosen=new Set(), failures=new Map();
  let scopes=[], data=[], blocked=[], tab='all', scope, busy=false, loaded=false, revision=0;
  const labels={...statusText,all:'Tất cả'};
  const scopeKey=s=>JSON.stringify([s.sittingId,s.testId,s.classCode]);
  const normalized=value=>String(value??'').toLocaleLowerCase('vi').normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').replaceAll('đ','d').trim();
  const filtered=()=>data.filter(row=>normalized([row.name,row.classCode].join(' ')).includes(normalized(search.value)));
  const visible=()=>filtered().filter(row=>tab==='all' || row.state===tab || tab==='running' && row.state==='starting');
  const canAssign=()=>loaded && scope?.canAssign===true && scope.openForStudents!==false;
  const canRevoke=()=>loaded && scope?.canAssign===true;
  const canSelect=row=>canAssign() && row.active && row.state==='pending' &&
    row.activeWaiting?.count===1 && Boolean(row.activeWaiting.sessionId);
  const actionable=()=>visible().filter(canSelect);
  const itemFor=row=>({id:row.id,version:row.version,sessionId:row.activeWaiting.sessionId});
  const clearHiddenSelection=()=>{const visibleIds=new Set(visible().map(row=>row.id));for(const id of chosen)if(!visibleIds.has(id))chosen.delete(id);};

  function syncSelection() {
    const ready=actionable();
    const selected=ready.filter(row=>chosen.has(row.id));
    selectAll.disabled=busy || !ready.length;
    selectAll.checked=ready.length>0 && selected.length===ready.length;
    selectAll.indeterminate=selected.length>0 && selected.length<ready.length;
    group.disabled=busy || !selected.length;
    clear.disabled=busy || !selected.length;
    count.textContent=selected.length ? 'Đã chọn '+selected.length+' học viên' : 'Chưa chọn học viên';
    for(const check of body.querySelectorAll('input[data-assignment-row]')) check.checked=chosen.has(check.dataset.assignmentRow);
  }

  function render() {
    const available=filtered();
    const rows=visible();
    tabs.replaceChildren(...['pending','assigned','running','submitted','all'].map(key=>{
      const total=key==='all'?available.length:available.filter(row=>row.state===key || key==='running' && row.state==='starting').length;
      const button=makeButton(labels[key]+' '+total,tab===key?'primary':'secondary');
      button.setAttribute('aria-pressed',String(tab===key));
      button.disabled=busy;
      button.onclick=()=>{tab=key;clearHiddenSelection();render();tabs.querySelector('[aria-pressed=true]').focus();};
      return button;
    }));
    body.replaceChildren();
    for (const row of rows) {
      const entry=body.insertRow();
      const pick=entry.insertCell(), identity=entry.insertCell(), test=entry.insertCell(),
        status=entry.insertCell(), action=entry.insertCell();
      const name=row.name || 'Hồ sơ cần đối chiếu';
      const check=element('input',undefined,{type:'checkbox',ariaLabel:'Chọn '+name,disabled:true});
      check.dataset.assignmentRow=row.id;
      check.onchange=()=>{if(check.checked)chosen.add(row.id);else chosen.delete(row.id);syncSelection();};
      pick.append(check);
      identity.append(element('strong',name,{className:'assignment-name'}),element('small',row.classCode));
      test.append(element('strong',scope.exam?'Substitute '+scope.exam+' · K'+scope.course:scope.testId),
        element('small',scope.partLabel??''));
      const pill=element('span',labels[row.state]??row.state,{className:'assignment-status'});
      pill.dataset.state=row.state;
      status.append(pill);
      if(failures.has(row.id)) status.append(element('small',actionError(failures.get(row.id)),{className:'assignment-row-error'}));

      if (canAssign() && row.active && row.state==='pending') {
        const individual=makeButton('Giao bài');
        individual.setAttribute('aria-label','Giao bài cho '+name);
        individual.onclick=()=>perform('assign',[itemFor(row)]);
        action.append(individual);
        check.disabled=individual.disabled=busy || !canSelect(row);
        if (!row.activeWaiting?.count) status.append(element('small','Học viên chưa vào phòng chờ.'));
        else if (row.activeWaiting.count>1) status.append(element('small','Yêu cầu học viên chỉ giữ một cửa sổ chờ, rồi bấm Cập nhật.'));
      }
      if (canRevoke() && row.active && row.state==='assigned') {
        const revoke=makeButton('Thu hồi');
        revoke.disabled=busy;
        revoke.onclick=()=>perform('revoke',[{id:row.id,version:row.version}]);
        action.append(revoke);
      }
    }
    table.hidden=!rows.length;
    reviews.replaceChildren(...blocked.map(item=>element('li','Dòng '+item.row+' · '+(blockedText[item.code]??item.code))));
    reviews.hidden=!blocked.length;
    syncSelection();
  }
  function actionError(code) {
    return ({SITTING_NOT_ACCEPTING:'Ca chưa mở hoặc đã dừng', WAITING_SESSION_MISMATCH:'Phiên chờ đã đổi',
      NO_ACTIVE_WAITING_SESSION:'Học viên chưa vào phòng chờ.',
      MULTIPLE_ACTIVE_WAITING_SESSIONS:'Học viên có nhiều cửa sổ chờ.',
      ASSIGNMENT_SCOPE_DENIED:'Tài khoản chưa có quyền', REGISTRATION_CHANGED:'Đăng ký đã đổi',
      ATTEMPT_ALREADY_STARTED:'Học viên đã bắt đầu', RETAKE_ALREADY_USED:'Đã sử dụng lượt thi lại'})[code]??'Cần đối chiếu lại dòng này';
  }
  function optionList() {
    const previous=filter.value;
    const options=scopes.filter(item=>!course.value||String(item.course)===course.value);
    filter.replaceChildren(...options.map(item=>element('option',item.label,{value:scopeKey(item)})));
    if (!options.length) filter.append(element('option','Chưa có ca thi',{value:''}));
    if (options.some(item=>scopeKey(item)===previous)) filter.value=previous;
    filter.disabled=busy||!options.length;
  }
  async function update(refreshCatalog=false) {
    const request=++revision;
    loaded=false; data=[]; blocked=[]; chosen.clear();
    feedback.textContent='Đang tải danh sách…';
    render();
    try {
      if (refreshCatalog) {
        const {scopes:result}=await api('teacher/scopes');
        if (request!==revision) return false;
        scopes=result.map(item=>{
          const test=findAssignmentTest(item.testId);
          return test?{...item,course:test.course,exam:test.exam,partLabel:test.partLabel,studentUrl:test.studentUrl}:item;
        });
        optionList();
      }
      scope=scopes.find(item=>scopeKey(item)===filter.value);
      onScope(scope);
      if (!scope) {feedback.textContent='Chưa có ca thi trong phạm vi của tài khoản này.';return true;}
      const {sittingId,testId,classCode}=scope;
      const result=await api('teacher/list',{query:{sittingId,testId,classCode}});
      if (request!==revision) return false;
      data=result.rows;blocked=result.blocked;
      loaded=true;
      render();
      feedback.textContent=!data.length?'Chưa có đăng ký đủ điều kiện.':
        canAssign()?'':scope.canAssign===undefined?'Ca này đang ở chế độ chỉ xem.':
          scope.canAssign?'Ca này chưa nhận lượt mới.':'Tài khoản chỉ có quyền xem ca này.';
      return true;
    } catch {
      if(request===revision)feedback.textContent='Không tải được danh sách. Bấm Cập nhật để thử lại.';
      return false;
    }
  }
  async function perform(action,items) {
    if(busy||!items.length||items.some(item=>!item)||!scope || (action==='assign'?!canAssign():!canRevoke()))return;
    busy=true;filter.disabled=reload.disabled=course.disabled=search.disabled=true;
    render();
    failures.clear();
    try{
      const {sittingId,testId,classCode}=scope;
      const response=await api('teacher/actions',{body:{scope:{sittingId,testId,classCode},
        action,operationId:crypto.randomUUID(),items}});
      const ids=new Set(items.map(item=>item.id));
      if(response.results.length!==ids.size || response.results.some(item=>!ids.delete(item.id))){
        throw new Error('ACTION_RECEIPT_MISMATCH');
      }
      for(const item of response.results)if(item.code)failures.set(item.id,item.code);
      if(await update(true))feedback.textContent='Đã cập nhật '+(items.length-failures.size)+'/'+items.length+' hồ sơ.';
    }catch{
      const read=await update(true);
      if(read)feedback.textContent='Chưa xác nhận được thao tác. Kiểm tra trạng thái từng dòng trước khi thử lại.';
    }finally{
      busy=false;reload.disabled=course.disabled=search.disabled=false;optionList();render();
    }
  }
  filter.onchange=()=>{failures.clear();return update();};
  course.onchange=()=>{failures.clear();optionList();return update();};
  search.oninput=()=>{clearHiddenSelection();render();};
  selectAll.onchange=()=>{for(const row of actionable())if(selectAll.checked)chosen.add(row.id);else chosen.delete(row.id);syncSelection();};
  clear.onclick=()=>{chosen.clear();syncSelection();};
  reload.onclick=()=>{failures.clear();return update(true);};
  group.onclick=()=>perform('assign',actionable().filter(row=>chosen.has(row.id)).map(itemFor));
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

export async function mountAssignmentWaiting(target, { api, scope, start, storage=sessionStorage,
  label='Bắt đầu',onState=()=>{},keepMonitoring=false }) {
  const key = 'substitute-assignment:'+[scope.sittingId,scope.testId,scope.classCode,scope.studentRef].join(':');
  const message = element('p','Đang mở phiên chờ…'); message.setAttribute('aria-live','polite');
  const reference = element('p','');
  const button = element('button',label,{type:'button',disabled:true});
  target.replaceChildren(message,reference,button);
  let token=storage.getItem(key),timer,closed=false,failures=0,busy=false,ready=false,lastState;
  const stop = () => { closed = true; clearTimeout(timer); };
  async function refresh() {
    if (closed || busy) return;
    if (document.hidden) { timer = setTimeout(refresh,5000); return; }
    try {
      const status = await api('student/status',{body:scope,token});
      if (closed) return;
      failures = 0;
      lastState=status.state;
      onState(lastState);
      message.textContent = statusText[status.state] ?? 'Chờ giao';
      reference.textContent = 'Phiên đang chờ ' + status.reference;
      button.disabled = ready || !['assigned','starting','running'].includes(status.state);
      button.textContent = status.state === 'running' ? 'Tiếp tục' : label;
      if (status.state === 'submitted') { stop(); return; }
    } catch (error) {
      if (closed) return;
      lastState=undefined;
      onState(undefined);
      if (error.message==='WAITING_SESSION_REQUIRED') {
        storage.removeItem(key);
        token=null;
        try{
          const waiting=await api('student/join',{body:scope});
          if(closed)return;
          token=waiting.token;
          storage.setItem(key,token);
        }catch{/* A stale/closed registration stays locked. */}
      }
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
      if (navigator.onLine===false && lastState!=='running') throw new Error('ASSIGNMENT_ONLINE_REQUIRED');
      await start({scope,token});
      if(keepMonitoring){ready=true;busy=false;await refresh();}
      else stop();
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
