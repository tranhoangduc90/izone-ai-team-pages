import { selectK67BrowserBatch } from './k67-pilot-browser-policy.mjs';

const encoder = new TextEncoder();
// The Worker accepts a 64,000-byte request. Keep room for the opaque ticket,
// envelope, and the signed archive representation before pinning the batch.
const maxCloudEventBytes = 52_000;

export function selectMiniK56BrowserBatch(events, route) {
  const selection = selectK67BrowserBatch(events, route);
  if (selection.destination !== 'pubsub-v1') return selection;

  let bytes = 2;
  let count = 0;
  for (const event of events.slice(0, selection.count)) {
    const eventBytes = encoder.encode(JSON.stringify(event)).length;
    if (bytes + eventBytes + Number(count > 0) > maxCloudEventBytes) break;
    bytes += eventBytes + Number(count > 0);
    count++;
  }
  if (!count) return { destination: 'collector-v1', count: 1 };
  return { ...selection, count };
}
