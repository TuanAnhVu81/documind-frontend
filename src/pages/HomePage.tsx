import { useEffect, useState } from 'react';
import { ArrowDownRight, BookOpenText, FileSearch, Quote, Sparkles } from 'lucide-react';
import { BackendStatus, type ConnectionState } from '@/components/feedback/BackendStatus';

const features = [
  {
    icon: BookOpenText,
    number: '01',
    title: 'Tài liệu của bạn',
    text: 'Tập hợp tài liệu để thông tin luôn trong tầm tay.',
  },
  {
    icon: FileSearch,
    number: '02',
    title: 'Câu hỏi rõ ràng',
    text: 'Tìm điều bạn cần bằng cách đặt câu hỏi tự nhiên.',
  },
  {
    icon: Quote,
    number: '03',
    title: 'Nguồn tham khảo',
    text: 'Xem đoạn tài liệu liên quan để kiểm tra câu trả lời.',
  },
];

export default function HomePage() {
  const [state, setState] = useState<ConnectionState>('checking');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timer = window.setTimeout(() => controller.abort(), 6000);
    void fetch('/actuator/health', { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('health request failed');
        const data: unknown = await response.json();
        if (!data || typeof data !== 'object' || !('status' in data) || data.status !== 'UP') {
          throw new Error('health status unavailable');
        }
        if (active) setState('connected');
      })
      .catch(() => {
        if (active) setState('unavailable');
      })
      .finally(() => window.clearTimeout(timer));
    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [attempt]);

  function retryConnection() {
    setState('checking');
    setAttempt((current) => current + 1);
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="DocuMind — trang chủ">
          <span className="brand-mark">
            <BookOpenText size={19} strokeWidth={2} aria-hidden="true" />
          </span>
          <span>
            DocuMind<span className="brand-dot">.</span>
          </span>
        </a>
        <span className="header-note">
          <span className="header-note-dot" /> MỘT KHÔNG GIAN CHO TÀI LIỆU
        </span>
      </header>

      <main id="main-content" className="main-layout">
        <section className="intro" aria-labelledby="intro-heading">
          <p className="intro-label">
            <Sparkles size={15} aria-hidden="true" /> CHÀO MỪNG ĐẾN VỚI DOCUMIND
          </p>
          <h1 id="intro-heading">
            Hiểu tài liệu.
            <br />
            <span>Rõ từng nguồn.</span>
          </h1>
          <p className="intro-copy">
            Một không gian giúp bạn tìm hiểu tài liệu, đặt câu hỏi và theo dõi những nguồn tham khảo
            liên quan.
          </p>
          <div className="intro-divider" />
          <p className="intro-footnote">
            <span className="footnote-mark">✳</span> Bắt đầu từ thông tin bạn tin cậy.
          </p>
        </section>

        <aside className="overview" aria-label="Tổng quan DocuMind">
          <div className="overview-head">
            <div>
              <p className="section-label">KHÔNG GIAN LÀM VIỆC</p>
              <h2>
                Đọc ít hơn.
                <br />
                Hiểu sâu hơn.
              </h2>
            </div>
            <span className="overview-arrow">
              <ArrowDownRight size={20} aria-hidden="true" />
            </span>
          </div>
          <div className="feature-list">
            {features.map(({ icon: Icon, number, title, text }) => (
              <div className="feature-row" key={number}>
                <span className="feature-icon">
                  <Icon size={19} strokeWidth={1.7} aria-hidden="true" />
                </span>
                <div className="feature-copy">
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
                <span className="feature-number">{number}</span>
              </div>
            ))}
          </div>
          <BackendStatus state={state} onRetry={retryConnection} />
        </aside>
      </main>

      <footer className="site-footer">
        <span>DOCUMIND</span>
        <span>Mỗi câu trả lời đều bắt đầu từ một nguồn.</span>
      </footer>
    </div>
  );
}
