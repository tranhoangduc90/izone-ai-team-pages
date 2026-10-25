import test from 'node:test';
import assert from 'node:assert/strict';
import {renderPracticeDefinitionHtml as render} from '../shared/teacher-practice-definition.js';

test('Bài authored: đủ câu ngoài phạm vi mẫu, phương án có nhãn và không dựng input/audio',()=>{
 const html=render({authored:true,passage:{A:'Passage giả'},groups:[{kind:'mcq',label:'Multiple Choice',instruction:'Choose one.',questions:[{n:31,text:'Câu mới <script>',options:[{value:'B',text:'Cổng bắc'}]}]},{kind:'completion',label:'Notes',instruction:'ONE WORD',questions:[{n:36,text:'Plant ___.'}]}]});
 for(const value of ['Câu 31','Câu 36','<b>B.</b> Cổng bắc','ONE WORD','Passage giả','&lt;script&gt;'])assert.ok(html.includes(value),value);
 assert.ok(!/<(?:input|audio|script)\b/.test(html));
});

test('Giữ nhãn headings, người, vế kết thúc và ngân hàng từ để đối chiếu đáp án ký tự',()=>{
 const html=render({headings:{i:'Một cách bắt đầu',ii:'Một cách kết thúc'},experts:{A:'Người giả A'},
  names:[{n:27,text:'Phát biểu giả'}],endings:[{n:34,text:'Đầu câu giả'}],endingOptions:{A:'vế một',B:'vế hai'},bank:{C:'từ giả'}});
 for(const text of ['i.</b> Một cách bắt đầu','ii.</b> Một cách kết thúc','A.</b> Người giả A','Câu 27','Câu 34','B.</b> vế hai','C.</b> từ giả'])assert.ok(html.includes(text),text);
});
test('Tóm tắt giữ vị trí từng chỗ trống và sơ đồ giữ số câu giữa hai vế',()=>{
 const html=render({summary:[{text:'Trước '},{question:24},{text:' sau.'}],flow:[[26,'Chọn cùng',' rồi đo.']]});
 assert.match(html,/Trước [\s\S]*Câu 24[\s\S]*_____.* sau\./);
 assert.match(html,/Chọn cùng [\s\S]*Câu 26[\s\S]*_____.* rồi đo\./);
});
test('Lựa chọn MCQ có A/B/C rõ ràng, không chỉ liệt kê nội dung',()=>{
 const html=render({mcq:[{n:21,text:'Câu hỏi giả',options:['Lựa chọn một','Lựa chọn hai','Lựa chọn ba']}]});
 for(const text of ['Câu 21','A.</b> Lựa chọn một','B.</b> Lựa chọn hai','C.</b> Lựa chọn ba'])assert.ok(html.includes(text));
});
test('Heading gắn đúng câu với đoạn khi danh sách câu xác minh khớp; không đoán khi thiếu dữ liệu',()=>{
 const definition={passage:{A:'Đoạn giả A',B:'Đoạn giả B'},headings:{i:'Tiêu đề giả'},mcq:[{n:16,text:'Câu giả',options:['Một']} ]};
 const html=render(definition,['16','15','14']);assert.ok(html.includes('Đoạn A · Câu 14'));assert.ok(html.includes('Đoạn B · Câu 15'));
 assert.ok(!render(definition,['14']).includes('Đoạn A · Câu'));
});
test('Không thực thi HTML hoặc tải audio/ảnh từ đề; không biến đối tượng thành [object Object]',()=>{
 const html=render({title:'<img src=x onerror=alert(1)>',passage:{A:'<script>bad</script>'},audio:{url:'https://audio.invalid/real.mp3'},bank:{A:'<audio src=x>'}});
 assert.ok(html.includes('&lt;img'));assert.ok(!/<(?:img|audio|script|iframe)\b/.test(html));assert.ok(!html.includes('https://audio.invalid'));assert.ok(!html.includes('[object Object]'));
});
