const demoEntryByDestination = new Map([
  ['mini-test-k56-computer-based', 'index-mini-demo-journal-v1.html'],
  ['term-test-1-k56-computer-based', 'demo-journal-v1/'],
  ['term-test-2-k56-computer-based', 'demo-journal-v1/'],
]);
export function demoJournalEntry(destination, classCode) {
  if (classCode !== 'CODEXDEMO56') return '';
  return demoEntryByDestination.get(destination) ?? '';
}
