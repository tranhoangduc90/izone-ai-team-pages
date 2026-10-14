// Cache chỉ đọc trong phiên; khóa giữ toàn bộ tham số, không dựa vào thứ tự phản hồi.
const reads = new Set(['writingCounts', 'writingClasses', 'writingFilterOptions',
  'writingPairsPage', 'writingSourceIssues', 'writingDailyStats']);

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}

export function createWritingReadCache(api, { now = Date.now, ttl = 30_000,
  filterTtl = 60_000, maxEntries = 128, onInvalidate = () => {} } = {}) {
  const entries = new Map();
  const pending = new Map();
  let epoch = 0;
  function clear(reason = 'reset') {
    epoch += 1;
    entries.clear();
    pending.clear();
    onInvalidate(reason);
  }
  const wrapped = {};
  for (const [method, operation] of Object.entries(api)) {
    if (typeof operation !== 'function') { wrapped[method] = operation; continue; }
    if (!reads.has(method)) {
      wrapped[method] = (...args) => {
        if (!/^(add|request|retry|skip|restore|update|save)/u.test(method)) {
          return operation.apply(api, args);
        }
        // Xóa cả khi thao tác thất bại: không giữ bản cũ như một biên nhận thành công.
        clear('mutation');
        return Promise.resolve().then(() => operation.apply(api, args)).finally(() => clear('mutation'));
      };
      continue;
    }
    wrapped[method] = (...args) => {
      const key = JSON.stringify([method, canonical(args)]);
      const cached = entries.get(key);
      if (cached && cached.expires > now()) return Promise.resolve(cached.value);
      if (pending.has(key)) return pending.get(key);
      const startedEpoch = epoch;
      const duration = method === 'writingFilterOptions' ? filterTtl : ttl;
      const promise = Promise.resolve().then(() => operation.apply(api, args)).then(value => {
        if (startedEpoch === epoch) {
          entries.delete(key);
          entries.set(key, { value, expires: now() + duration });
          while (entries.size > maxEntries) entries.delete(entries.keys().next().value);
        }
        return value;
      }).catch(error => {
        if (startedEpoch === epoch && [401, 403].includes(error.status)) clear('auth');
        throw error;
      }).finally(() => {
        if (pending.get(key) === promise) pending.delete(key);
      });
      pending.set(key, promise);
      return promise;
    };
  }
  return { api: wrapped, clear };
}
