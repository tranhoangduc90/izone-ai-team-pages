const lanes = new WeakMap();
const endpoint = '/offline/listening-clock';
const retryDelaysMs = [1000, 3000, 10000, 30000, 60000];

function laneFor(runtime, attempt) {
  let lane = lanes.get(attempt);
  if (lane) return lane;
  const sync = attempt.listeningClockSync ??= {revision: 0, pending: []};
  let inFlight;
  let timer;
  let failures = 0;
  const current = () => runtime.record === attempt && runtime.owned;
  const log = (action, item, fields = {}) => runtime.observe(action, {
    section: 'listening', playerId: item.playerId, operationId: item.operationId, transition: item.phase,
    positionMs: item.positionMs, remainingMs: item.remainingMs, interruptionId: item.interruptionId,
    resumeCount: item.resumeCount, ...fields
  });

  function schedule(delay = 0) {
    if (timer || inFlight || !sync.pending.length || sync.review || !current()) return;
    timer = setTimeout(() => {
      timer = null;
      if (globalThis.navigator?.onLine === false) schedule(retryDelaysMs.at(-1));
      else void drain();
    }, delay);
    timer.unref?.();
  }

  async function drain() {
    const item = sync.pending[0];
    if (!item || inFlight || sync.review || !current()) return;
    inFlight = item;
    let retry = 0;
    try {
      item.expectedRevision ??= sync.revision;
      await runtime.persist(false, true);
      if (!current()) return;
      const {remainingMs, ...operation} = item;
      const scope = runtime.scope;
      const receipt = await runtime.post(endpoint, {...scope, ...operation});
      if (!current()) return;
      if (receipt.version !== 1 || receipt.operationId !== item.operationId || receipt.attemptToken !== scope.attemptToken ||
        receipt.generation !== scope.generation || receipt.playerId !== item.playerId || receipt.revision !== item.expectedRevision + 1 ||
        receipt.clock?.positionMs !== item.positionMs || receipt.clock?.remainingMs !== remainingMs ||
        receipt.clock?.phase !== item.phase || receipt.clock?.resumeCount !== item.resumeCount ||
        receipt.clock?.observedAt !== item.observedAt || receipt.clock?.interruptionId !== item.interruptionId ||
        receipt.clock?.recoverable !== item.recoverable) {
        throw Object.assign(new Error('Biên nhận đồng hồ Listening chưa khớp.'), {code: 'LISTENING_CLOCK_ACK_MISMATCH'});
      }
      const confirmedRevision = sync.revision;
      sync.revision = receipt.revision;
      sync.pending.shift();
      try {
        await runtime.persist(false, true);
      } catch (error) {
        sync.revision = confirmedRevision;
        sync.pending.unshift(item);
        throw error;
      }
      log('listening_clock_synced', item, {revision: sync.revision});
      failures = 0;
    } catch (error) {
      if (!current()) return;
      if ([400, 401, 403, 409].includes(error?.status) && error?.code !== 'LISTENING_CLOCK_START_REQUIRED') {
        sync.review = {operationId: item.operationId, reason: error.code || 'LISTENING_CLOCK_REVIEW_REQUIRED'};
        log('listening_clock_sync_rejected', item, {errorCode: sync.review.reason});
        await runtime.persist(false, true).catch(() => {});
        return;
      }
      failures++;
      retry = retryDelaysMs[Math.min(failures - 1, retryDelaysMs.length - 1)];
      log('listening_clock_sync_deferred', item, {errorCode: error?.code || 'LISTENING_CLOCK_UNAVAILABLE', retry});
    } finally {
      inFlight = null;
      schedule(retry);
    }
  }

  lane = {
    wake() {
      clearTimeout(timer);
      timer = null;
      schedule();
    },
    enqueue(checkpoint, phase, remainingMs, playerId, interruptionId) {
      const now = runtime.now();
      const item = {
        operationId: crypto.randomUUID(), phase, playerId, remainingMs,
        positionMs: checkpoint.positionMs, resumeCount: checkpoint.resumeCount,
        interruptionId, recoverable: checkpoint.interruption?.recoverable ?? null,
        observedAt: new Date(now).toISOString(),
      };
      sync.pending.push(item);
      schedule();
    }
  };
  lanes.set(attempt, lane);
  return lane;
}

export function queueListeningClock(runtime, attempt, checkpoint, phase, remainingMs, playerId, interruptionId) {
  laneFor(runtime, attempt).enqueue(checkpoint, phase, remainingMs, playerId, interruptionId);
}

export function drainListeningClock(runtime) {
  const attempt = runtime.record;
  if (attempt?.listeningClockSync && runtime.listeningRecoveryEnabled) laneFor(runtime, attempt).wake();
}
