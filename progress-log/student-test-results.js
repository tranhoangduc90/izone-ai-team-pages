// Dữ liệu Test đã qua kiểm quyền: khử bản trùng và chọn mốc làm bài thật, không dùng ngày nhập Portal.
export function resultTime(result, skill) {
  const value = result?.[skill]?.completedAt || result?.completedAt;
  return typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/u.test(value)
    && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
}

export function studentTestRecords(records) {
  const unique = new Map();
  for (const result of records) {
    if (!result || typeof result !== 'object') continue;
    const key = result.testSlug || result.title;
    if (!key) continue;
    const prior = unique.get(key), time = resultTime(result), priorTime = resultTime(prior);
    if (!prior || time !== null && (priorTime === null || time > priorTime)) unique.set(key, result);
  }
  return [...unique.values()].sort((a, b) => (resultTime(b) ?? -Infinity) - (resultTime(a) ?? -Infinity)
    || String(a.title || a.testSlug).localeCompare(String(b.title || b.testSlug), 'vi'));
}

export function latestSkillTest(records, skill) {
  return studentTestRecords(records.filter(result => Number.isFinite(result?.[skill]?.correct)
    && Number.isFinite(result[skill]?.total) && result[skill].total > 0 && resultTime(result, skill) !== null))
    .sort((a, b) => resultTime(b, skill) - resultTime(a, skill))[0] || null;
}

export function safeWritingResultUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value, location.href);
    // Chỉ liên kết tới giao diện cùng origin. Token chỉ được giữ trong fragment.
    if (url.origin !== location.origin || !/^https?:$/u.test(url.protocol)
      || !url.pathname.includes('/term-tests/') || url.searchParams.has('attemptToken')) return null;
    return url.href;
  } catch { return null; }
}

export function writingResultLink(result,task,identity){
  if(!/^term-test-[1-9]\d*$/u.test(result?.testSlug||'')||!/^[0-9a-f]{64}$/u.test(result?.resultRef||'')||![1,2].includes(task))return null;
  const params={test:result.testSlug,result:result.resultRef,task:String(task)};
  if(identity?.accessToken)params.access=identity.accessToken;
  else if(/^[0-9a-f-]{36}$/iu.test(identity?.publicToken||'')&&/^[0-9a-f-]{36}$/iu.test(identity?.studentRef||'')){
    params.assignment=identity.publicToken;params.student=identity.studentRef;
  }else return null;
  const url=new URL('../term-tests/writing-result/',location.href);url.hash=new URLSearchParams(params);return url.href;
}
