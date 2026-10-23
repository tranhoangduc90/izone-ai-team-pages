# Checklist bố cục K67 và đối chiếu bản sửa K56

120 điểm · ngày 23/10/2026 · phạm vi đã chỉnh theo lời làm rõ mới nhất của Linh.

**Checklist này chỉ về bố cục. Không lấy màu sắc hoặc font chữ K67 để áp sang K56. Không thêm các chức năng riêng K67.** K56 tiếp tục font/màu #170 đã chốt và các chức năng hiện có. Ưu tiên giữ cấu trúc tổ chức đề K56 cũ khi khác với K67.

## Nguồn và cách đọc

K67: các entry production; `design-demo/skin.css`, `design-demo/presentation.js`, `design-full/native.css`, `k67-design/appearance.css`, `k67-design/appearance.js`, `reading-landing.css`. K56 gốc: source trước redesign tại `bfa6dac77c77785bab67865dfd5b83266baac55d`, CSS renderer/content/layout-updates/ba adapter.

Khảo sát K67 trong lượt này dựa trên mã bố cục production và tài liệu kế thừa; không tuyên bố đã đi hết UI K67. Ảnh kiểm là chính K56 với dữ liệu giả.

Mức bằng chứng được ghi từng dòng: đối chiếu mã; xem render K56; ca browser; khác biệt giữ có chủ đích; hoặc chưa đủ bằng chứng. Ca browser chỉ được ghi đạt sau đọc log thực chạy. Font/màu vẫn có bộ kiểm K56 riêng, không nằm trong checklist bố cục này.

## A. Nguồn và nguyên tắc bố cục

| ID | Điểm đối chiếu bố cục | K56 cần giữ/kiểm cụ thể | Kết quả/mức bằng chứng |
|---|---|---|---|
| A01 | Đọc đúng các lớp layout K67 production | Entry → skin/theme/native/appearance; không dùng host demo | Đã đối chiếu mã bố cục |
| A02 | Phân biệt khung trang với cách tổ chức đề | Học tỷ lệ diện tích, nhịp vùng và độ gọn; giữ renderer đề K56 | Đã đối chiếu mã bố cục |
| A03 | Không dùng một màn để đại diện toàn bộ hệ thống | Tách landing, lobby, Listening, Reading, Writing, phiếu, kết quả, GV | Đã xem render K56 |
| A04 | Khu vực không dùng ở K56 không nhận ô giữ chỗ từ mẫu | Không thêm cột/panel trống vào vùng đề K56 | Đã đối chiếu mã bố cục |
| A05 | Vị trí các vùng ổn định khi thay trạng thái hiển thị | Giữ thứ tự DOM và các vùng nội dung hiện có của K56 | Đã đối chiếu mã bố cục |
| A06 | Luồng cũ là mốc cho tổ chức đề K56 | So với source trước redesign ở bfa6dac; ghi riêng ngoại lệ có chủ đích | Đã đối chiếu mã bố cục |

## B. Khung trang và diện tích làm bài

| ID | Điểm đối chiếu bố cục | K56 cần giữ/kiểm cụ thể | Kết quả/mức bằng chứng |
|---|---|---|---|
| B01 | Header không chiếm vai trò vùng nội dung chính | Giảm chiều cao/nhịp header; phần đề nhận diện tích lớn hơn | Đã xem render K56 |
| B02 | Logo, tên bài, nhận diện cùng một dải trên desktop | Giữ trong topbar, không thêm một hero phía trên | Đã xem render K56 |
| B03 | Tên người/lớp dài không đẩy header ra ngoài khung | Header wrap, cột min-width 0; ảnh tên dài | Có ca browser kiểm vị trí/reflow |
| B04 | Mép vùng đề và thanh công cụ được canh nhất quán | Page-shell và form cùng trục, lề desktop 16 px mỗi bên | Đã xem render K56 |
| B05 | Màn đang làm bài dùng chiều cao còn lại của laptop | Khung desktop flex theo viewport, không min-height làm cắt thanh dưới | Có ca browser kiểm vị trí/reflow |
| B06 | Nội dung vẫn cuộn trong đúng vùng hiện có | Giữ pane Reading và vùng đề/editor Writing gốc | Có ca browser kiểm vị trí/reflow |
| B07 | Không để khoảng trống giữ chỗ cho vùng đã không dùng | Không tạo panel nhận xét trống trong lúc thi | Đã đối chiếu mã bố cục |
| B08 | Không dùng khung thi cố định cho dashboard GV | Quy tắc chiều cao chỉ bật ở body.cbt-mode khi đang làm | Có ca browser kiểm vị trí/reflow |

## C. Trang chính và chọn bài

| ID | Điểm đối chiếu bố cục | K56 cần giữ/kiểm cụ thể | Kết quả/mức bằng chứng |
|---|---|---|---|
| C01 | Khung chọn bài cân đối trên laptop | Card tối đa 820 px, không kéo biểu mẫu đến toàn chiều rộng | Đã xem render K56 |
| C02 | Tên trang, mô tả, đăng nhập và lớp có thứ tự rõ | Giữ thứ tự DOM cũ, không tạo bước phụ | Đã xem render K56 |
| C03 | Khối đăng nhập không lấn át lựa chọn bài | Thu padding, nội dung trạng thái ở ngay vùng đăng nhập | Đã xem render K56 |
| C04 | Ô chọn lớp ở trước thứ tự và bài thi | Giữ input/select cùng nhãn, demo nằm trong bộ chọn lớp | Có ca browser kiểm vị trí/reflow |
| C05 | Hai lựa chọn thứ tự nằm cùng một hàng desktop | Giữ fieldset, không đưa từng lựa chọn ra màn khác | Đã xem render K56 |
| C06 | Ba bài chính cùng cấp và thẳng hàng | Ba cột desktop, một cột màn hẹp; nhãn dài không tràn | Có ca browser kiểm vị trí/reflow |
| C07 | Audio Backup là một nhóm hỗ trợ riêng | Giữ ba nút đúng nhóm và thứ tự cũ | Có ca browser kiểm vị trí/reflow |
| C08 | Phiếu dự phòng là một nhóm riêng sau audio | Giữ ba đích phiếu, không trộn vào nhóm bài trên máy | Có ca browser kiểm vị trí/reflow |
| C09 | Hành động xem kết quả ở cuối nhóm nghiệp vụ | Không di chuyển vào mỗi card bài hoặc tạo đường mới | Đã xem render K56 |
| C10 | Không lặp phần mở lớp demo ở cuối trang | Xóa card/link demo cuối trang; giữ demo trong chọn lớp trên | Có ca browser kiểm vị trí/reflow |

## D. Nhận diện và phòng chờ

| ID | Điểm đối chiếu bố cục | K56 cần giữ/kiểm cụ thể | Kết quả/mức bằng chứng |
|---|---|---|---|
| D01 | Thông tin bài → người làm → chuẩn bị có trình tự nhìn | Giữ trình tự gốc K56, không thay thành nhiều màn mới | Đã đối chiếu mã bố cục |
| D02 | Vùng tên/lớp đủ chỗ cho tên dài | Giữ control trong khung, không đè nhãn hoặc nút | Có ca browser kiểm vị trí/reflow |
| D03 | Các bước chuẩn bị có bố cục ngang ở desktop theo source cũ | Gỡ ép tất cả thành một cột từ redesign trước | Đã đối chiếu mã bố cục |
| D04 | Màn hẹp dùng cách xếp bước cũ | Để breakpoint của CSS lobby K56 quyết định, không sao bước K67 | Đã đối chiếu mã bố cục |
| D05 | Hướng dẫn ở gần thao tác cần dùng | Không chuyển nội dung nghe thử/tải/bắt đầu sang vùng xa | Đã xem render K56 |
| D06 | Trạng thái tải nằm gần thanh tải và nút tương ứng | Giữ status/progress gốc, không thêm card trạng thái riêng | Đã đối chiếu mã bố cục |
| D07 | Nút bắt đầu không bị đẩy khỏi khung bởi nội dung dài | Kiểm control hiện đủ trong ca qua phòng chờ | Có ca browser kiểm vị trí/reflow |
| D08 | Hộp xác nhận giữ đủ thông tin và nút ở màn hẹp | Giữ cấu trúc dialog do bootstrap dựng | Đã đối chiếu mã bố cục |

## E. Toolbar và điều hướng

| ID | Điểm đối chiếu bố cục | K56 cần giữ/kiểm cụ thể | Kết quả/mức bằng chứng |
|---|---|---|---|
| E01 | Tiêu đề kỹ năng, trạng thái và nút nộp cùng nhóm | Giữ nhóm cũ; giảm padding để ưu tiên vùng đề | Đã xem render K56 |
| E02 | Part/Passage tách với hành động nộp | Giữ đúng toolbar-controls, không di chuyển node | Đã đối chiếu mã bố cục |
| E03 | Công cụ cỡ chữ và Notes có vùng ổn định | Giữ ngay toolbar cũ, không dựng menu mới | Đã xem render K56 |
| E04 | K67 có toolbar một hàng nhưng K56 không bắt buộc sao | Giữ hàng/cụm gốc K56, chỉ làm gọn không gian | Giữ khác biệt K56 có chủ đích |
| E05 | K67 đã bỏ thanh bước, K56 vẫn có thanh bước cũ | Không ẩn hoặc xóa thanh bước K56 theo mẫu K67 | Giữ khác biệt K56 có chủ đích |
| E06 | Thanh số câu nằm sau vùng làm bài | Không đưa sang sidebar hoặc nhân đôi điều hướng | Có ca browser kiểm vị trí/reflow |
| E07 | Thanh số câu không bị cắt ở đáy laptop | Assert Reading form bottom ≤ viewport ở 1366×768/1280×720 | Có ca browser kiểm vị trí/reflow |
| E08 | Màn hẹp có chỗ wrap cho công cụ và nút nộp | Không tràn cả trang hoặc đè công cụ lên nội dung | Có ca browser kiểm vị trí/reflow |

## F. Listening: tổ chức đề

| ID | Điểm đối chiếu bố cục | K56 cần giữ/kiểm cụ thể | Kết quả/mức bằng chứng |
|---|---|---|---|
| F01 | Nội dung Part giữ nguyên thứ tự | Không chuyển hoặc bọc lại nhóm trong semantic content | Đã đối chiếu mã bố cục |
| F02 | Nhãn nhóm ở trước hướng dẫn và phần trả lời | Giữ heading node hiện có; kiểm vị trí trước paragraph hướng dẫn | Có ca browser kiểm vị trí/reflow |
| F03 | Tên nội dung đứng dưới nhãn nhóm khi đề có tên | Giữ h3/h4 và instruction đúng thứ tự source | Đã xem render K56 |
| F04 | Notes/form không biến thành dãy card chung | Giữ table/form/notes/summary đúng cấu trúc từng đề | Đã đối chiếu mã bố cục |
| F05 | Bank đáp án và câu tương ứng ở đúng hai bên cũ | Không đổi .k56-side-layout/.k56-answers-left | Đã đối chiếu mã bố cục |
| F06 | Bản đồ và ô trả lời ở đúng khu vực gốc | Giữ .k56-map-layout và markup ảnh hiện hành | Đã đối chiếu mã bố cục |
| F07 | Một câu có hai ô vẫn ở cùng câu | Term 1 Q32 giữ hai slot và một số điều hướng | Có ca browser kiểm vị trí/reflow |
| F08 | Khoảng cách trong câu không tách số khỏi ô nhập | Giữ answer-control và inline-answer hiện có | Đã xem render K56 |
| F09 | Audio K67 được gom nhưng không chuyển audio K56 | Giữ card/audio/volume tại vùng cũ, không thêm control K67 | Giữ khác biệt K56 có chủ đích |
| F10 | Mỗi Part đọc được ở desktop và màn hẹp | Đi tất cả Part ở 1366/390/320, kiểm không tràn trang | Có ca browser kiểm vị trí/reflow |

## G. Reading: bài đọc và câu hỏi

| ID | Điểm đối chiếu bố cục | K56 cần giữ/kiểm cụ thể | Kết quả/mức bằng chứng |
|---|---|---|---|
| G01 | Bài đọc trái, câu hỏi phải trên desktop | Khôi phục hai cột bằng nhau 50/50 của K56 gốc | Có ca browser kiểm vị trí/reflow |
| G02 | Bài đọc và câu hỏi không tranh một vùng cuộn | Giữ hai pane gốc có overflow riêng | Có ca browser kiểm vị trí/reflow |
| G03 | Tiêu đề Passage gắn với bài đọc | Giữ header trong pane, không tách ra hero toàn trang | Đã xem render K56 |
| G04 | Đầu bài đọc và câu hỏi có canh hàng hợp lý | Không thêm vùng điều khiển chen giữa hai pane | Đã xem render K56 |
| G05 | Đoạn dài nằm trọn trong chiều rộng pane | Giữ lề/padding đọc, căn hai lề theo yêu cầu riêng K56 | Đã xem render K56 |
| G06 | Ảnh/bảng trong passage không bị khung trang cắt | Không thay node nội dung hoặc ép crop mới | Đã đối chiếu mã bố cục |
| G07 | Hướng dẫn nhóm nằm ngay trước câu tương ứng | Giữ phạm vi nhóm, không gom hướng dẫn sang panel khác | Có ca browser kiểm vị trí/reflow |
| G08 | Bank heading giữ đúng vị trí so với đáp án | Giữ các container và thứ tự cũ của đề | Đã đối chiếu mã bố cục |
| G09 | Số câu không rời stem và control khi xuống dòng | Đối chiếu reflow câu dài, không thay node form | Có ca browser kiểm vị trí/reflow |
| G10 | Mobile K56 hiện bài đọc trên và câu hỏi dưới | Giữ cả hai cùng hiện, cuộn riêng theo layout cũ | Có ca browser kiểm vị trí/reflow |
| G11 | Không sao nút đổi vùng Reading của K67 | Xóa switch mới khỏi presentation K56; không thêm bước tương tác | Giữ khác biệt K56 có chủ đích |
| G12 | Qua breakpoint vẫn là cùng đáp án đang làm | Kiểm cùng node/value ở 981/980/979/801/800/799/390/320/844 | Có ca browser kiểm vị trí/reflow |

## H. Nhóm câu hỏi và nội dung dài

| ID | Điểm đối chiếu bố cục | K56 cần giữ/kiểm cụ thể | Kết quả/mức bằng chứng |
|---|---|---|---|
| H01 | Nhóm câu hỏi có một đầu nhóm rõ | Dùng heading có sẵn, không tạo wrapper mới quanh đề | Đã đối chiếu mã bố cục |
| H02 | Hướng dẫn nằm giữa đầu nhóm và câu đầu tiên | Kiểm vị trí nhìn thấy và thứ tự DOM | Có ca browser kiểm vị trí/reflow |
| H03 | Câu trắc nghiệm có stem trước lựa chọn | Giữ cấu trúc radio/label, không xếp lại option | Đã đối chiếu mã bố cục |
| H04 | Các option dài xuống dòng trong vùng của mình | Không đè radio, nhãn hoặc cờ ở 320 px | Có ca browser kiểm vị trí/reflow |
| H05 | Câu điền chỗ trống giữ ô trong câu hoặc dòng đúng chỗ | Không chuyển tất cả ô ra bảng phụ | Đã đối chiếu mã bố cục |
| H06 | Bảng giữ hàng/cột và nhãn liên quan | Không đổi table thành card vì màn hẹp | Đã đối chiếu mã bố cục |
| H07 | Matching giữ bank riêng và danh sách câu riêng | Giữ cách chia khung trong layout-updates.css | Đã đối chiếu mã bố cục |
| H08 | Nhóm nhiều đáp án vẫn là một nhóm chung | Giữ bố cục và input group Reading Q24–26 Term 2 | Đã đối chiếu mã bố cục |
| H09 | Hình, caption và bộ câu đi cùng nhau | Không đưa ảnh sang modal mới hoặc tách khỏi nhóm | Đã đối chiếu mã bố cục |
| H10 | Không nhân bản nội dung khi đổi viewport | Không render lại controls hoặc text annotation | Có ca browser kiểm vị trí/reflow |

## I. Writing: đề, dàn ý và bài làm

| ID | Điểm đối chiếu bố cục | K56 cần giữ/kiểm cụ thể | Kết quả/mức bằng chứng |
|---|---|---|---|
| I01 | Đề bên trái, bài viết bên phải trên desktop | Giữ hai pane và separator gốc | Có ca browser kiểm vị trí/reflow |
| I02 | Tỷ lệ mỗi đề được giữ theo cấu hình cũ | Term 1 44%, Term 2/Mini 50% khi chưa có preference | Có ca browser kiểm vị trí/reflow |
| I03 | Preference cũ vẫn quyết định tỷ lệ khi có | Không đặt mọi bài thành default 1/3 mới | Đã đối chiếu mã bố cục |
| I04 | Đầu vùng đề và đầu vùng bài viết cùng hàng | Giữ pane-header ở đầu từng pane | Đã xem render K56 |
| I05 | Hướng dẫn và ảnh ở trong vùng đề | Không đưa lên trước toàn bộ editor hoặc sang tab mới | Đã xem render K56 |
| I06 | Dàn ý ở đúng vị trí cũ trong vùng đề | Không tạo một cột dàn ý mới | Đã xem render K56 |
| I07 | Editor là vùng làm việc ổn định | Cùng node editor khi thay kích thước, không dựng lại form | Có ca browser kiểm vị trí/reflow |
| I08 | Số từ và trạng thái lưu nằm cạnh editor | Giữ meta/footer trong answer-pane, không cắt ở đáy | Có ca browser kiểm vị trí/reflow |
| I09 | Khung Writing vừa laptop 1366×768/1280×720 | Assert form/footer nằm trong viewport desktop | Có ca browser kiểm vị trí/reflow |
| I10 | Mobile giữ đề trên, bài viết dưới | Giữ breakpoint620 và thứ tự gốc, không sao tab chuyển vùng K67 | Có ca browser kiểm vị trí/reflow |
| I11 | Ảnh đề giữ tỉ lệ và đọc được đầy đủ khi cuộn | Không crop để vừa card; giữ cuộn vùng đề | Đã xem render K56 |
| I12 | Khi xuất hiện hai bản xung đột dài, vẫn có đủ chỗ đọc/chọn | Đã tái hiện nút bị cắt, sửa chiều cao trạng thái lỗi; kiểm ba bài tại 1366/1280/390 bằng preview giao diện giả | Có ca browser kiểm vị trí/reflow |

## J. Phiếu đáp án

| ID | Điểm đối chiếu bố cục | K56 cần giữ/kiểm cụ thể | Kết quả/mức bằng chứng |
|---|---|---|---|
| J01 | Desktop có hai cột đầy chiều rộng vùng phiếu | Giữ grid hai cột K56, không lấy tỷ lệ Reading áp vào phiếu | Có ca browser kiểm vị trí/reflow |
| J02 | Câu đi từ trên xuống theo cột như bản gốc | Khôi phục grid-auto-flow column và question-rows | Có ca browser kiểm vị trí/reflow |
| J03 | Số câu và control cùng một hàng trong ô | Giữ .question và control gốc | Có ca browser kiểm vị trí/reflow |
| J04 | Hai cột có độ rộng bằng nhau ở 701–800 px | Thêm assertion, không để sinh cột implicit auto | Có ca browser kiểm vị trí/reflow |
| J05 | Chỉ chuyển một cột tại breakpoint700 của phiếu | Kiểm 801/800/799/701/700/699 | Có ca browser kiểm vị trí/reflow |
| J06 | Khi một cột, bỏ số hàng cố định của grid | grid-template-rows none, flow row để không sinh cột ngầm | Có ca browser kiểm vị trí/reflow |
| J07 | Ô chọn dài không làm toàn trang tràn ngang | Kiểm 390/320 và cả hai thứ tự của ba phiếu | Có ca browser kiểm vị trí/reflow |
| J08 | Nhóm kỹ năng, hướng dẫn và nộp giữ thứ tự gốc | Không chuyển bố cục CBT sang phiếu | Đã đối chiếu mã bố cục |

## K. Kết quả và xem bài

| ID | Điểm đối chiếu bố cục | K56 cần giữ/kiểm cụ thể | Kết quả/mức bằng chứng |
|---|---|---|---|
| K01 | Trạng thái/điểm trước phần nhận xét dài | Giữ thứ tự các section gốc của K56 | Đã xem render K56 |
| K02 | Hai nhóm điểm nằm trong vùng kết quả ổn định | Không đổi sang dashboard nhiều card phụ | Đã xem render K56 |
| K03 | Bảng chi tiết đủ chiều rộng hoặc có vùng cuộn | Không ẩn cột để vừa màn | Đã xem render K56 |
| K04 | Bài viết dài và ảnh đề có vùng đọc đầy đủ | Giữ các vùng source/essay hiện hành | Đã xem render K56 |
| K05 | Nhận xét không làm thay vị trí phần bài đã nộp | Giữ tổ chức dialog/section của module xem bài | Đã đối chiếu mã bố cục |
| K06 | Đường quay lại không mất vùng vừa xem | Giữ nút/owner hiện có, không thêm luồng tra cứu K67 | Đã đối chiếu mã bố cục |

## L. Giảng viên

| ID | Điểm đối chiếu bố cục | K56 cần giữ/kiểm cụ thể | Kết quả/mức bằng chứng |
|---|---|---|---|
| L01 | Bộ lọc lớp/bài ở ngay trước dữ liệu | Giữ toolbar gốc, không đưa sang sidebar mới | Đã xem render K56 |
| L02 | Tổng quan không đẩy bảng xuống quá xa | Giữ số liệu nhưng thu nhịp summary | Đã xem render K56 |
| L03 | Bảng là vùng chính để đối chiếu học viên | Không đổi danh sách thành nhiều card rời | Đã xem render K56 |
| L04 | Tên dài không đè trạng thái hoặc nút mở | Ảnh fixture tên dài, table-wrapper giữ cuộn cần thiết | Có ca browser kiểm vị trí/reflow |
| L05 | Tab học viên và tổng quan còn ở vị trí cũ | Không sao navigation riêng của K67 | Đã đối chiếu mã bố cục |
| L06 | Chi tiết bài đủ rộng cho passage/câu hỏi/ảnh | Giữ module xem toàn bài K56 hiện hành | Có ca browser kiểm vị trí/reflow |
| L07 | Bản lưu và toàn bài vẫn là các vùng riêng hiện có | Không gộp thành công cụ mới | Có ca browser kiểm vị trí/reflow |
| L08 | Màn hẹp không nhận khung thi cố định của học viên | Kiểm teacher mobile và selector scope | Có ca browser kiểm vị trí/reflow |

## M. Dialog và lớp phủ

| ID | Điểm đối chiếu bố cục | K56 cần giữ/kiểm cụ thể | Kết quả/mức bằng chứng |
|---|---|---|---|
| M01 | Dialog có khoảng cách với mép viewport | Giữ vùng đọc và thanh đầu trong kích thước màn | Đã xem render K56 |
| M02 | Tiêu đề và nút đóng không đè nhau | Nút đóng giữ vị trí cũ, tên dài được wrap | Đã xem render K56 |
| M03 | Nội dung dài cuộn trong vùng dialog | Không cắt essay/nhận xét hoặc buộc toàn trang tràn ngang | Đã xem render K56 |
| M04 | Hai vùng đối chiếu vẫn theo cấu trúc hiện có | Không áp tỷ lệ popup38/62 của sản phẩm khác | Đã đối chiếu mã bố cục |
| M05 | Màn hẹp các vùng xếp theo thứ tự cũ | Ảnh teacher mobile; không thêm tab hoặc bước mới | Có ca browser kiểm vị trí/reflow |
| M06 | Trạng thái đang xem không che thao tác thoát | Giữ các control hiện có trong khung nhìn | Có ca browser kiểm vị trí/reflow |

## N. Biên bố cục và mức bằng chứng

| ID | Điểm đối chiếu bố cục | K56 cần giữ/kiểm cụ thể | Kết quả/mức bằng chứng |
|---|---|---|---|
| N01 | Laptop kiểm hai kích thước thường dùng | 1366×768 và1280×720: Reading/Writing không cắt thanh dưới | Có ca browser kiểm vị trí/reflow |
| N02 | Màn hẹp và ngang kiểm độc lập | 390×844,320 CSSpx,844×390 không tràn toàn trang | Có ca browser kiểm vị trí/reflow |
| N03 | Biên chia Reading dùng mốc gốc980 | Kiểm979/980/981, không coi800 là bước đổi vùng mới | Có ca browser kiểm vị trí/reflow |
| N04 | Biên Writing dùng mốc gốc620 | Kiểm619/620/621, editor còn cùng node | Có ca browser kiểm vị trí/reflow |
| N05 | Biên phiếu dùng mốc700 | Kiểm699/700/701 và khoảng701–800 | Có ca browser kiểm vị trí/reflow |
| N06 | Zoom200% thật có thể đổi diện tích nhìn/độ xuống dòng | Chưa kiểm browser zoom thật; không đánh đồng với viewport nhỏ | Chưa đủ bằng chứng |
| N07 | Thiết bị vật lý có bàn phím/chiều cao khả dụng khác | Chưa kiểm thiết bị vật lý; ảnh là browser mô phỏng | Chưa đủ bằng chứng |
| N08 | Mỗi kết luận có phạm vi rõ | Mã khác ảnh, fixture khác vận hành thật; không gọi toàn bộ đạt từ tổng test | Đã đối chiếu mã bố cục |

## Biên nhận và giới hạn

Bộ kiểm bố cục gốc: `tests/k56-original-layout-browser.mjs` — Reading 50/50, cả hai pane mobile cùng hiện theo thứ tự, phiếu theo cột/breakpoint700, Writing default44/50/50. Cùng test RED trên bản đã phát hành trước sửa (`original-layout-red.log`).

Bộ UI K56: `tests/k56-master170-browser.mjs`, `tests/k56-master170-entry-teacher.mjs`; scope cache giữ riêng. Log và ảnh ở gói evidence hiện hành. Biên nhận cuối được liệt kê ngay bên dưới; không gọi một lần chạy 57/57 nếu chưa có một log như vậy.

Rà độc lập đã phát hiện và xác minh sửa rule phiếu 701–800 px. Phần badge Questions được trả về vai trò chữ của K56; checklist không dùng cỡ chữ hoặc màu K67 làm tiêu chí. Reviewer chỉ đọc source, không mở browser.

Hai khoảng trống bố cục còn ghi riêng: zoom 200% thật và thiết bị vật lý. Writing conflict dài đã kiểm fixture hình thức, chưa kiểm xử lý revision thật. Audit nghiệp vụ rộng trước đó còn 63/450 ca lỗi, không nằm trong checklist bố cục và không được coi đã xử lý. Chưa phát hành bản sửa sau phản hồi.


## Kết quả đọc lại từng nhóm kiểm

| Biên nhận | Kết quả quan sát | Phạm vi |
|---|---|---|
| `revised-ui.log` | 54/54 đạt | Bản khôi phục cấu trúc ban đầu, trước chỉnh viewport/badge cuối |
| `revised-final-ui.log` | 53/54 đạt, 1 lỗi fixture | Ca kiểm demo yêu cầu select khi fixture đang đăng xuất; đã sửa fixture dùng phiên GV giả, không đổi app để làm xanh |
| `revised-focused-ui.log` | 22/22 đạt | Kiểm lại Reading/Listening, 12 kết quả đúng tổng câu, landing có demo ở bộ chọn lớp và không có card demo cuối, ba cấu trúc đề |
| `revised-layout-final.log` | 3/3 đạt | Theo yêu cầu chỉ tham chiếu bố cục: vị trí heading, Reading50/50, mobile hai pane cùng hiện, phiếu/breakpoint, Writing default gốc |
| `revised-render-final.log` | 6/6 đạt | Ảnh Reading/Listening sau chỉnh cuối; font/màu giữ bộ K56, không là tiêu chí sao K67 |
| `revised-conflict-red.log` | 3/3 bắt được nút bị cắt | Fixture chỉ hình thức: panel thật và preview hai bài dài/dàn ý; không giả nghiệp vụ lưu |
| `revised-writing-final.log` | 6/6 đạt | Ba Writing bình thường và ba Writing có đối chiếu dài, sau sửa chiều cao theo trạng thái |

Bộ UI hiện có 57 ca (gồm 3 ca conflict mới). Các log được hợp theo phần source/thay đổi thực sự chịu ảnh hưởng; chưa có một lượt đầy đủ 57/57 trên snapshot cuối. Audit nghiệp vụ rộng còn khoảng trống đã báo; không dùng hợp kiểm giao diện để kết luận toàn sản phẩm đã được xác minh.
