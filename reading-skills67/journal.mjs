import { startHomeworkJournal } from '../shared/reading-homework-journal.mjs?v=20261117-rh-sealed-r1';
import { SpeakingDurableOutbox as SealedOutbox } from '../speaking-homework/journal/speaking-durable-outbox.mjs?v=20261117-cloud-r1';
import { createRecorder } from '../speaking-homework/journal/recorder.mjs?v=20261117-speaking-cloud-r1';

export function startReadingHomeworkJournal(endpoint) {
  return startHomeworkJournal(endpoint, 'reading-homework', {
    Outbox: SealedOutbox, recorderFactory: createRecorder, durableBatches: true,
  });
}
