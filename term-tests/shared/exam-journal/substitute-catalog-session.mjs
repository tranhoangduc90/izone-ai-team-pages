const OUTCOMES = new Set([
  'response_stale', 'catalog_read', 'catalog_failed',
  'entry_selected', 'entry_opened', 'copy_confirmed', 'copy_failed',
]);
const ACTIONS = new Set(['full', 'listening', 'reading', 'writing']);
const TESTS = new Set([
  'substitute-test-1-k56', 'substitute-test-2-k56',
  'substitute-test-1-k67', 'substitute-test-2-k67',
]);
const LIMIT = 80;
const STORAGE_KEY = 'izone:teacher-journal:v1:substitute-catalog';

export function readCatalogJournal() {
  try {
    const rows = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(rows) ? rows.slice(-LIMIT) : [];
  } catch { return []; }
}

export function recordCatalogJournal(outcome, fields = {}) {
  if (!OUTCOMES.has(outcome)) return;
  try {
    const row = {schemaVersion:1, outcome, occurredAt:new Date().toISOString()};
    if (TESTS.has(fields.testSlug)) row.testSlug = fields.testSlug;
    if (ACTIONS.has(fields.action)) row.action = fields.action;
    if (Number.isInteger(fields.status) && fields.status >= 100 && fields.status <= 599) row.status = fields.status;
    if (Number.isInteger(fields.count) && fields.count >= 0 && fields.count <= 16) row.count = fields.count;
    if (typeof fields.ready === 'boolean') row.ready = fields.ready;
    const rows = readCatalogJournal();
    rows.push(row);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(rows.slice(-LIMIT)));
  } catch {}
}
