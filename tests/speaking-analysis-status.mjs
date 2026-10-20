import test from 'node:test';
import assert from 'node:assert/strict';
import { analysisStatus, analysisPending } from '../speaking-homework/analysis-status.js';

// Trạng thái lấy từ API; accepted độc lập với Doctor, lỗi hết retry không hứa đang chạy.
test('Phân tích dừng giữ công nhận và biên nhận, không hiện đang phân tích',()=>{
  const result=analysisStatus('review');
  assert.match(result.message,/Bài đã được nhận/);assert.match(result.message,/biên nhận vẫn được giữ/);
  assert.match(result.label,/kiểm lại/);assert.notEqual(result.tone,'loading');
});
test('Phân biệt thành công, đang xử lý, thử lại và chưa rõ',()=>{
  assert.equal(analysisStatus('done').tone,'pass');
  for(const status of ['pending','processing','queued','failed'])assert.equal(analysisStatus(status).tone,'loading');
  assert.match(analysisStatus('failed').message,/thử phân tích lại/);
  for(const status of [null,undefined,'future']) {
    assert.match(analysisStatus(status).message,/Chưa có kết quả/);
    assert.notEqual(analysisStatus(status).tone,'pass');
  }
});
test('Chờ Doctor sau nộp và lỗi còn retry; dừng hỏi khi cần kiểm lại hoặc đã xong',()=>{
  for(const s of ['pending','processing','failed'])assert.equal(analysisPending(s),true);
  for(const s of ['review','done',undefined])assert.equal(analysisPending(s),false);
});
