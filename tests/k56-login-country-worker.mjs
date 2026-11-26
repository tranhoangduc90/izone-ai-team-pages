import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import worker from '../ops/k56-login-reports/worker.mjs';

const token = 'a'.repeat(43);
const reportCases = JSON.stringify([{
  id: 'qa-case',
  sha256: createHash('sha256').update(token).digest('hex'),
  expires: new Date(Date.now() + 60000).toISOString()
}]);

async function submit(build, fields, cf) {
  const body = { reportId: randomUUID(), build: 'k56-login-check-20261126-' + build, classCode: 'IC2367', ...fields };
  const request = new Request('https://report.example.test/v1/reports', {
    method: 'POST',
    headers: {
      Origin: 'https://tranhoangduc90.github.io',
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      'CF-IPCountry': 'FR',
      'CF-Connecting-IP': '192.0.2.12'
    },
    body: JSON.stringify(body)
  });
  Object.defineProperty(request, 'cf', { value: cf });
  const rows = [];
  const response = await worker.fetch(request, {
    REPORT_CASES: reportCases,
    DB: {
      prepare: () => ({
        bind(caseId, reportId, payload) {
          rows.push({ caseId, reportId, payload: JSON.parse(payload) });
          return { run: async () => ({ success: true }) };
        }
      })
    }
  });
  return { status: response.status, body, rows };
}

test('records the country from Cloudflare on a scoped page open, without raw network data', async () => {
  const { status, body, rows } = await submit('r3', {
    event: 'page_open', country: 'VN', ip: '192.0.2.10', city: 'client-city'
  }, { country: 'JP', city: 'edge-city', colo: 'HKG' });
  assert.equal(status, 204);
  assert.deepEqual(rows, [{ caseId: 'qa-case', reportId: body.reportId, payload: {
    reportId: body.reportId, build: body.build, classCode: 'IC2367', event: 'page_open', country: 'JP'
  } }]);
});

test('keeps an unknown country distinct and also adds country to technical reports', async () => {
  const fields = { run: { action: 'restore_session', outcome: 'SESSION_UNVERIFIED', requests: [] } };
  const known = await submit('r3', fields, { country: 'VN' });
  assert.equal(known.status, 204);
  assert.equal(known.rows[0].payload.country, 'VN');
  assert.equal(known.rows[0].payload.run.outcome, 'SESSION_UNVERIFIED');

  for (const cf of [undefined, { country: 'XX' }, { country: 'T1' }]) {
    const unknown = await submit('r3', { event: 'page_open', country: 'FR' }, cf);
    assert.equal(unknown.status, 204);
    assert.equal(unknown.rows[0].payload.country, null);
  }
});

test('continues accepting old diagnostics without country or page-open tracking', async () => {
  const old = await submit('r2', { googleButton: 'LOAD_FAILED', country: 'FR' }, { country: 'VN' });
  assert.equal(old.status, 204);
  assert.equal(Object.hasOwn(old.rows[0].payload, 'country'), false);
  assert.equal((await submit('r2', { event: 'page_open' }, { country: 'VN' })).status, 400);
});

test('stores only the scoped email field and only on r4 with a verified-session outcome', async () => {
  const account = 'verified-staff@example.test';
  const run = {
    action: 'restore_session', outcome: 'CLASS_NOT_GRANTED', requests: [],
    reviewerEmail: account, accessToken: 'fixture-credential', email: 'ignored@example.test'
  };
  const received = await submit('r4', { run }, { country: 'JP' });
  assert.equal(received.status, 204);
  assert.equal(received.rows[0].payload.run.reviewerEmail, account);
  assert.equal(received.rows[0].payload.country, 'JP');
  assert.doesNotMatch(JSON.stringify(received.rows[0].payload), /fixture-credential|ignored@example.test/);
  for (const [build, fields] of [
    ['r3', { run }],
    ['r4', { run: { ...run, outcome: 'SESSION_UNVERIFIED' } }],
    ['r4', { run: { ...run, reviewerEmail: 'invalid-contact' } }],
    ['r4', { event: 'page_open', run }]
  ]) {
    const ignored = await submit(build, fields, { country: 'VN' });
    assert.equal(ignored.status, 204);
    assert.equal(ignored.rows[0].payload.run?.reviewerEmail, undefined);
  }
});

test('stores two distinct email event sources and drops unrelated request data', async () => {
  const visitId = randomUUID();
  for (const [event, field, email] of [
    ['email_entered', 'enteredEmail', 'entered-staff@example.test'],
    ['google_account_selected', 'googleEmail', 'chosen-staff@example.test']
  ]) {
    const { status, body, rows } = await submit('r4', {
      event, visitId, [field]: email, credential: 'test-credential', ip: '192.0.2.20'
    }, { country: 'JP' });
    assert.equal(status, 204);
    assert.deepEqual(rows[0].payload, {
      reportId: body.reportId, build: body.build, classCode: 'IC2367', visitId, event, [field]: email, country: 'JP'
    });
    assert.equal((await submit('r4', { event, [field]: 'unfinished' }, { country: 'VN' })).status, 400);
    assert.equal((await submit('r3', { event, [field]: email }, { country: 'VN' })).status, 400);
  }
});
