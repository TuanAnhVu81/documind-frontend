import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  MessageSquareText,
  RefreshCw,
} from 'lucide-react';
import { usageApi } from '@/api/usage';
import { ApiError } from '@/api/errors';
import type { Usage } from '@/api/types';
import { queryKeys } from '@/app/query-client';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { ErrorState, Skeleton } from '@/components/ui/Feedback';
import { useAuth } from '@/features/auth/use-auth';
import { accessTokenForUser } from '@/features/auth/user-token';
import { formatTokens, formatUsageTime } from './usage-format';

function UsageSummary({ usage }: { usage: Usage }) {
  const stats = [
    {
      label: 'Lượt hỏi',
      value: formatTokens(usage.questionCount),
      detail: 'Bao gồm cả lượt lỗi; không tính phát lại.',
      icon: MessageSquareText,
    },
    {
      label: 'Token đầu vào',
      value: formatTokens(usage.promptTokens),
      detail: 'Chat, viết lại và các lần xử lý liên quan.',
      icon: ArrowUpRight,
    },
    {
      label: 'Token đầu ra',
      value: formatTokens(usage.completionTokens),
      detail: 'Câu trả lời và các lần xử lý liên quan.',
      icon: ArrowDownLeft,
    },
  ];
  const empty =
    usage.questionCount === 0 &&
    usage.promptTokens === 0 &&
    usage.completionTokens === 0 &&
    usage.embeddingTokens === 0 &&
    usage.estimatedCostUsd === 0;
  return (
    <>
      <div className="usage-period">
        <CalendarDays size={17} aria-hidden="true" />
        <div>
          <strong>Toàn bộ thời gian</strong>
          <p>
            Từ {formatUsageTime(usage.periodStart)} đến {formatUsageTime(usage.periodEnd)}
          </p>
        </div>
        <span>THEO TÀI KHOẢN</span>
      </div>
      {empty && (
        <div className="usage-empty" role="status">
          <Activity size={18} aria-hidden="true" />
          <div>
            <strong>Chưa có hoạt động được ghi nhận</strong>
            <p>Số liệu sẽ cập nhật khi có lượt hỏi hoặc xử lý tài liệu.</p>
          </div>
        </div>
      )}
      <section aria-labelledby="usage-metrics-title">
        <div className="usage-section-heading">
          <div>
            <p className="section-kicker">TỔNG QUAN SỬ DỤNG</p>
            <h2 id="usage-metrics-title">Hoạt động của bạn</h2>
          </div>
          <span className="usage-accuracy">
            {usage.estimated ? 'Có số liệu ước tính' : 'Theo dữ liệu ghi nhận'}
          </span>
        </div>
        <div className="usage-grid">
          {stats.map(({ label, value, detail, icon: Icon }) => (
            <article className="usage-card" key={label}>
              <div className="usage-card-top">
                <span>{label}</span>
                <span className="usage-icon">
                  <Icon size={17} aria-hidden="true" />
                </span>
              </div>
              <strong>{value}</strong>
              <p>{detail}</p>
            </article>
          ))}
        </div>
      </section>
      <p className="usage-footnote">
        {usage.estimated ? 'Một phần số liệu là ước tính. ' : ''}“Chưa có số liệu” nghĩa là chưa xác
        định được tổng, khác với 0. Số liệu bao gồm cả hoạt động đã xóa khỏi lịch sử nếu được lưu
        lại.
      </p>
      <p className="usage-footnote">
        Quản trị viên có thể xem hạn mức Gemini của dự án trong{' '}
        <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer">
          Google AI Studio
        </a>.
      </p>
    </>
  );
}
export default function UsagePage() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const usage = useQuery({
    queryKey: queryKeys.usage(userId),
    queryFn: async ({ signal }) => usageApi.summary(await accessTokenForUser(userId), { signal }),
    enabled: !!userId,
    staleTime: 0,
    refetchOnMount: 'always',
    networkMode: 'always',
    retry: false,
  });
  const error =
    usage.error instanceof ApiError
      ? `${usage.error.message}${usage.error.requestId ? ` Mã yêu cầu: ${usage.error.requestId}` : ''}`
      : 'Không thể kết nối đến máy chủ. Vui lòng thử lại.';
  return (
    <AppShell>
      <div className="account-page">
        <div className="account-page-heading">
          <div>
            <p className="page-eyebrow">
              <Activity size={14} aria-hidden="true" /> SỐ LIỆU CỦA BẠN
            </p>
            <h1>Thống kê sử dụng</h1>
            <p>Theo dõi hoạt động và tài nguyên đã sử dụng trong không gian của bạn.</p>
          </div>
          <Button
            variant="secondary"
            loading={usage.isFetching && !usage.isPending}
            onClick={() => void usage.refetch()}
          >
            <RefreshCw size={16} aria-hidden="true" /> Làm mới
          </Button>
        </div>
        {usage.isPending ? (
          <div className="usage-loading" role="status" aria-label="Đang tải thống kê">
            <Skeleton />
            <Skeleton />
            <Skeleton />
          </div>
        ) : usage.isError ? (
          <ErrorState
            title="Chưa tải được thống kê"
            description={error}
            onRetry={() => void usage.refetch()}
          />
        ) : (
          <UsageSummary usage={usage.data} />
        )}
      </div>
    </AppShell>
  );
}
