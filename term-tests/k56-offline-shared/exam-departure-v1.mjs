const warning = 'Nếu bạn rời trang hoặc tải lại, hệ thống sẽ nộp ngay phần thi đang làm với các câu trả lời đã lưu. Bạn không thể quay lại làm tiếp phần này.';
const nextStep = 'Khi mở lại bài thi, bạn sẽ chuyển sang phần tiếp theo.';
const lastStep = 'Khi mở lại, bạn sẽ thấy màn hình kết thúc bài thi.';
const labels = {listening: 'Listening', reading: 'Reading', writing: 'Writing'};

export function departureWarning(isLast) {
  return warning + ' ' + (isLast ? lastStep : nextStep);
}

function paragraph(doc, text) {
  const node = doc.createElement('p');
  node.textContent = text;
  return node;
}

function confirmDeparture(doc, isLast, action) {
  const dialog = doc.createElement('dialog');
  dialog.className = 'panel exam-departure-dialog';
  dialog.setAttribute('aria-label', 'Xác nhận rời bài thi');
  const heading = doc.createElement('h2');
  heading.textContent = action === 'reload' ? 'Tải lại bài thi' : 'Rời trang bài thi';
  const form = doc.createElement('form');
  form.method = 'dialog';
  form.className = 'exam-departure-actions';
  const stay = doc.createElement('button');
  stay.className = 'button button-secondary';
  stay.value = 'stay';
  stay.textContent = 'Ở lại làm bài';
  stay.autofocus = true;
  const leave = doc.createElement('button');
  leave.className = 'button';
  leave.value = 'confirm';
  leave.textContent = action === 'reload' ? 'Tải lại và nộp phần này' : 'Rời trang và nộp phần này';
  form.append(stay, leave);
  dialog.append(heading, paragraph(doc, departureWarning(isLast)), form);
  doc.body.append(dialog);
  return new Promise(resolve => {
    dialog.addEventListener('close', () => {
      const confirmed = dialog.returnValue === 'confirm';
      dialog.remove();
      resolve(confirmed);
    }, {once:true});
    dialog.showModal();
  });
}

function answerData(record, item, skill, taskId) {
  const snapshot = record.snapshot;
  const revisions = snapshot?.draftRevisions;
  const revision = skill === 'writing' ? snapshot?.writingRevision : revisions?.[skill];
  const draft = snapshot?.drafts?.[skill];
  if (draft && (Number(revision) || 0) >= (item.revision || 0)) {
    return skill === 'writing'
      ? {data:{[taskId]:String(draft[taskId] ?? '')}, revision}
      : {data:{answers:structuredClone(draft)}, revision};
  }
  const content = item.content ? JSON.parse(item.content) : null;
  return {data:content || (skill === 'writing' ? {[taskId]:''} : {answers:{}}), revision:item.revision};
}

export function withExamDeparture(Base, {taskId}) {
  return class extends Base {
    get departureSkill() {
      if (!this.active) return null;
      const skill = this.sectionResponse().nextSection;
      const item = this.record.sections[skill];
      return item?.startedAt && !item.sealed && !item.interrupted ? skill : null;
    }

    disarmNativeDeparture() {
      this.nativeDeparture = null;
    }

    armNativeDeparture(event) {
      const skill = this.departureSkill;
      if (!skill && !this.departureSaving) return false;
      event.preventDefault();
      event.returnValue = true;
      if (skill && event.isTrusted) {
        this.nativeDeparture = {record:this.record, skill};
        this.observe('exam_departure_guard_requested',{section:skill,action:'native'});
      }
      return true;
    }

    handleNativeDeparture(event) {
      if (!event.isTrusted) return;
      const armed = this.nativeDeparture;
      this.disarmNativeDeparture();
      if (!armed || window.TERM_TEST_ALLOW_NAVIGATION ||
        armed.record !== this.record || armed.skill !== this.departureSkill) return;
      // The existing store writes its localStorage copy before awaiting IndexedDB.
      void this.lockForDeparture(armed.skill, 'native_pagehide', {record:armed.record}).catch(() => {});
    }

    async lockForDeparture(skill, action, {record = this.record, capture = false} = {}) {
      if (this.departureSaving) return this.departureSaving;
      if (this.record !== record || this.departureSkill !== skill) return false;
      const item = record.sections[skill];
      const previousSnapshot = record.snapshot;
      const previousDeparture = record.departure;
      if (capture && this.departureSnapshot) record.snapshot = this.departureSnapshot();
      const {data,revision} = answerData(record,item,skill,taskId);
      record.departure = {skill,action,at:new Date(this.now()).toISOString()};
      this.observe('exam_departure_confirmed',{section:skill,action,
        ...(skill === 'listening' && {position:this.record.player.position, paused:this.player?.paused})});
      // Confirmed navigation uses the same manual seal and retry identity as the submit button.
      const save = this.seal(skill,data,revision,'manual');
      const operationId = record.sections[skill].operationId;
      this.departureSaving = save.then(() => {
        this.observe('exam_departure_locked_on_device',{section:skill,operationId,action});
        if (skill === 'listening') this.listeningController?.finish();
        return true;
      }, error => {
        if (this.record === record && record.sections[skill].operationId === operationId) {
          record.sections[skill] = item;
          record.operations = record.operations.filter(op=>op.operationId !== operationId);
          record.snapshot = previousSnapshot;
          record.departure = previousDeparture;
          this.changed();
        }
        this.observe('exam_departure_lock_failed',{section:skill,operationId,action,errorCode:error.code || 'LOCAL_PERSIST_FAILED'});
        throw error;
      }).finally(() => { this.departureSaving = null; });
      return this.departureSaving;
    }

    async requestDeparture(action, navigate) {
      const skill = this.departureSkill;
      if (!skill && !this.departureSaving) { await navigate(); return true; }
      if (!skill || this.departureDialog || this.departureSaving) return false;
      const record = this.record;
      this.departureDialog = true;
      try {
        this.observe('exam_departure_guard_requested',{section:skill,action});
        if (!await confirmDeparture(document,this.order().at(-1)===skill,action)) {
          if (this.record === record) this.observe('exam_departure_stayed',{section:skill,action});
          return false;
        }
        if (!await this.lockForDeparture(skill,action,{capture:true,record})) return false;
        const previousNavigation = window.TERM_TEST_ALLOW_NAVIGATION;
        window.TERM_TEST_ALLOW_NAVIGATION = true;
        try { return (await navigate()) !== false; }
        finally { window.TERM_TEST_ALLOW_NAVIGATION = previousNavigation; }
      } catch {
        this.lastError = 'Chưa khóa được phần thi trên thiết bị. Bài vẫn đang mở để bạn giữ câu trả lời.';
        this.changed();
        return false;
      } finally { this.departureDialog = false; }
    }

    async reopenDepartedAttempt(studentRef) {
      const keys = (await this.store.keys('run:')).filter(key => !key.endsWith(':audio'));
      const matches = [];
      for (const key of keys) {
        const record = await this.store.get(key);
        if (record?.ready && record.classCode === this.classCode && record.studentRef === studentRef) matches.push(record);
      }
      const recent = matches.sort((a,b)=>
        (Number(b.prepared.generation) || 0) - (Number(a.prepared.generation) || 0) ||
        String(b.prepared.offline.preparedAt || b.prepared.serverNow).localeCompare(
          String(a.prepared.offline.preparedAt || a.prepared.serverNow)))[0];
      if (!recent?.departure || !recent.sections[recent.departure.skill]?.sealed) return false;
      return this.restorePrepared(recent.prepared,studentRef);
    }

    mount(options) {
      super.mount(options);
      if (!this.active) return;
      this.departureSnapshot = options.snapshot;
      if (this.departureBanner?.isConnected) return;
      this.unmountDeparture?.();
      const box = document.createElement('aside');
      box.className = 'writing-save-status exam-departure-note';
      box.setAttribute('aria-label','Quy tắc rời trang');
      const policy = paragraph(document,'');
      const status = paragraph(document,'');
      status.setAttribute('role','status');
      const reload = document.createElement('button');
      reload.type = 'button';
      reload.className = 'button button-secondary';
      reload.textContent = 'Tải lại trang';
      reload.addEventListener('click', () => {
        void this.requestDeparture('reload', () => location.reload());
      });
      box.append(policy,status,reload);
      options.host.prepend(box);
      this.departureBanner = box;
      const clear = event => { if (event.isTrusted) this.disarmNativeDeparture(); };
      const listen = new AbortController();
      document.addEventListener('pointerdown', clear, {capture:true,signal:listen.signal});
      document.addEventListener('keydown', clear, {capture:true,signal:listen.signal});
      options.host.addEventListener('click', event => {
        if (event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
          !this.departureSkill) return;
        const link = event.target.closest?.('a[href]');
        if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
        const target = new URL(link.href);
        if (!['http:','https:'].includes(target.protocol) ||
          (target.origin === location.origin && target.pathname === location.pathname && target.search === location.search)) return;
        event.preventDefault();
        void this.requestDeparture('leave', () => location.assign(target.href));
      }, {signal:listen.signal});
      const render = () => {
        const skill = this.departureSkill;
        const departed = this.record?.departure;
        box.hidden = !skill && !departed;
        policy.hidden = !skill;
        reload.hidden = !skill;
        if (skill) {
          const text = departureWarning(this.order().at(-1) === skill);
          if (policy.textContent !== text) policy.textContent = text;
        }
        const operationId = departed && this.record.sections[departed.skill]?.operationId;
        const receipt = this.record?.receipts?.[operationId];
        const text = !operationId ? '' : receipt?.status === 'accepted'
          ? 'Máy chủ đã nhận phần ' + labels[departed.skill] + '.'
          : receipt?.status === 'review_required' || this.record.review
            ? 'Phần ' + labels[departed.skill] + ' đã khóa trên thiết bị. Hãy báo giảng viên để đối soát.'
            : 'Phần ' + labels[departed.skill] + ' đã khóa trên thiết bị. Đang chờ máy chủ xác nhận.';
        if (status.textContent !== text) status.textContent = text;
        status.hidden = !text;
      };
      this.addEventListener('change', render);
      this.unmountDeparture = () => {
        listen.abort();
        this.removeEventListener('change',render);
        box.remove();
      };
      render();
    }
  };
}
