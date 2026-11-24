import {createK67ExamDeparture} from '../k67-shared/exam-departure-v1.mjs';
import {submitSection} from './section-submission-k56-term-v1.mjs?v=20261112-k56-online-writing';

const pendingCopy = {
  listening: 'Listening',
  reading: 'Reading',
  writing: 'Writing'
};
const retryDelaysMs = [2000, 5000, 15000];

export function mountTermPaperDeparture({
  state, testSlug, host, getOwner, getRecovery, getActiveSkill, getBody, getNext, save, onAccepted, sendOnLeave
}) {
  const changed = new EventTarget();
  let sending = false;
  let restoring = false;
  let nextNotice;
  let retryTimer;
  let retries = 0;

  function departure() {
    const value = state.confirmedDeparture;
    return value?.owner === getOwner() ? value : null;
  }

  function pending() {
    const value = departure();
    const entry = value && state.pendingSubmissions?.[value.section];
    return entry?.owner === value?.owner && entry?.operationId === value?.operationId ? entry : null;
  }

  function status() {
    const value = departure();
    const skill = getActiveSkill();
    return {
      skill,
      finalSkill: Boolean(skill && getNext(skill) === 'result'),
      saving: sending,
      departed: value?.section,
      received: value?.received === true,
      review: Boolean(pending()?.review)
    };
  }

  function notify() {
    changed.dispatchEvent(new Event('change'));
  }

  function observe(action, details) {
    getRecovery()?.observe(action, details);
  }

  const guard = createK67ExamDeparture({
    changed, state: status, observe,
    async lock(section, action) {
      if (getActiveSkill() !== section) return false;
      const recovery = getRecovery()?.forSubmission(section, false);
      if (!recovery) return false;
      const owner = getOwner();
      const body = getBody(section);
      const previous = state.confirmedDeparture;
      const prior = state.pendingSubmissions?.[section];
      if (prior && (prior.owner !== owner || !prior.recovery || prior.saveFailed)) return false;
      const operationId = prior?.operationId || crypto.randomUUID();
      const entry = prior || {
        owner, operationId, body,
        ...(section === 'writing'
          ? {writing: {task1: body.task1, task2: body.task2, outline: body.outline}}
          : {answers: {...body.answers}}),
        recovery: {...recovery.scope, operationId, capturedAt: new Date().toISOString(), automatic: false},
        startedAt: recovery.startedAt || null, deadlineAt: recovery.deadlineAt || null
      };
      state.pendingSubmissions ||= {};
      state.pendingSubmissions[section] = entry;
      state.confirmedDeparture = {owner, operationId, section, nextSection: getNext(section), received: false};
      if (save() === false) {
        if (prior) state.pendingSubmissions[section] = prior;
        else delete state.pendingSubmissions[section];
        state.confirmedDeparture = previous;
        observe('exam_departure_lock_failed', {section, action, operationId, errorCode: 'LOCAL_PERSIST_FAILED'});
        throw Error('Chưa khóa được phần thi trên thiết bị.');
      }
      observe('exam_departure_locked_on_device', {section, action, operationId});
      notify();
      return true;
    }
  });
  guard.mount(host);

  function renderWaiting() {
    const value = departure();
    if (!value || value.received || !pending()) return false;
    if (!nextNotice) {
      nextNotice = document.createElement('section');
      nextNotice.className = 'panel transition-card';
      nextNotice.id = 'termPaperDepartureWaiting';
      const heading = document.createElement('h2');
      const message = document.createElement('p');
      const retry = document.createElement('button');
      Object.assign(retry, {type:'button',className:'button button-secondary',textContent:'Kiểm tra biên nhận'});
      retry.addEventListener('click', retryRestore);
      nextNotice.append(heading, message, retry);
      host.append(nextNotice);
    }
    const [heading, message, retry] = nextNotice.children;
    heading.textContent = value.nextSection === 'result'
      ? 'Kết thúc bài thi' : 'Chuẩn bị phần ' + pendingCopy[value.nextSection];
    message.textContent = pending().review
      ? 'Bản chốt được giữ trên thiết bị. Hãy báo giảng viên để đối soát.'
      : 'Bạn có thể tiếp tục sau khi máy chủ xác nhận phần đã khóa.';
    retry.disabled = sending || restoring || navigator.onLine === false || Boolean(pending().review);
    nextNotice.hidden = false;
    return true;
  }

  async function restore() {
    const value = departure();
    const entry = pending();
    if (!value || !entry || value.received || sending || entry.review || navigator.onLine === false) return false;
    const recovery = getRecovery()?.forSubmission(value.section, false);
    if (!recovery) return false;
    clearTimeout(retryTimer);
    retryTimer = undefined;
    sending = true;
    if (restoring) renderWaiting();
    try {
      const response = await submitSection({
        state, testSlug, section: value.section, body: entry.body, owner: value.owner,
        getOwner, operationId: value.operationId, save, recovery
      });
      if (departure() !== value) return false;
      value.received = true;
      save();
      if (nextNotice) nextNotice.hidden = true;
      await onAccepted(value.section, response);
      return true;
    } catch (error) {
      if (departure() === value && pending() === entry) {
        observe('exam_departure_receipt_pending', {section:value.section,operationId:value.operationId,
          errorCode:error?.code || 'RECEIPT_PENDING'});
        if (!entry.review && navigator.onLine !== false && retries < retryDelaysMs.length)
          retryTimer = setTimeout(() => { if (pending() === entry) void restore(); }, retryDelaysMs[retries++]);
      }
      return false;
    } finally {
      sending = false;
      if (restoring) renderWaiting();
      notify();
    }
  }

  function retryRestore() {
    retries = 0;
    if (restoring) void restore();
  }

  function reopen() {
    if (!renderWaiting()) return false;
    restoring = true;
    void restore();
    return true;
  }

  window.addEventListener('online', retryRestore);
  window.addEventListener('offline', () => {
    clearTimeout(retryTimer);
    retryTimer = undefined;
    if (restoring) renderWaiting();
  });

  return {...guard, notify, pending, reopen,
    sendConfirmedOnLeave() {
      const value = departure();
      const entry = pending();
      if (entry && !entry.review && !value.received && !sending && navigator.onLine !== false)
        sendOnLeave(value.section, {...entry.body, recovery:entry.recovery});
    }
  };
}
