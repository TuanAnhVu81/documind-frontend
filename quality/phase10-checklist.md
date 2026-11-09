# Kiểm tra giao diện Phase 10

Ngày kiểm tra: 09/11/2026. BE chạy với PostgreSQL và tài khoản demo trong database cách ly; Gemini và worker được tắt. Message có nguồn là dữ liệu demo được chèn vào database test, không phải câu trả lời AI thật. Các ảnh trong `.local/phase10-screenshots/` được tạo lại bằng `npm run test:e2e:phase10` và không được đưa lên Git.

| Nội dung | Kết quả |
| --- | --- |
| Tải tài liệu, thư viện, chi tiết, lỗi kết nối | Kiểm tra qua BE thật; ảnh 01–03 |
| Chat và panel nguồn trên desktop | Kiểm tra bằng message demo; ảnh 04–05 |
| Chat mobile và cài đặt dark mode | Kiểm tra ở 390 × 844; ảnh 06–07 |
| Responsive chat | Không tràn ngang ở độ rộng 320, 390, 768, 1024 và 1440 px; kiểm tra viewport 320 × 360 với câu hỏi dài và nút xử lý lỗi có thể cuộn tới |
| Bàn phím | Kiểm tra Tab trong dialog tài liệu, Escape và trả focus; mở/đóng panel nguồn bằng bàn phím; Enter xuống dòng và Ctrl+Enter gửi |
| Axe | Không có vi phạm được axe phát hiện trên chat mobile và trang cài đặt dark mode trong lượt chạy |
| Reduced motion | Kiểm tra nhận diện thiết lập hệ điều hành giả lập; CSS đã có quy tắc giảm animation và transition |
| Hiệu năng | E2E ghi CLS theo session window và DOMContentLoaded sau reload chat trong môi trường dev với dữ liệu demo; số đo được in ở mỗi lượt chạy, không phải Lighthouse hay cam kết hiệu năng production. Build tách các view bằng lazy import. |
| Streaming AI thật | Chưa kiểm tra và chưa có ảnh: cần chủ dự án cho phép gọi Gemini và kiểm tra quota trước |
| Screen reader và bàn phím điện thoại thật | Chưa smoke test bằng công cụ/thiết bị vật lý; kiểm tra tự động không thay thế được |

Các ảnh có thể chứa email của tài khoản demo ngẫu nhiên. Không dùng dữ liệu người dùng thật khi tạo lại.
