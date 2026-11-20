# DocuMind — Frontend

Giao diện hỏi đáp trên tài liệu cá nhân. Bạn có thể tải tài liệu lên, theo dõi quá trình xử lý và đặt câu hỏi. Câu trả lời hiện dần trong hội thoại, kèm trích dẫn để mở đoạn nguồn và tự đối chiếu.

**[Mở bản demo](https://documind-avt.vercel.app)** · **[Đăng ký](https://documind-avt.vercel.app/register)** · **[Mã nguồn backend](https://github.com/TuanAnhVu81/documind-backend)**

Backend demo chạy trên Render Free. Lần truy cập sau khi dịch vụ ngủ có thể mất thêm thời gian để kiểm tra phiên. Hãy thử bằng tài liệu giả lập hoặc tài liệu bạn có quyền chia sẻ.

## Trải nghiệm nhanh

1. Tạo tài khoản, nhập lại mật khẩu để xác nhận, rồi đăng nhập.
2. Vào **Tài liệu**, tải lên PDF, DOCX hoặc TXT và đợi tài liệu ở trạng thái `READY`.
3. Tạo hội thoại, chọn tài liệu cần hỏi hoặc dùng toàn bộ thư viện đã sẵn sàng.
4. Đặt câu hỏi, sau đó bấm vào trích dẫn như `[S1]` để xem tên tệp, vị trí và đoạn nguồn. Nếu tài liệu thiếu bằng chứng, DocuMind sẽ báo trong câu trả lời.

## Tính năng và công nghệ

| Tính năng | Cách triển khai |
| --- | --- |
| Tài khoản | Đăng ký và đăng nhập, giữ access token trong bộ nhớ, khôi phục phiên qua refresh cookie `HttpOnly` do backend cấp |
| Thư viện tài liệu | Tải lên, tìm trong danh sách, xem trạng thái xử lý và xóa tài liệu |
| Hội thoại | Nhận câu trả lời qua Server-Sent Events (SSE), xem lịch sử và mở trích dẫn ngay trong giao diện |
| Giao diện | React 19, TypeScript, Vite, React Router, Tailwind CSS và Radix UI |
| Dữ liệu và biểu mẫu | TanStack Query, React Hook Form và Zod |
| Kiểm thử | Vitest, Testing Library, Playwright và axe |

## Chạy local

Cần Node.js `>=24.15.0 <25` và [DocuMind Backend](https://github.com/TuanAnhVu81/documind-backend) đang chạy. Trong thư mục frontend, chạy:

```powershell
npm ci
npm run dev
```

Mở [localhost:5173](http://localhost:5173). Vite mặc định chuyển `/api/v1/*` và `/actuator/health` đến `http://localhost:8080`. Nếu backend chạy ở cổng khác, sao chép `.env.example` thành `.env` và chỉnh `BACKEND_PROXY_TARGET`. `AUTH_ALLOWED_ORIGINS` ở backend phải chứa đúng origin của frontend local.

`src/pages/` chứa các màn hình cấp route, `src/features/` chứa logic theo tính năng và `src/api/` tập trung các lời gọi backend. Chi tiết về lỗi API, SSE và cache nằm trong [tài liệu API frontend](src/api/README.md).

## Kiểm thử và triển khai

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
```

`npm run test:e2e:phase04` kiểm thử luồng tài khoản trên backend local cách ly. Harness cần Java 21, Chrome, container `local_postgres` có pgvector và JAR backend đã build trong `../documind-backend/target/`. Harness tắt Gemini trong lúc chạy.

Trên Vercel, dùng preset **Vite**, Node.js **24.x**, thư mục đầu ra `dist`. Browser gọi API cùng origin và [vercel.json](vercel.json) chuyển các request API và health check sang Render. Khi đổi URL backend, cập nhật đích rewrite. Khi đổi tên miền frontend, cập nhật `AUTH_ALLOWED_ORIGINS` trong Render để login và refresh tiếp tục hoạt động. Cấu hình frontend hiện tại không cần biến môi trường trên Vercel.
