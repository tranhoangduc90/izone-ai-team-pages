import { withinWritingRange } from './writing-flow-overview.js';

export function worksheetSourcePanel(records, { view, stage = null, stageStatus = '', taskType = '', search = '', dateFrom = null, dateTo = null } = {}) {
  const pending = view === 'overview' || view === 'intake';
  const delivered = view === 'delivered' || stage === 'deliver';
  if (!pending && !delivered || ['Task 1','task_1'].includes(taskType)) return null;
  if (stage && stageStatus && stageStatus !== (pending ? 'pending' : 'succeeded')) return null;
  const needle = String(search).trim().toLocaleLowerCase('vi');
  const seen = new Set();
  const rows = (records || []).filter(row => {
    if (seen.has(row.homework_file_id)) return false;
    if (pending ? row.worksheet || !['pending', 'sent'].includes(row.dispatch_status) : !row.worksheet) return false;
    if (delivered && !stage && !withinWritingRange(row.worksheet.deliveredAt, dateFrom, dateTo)) return false;
    if (needle && ![row.homework_file_id, row.class_code, row.display_name].filter(Boolean).join(' ').toLocaleLowerCase('vi').includes(needle)) return false;
    seen.add(row.homework_file_id); return true;
  });
  return { pending, rows, documents: rows.length, units: rows.reduce((total, row) => total + Number(row.worksheet?.answeredCount || 0), 0) };
}
