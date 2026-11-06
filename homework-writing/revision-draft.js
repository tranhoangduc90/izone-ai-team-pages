// Chỉ dùng bài nộp bất biến làm điểm bắt đầu; không lấy câu AI/GV viết thay.
export function initialRevisionText(state) {
  if(state.revisionEditable)return state.revisionDraft.text.trim()?state.revisionDraft.text:state.revision?.text??state.submission?.text??'';
  return state.revision?.text ?? (state.revisionDraft.text.trim() ? state.revisionDraft.text : state.submission?.text || '');
}

export function shouldRestoreRevisionBackup(state,backup) {
  // Dự phòng rỗng của bản cũ chưa chứng minh HV đã bắt đầu sửa. Không để
  // bản đó che bài nộp khi nháp máy chủ cũng chỉ là khoảng trắng.
  // Bản mới đánh dấu phiên bản để giữ thao tác chủ động xóa trong lượt sửa.
  return !!backup && (!!backup.text.trim() || !!state.revisionDraft.text.trim() || backup.revisionPrefillVersion === 2);
}
