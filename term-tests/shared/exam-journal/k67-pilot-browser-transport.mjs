import { sendSealedBatch } from './sealed-batch.mjs';
import { selectK67BrowserBatch } from './k67-pilot-browser-policy.mjs';
import { fetchTransport } from './recorder.mjs?v=20261109-term1-writing-v1';

const collector = { destination: 'collector-v1' };
const fields = ['ticket', 'ticketId', 'issuedAt', 'expiresAt'];
const authOf = value => Object.fromEntries(fields.map(key => [key, value[key]]));

export function createK67PilotFlush({ target, ingress, fetcher, outbox, recorder, getCurrent, getProof, onHealth }) {
  const sendCloud = fetchTransport(ingress, fetcher);
  const sendCollector = fetchTransport(target.href + '/journal-collector-sealed', fetcher);
  let running = false, cachedRoute, failures = 0, retryAt = 0, lastBinding;

  async function context(proof, sealed) {
    const started = performance.now();
    const reply = await fetcher(target.href + '/journal-pilot-context', { method: 'POST', credentials: 'omit', cache: 'no-store',
      body: JSON.stringify(sealed ? { ...proof, sealed } : proof), signal: AbortSignal.timeout(1600),
      headers: { 'Content-Type': 'application/json' } });
    const result = await reply.json();
    if (!reply.ok || result.ok !== true) throw Error(result?.error || 'PILOT_CONTEXT_UNAVAILABLE');
    if (!sealed && result.destination === collector.destination) return collector;
    if (result.destination !== 'pubsub-v1' || typeof result.pilotId !== 'string' || typeof result.ticket !== 'string'
      || !result.ticketId || !/^[a-f0-9]{64}$/.test(result.bindingId) || !Number.isSafeInteger(result.expiresAt)
      || !Number.isSafeInteger(result.issuedAt) || result.expiresAt <= result.issuedAt) throw Error('PILOT_CONTEXT_INVALID');
    return { ...result, usableUntil: started + (result.expiresAt - result.issuedAt) };
  }

  return async function flush({ keepalive = false, force = false } = {}) {
    if (running) return { status: 'deferred', acknowledgedCount: 0 };
    const current = getCurrent();
    if (!current) return { status: 'no_identity', acknowledgedCount: 0 };
    if (globalThis.navigator?.onLine === false) return { status: 'offline', acknowledgedCount: 0 };
    const proof = getProof();
    const { bindingId, auth } = current;
    if (bindingId !== lastBinding) { lastBinding = bindingId; retryAt = 0; failures = 0; }
    if (!force && performance.now() < retryAt) return { status: 'deferred', acknowledgedCount: 0 };
    const proofKey = JSON.stringify(proof);
    const usable = () => current === getCurrent() && proofKey === JSON.stringify(getProof());
    const bound = grant => grant.bindingId === bindingId;
    const baseSelection = proof.examSessionToken || proof.attemptToken;
    running = true;
    try {
      await recorder.idle();
      if (!usable()) throw Error('SEALED_CONTEXT_CHANGED');
      let route = collector;
      if (baseSelection) {
        const now = performance.now();
        if (cachedRoute?.key !== proofKey || now >= cachedRoute.recheckAt) {
          if (keepalive) return { status: 'deferred', acknowledgedCount: 0 };
          if (!(await outbox.list(bindingId, { maxCount: 1 })).length) return { status: 'ok', acknowledgedCount: 0 };
          const fresh = await context(proof);
          if (fresh.destination === 'pubsub-v1' && !bound(fresh)) throw Error('PILOT_BINDING_MISMATCH');
          cachedRoute = { key: proofKey, route: fresh, recheckAt: Math.min(now + 15_000, (fresh.usableUntil ?? Infinity) - 1500) };
        }
        route = cachedRoute.route;
      }

      const send = async (body, options) => {
        if (!usable()) throw Error('SEALED_CONTEXT_CHANGED');
        if (options.destination === collector.destination) return sendCollector(body, options);
        if (options.destination !== 'pubsub-v1' || !options.pilotId || !baseSelection) throw Error('PILOT_SEALED_DESTINATION_UNKNOWN');
        if (route.pilotId === options.pilotId && route.usableUntil > performance.now() + 500) {
          try { return await sendCloud({ ...body, auth: authOf(route) }, options); }
          catch (error) {
            if (!['JOURNAL_TICKET_EXPIRED', 'JOURNAL_TICKET_INVALID'].includes(error.code)) throw error;
            cachedRoute = undefined;
          }
        }
        if (keepalive) throw Error('PILOT_RENEWAL_DEFERRED');
        const sealed = { destination: options.destination, pilotId: options.pilotId, scopeId: bindingId,
          batchId: body.batchId, eventPayloadSha256: body.eventPayloadSha256 };
        const renewed = await context(proof, sealed);
        if (!usable() || !bound(renewed) || renewed.pilotId !== options.pilotId) throw Error('PILOT_BINDING_MISMATCH');
        return sendCloud({ ...body, auth: authOf(renewed) }, options);
      };
      const acknowledgedCount = await sendSealedBatch(outbox, bindingId, auth, send, usable,
        { keepalive, selectBatch: rows => selectK67BrowserBatch(rows, route) });
      failures = 0;
      retryAt = 0;
      return { status: 'ok', acknowledgedCount };
    } catch (error) {
      failures++;
      retryAt = performance.now() + Math.min(60_000, 1000 * 2 ** Math.min(6, failures - 1)) * (0.5 + Math.random() * 0.5);
      if (usable() && Date.now() > auth.expiresAt) {
        await outbox.blockContext(bindingId, auth.ticketId).catch(() => {});
        onHealth({ status: 'degraded', errorCode: 'JOURNAL_TICKET_EXPIRED', expiredBindingId: bindingId, pendingReauthorization: true });
      } else {
        const reason = error.code || error.message;
        onHealth({ status: 'degraded', errorCode: /^[A-Z0-9_]{1,80}$/.test(reason) ? reason : 'PILOT_JOURNAL_RETRY' });
      }
      return { status: 'degraded', acknowledgedCount: 0 };
    } finally { running = false; }
  };
}
