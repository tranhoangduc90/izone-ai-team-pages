(function () {
  'use strict';
  const products = new Set(['mini-test-k56', 'term-test-1-k56', 'term-test-2-k56',
    'mini-test-lesson-5', 'term-test-1', 'term-test-2']);
  const outcomes = new Set(['load_requested', 'ready', 'load_failed', 'access_denied',
    'start_window_allowed', 'start_window_locked', 'play_requested', 'playing',
    'play_rejected', 'paused', 'resume_requested', 'reported_interrupted', 'ended']);
  const sources = new Set(['cloudflare', 'pages', 'cache']);
  const errorCodes = new Set(['PLAY_NOT_ALLOWED', 'PLAY_FAILED', 'LOAD_FAILED', 'ACCESS_DENIED']);
  const safeNumber = (value, max) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;
  const limit = 80;
  window.IZONE_PUBLIC_AUDIO_JOURNAL = Object.freeze({
    open(slug, player) {
      if (!products.has(slug) || !['backup', 'paper'].includes(player)) return null;
      try {
        const key = 'izone:public-audio:v1:' + player + ':' + slug;
        const sessionId = crypto.randomUUID();
        const started = performance.now();
        let entries = [];
        try {
          const prior = JSON.parse(sessionStorage.getItem(key) || '[]');
          if (Array.isArray(prior)) entries = prior.slice(-limit);
        } catch {}
        function record(outcome, fields = {}) {
          try {
            if (!outcomes.has(outcome) || !['preview', 'exam'].includes(fields.mode)) return;
            const row = { telemetryVersion:1, slug, player, sessionId, outcome, mode:fields.mode,
              occurredAt:new Date().toISOString(), elapsedPageMs:Math.round(performance.now()-started) };
            if (safeNumber(fields.positionMs,86_400_000)) row.positionMs=fields.positionMs;
            if (safeNumber(fields.bytes,512*1024*1024)) row.bytes=fields.bytes;
            if (safeNumber(fields.elapsedMs,240_000)) row.elapsedMs=fields.elapsedMs;
            if (errorCodes.has(fields.errorCode)) row.errorCode=fields.errorCode;
            if (['operator','media','schedule'].includes(fields.actor)) row.actor=fields.actor;
            if (typeof fields.assetHash==='string' && /^[a-f0-9]{64}$/.test(fields.assetHash)) row.assetHash=fields.assetHash;
            if (Array.isArray(fields.sources)) row.sources=[...new Set(fields.sources.filter(source=>sources.has(source)))];
            entries.push(row);
            if (entries.length>limit) entries.shift();
            window.dispatchEvent(new CustomEvent('exam:public-audio-observed',{detail:row}));
            queueMicrotask(()=>{ try { sessionStorage.setItem(key,JSON.stringify(entries)); } catch {} });
          } catch {}
        }
        return Object.freeze({record,read:()=>structuredClone(entries)});
      } catch { return null; }
    },
    read(slug, player) {
      if (!products.has(slug) || !['backup','paper'].includes(player)) return [];
      try { return JSON.parse(sessionStorage.getItem('izone:public-audio:v1:' + player + ':' + slug) || '[]'); }
      catch { return []; }
    }
  });
}());
