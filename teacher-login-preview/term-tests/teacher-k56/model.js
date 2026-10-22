export function getAverageBand(result) {
  if (typeof result?.summary?.averageBand === 'number' && Number.isFinite(result.summary.averageBand)) {
    return result.summary.averageBand;
  }
  const bands = [result?.listening?.band, result?.reading?.band];
  return bands.every(band => typeof band === 'number' && Number.isFinite(band))
    ? (bands[0] + bands[1]) / 2
    : null;
}

export function formatBand(value, decimals = 1) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(decimals) : '—';
}

export function summarizeStudents(students, scoreMode = 'band') {
  const completed = (students || []).filter(student => student.status === 'completed' && student.result);
  const average = values => values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
  return {
    total: (students || []).length,
    completed: completed.length,
    writingReady: (students || []).filter(student => student.writing?.status === 'ready').length,
    writingProcessing: (students || []).filter(student => student.writing?.status === 'processing').length,
    writingReviewRequired: (students || []).filter(student => student.writing?.status === 'review_required').length,
    listeningAverage: average(completed.map(student => scoreMode === 'raw'
      ? student.result.listening?.correct
      : student.result.listening?.band).filter(Number.isFinite)),
    readingAverage: average(completed.map(student => scoreMode === 'raw'
      ? student.result.reading?.correct
      : student.result.reading?.band).filter(Number.isFinite)),
    overallAverage: average(completed.map(student => scoreMode === 'raw'
      ? student.result.summary?.totalCorrect
      : getAverageBand(student.result)).filter(Number.isFinite))
  };
}

export function writingStatusLabel(status) {
  return {
    ready: 'Đã chấm xong',
    processing: 'Đang chấm',
    review_required: 'Cần kiểm tra',
    not_submitted: 'Chưa nộp Writing'
  }[status] || 'Chưa có trạng thái';
}

export function writingTaskStateLabel(status) {
  return {
    complete: 'xong',
    grading: 'đang chấm',
    queued: 'đang chờ',
    retry_wait: 'đang thử lại',
    review_required: 'cần kiểm tra',
    failed: 'lỗi',
    not_submitted: 'chưa nộp'
  }[status] || 'đang chờ';
}

export function statusLabel(status) {
  return {
    completed: 'Đã hoàn thành',
    incomplete: 'Chưa hoàn thành',
    not_started: 'Chưa nộp'
  }[status] || 'Chưa xác định';
}
