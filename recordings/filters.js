/* Bộ lọc chỉ đọc; ngày đối soát của từng nguồn được giữ khi gộp nhiều ngày. */
(function (root) {
  function text(value) {
    return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').trim().toLowerCase();
  }
  function validDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value + 'T00:00:00Z'))
      && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
  }
  function range(from, to) {
    from = from || to; to = to || from;
    if (!validDate(from) || !validDate(to)) throw Error('INVALID_DATE_RANGE');
    if (from > to) throw Error('REVERSED_DATE_RANGE');
    if ((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000 >= 90) throw Error('DATE_RANGE_TOO_LARGE');
    const days = [];
    for (let value = Date.parse(from + 'T00:00:00Z'), end = Date.parse(to + 'T00:00:00Z'); value <= end; value += 86400000)
      days.push(new Date(value).toISOString().slice(0, 10));
    return {from, to, days};
  }
  function youtube(record) {
    if (record.errorCode || record.error || record.destinationHold || ['error', 'failed'].includes(record.youtubeStatus)) return 'error';
    if (['queued', 'download', 'downloading', 'upload', 'uploading', 'processing', 'postprocess_handoff'].includes(record.stage)
      || ['uploading', 'processing'].includes(record.youtubeStatus)) return 'processing';
    return record.videoId || record.youtubeUrl ? 'has_link' : 'no_link';
  }
  function matches(record, filter, day, session = false) {
    const date = day(record.recordingStart || record.sessionStart);
    if ((filter.from && date < filter.from) || (filter.to && date > filter.to) || ((filter.from || filter.to) && !date)) return false;
    if (filter.account && text(record.source || record.zoomAccount) !== text(filter.account)) return false;
    if (!session && filter.review && (record.reviewStatus === 'approved' ? 'approved' : 'pending') !== filter.review) return false;
    if (!session && filter.youtube) {
      const hasLink = Boolean(record.videoId || record.youtubeUrl);
      if (filter.youtube === 'has_link' ? !hasLink : filter.youtube === 'no_link' ? hasLink : youtube(record) !== filter.youtube) return false;
    }
    const fields = {
      className: [record.className], title: [record.title, record.proposedTitle], source: [record.source, record.zoomAccount],
      recordingFileId: [record.recordingFileId], playlistTitle: [record.playlistTitle],
      reason: [record.errorCode, record.matchReason, record.playlistReason, ...(record.reasons || []),
        ...(record.reasons || []).map(code => filter.reasonLabels?.[code] || '')],
    };
    const values = fields[filter.column] || Object.values(fields).flat();
    return !filter.search || text(values.join(' ')).includes(text(filter.search));
  }
  async function loadRange(dates, read, {signal, onProgress = () => {}, concurrency = 3} = {}) {
    let next = 0, done = 0;
    const snapshots = [], missing = [], failed = [];
    async function worker() {
      while (next < dates.length) {
        if (signal?.aborted) throw Error('RANGE_ABORTED');
        const date = dates[next++];
        try {
          const snapshot = await read(date, signal);
          if (date && snapshot && snapshot.date !== date) throw Error('SNAPSHOT_DATE_MISMATCH');
          if (snapshot) snapshots.push(snapshot); else missing.push(date);
        } catch (error) {
          if (signal?.aborted) throw Error('RANGE_ABORTED');
          failed.push(date);
        }
        onProgress(++done, dates.length);
      }
    }
    await Promise.all(Array.from({length: Math.min(concurrency, dates.length)}, worker));
    snapshots.sort((a, b) => a.date.localeCompare(b.date));
    return {snapshots, missing: missing.sort(), failed: failed.sort()};
  }
  function combine(snapshots) {
    const records = new Map(), accounts = new Map();
    for (const snapshot of [...snapshots].sort((a, b) => a.date.localeCompare(b.date))) {
      for (const record of snapshot.records || []) {
        const key = record.kind === 'session' ? `${snapshot.date}:${record.id}`
          : `${record.source || record.account}:${record.recordingFileId || record.id}`;
        // Bản mới hơn của cùng nguồn thắng; không dựa vào vị trí kết quả HTTP.
        records.set(key, {...record, _snapshotDate: snapshot.date});
      }
      for (const account of snapshot.accounts || []) accounts.set(account.account, account);
    }
    return {date: snapshots.at(-1)?.date, records: [...records.values()], accounts: [...accounts.values()],
      scanStatus: snapshots.some(s => ['failed', 'partial'].includes(s.scanStatus)) ? 'partial' : 'completed'};
  }
  root.recordingFilters = {text, validDate, range, youtube, matches, loadRange, combine};
})(typeof window === 'undefined' ? globalThis : window);
