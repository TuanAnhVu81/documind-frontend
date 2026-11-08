import {
  ArrowUpRight,
  BookOpenText,
  FilePlus2,
  FileSearch,
  MessageSquareText,
  Quote,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { BackendStatus } from '@/components/feedback/BackendStatus';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useBackendConnection } from '@/features/system/useBackendConnection';
import { Link } from 'react-router';

const steps = [
  {
    number: '01',
    icon: FilePlus2,
    title: 'Thêm tài liệu',
    text: 'Đưa tài liệu PDF, DOCX hoặc TXT vào không gian của bạn.',
  },
  {
    number: '02',
    icon: MessageSquareText,
    title: 'Đặt câu hỏi',
    text: 'Hỏi bằng ngôn ngữ tự nhiên về nội dung bạn muốn tìm.',
  },
  {
    number: '03',
    icon: Quote,
    title: 'Xem nguồn',
    text: 'Đọc đoạn trích liên quan để kiểm tra thông tin.',
  },
];

export default function HomePage() {
  const { state, retry } = useBackendConnection();
  return (
    <AppShell>
      <div className="overview-page">
        <div className="page-heading">
          <div>
            <p className="page-eyebrow">
              <Sparkles size={14} aria-hidden="true" /> KHÔNG GIAN CỦA BẠN
            </p>
            <h1>
              Chào mừng đến DocuMind<span className="heading-dot">.</span>
            </h1>
            <p>Một nơi yên tĩnh để đọc, tìm hiểu và kết nối với tài liệu của bạn.</p>
          </div>
          <Badge tone="info">
            <span className="badge-dot" aria-hidden="true" /> Không gian cá nhân
          </Badge>
        </div>

        <section className="hero-card" aria-labelledby="hero-title">
          <div className="hero-copy">
            <div className="hero-label">
              <WandSparkles size={15} aria-hidden="true" /> HIỂU TÀI LIỆU THEO CÁCH CỦA BẠN
            </div>
            <h2 id="hero-title">
              Từ tài liệu đến
              <br />
              <span>điều bạn cần biết.</span>
            </h2>
            <p>Đặt câu hỏi, khám phá thông tin và quay lại đúng đoạn tài liệu liên quan.</p>
            <div className="hero-actions">
              <Link className="ui-button ui-button--primary ui-button--medium" to="/app/documents">
                <FilePlus2 size={17} aria-hidden="true" /> Tải tài liệu
              </Link>
              <Button variant="secondary" disabled>
                <MessageSquareText size={17} aria-hidden="true" /> Bắt đầu hội thoại
              </Button>
            </div>
            <p className="availability-note">
              Tải tài liệu lên để bắt đầu. Hội thoại sẽ khả dụng ở bước tiếp theo.
            </p>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="art-orbit art-orbit--outer" />
            <div className="art-orbit art-orbit--inner" />
            <div className="art-page art-page--back">
              <span />
              <span />
              <span />
            </div>
            <div className="art-page art-page--front">
              <div className="art-page-icon">
                <BookOpenText size={23} />
              </div>
              <div className="art-line art-line--long" />
              <div className="art-line" />
              <div className="art-line art-line--short" />
              <div className="art-highlight" />
            </div>
            <span className="art-spark art-spark--one">✦</span>
            <span className="art-spark art-spark--two">✳</span>
            <div className="art-source">
              <Quote size={15} />
              <span>Thông tin có nguồn</span>
            </div>
          </div>
        </section>

        <div className="overview-grid">
          <section className="steps-section" aria-labelledby="steps-title">
            <div className="section-heading">
              <div>
                <p className="section-kicker">BẮT ĐẦU THẬT ĐƠN GIẢN</p>
                <h2 id="steps-title">Ba bước để khám phá</h2>
                <p>Đi từ câu hỏi đến thông tin bạn có thể kiểm tra.</p>
              </div>
              <span className="section-mark" aria-hidden="true">
                <ArrowUpRight size={19} />
              </span>
            </div>
            <div className="steps-grid">
              {steps.map(({ number, icon: Icon, title, text }) => (
                <article className="step-card" key={number}>
                  <div className="step-card-top">
                    <span className="step-icon">
                      <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <span className="step-number">{number}</span>
                  </div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </section>
          <aside className="overview-aside" aria-label="Thông tin không gian">
            <div className="aside-card">
              <span className="aside-icon">
                <FileSearch size={18} aria-hidden="true" />
              </span>
              <p className="section-kicker">RÕ RÀNG HƠN MỖI NGÀY</p>
              <h2>
                Đừng chỉ tìm câu trả lời.
                <br />
                Hãy tìm cả nguồn.
              </h2>
              <p>Thông tin sẽ dễ tin cậy hơn khi bạn có thể xem lại tài liệu liên quan.</p>
              <div className="aside-divider" />
              <span className="aside-signature">DÀNH CHO NHỮNG CÂU HỎI HAY</span>
            </div>
            <BackendStatus state={state} onRetry={retry} />
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
