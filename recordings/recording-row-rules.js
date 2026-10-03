// Chỉ video và placeholder đang chờ Zoom xử lý thuộc bảng recording.
function shouldShowRecordingRow(record) {
  return record?.kind !== 'session' && !String(record?.id || '').startsWith('session:')
    && (!record.type || record.type === 'MP4');
}

function canRefreshRecordingFile(record) {
  return record?.kind === 'recording' && ['Zoom 26', 'Zoom 47', 'Zoom 55'].includes(record.source)
    && record.account === record.source
    && record.status === 'processing' && !record.type && !record.fileSize && !record.videoId
    && !record.excluded && !record.manualDecision && !record.manualPublish
    && (!record.youtubeStatus || record.youtubeStatus === 'not_started')
    && record.reviewStatus !== 'approved' && Boolean(record.meetingUuid);
}
