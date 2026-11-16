export function connectCloudJournal({ target, config, fetcher, recorder, outbox, getCurrent, getProof, onHealth, restoreLegacy }) {
  let ingress;
  try {
    ingress = new URL(config);
    if (ingress.protocol !== 'https:' || ingress.username || ingress.password || ingress.search || ingress.hash) return null;
  } catch { return null; }
  let closed = false;
  let transport;
  let legacy;
  const initialize = () => transport ??= Promise.all([
    import('./k67-pilot-browser-transport.mjs'),
    import('./k67-pilot-legacy-drain.mjs'),
  ]).then(([{ createK67PilotFlush }, { createK67LegacyDrain }]) => {
    const options = { target, ingress: ingress.href, fetcher, recorder, getCurrent, getProof, onHealth };
    if (restoreLegacy) legacy = createK67LegacyDrain(options);
    return createK67PilotFlush({ ...options, outbox });
  });
  async function flush(settings = {}) {
    if (closed || (settings.keepalive && !transport)) return { status: 'deferred', acknowledgedCount: 0 };
    try {
      const send = await initialize();
      if (closed) return { status: 'deferred', acknowledgedCount: 0 };
      const active = await send(settings);
      if (!legacy) return active;
      const retained = await legacy.flush(settings);
      return { ...active, acknowledgedCount: active.acknowledgedCount + retained.acknowledgedCount };
    } catch {
      onHealth({ status: 'degraded', errorCode: 'CLOUD_TRANSPORT_UNAVAILABLE' });
      return { status: 'degraded', acknowledgedCount: 0 };
    }
  }
  return { flush, async close() { closed = true; await legacy?.close(); } };
}
