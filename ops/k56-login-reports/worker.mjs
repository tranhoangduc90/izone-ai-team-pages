const origin = 'https://tranhoangduc90.github.io';
const cors = {
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Cache-Control': 'no-store',
  Vary: 'Origin'
};
const outcomes = new Set([
  'SIGNED_OUT', 'SESSION_UNVERIFIED', 'REAL_SESSION_UNVERIFIED', 'AUTH_MODULE_LOAD_FAILED',
  'CLASS_ACCESS_OK', 'CLASS_NOT_GRANTED', 'CLASS_LOOKUP_FAILED', 'DIAGNOSTIC_ERROR'
]);
const errors = new Set(['FETCH_FAILED', 'TIMEOUT', 'ABORTED', 'ERROR']);
const stepPattern = /^(?:(?:Kết nối API|Đăng nhập Google vào API|Đọc quyền lớp|Đọc phiên) · (?:k56|demo)|Khôi phục phiên (?:k56|k56demo)|Tìm phiên ở (?:reading|listening|writing|mapping|term67|materials|k56|demo|handout67|shops))$/u;
const browserPattern = /^(?:(?:EdgA?|EdgiOS|OPR|SamsungBrowser|YaBrowser|FxiOS|Firefox|CriOS|Chrome|Chromium|Safari)\/\d{1,4}(?:\.\d{1,6}){0,5}|unknown)$/;

async function findCase(request, secret) {
  const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(request.headers.get('authorization') || '')?.[1];
  if (!token || !secret) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const hex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  const now = Date.now();
  return JSON.parse(secret).find(item => {
    if (!/^[a-z0-9-]{1,48}$/.test(item.id) || Date.parse(item.expires) <= now
        || !Number.isFinite(Date.parse(item.expires)) || !/^[a-f0-9]{64}$/.test(item.sha256)) return false;
    let differingBits = 0;
    for (let i = 0; i < hex.length; i++) differingBits |= item.sha256.charCodeAt(i) ^ hex.charCodeAt(i);
    return differingBits === 0;
  })?.id || null;
}

async function readJson(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json') || !request.body) throw new Error();
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let length = 0;
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 8192) {
      await reader.cancel();
      throw new Error();
    }
    text += decoder.decode(value, { stream: true });
  }
  return JSON.parse(text + decoder.decode());
}

function httpStatus(value) {
  return Number.isInteger(value) && value >= 100 && value <= 599;
}

function normalize(body) {
  if (!body || typeof body.reportId !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(body.reportId)
      || body.build !== 'k56-login-check-20261126-r2' || body.classCode !== 'IC2367') return null;
  const result = { reportId: body.reportId, build: body.build, classCode: 'IC2367' };
  if (['RENDER_REQUESTED', 'LOAD_FAILED', 'INIT_FAILED'].includes(body.googleButton)) result.googleButton = body.googleButton;
  if (Array.isArray(body.browserPolicy)) {
    result.browserPolicy = [...new Set(body.browserPolicy.filter(code => typeof code === 'string' && /^(?:frame-src|script-src-elem|connect-src):(?:k56_api|google)$/.test(code)))];
  }
  const run = body.run;
  if (!run) return result.googleButton || result.browserPolicy?.length ? result : null;
  if (!['restore_session', 'google_sign_in'].includes(run.action) || !outcomes.has(run.outcome)
      || !Array.isArray(run.requests) || run.requests.length > 40) return null;
  const metadata = run.environment || {};
  result.run = {
    action: run.action,
    outcome: run.outcome,
    environment: {
      browser: browserPattern.test(metadata.browser) ? metadata.browser : 'unknown',
      os: ['Android', 'iOS', 'Windows', 'macOS', 'Linux'].includes(metadata.os) ? metadata.os : 'unknown'
    },
    requests: []
  };
  const utc = typeof run.utc === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(run.utc) ? Date.parse(run.utc) : NaN;
  if (Number.isFinite(utc)) result.run.utc = new Date(utc).toISOString();
  for (const key of ['online', 'cookiesEnabled', 'secureContext']) {
    if (typeof metadata[key] === 'boolean') result.run.environment[key] = metadata[key];
  }
  if (httpStatus(run.classError) || errors.has(run.classError)) result.run.classError = run.classError;
  if (errors.has(run.error)) result.run.error = run.error;
  for (const item of run.requests) {
    if (!item || typeof item.step !== 'string' || !stepPattern.test(item.step) || !Number.isInteger(item.ms) || item.ms < 0 || item.ms > 300000) continue;
    if (httpStatus(item.http)) result.run.requests.push({ step: item.step, ms: item.ms, http: item.http });
    else if (errors.has(item.error)) result.run.requests.push({ step: item.step, ms: item.ms, error: item.error });
  }
  return result;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/v1/reports') return new Response(null, { status: 404 });
    if (request.headers.get('origin') !== origin) return new Response(null, { status: 403 });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: cors });
    let caseId;
    try { caseId = await findCase(request, env.REPORT_CASES); }
    catch { return new Response(null, { status: 503, headers: cors }); }
    if (!caseId) return new Response(null, { status: 401, headers: cors });
    let report;
    try { report = normalize(await readJson(request)); }
    catch { return new Response(null, { status: 400, headers: cors }); }
    if (!report) return new Response(null, { status: 400, headers: cors });
    try {
      const stored = await env.DB.prepare(
        'INSERT INTO reports (case_id, report_id, payload) VALUES (?, ?, ?) ON CONFLICT (case_id, report_id) DO NOTHING'
      ).bind(caseId, report.reportId, JSON.stringify(report)).run();
      if (!stored.success) throw new Error();
    } catch {
      return new Response(null, { status: 503, headers: cors });
    }
    return new Response(null, { status: 204, headers: cors });
  },
  async scheduled(event, env) {
    const cutoff = new Date(event.scheduledTime - 7 * 86400000).toISOString();
    await env.DB.prepare('DELETE FROM reports WHERE received_at < ?').bind(cutoff).run();
  }
};
