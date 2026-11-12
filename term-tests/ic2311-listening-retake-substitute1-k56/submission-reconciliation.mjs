const reviewErrors = new Set([
  'AUDIO_RESPONSE_STALE', 'AUDIO_GENERATION_STALE', 'AUDIO_OWNER_CONFLICT', 'AUDIO_NOT_FINISHED',
  'ATTEMPT_LOCKED', 'ATTEMPT_NOT_FOUND', 'PERMIT_INVALID', 'OPERATION_CONFLICT', 'TIMING_INVALID',
  'SNAPSHOT_INVALID', 'SUBMISSION_INVALID', 'ANSWERS_INVALID'
]);

export function heldMetadata(value) {
  const time = input => typeof input === 'string' && input.endsWith('Z') ? Date.parse(input) : NaN;
  return value?.persisted === true && time(value.heldAt) < time(value.expiresAt)
    ? { heldAt: value.heldAt, expiresAt: value.expiresAt } : null;
}

export function pendingReview(state) {
  if (state?.pending?.status === 'submitted' && state.reconciliation?.operationId === state.pending.operationId) {
    return state.reconciliation;
  }
  return null;
}

export function submissionReview(pending, error) {
  if (pending?.status === 'submitted' && reviewErrors.has(error.code)) {
    return { operationId: pending.operationId, code: error.code, held: heldMetadata(error.held) };
  }
  return null;
}

export function downloadListeningSeal(state, product, testSlug, contentVersion) {
  const { attemptId, studentRef, classCode, generation } = state.identity;
  const { operationId, revision, startedAt, sealedAt, submitReason, playedSeconds, audioEndedAt, reviewElapsedMs, answers } = state.sealed;
  const payload = { version: 1, product, testSlug, contentVersion, attemptId, studentRef, classCode, generation,
    operationId, revision, startedAt, sealedAt, submitReason, playedSeconds, audioEndedAt, reviewElapsedMs, answers };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'listening-retake-' + operationId + '.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export async function activateListeningShell(url) {
  const expected = new URL(url, location.href).href;
  const registration = await navigator.serviceWorker.register(expected);
  const worker = [registration.installing, registration.waiting, registration.active]
    .find(candidate => candidate?.scriptURL === expected);
  if (!worker) return null;
  return new Promise(resolve => {
    const check = () => {
      if (worker.state !== 'activated' && worker.state !== 'redundant') return;
      worker.removeEventListener('statechange', check);
      resolve(worker.state === 'activated' ? worker : null);
    };
    worker.addEventListener('statechange', check);
    check();
  });
}
