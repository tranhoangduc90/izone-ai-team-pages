import {startHomeworkJournal} from './reading-homework-journal.mjs?v=20261105-homework-p2';

export function startListeningHomeworkJournal(endpoint, assignmentCode) {
  if (typeof assignmentCode !== 'string' || assignmentCode.length > 160 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(assignmentCode)) throw Error('JOURNAL_ASSIGNMENT_INVALID');
  // Keep the shared transport's strict endpoint contract. The native registry
  // needs this public lesson code; identity and authorization stay in the ticket.
  return startHomeworkJournal(endpoint, 'listening-homework', {fetcher: (target, options) => {
    const url = new URL(target); url.searchParams.set('assignmentCode', assignmentCode);
    return fetch(url.href, options);
  }});
}
