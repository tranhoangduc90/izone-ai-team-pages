const privateDetail = /^(?:answer|answers|answerText|essay|essayText|essay_text|transcript|text|insert|value|message|studentName|studentRef|studentId|studentContactId|erpStudentContactId|email|fullName|displayName|phone|rawPayload|journeyId|sourceId)$/i;
const maxCloudEventsBytes = 55 * 1024;
const utf8 = new TextEncoder();

function hasPrivateDetail(value) {
  if (Array.isArray(value)) return value.some(hasPrivateDetail);
  return value !== null && typeof value === 'object' && Object.entries(value).some(([key, child]) =>
    privateDetail.test(key) || hasPrivateDetail(child));
}

export function k67CloudEligible(event) {
  return event.type !== 'content_checkpoint' && event.type !== 'content_changed' && !hasPrivateDetail(event.data);
}

export function selectK67BrowserBatch(events, route) {
  if (route.destination !== 'pubsub-v1' || !route.pilotId || events.length === 0) {
    return { destination: 'collector-v1', count: events.length };
  }
  const bytes = event => utf8.encode(JSON.stringify(event)).length + 1;
  const fitsCloud = event => k67CloudEligible(event) && bytes(event) <= maxCloudEventsBytes;
  if (!fitsCloud(events[0])) {
    const nextCloud = events.findIndex(fitsCloud);
    return { destination: 'collector-v1', count: nextCloud < 0 ? events.length : nextCloud };
  }
  let total = 0;
  let count = 0;
  for (const event of events) {
    if (!k67CloudEligible(event) || (total += bytes(event)) > maxCloudEventsBytes) break;
    ++count;
  }
  return { destination: 'pubsub-v1', count, pilotId: route.pilotId };
}
