# Hợp đồng API frontend

Các module trong thư mục này mô tả contract thủ công theo `TECH_SPEC.md` mục 4, 7 và controller/DTO backend hiện tại. BE dev cung cấp OpenAPI tại `/v3/api-docs`. Khi BE thay đổi, đối chiếu endpoint, phương thức, header, nullability và kiểu response/SSE với tài liệu, code controller/DTO và OpenAPI; cập nhật `types.ts`, module tương ứng, unit test và kiểm thử BE thật. OpenAPI không mô tả đầy đủ payload SSE nên phải đối chiếu `ChatStreamService`, `ConversationService` và `RagAnswerEngine`. Các kiểu là compile-time, không xác thực schema JSON runtime.

- Tất cả request cùng origin `/api/v1` qua Vite proxy hoặc rewrite khi deploy; Bearer do caller truyền, không lưu token. CSRF trả từ BE được caller cung cấp cho từng POST auth; refresh/logout không cần Bearer. Việc bootstrap, phối hợp refresh nhiều tab và logout của UI thuộc Phase 04.
- Request thường giới hạn 75 giây kể cả đọc JSON để có thể chờ backend cold start; có thể điều chỉnh hoặc hủy bằng `AbortSignal`. Với SSE, giới hạn áp dụng đến khi nhận HTTP response, không giới hạn thời gian đọc stream. Stream trả về `ReadableStream`; consumer phải hủy signal/reader khi không còn sử dụng. Parser, heartbeat, đối soát lịch sử và kết thúc stream thuộc Phase 07.
- Mã lỗi và requestId được giữ trong `ApiError`; thông báo hiển thị được ánh xạ nội bộ, không dùng `detail` thô. `Retry-After`, generationId và assistantMessageId được giữ để các phase sau xử lý. Hủy chủ động trả `AbortError`.
- Query keys bắt đầu bằng userId, không chứa token; stale time 30 giây; query chỉ retry một lần cho lỗi mạng, timeout hoặc 5xx; mutation không tự retry. Sau upload/xóa nên gọi `invalidateUserData.documents`, sau tạo/xóa hội thoại gọi `invalidateUserData.conversations`, sau generation thay đổi usage gọi `invalidateUserData.usage`. Khi logout/đổi phiên phải hủy stream riêng và gọi `clearSessionCache` trước khi hiển thị tài khoản khác. Việc kết nối các callback vào UI thuộc các phase tương ứng.
- `Source.sourceId` là ID gốc `S1`, dùng nhãn `[S1]`; phải tra bằng cặp messageId/sourceId, không thay bằng vị trí mảng.

## Kiểm thử với BE thật

Chạy `npm run test:e2e:phase03`. Harness yêu cầu Docker container `local_postgres`, Java 21, Chrome và JAR backend đã build tại `../documind-backend/target/documind-backend-0.0.1-SNAPSHOT.jar`. Harness tự tạo database tên ngẫu nhiên, thư mục tạm, backend và Vite trên các cổng local riêng; nó khóa tắt Gemini, chat provider, ingestion pipeline và worker, đồng thời kiểm tra dấu nhận diện Vite trước khi chạy test. Sau khi chạy, harness dừng tiến trình và xóa database, thư mục do chính nó tạo. Chạy Playwright trực tiếp sẽ bỏ qua các test này nếu không có môi trường của harness.

Chưa xác minh 503 từ BE thật, nguồn history/SSE có citation và luồng AI thật. Không chủ động tạo lỗi provider hay bật Gemini. Không giả định upload quá giới hạn luôn nhận 413: khi vượt cả giới hạn request, proxy/kết nối có thể bị ngắt trước khi browser nhận response.

Các test dùng response tĩnh chỉ kiểm tra hàm xử lý dữ liệu thuần; transport được kiểm tra với BE thật. Timeout lúc chờ response hoặc đọc JSON chưa được tái hiện qua BE thật trong bộ test hiện tại.
