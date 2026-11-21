const cbtEntryByDestination = new Map([
  ['mini-test-k56-computer-based', 'index-mini-demo-journal-v1.html'],
  ['term-test-1-k56-computer-based', 'demo-journal-v1/'],
  ['term-test-2-k56-computer-based', 'demo-journal-v1/'],
]);

export function demoJournalPage(destination, classCode) {
  if (classCode !== 'CODEXDEMO56') return destination + '/';
  if (destination === 'mini-test-k56') return 'mini-test-k56-demo-paper-v1/';
  return destination + '/' + (cbtEntryByDestination.get(destination) ?? '');
}
