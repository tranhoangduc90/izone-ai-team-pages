(() => {
  const script = document.createElement('script');
  script.src = document.currentScript.dataset.bootstrap;

  const product = 'term-test-1';
  const classCode = 'IC2304';
  const search = new URLSearchParams(location.search);
  const parallelScope = history.state?.izoneTerm1CbtSessionV1;
  if (search.get('class')?.trim().toUpperCase() !== classCode || navigator.onLine === false
    || search.has('retakeGrant') || parallelScope?.classCode === classCode) {
    document.body.append(script);
    return;
  }

  const scope = `${product}:${classCode}`;
  const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
  const owner = history.state?.izoneStudentProductStateV1;
  const stores = ['sessionStorage', 'localStorage'].flatMap(name => {
    try { return [window[name]]; } catch { return []; }
  });

  const read = (storage, key) => {
    try { return JSON.parse(storage.getItem(key) || 'null'); } catch { return null; }
  };

  async function recoverExpiredSession() {
    const pinned = owner?.classCode === classCode && owner?.product === product && uuid.test(owner.studentRef);
    if (!pinned && (owner?.cleared || performance.getEntriesByType('navigation')[0]?.type !== 'reload')) return;

    const suffix = pinned && !owner.legacyScope ? `:student:${owner.studentRef}` : '';
    const stateKey = `izone-test:${scope}${suffix}`;
    const uiKey = `izone-test-ui:${scope}${suffix}`;
    const annotationsKey = `izone-test-annotations:${scope}${suffix}`;
    const candidates = pinned ? stores : stores.slice(0, 1);
    const saved = candidates.map(storage => read(storage, stateKey)).find(value =>
      uuid.test(value?.examSessionToken) && uuid.test(value.studentRef) && (!pinned || value.studentRef === owner.studentRef));
    if (!saved) return;

    const apiBase = window.TERM_TEST_APP_CONFIG?.API_BASE_URL;
    if (!apiBase) return;
    const response = await fetch(`${apiBase}/api/term-tests/${product}/session/${saved.examSessionToken}/preview`, {
      cache: 'no-store', signal: AbortSignal.timeout(3000)
    });
    if (response.status !== 404) {
      await response.body?.cancel();
      return;
    }
    if ((await response.json()).error !== 'EXAM_SESSION_NOT_FOUND') return;

    for (const storage of stores) {
      const current = read(storage, stateKey);
      if (current?.studentRef !== saved.studentRef || current.examSessionToken !== saved.examSessionToken) continue;
      const archiveKey = `izone-test-expired:${scope}:${saved.examSessionToken}`;
      try {
        if (!storage.getItem(archiveKey)) storage.setItem(archiveKey, JSON.stringify({
          state: current, ui: read(storage, uiKey), annotations: read(storage, annotationsKey)
        }));
        storage.setItem(stateKey, JSON.stringify({
          studentRef: current.studentRef,
          studentName: current.studentName,
          studentIdentitySource: current.studentIdentitySource,
          audioVolume: current.audioVolume
        }));
        storage.removeItem(uiKey);
        storage.removeItem(annotationsKey);
      } catch { /* Keep current state if the expired draft cannot be archived. */ }
    }
  }

  recoverExpiredSession().catch(() => {}).finally(() => document.body.append(script));
})();
