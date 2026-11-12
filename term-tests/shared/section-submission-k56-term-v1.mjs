// Nhận request L/R và state của đúng lượt; chỉ chuyển bước khi đã có xác nhận hợp lệ.
// Khi mất phản hồi, đọc biên nhận không ghi dữ liệu. Gói chưa rõ kết quả giữ nguyên qua reload/retry.
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const canonical=value=>JSON.stringify(Object.fromEntries(Object.entries(value||{}).sort(([a],[b])=>a.localeCompare(b))));
const failure=()=>Object.assign(new Error('Chưa nhận được xác nhận lưu bài hợp lệ. Bản đã gửi vẫn được giữ; hãy thử kiểm tra và nộp lại.'),{code:'SUBMISSION_UNCONFIRMED'});
export function validateSubmission(data,{section,body,testSlug}){
  if(!data||data.ok!==true||!uuid(data.attemptToken)||typeof data.completed!=='boolean')throw failure();
  if(body.attemptToken&&data.attemptToken!==body.attemptToken)throw failure();
  if(data.testSlug&&data.testSlug!==testSlug)throw failure();
  if(data.examSessionToken&&body.examSessionToken&&data.examSessionToken!==body.examSessionToken)throw failure();
  if(data.generation!==undefined&&body.generation!==undefined&&data.generation!==body.generation)throw failure();
  if(section==='reading'&&data.completed!==true&&!(data.examMode==='read_first'&&data.readingSubmitted===true))throw failure();
  if(section==='listening'&&data.listeningSubmitted===false)throw failure();
  return data;
}
function receiptData(status,input){
  const r=status?.receipt;
  if(status?.ok!==true||status.persisted!==true||!r||r.version!==1||r.section!==input.section||r.testSlug!==input.testSlug
    ||!r.submittedAt||!Number.isFinite(Date.parse(r.submittedAt))||!uuid(r.attemptToken)
    ||(input.body.examSessionToken&&r.examSessionToken!==input.body.examSessionToken)
    ||(input.body.attemptToken&&r.attemptToken!==input.body.attemptToken)
    ||(input.body.clientSubmissionId&&r.clientSubmissionId!==input.body.clientSubmissionId)
    ||(input.body.generation!==undefined&&r.generation!==input.body.generation)
    ||canonical(r.answers)!==canonical(input.body.answers))throw failure();
  return validateSubmission(status.response,input);
}
export async function submitSection({state,section,body,testSlug,owner,getOwner,operationId,save,send,read,recovery}){
  state.pendingSubmissions ||= {};
  const k56Term = testSlug === 'term-test-1-k56' || testSlug === 'term-test-2-k56';
  let previous=state.pendingSubmissions[section];
  if(previous&&previous.owner!==owner)throw Object.assign(failure(),{code:'SUBMISSION_OWNER_CHANGED'});
  if(k56Term&&(previous?.recovery||(!previous&&recovery))){
    return submitTermRecovery({state,section,body,testSlug,owner,getOwner,operationId,save,recovery,previous});
  }
  // Quyền audio luôn lấy từ request hiện tại; bản lưu chỉ giữ payload nộp, không giữ bằng chứng quyền cũ.
  if(previous)body={...body,...previous.body};
  const requestedId=uuid(operationId)?operationId:undefined;
  const traceId=uuid(previous?.operationId)?previous.operationId:requestedId??(k56Term?crypto.randomUUID():undefined);
  const input={section,body,testSlug};
  const checkOwner=()=>{if(getOwner()!==owner)throw Object.assign(failure(),{code:'SUBMISSION_OWNER_CHANGED'});};
  const accept=data=>{checkOwner();delete state.pendingSubmissions[section];save();return data;};
  if(previous){
    if(traceId&&!uuid(previous.operationId)){
      previous.operationId=traceId;
      if(k56Term)save();
    }
    const status=await read(body,traceId);checkOwner();
    if(status?.persisted===true)return accept(receiptData(status,input));
    if(status?.ok!==true||status.persisted!==false)throw failure();
  }else{
    const stored={...body};for(const key of ['ownerId','ownerProof','ownerEpoch','audioOwnerId'])delete stored[key];
    state.pendingSubmissions[section]={owner,body:stored,answers:{...body.answers},...(traceId?{operationId:traceId}:{})};save();
  }
  try{return accept(validateSubmission(await send(body,traceId),input));}
  catch(error){
    checkOwner();
    try{
      const status=await read(body,traceId);checkOwner();
      if(status?.persisted===true)return accept(receiptData(status,input));
      // HTTP lỗi đã kết thúc + đọc thấy chưa lưu: cho sửa bài theo deadline. Lỗi truyền tải vẫn giữ snapshot.
      const httpStatus=Number(error.status);
      const transient=k56Term&&(httpStatus>=500||[408,425,429].includes(httpStatus));
      if(status?.ok===true&&status.persisted===false&&httpStatus>=400&&!transient){delete state.pendingSubmissions[section];save();}
    }catch(readError){if(readError.code==='SUBMISSION_OWNER_CHANGED')throw readError;}
    if(state.pendingSubmissions[section])throw failure();
    throw error;
  }
}

const ownerChanged=()=>Object.assign(failure(),{code:'SUBMISSION_OWNER_CHANGED'});

async function receiptHash(pending, section) {
  const { operationId, attemptToken, generation, capturedAt, automatic } = pending.recovery;
  const payload = { operationId, attemptToken, generation, section, revision: pending.body.draftRevision ?? null,
    capturedAt, automatic, ...(section === 'writing' ? { writing: pending.writing } : { answers: canonical(pending.answers) }) };
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload))));
  return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
}

function sameScope(left, right) {
  return ['attemptToken', 'examSessionToken', 'generation', 'classCode', 'studentRef'].every(key => left?.[key] === right?.[key]);
}

async function validateRecoveryReceipt(receipt, pending, testSlug, section) {
  const proof = pending.recovery;
  if (receipt?.version !== 1 || !uuid(receipt.receiptId) || receipt.operationId !== proof.operationId
      || receipt.testSlug !== testSlug || receipt.section !== section || receipt.attemptToken !== proof.attemptToken
      || receipt.examSessionToken !== proof.examSessionToken || receipt.generation !== proof.generation
      || receipt.revision !== (pending.body.draftRevision ?? null) || !Number.isFinite(Date.parse(receipt.submittedAt))
      || receipt.payloadHash !== await receiptHash(pending, section)) throw failure();
}

function rememberHold(pending, held, expectedHash) {
  if (held?.payloadHash !== expectedHash || !Number.isSafeInteger(held.heldAt)
      || !Number.isSafeInteger(held.expiresAt) || held.expiresAt <= held.heldAt) return;
  pending.held = { payloadHash: held.payloadHash, heldAt: held.heldAt, expiresAt: held.expiresAt };
}

function validateFinalSubmission(data, input) {
  if (input.section !== 'writing') return validateSubmission(data, input);
  if (data?.ok !== true || data.writing?.submitted !== true
      || !['task1', 'task2', 'outline'].every(key => data.writing[key] === input.body[key])) throw failure();
  return data;
}

async function submitTermRecovery({state,section,body,testSlug,owner,getOwner,operationId,save,recovery,previous}) {
  if (!recovery || (previous && !sameScope(previous.recovery, recovery.scope))) throw ownerChanged();
  const checkOwner = () => { if (getOwner() !== owner) throw ownerChanged(); };
  const report = (action, data = {}) => {
    if (getOwner() !== owner) return;
    try { recovery.observe?.(action, { section, operationId: pending.operationId, revision: pending.body.draftRevision ?? 0, ...data }); }
    catch {}
  };
  const pending = previous || {
    owner,
    operationId: uuid(operationId) ? operationId : crypto.randomUUID(),
    ...(section === 'writing' ? { writing: { task1: body.task1, task2: body.task2, outline: body.outline } }
      : { answers: { ...body.answers } }),
    body: Object.fromEntries(Object.entries(body).filter(([key]) => !['ownerId', 'ownerProof', 'ownerEpoch', 'audioOwnerId'].includes(key)))
  };
  if (!previous) {
    pending.recovery = { ...recovery.scope, operationId: pending.operationId, capturedAt: new Date().toISOString(),
      automatic: recovery.automatic === true };
    pending.startedAt = recovery.startedAt || null;
    pending.deadlineAt = recovery.deadlineAt || null;
    state.pendingSubmissions[section] = pending;
  }
  const publish = () => { try { recovery.changed?.(); } catch {} };
  delete pending.saveFailed;
  if (save() === false) {
    pending.saveFailed = true;
    report('local_persist_failed', { errorCode: 'LOCAL_PERSIST_FAILED' });
    publish();
    throw Object.assign(Error('Chưa giữ được bài trên thiết bị. Hãy tải bản chốt trước khi rời trang.'), { code: 'LOCAL_PERSIST_FAILED' });
  }
  if (!previous) report('submission_device_saved', { capturedAtMs: Date.parse(pending.recovery.capturedAt),
    startedAtMs: Date.parse(pending.startedAt), deadlineAtMs: Date.parse(pending.deadlineAt),
    automatic: pending.recovery.automatic, ...(section === 'writing' ? {
      task1Length: pending.writing.task1.length, task2Length: pending.writing.task2.length
    } : { answeredCount: Object.values(pending.answers).filter(Boolean).length }) });
  publish();
  const expectedHash = await receiptHash(pending, section);
  checkOwner();
  const sent = { ...body, ...pending.body, recovery: pending.recovery };
  const input = { section, body: sent, testSlug };
  const accept = async (data, receipt) => {
    await validateRecoveryReceipt(receipt, pending, testSlug, section);
    checkOwner();
    validateFinalSubmission(data, input);
    report('receipt_read', { receiptId: receipt.receiptId, outcome: 'accepted' });
    delete state.pendingSubmissions[section];
    save();
    publish();
    return data;
  };
  const readback = async () => {
    const status = await recovery.read(pending.recovery, section, report);
    checkOwner();
    if (status?.ok !== true || typeof status.persisted !== 'boolean') throw failure();
    if (status.persisted) return accept(status.response, status.receipt);
    rememberHold(pending, status.held, expectedHash);
    if (status.recoveryReview === 'SUBMISSION_DIFFERENT_CANONICAL') pending.review = status.recoveryReview;
    save();
    publish();
    return null;
  };
  if (previous) {
    const accepted = await readback();
    if (accepted) return accepted;
    if (pending.review) throw Object.assign(failure(), { code: pending.review });
  }
  try {
    if (section === 'writing' && recovery.automatic) {
      pending.automaticSends = (pending.automaticSends || 0) + 1;
      save();
    }
    const result = await recovery.send(sent, report);
    checkOwner();
    if (result.recoveryReview) {
      rememberHold(pending, result.held, expectedHash);
      pending.review = result.recoveryReview;
      save();
      publish();
      throw Object.assign(Error('Máy chủ dùng bản đã ghi trước đó. Bản vừa chốt được giữ để đối soát.'), { code: pending.review });
    }
    return await accept(result, result.receipt);
  } catch (error) {
    checkOwner();
    const httpStatus = Number(error.status);
    if ([401, 403, 404].includes(httpStatus)) delete pending.held;
    else rememberHold(pending, error.held, expectedHash);
    if (pending.review) throw error;
    if ([400, 401, 403, 404, 409, 422].includes(httpStatus)
        && !['K56_SECTION_ORDER', 'SECTION_NOT_STARTED', 'WRITING_ATTEMPT_NOT_READY'].includes(error.code))
      pending.review = error.code || 'SUBMISSION_REVIEW';
    save();
    publish();
    try {
      const accepted = await readback();
      if (accepted) return accepted;
    } catch (readError) {
      if (readError.code === 'SUBMISSION_OWNER_CHANGED') throw readError;
    }
    throw error.code ? error : failure();
  }
}

export async function clearReceivedTermSubmission({state,section,testSlug,scope,owner,getOwner,read,save,observe}) {
  const pending = state.pendingSubmissions?.[section];
  if (!pending?.recovery || pending.owner !== owner || !sameScope(pending.recovery, scope)) return;
  const status = await read(pending.recovery, section);
  if (getOwner() !== owner || state.pendingSubmissions[section] !== pending) return;
  if (status?.persisted === true) {
    await validateRecoveryReceipt(status.receipt, pending, testSlug, section);
    if (section === 'writing') validateFinalSubmission(status.response, { section, body: pending.body });
    if (getOwner() !== owner || state.pendingSubmissions[section] !== pending) return;
    delete state.pendingSubmissions[section];
    if (state.frozenAnswers && section !== 'writing') state.frozenAnswers[section] = null;
    try { observe?.('receipt_read', { operationId: pending.operationId, section, receiptId: status.receipt.receiptId, outcome: 'accepted' }); } catch {}
  } else if (status?.ok === true && status.persisted === false) {
    const expected = await receiptHash(pending, section);
    if (getOwner() !== owner || state.pendingSubmissions[section] !== pending) return;
    rememberHold(pending, status.held, expected);
    if (status.recoveryReview === 'SUBMISSION_DIFFERENT_CANONICAL') pending.review = status.recoveryReview;
  }
  save();
  return status?.persisted === true ? status.response : undefined;
}

export function renderTermSubmissionRecovery(host, state, testSlug, owner, check) {
  let panel = host.querySelector('#termSubmissionRecovery');
  const rows = Object.entries(state.pendingSubmissions || {}).filter(([, item]) => item.recovery && item.owner === owner);
  if (!rows.length) { panel?.remove(); return; }
  if (!panel) {
    panel = document.createElement('aside');
    panel.id = 'termSubmissionRecovery';
    panel.className = 'notice';
    panel.setAttribute('aria-label', 'Bản chốt cần kiểm tra');
    host.prepend(panel);
  }
  panel.replaceChildren(...rows.map(([section, pending]) => {
    const row = document.createElement('div');
    const text = document.createElement('p');
    const label = { reading: 'Reading', listening: 'Listening', writing: 'Writing' }[section];
    text.textContent = label + ' · ' + (pending.saveFailed
      ? 'Chưa giữ được bài trên thiết bị.'
      : pending.held?.expiresAt > Date.now() ? 'Máy chủ đã giữ bản để đối soát.'
        : pending.review ? 'Bản chốt cần đối soát.' : 'Đã lưu trên thiết bị. Đang chờ xác nhận.');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button';
    button.textContent = 'Tải bản chốt ' + label;
    button.onclick = async () => {
      if (state.pendingSubmissions?.[section] !== pending) return;
      const { operationId, generation, capturedAt, automatic } = pending.recovery;
      const payloadHash = await receiptHash(pending, section);
      if (state.pendingSubmissions?.[section] !== pending) return;
      const file = { version: 1, testSlug, section, operationId, generation, capturedAt, automatic, payloadHash,
        startedAt: pending.startedAt, deadlineAt: pending.deadlineAt, revision: pending.body.draftRevision ?? null,
        held: pending.held || null, review: pending.review || null,
        ...(section === 'writing' ? { writing: pending.writing } : { answers: pending.answers }) };
      const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = testSlug + '-' + section + '-' + operationId.slice(0, 8) + '.json';
      panel.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    };
    const lookup = document.createElement('button');
    lookup.type = 'button';
    lookup.className = 'button';
    lookup.textContent = 'Kiểm tra biên nhận';
    lookup.onclick = () => check(section);
    row.append(text, button, lookup);
    return row;
  }));
}

export function createTermRecoveryController({state,host,testSlug,classCode,getOwner,save,request,journal,onAccepted,onWritingAccepted}) {
  const path = '/api/term-tests/' + testSlug;
  const cause = testSlug === 'term-test-1-k56' ? 'term1_offline' : 'term2_offline';
  const checking = new Set();
  let flushTimer;
  function scope() {
    if (state.submissionRecoveryVersion !== 1 || !uuid(state.attemptToken)
        || !uuid(state.examSessionToken) || !uuid(state.studentRef)
        || !Number.isSafeInteger(state.generation) || state.generation < 0) return;
    return { attemptToken: state.attemptToken, examSessionToken: state.examSessionToken,
      studentRef: state.studentRef, generation: state.generation, classCode };
  }
  function flush() {
    clearTimeout(flushTimer);
    const current = scope(), bridge = journal(), owner = getOwner();
    const queue = state.termSubmissionDiagnostics || [];
    if (!current || !queue.length) return;
    let changed = false;
    while (queue.length) {
      const row = queue[0];
      if (row.owner === owner) {
        const lost = state.termSubmissionDiagnosticsLost;
        try {
          if (!bridge?.metadataOnlySubmission || !bridge.recordK56Submission(current, 'state_observed', {
            cause, checkpointState: lost ? { ...row.event, lostDiagnostics: lost } : row.event
          })) break;
          if (lost) delete state.termSubmissionDiagnosticsLost;
        } catch { break; }
      }
      queue.shift();
      changed = true;
    }
    if (changed) save();
    if (queue.length) flushTimer = setTimeout(flush, 5000);
  }
  function observe(action, fields) {
    if (!scope()) return;
    const queue = state.termSubmissionDiagnostics ||= [];
    if (queue.length >= 48) {
      queue.shift();
      state.termSubmissionDiagnosticsLost = (state.termSubmissionDiagnosticsLost || 0) + 1;
    }
    queue.push({ owner: getOwner(), event: { offlineVersion: 1, submissionRecoveryVersion: 1, action,
      generation: state.generation, observedAt: new Date().toISOString(), ...fields } });
    save();
    flush();
  }
  async function tracedRequest(suffix, body, report) {
    const requestId = crypto.randomUUID(), began = performance.now();
    const endpoint = ['/submission-recovery/status', '/writing/finalize'].includes(suffix) ? suffix : '/submission-recovery/submit';
    let httpStatus = null, errorCode;
    report?.('request_sent', { requestId, endpoint });
    try {
      const response = await request(path + suffix, { method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-exam-journal-request-id': requestId }, body: JSON.stringify(body) });
      httpStatus = 200;
      return response;
    } catch (error) {
      httpStatus = error.status || null;
      errorCode = /^[A-Z0-9_:-]{3,100}$/.test(error.code || '') ? error.code : 'FETCH_FAILED';
      throw error;
    } finally {
      report?.('request_finished', { requestId, endpoint, httpStatus, errorCode, elapsedMs: performance.now() - began });
    }
  }
  function read(proof, section, report) {
    const { capturedAt, automatic, ...identity } = proof;
    return tracedRequest('/submission-recovery/status', { ...identity, section }, report);
  }
  function render() { renderTermSubmissionRecovery(host, state, testSlug, getOwner(), check); }
  async function check(section) {
    const current = scope(), owner = getOwner();
    const pending = state.pendingSubmissions?.[section];
    if (!current || !pending?.operationId || checking.has(pending.operationId)) return;
    checking.add(pending.operationId);
    try {
      const result = await clearReceivedTermSubmission({state,section,testSlug,scope:current,owner,getOwner,save,observe,
        read: (proof, skill) => read(proof, skill, (action, data) => {
          if (getOwner() === owner) observe(action, { ...data, operationId: pending.operationId, section: skill });
        }) });
      if (result && getOwner() === owner) await (section === 'writing' ? onWritingAccepted?.(result) : onAccepted(result));
    } catch {}
    finally { checking.delete(pending.operationId); render(); }
  }
  return {
    observe, flush, render, restore() {
      render();
      for (const section of ['listening', 'reading', 'writing']) void check(section);
    },
    forSubmission(section, automatic) {
      const identity = scope();
      if (!identity) return;
      return { scope: identity, automatic, startedAt: state[section + 'StartedAt'], deadlineAt: state[section + 'DeadlineAt'],
        changed: render, observe, read,
        send: (body, report) => {
          if (section !== 'writing') return tracedRequest('/' + section, body, report);
          const { attemptToken, draftRevision, task1, task2, outline, recovery } = body;
          return tracedRequest('/writing/finalize', { attemptToken, baseRevision: draftRevision, task1, task2, outline, recovery }, report);
        } };
    }
  };
}
