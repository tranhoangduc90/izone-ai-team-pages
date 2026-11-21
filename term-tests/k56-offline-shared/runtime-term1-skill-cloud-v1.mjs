import { createOfflineRuntime as createSharedRuntime, withListeningContinuity } from './runtime-term-submission-recovery-v1.mjs?v=20261112-term1-fallback';
export { withListeningContinuity };

export function createOfflineRuntime(profile) {
  const shared = createSharedRuntime(profile);
  if (profile.slug !== 'term-test-1-k56' || !profile.skillFallback) return shared;

  class OfflineRuntime extends shared.OfflineRuntime {
    connectRecoveryJournal() {
      const config = globalThis.TERM_TEST_APP_CONFIG;
      const run = this.record;
      if (config?.EXAM_JOURNAL_ENABLED !== true || globalThis.navigator?.onLine === false || this.journalConnecting
          || performance.now() < (this.journalRetryAt || 0) || !this.active) return;
      const endpoint = (config.EXAM_JOURNAL_BASE_URL || this.apiBase + '/api/term-tests/' + profile.slug)
        + '/skill-fallback';
      const getState = () => this.record === run && this.active
        ? { ...this.sectionResponse(), classCode: this.classCode, clientRunId: this.scope.ownerId }
        : {};
      // The skill credential goes only to the native API for context/renewal.
      const credentialTargets = new Set([endpoint + '/journal-context', endpoint + '/journal-pilot-context']);
      const fetcher = (url, options) => credentialTargets.has(url) ? this.fetchImpl(url, options) : globalThis.fetch(url, options);
      this.journalConnecting = import('../shared/exam-journal/bridge-term1-k56-skill-cloud-v1.mjs')
        .then(({ connectExamJournal }) => {
          if (this.record === run && this.active) this.setJournal(connectExamJournal({
            enabled: true, endpoint, testSlug: profile.slug, build: this.build, getState,
            submissionMetadataOnly: true, fetcher
          }));
        })
        .catch(() => { this.journalRetryAt = performance.now() + 10_000; })
        .finally(() => { this.journalConnecting = null; });
    }
  }
  return { ...shared, OfflineRuntime };
}
