import { IndexedOutbox } from './outbox.mjs';
import { k67CloudEligible } from './k67-pilot-browser-policy.mjs';
import { createK67PilotFlush } from './k67-pilot-browser-transport.mjs';

const maxBatchBytes = 44 * 1024;
const routineBatchIntervalMs = 120_000;
const fullBatchCount = 40;
const encoder = new TextEncoder();

class PretestTechnicalOutbox extends IndexedOutbox {
  list(binding, options = {}) {
    return super.list(binding, { ...options, maxBytes: Math.min(options.maxBytes ?? maxBatchBytes, maxBatchBytes) });
  }
}

function hasDisplayedText(value) {
  return value !== null && typeof value === 'object'
    && Object.entries(value).some(([key, child]) => /^(?:label|selected|previous)$/i.test(key) || hasDisplayedText(child));
}

export function createPretestBrowserDelivery({ target, ingress, getCurrent, getProof, fetcher, onHealth,
  technicalOutbox }) {
  if (!target.pathname.endsWith('/api/term-tests/pretest-lesson-16')) throw Error('PRETEST_JOURNAL_TARGET_INVALID');
  const outbox = technicalOutbox ?? new PretestTechnicalOutbox({
    name: 'izone-exam-journal-v2:' + target.origin + target.pathname + ':pretest-cbt-technical-v1',
  });
  return {
    companion: {
      outbox,
      accepts(event, captured) {
        const proof = getProof();
        return captured.bindingId === getCurrent()?.bindingId
          && Boolean(proof.examSessionToken || proof.attemptToken) && k67CloudEligible(event)
          && !hasDisplayedText(event.data) && encoder.encode(JSON.stringify(event)).byteLength <= maxBatchBytes - 512;
      },
    },
    connect(recorder) {
      const collectorFlush = recorder.flush.bind(recorder);
      const flush = createK67PilotFlush({ target, ingress, getCurrent, getProof, fetcher, onHealth, outbox, recorder });
      let lastBatch;
      async function flushTechnical(settings) {
        const bindingId = getCurrent()?.bindingId;
        const started = performance.now();
        if (!settings?.force && lastBatch && lastBatch.bindingId === bindingId && started < lastBatch.nextAt) {
          return { status: 'deferred', acknowledgedCount: 0 };
        }
        const result = await flush(settings);
        if (bindingId && bindingId === getCurrent()?.bindingId) {
          if (result.status === 'degraded' || result.acknowledgedCount >= fullBatchCount) lastBatch = undefined;
          else if (result.acknowledgedCount > 0) lastBatch = { bindingId, nextAt: started + routineBatchIntervalMs };
        }
        return result;
      }
      return {
        // The original recorder can flush old/content rows while a cloud ACK is
        // outstanding. No cloud callback may change the destination of those rows.
        // Routine technical rows stay durable while the next batch collects. A
        // forced flush, a full batch, or an unsuccessful send keeps the existing
        // immediate flush or retry behavior.
        async flush(settings) {
          const [collector, technical] = await Promise.all([collectorFlush(settings), flushTechnical(settings)]);
          return { collector, technical };
        },
        async close() { await outbox.close(); },
      };
    },
  };
}
