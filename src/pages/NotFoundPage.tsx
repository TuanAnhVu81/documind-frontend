import { Link } from 'react-router';

export default function NotFoundPage() {
  return (
    <main className="fallback-page">
      <p className="eyebrow">DOCUMIND / 404</p>
      <h1>Không tìm thấy trang</h1>
      <p>Đường dẫn này không tồn tại hoặc đã thay đổi.</p>
      <Link className="button button-primary" to="/">
        Về trang chủ
      </Link>
    </main>
  );
}
