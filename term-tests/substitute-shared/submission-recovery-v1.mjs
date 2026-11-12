const hashPattern = /^[a-f0-9]{64}$/;
const uuidPattern = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const retryable = new Set([
  'LISTENING_NOT_SUBMITTED', 'READING_NOT_SUBMITTED', 'LISTENING_PHASE_NOT_STARTED',
  'SUBMISSION_COMMIT_UNCONFIRMED', 'SECTIONS_NOT_SUBMITTED',
  'LISTENING_EOF_UNCONFIRMED', 'LISTENING_REVIEW_IN_PROGRESS'
]);

function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function codedError(code, message, extra = {}) {
  return Object.assign(new Error(message), { code, ...extra });
}

async function sealHash(row, body) {
  const payload = {
    version: 1, testSlug: row.scope.testSlug, clientRunId: row.scope.clientRunId,
    generation: row.scope.generation, section: row.skill, ...row.recovery,
    body
  };
  const bytes = new TextEncoder().encode(canonical(payload));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
    value => value.toString(16).padStart(2, '0')).join('');
}

export function submitRecoveredSection({ row, definitionVersion, readCanonical, ...io }) {
  return submitRecovered({ ...io, row, body: { answers: row.answers, definitionVersion },
    verifySaved: (saved, receipt) => saved.persisted === true
      && saved.snapshotHash === receipt.acceptedHash && saved.submittedAt === receipt.submittedAt,
    fromStatus: () => readCanonical() });
}

export function submitRecoveredWriting({ row, taskNumber, examVersion, readCanonical, claimDispatch, ...io }) {
  const essay = number => String(row.payload['task' + number] ?? '');
  const body = { attemptToken: row.payload.attemptToken.toLowerCase(), taskNumber, examVersion: examVersion || null,
    ...(examVersion ? { tasks: [1, 2].map(taskNumber => ({ taskNumber, essay: essay(taskNumber) })) }
      : { essay: essay(taskNumber) }) };
  return submitRecovered({ ...io, row, body, claimDispatch,
    verifySaved: saved => saved.accepted === true && saved.persisted === true
      && typeof saved.grading?.status === 'string' && typeof saved.grading.ready === 'boolean',
    async fromStatus(status) {
      const saved = await readCanonical().catch(() => null);
      return { ...saved, accepted: true, persisted: true, dispatchUnconfirmed: status.dispatchPending === true,
        grading: saved?.grading || { status: status.dispatchPending ? 'queued' : '', ready: false } };
    }
  });
}

async function submitRecovered({ row, body, read, fromStatus, verifySaved, send, rememberHold, claimDispatch }) {
  if (!uuidPattern.test(row?.recovery?.operationId || '')) {
    throw codedError('SUBMISSION_SEAL_MISSING', 'Thiếu mã của bản chốt. Hãy tải bài để đối soát.');
  }
  const expectedHash = await sealHash(row, body);
  const validHold = hold => hold?.version === 1 && hold.operationId === row.recovery.operationId
    && hold.section === row.skill && hold.payloadHash === expectedHash && Number.isFinite(Date.parse(hold.expiresAt));
  const held = (hold, code) => {
    const message = code === 'LISTENING_REVIEW_IN_PROGRESS'
      ? 'Máy chủ đã giữ bản chốt và đang chờ hết giờ rà. Mã: '
      : code === 'LISTENING_EOF_UNCONFIRMED'
        ? 'Máy chủ đã giữ bản chốt và đang chờ xác nhận audio đã phát hết. Mã: '
        : 'Máy chủ đã giữ bản chốt để đối soát. Mã: ';
    return codedError(code || 'SUBMISSION_HELD', message + hold.operationId, { submissionHold: hold });
  };

  function verifyReceipt(receipt) {
    if (receipt?.version !== 1 || !uuidPattern.test(receipt.receiptId || '')
      || receipt.operationId !== row.recovery.operationId || receipt.payloadHash !== expectedHash
      || receipt.testSlug !== row.scope.testSlug || receipt.clientRunId !== row.scope.clientRunId
      || receipt.generation !== row.scope.generation || receipt.section !== row.skill
      || !hashPattern.test(receipt.acceptedHash || '') || !Number.isFinite(Date.parse(receipt.submittedAt))) {
      throw receiptMismatch();
    }
  }

  function receiptMismatch() {
    return codedError('SUBMISSION_RECEIPT_MISMATCH', 'Biên nhận chưa khớp bản chốt. Hãy tải bài để đối soát.');
  }

  function finish(receipt, saved) {
    verifyReceipt(receipt);
    if (!verifySaved(saved, receipt)) throw receiptMismatch();
    return { ...saved, submissionReceipt: receipt };
  }

  async function readState(resumeDispatch = false) {
    const status = await read(row);
    if (status?.state === 'accepted') {
      const receipt = status.submissionReceipt;
      verifyReceipt(receipt);
      if (resumeDispatch && status.dispatchPending === true && claimDispatch && await claimDispatch()) {
        // The native job claim deduplicates delivery even when the first dispatch timed out.
        try {
          const sent = await send(row);
          if (sent.submissionReceipt?.receiptId === receipt.receiptId) return finish(sent.submissionReceipt, sent);
        } catch {}
      }
      return finish(receipt, await fromStatus(status));
    }
    if (status?.state === 'held' && validHold(status.submissionHold)) return status;
    if (status?.state === 'missing' || status?.state === 'expired') return status;
    throw codedError('SUBMISSION_STATUS_MISMATCH', 'Trạng thái máy chủ chưa khớp bản chốt. Hãy tải bài để đối soát.');
  }

  const existing = await readState(true);
  if (existing.persisted) return existing;
  if (row.status === 'acknowledged') throw receiptMismatch();
  if (existing.state === 'held' && row.holdCode && !retryable.has(row.holdCode)) {
    throw held(existing.submissionHold, row.holdCode);
  }
  try {
    const saved = await send(row);
    return finish(saved.submissionReceipt, saved);
  } catch (error) {
    if (validHold(error.submissionHold)) {
      await rememberHold(error.submissionHold, error.code).catch(() => {});
      throw held(error.submissionHold, error.code);
    }
    const status = await readState().catch(() => null);
    if (status?.persisted) return status;
    if (status?.state === 'held') {
      await rememberHold(status.submissionHold, null).catch(() => {});
      throw held(status.submissionHold);
    }
    throw error;
  }
}


export function createSubmissionRecoveryClient({apiRequest,journalSubmissionOwner,sectionDefinition,taskNumber,examVersion=null}) {
  let scheduledListeningRetry='';
  function sealedTransport(exam,row,owner) {
    const permit={deviceId:exam.offlineDeviceId,generation:exam.offlineGeneration,offlinePermit:exam.offlinePermit};
    const assertOwner=()=>{
      if(exam!==window.TERM_TEST_BOOTSTRAP||owner!==journalSubmissionOwner()||window.SUBSTITUTE_STATE.blocked)throw new Error('Lượt thi đã đổi.');
    };
    const request=async (route,body,phase)=>{
      assertOwner();
      const data=await apiRequest(route,{method:'POST',body:JSON.stringify(body)},
        {operationId:row.recovery?.operationId,phase,owner});
      assertOwner();return data;
    };
    return {permit,request,assertOwner};
  }

  async function submitSection(exam, skill, answers, automatic, owner) {
    const offline = window.SUBSTITUTE_OFFLINE;
    if (!offline) throw new Error('Không thể lưu bản chốt trên thiết bị. Hãy tải bài để đối soát.');
    const clock = window.IZONE_EXAM_CLOCK?.estimate(exam.serverTimeOffsetMs)
      ?? Date.now() + (Number(exam.serverTimeOffsetMs) || 0);
    const row = await offline.queueSection(skill, answers, {
      operationId: crypto.randomUUID(), revision: 0, capturedAt: new Date(clock).toISOString(), automatic
    });
    const { permit, request, assertOwner } = sealedTransport(exam,row,owner);
    try {
      const receipt = await submitRecoveredSection({
        row, definitionVersion:sectionDefinition,
        read: () => request('/api/test/exam/recovery/status', {
          ...permit, clientRunId:exam.clientRunId, section:skill, operationId:row.recovery.operationId
        }, 'readback'),
        readCanonical: () => request('/api/test/exam/section-status', {examId:skill}, 'readback'),
        send: async () => {
          if (exam.listeningContinuityVersion===1 && (skill==='listening'||exam.examOrder!=='reading-first')) {
            try { await window.SUBSTITUTE_EXAM.flushListeningOutcome(); }
            catch (error) {
              // For an automatic seal the native EOF guard can retain it while confirmation is unavailable.
              if (skill==='listening' && !row.recovery.automatic) throw error;
            }
          }
          return request('/api/test/grade', {...permit, examId:skill, answers:row.answers, recovery:row.recovery}, 'send');
        },
        rememberHold: async (hold, code) => { assertOwner(); await offline.rememberSectionHold(skill,hold,code); }
      });
      assertOwner();
      try { await offline.acknowledgeSection(skill,receipt); }
      catch { window.SUBSTITUTE_OFFLINE_STATUS = 'receipt_cache_failed'; }
      return receipt;
    } catch (error) {
      assertOwner();
      error.offlineQueued = true;
      const refusal=error.submissionRecoveryError;
      const matchesSeal=refusal?.version===1 && refusal.operationId===row.recovery.operationId && refusal.section===skill;
      const retryAt=Date.parse(error.submissionHold?.retryAt || (matchesSeal ? refusal.retryAt : '') || '');
      if(error.code==='LISTENING_REVIEW_IN_PROGRESS' && Number.isFinite(retryAt)
        && scheduledListeningRetry!==row.recovery.operationId){
        scheduledListeningRetry=row.recovery.operationId;
        const now=window.IZONE_EXAM_CLOCK?.estimate(exam.serverTimeOffsetMs) ?? Date.now();
        window.setTimeout(()=>{
          if(exam===window.TERM_TEST_BOOTSTRAP && owner===journalSubmissionOwner())void window.SUBSTITUTE_SYNC_PENDING?.();
        },Math.max(1500,retryAt-now+1500));
      }
      throw error;
    }
  }

  async function submitWriting(row){
    const offline=window.SUBSTITUTE_OFFLINE,exam=window.TERM_TEST_BOOTSTRAP;
    const {permit,request,assertOwner}=sealedTransport(exam,row,journalSubmissionOwner());
    const payload=row.payload;
    const saved=await submitRecoveredWriting({
      row,taskNumber,examVersion,
      read:()=>request('/api/test/exam/recovery/status',{
        ...permit,clientRunId:exam.clientRunId,section:'writing',operationId:row.recovery.operationId
      },'readback'),
      readCanonical:()=>request('/api/test/writing/status',{
        classCode:payload.classCode,studentRef:payload.studentRef,attemptToken:payload.attemptToken,promptVersion:payload.promptVersion
      },'readback'),
      send:()=>request('/api/test/writing',{...payload,...permit,recovery:row.recovery},'send'),
      rememberHold:async(hold,code)=>{assertOwner();await offline.rememberSectionHold('writing',hold,code);},
      claimDispatch:async()=>{assertOwner();return offline.claimWritingDispatch(row.recovery.operationId).catch(()=>false);}
    });
    assertOwner();
    let acknowledged;
    try{acknowledged=await offline.acknowledgeWriting(saved);}
    catch{window.SUBSTITUTE_OFFLINE_STATUS='writing_receipt_cache_failed';}
    return {saved,acknowledged};
  }

  return {submitSection,submitWriting};
}
