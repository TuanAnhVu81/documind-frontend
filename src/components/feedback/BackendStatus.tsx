import { CheckCircle2, CircleAlert, LoaderCircle, RefreshCw } from 'lucide-react';

export type ConnectionState = 'checking' | 'connected' | 'unavailable';

type Props = { state: ConnectionState; onRetry: () => void };

export function BackendStatus({ state, onRetry }: Props) {
  const checking = state === 'checking';
  const connected = state === 'connected';
  const Icon = checking ? LoaderCircle : connected ? CheckCircle2 : CircleAlert;
  const label = checking
    ? 'Đang kiểm tra kết nối'
    : connected
      ? 'Đã kết nối máy chủ'
      : 'Chưa kết nối được máy chủ';
  const detail = checking
    ? 'Đang kiểm tra trạng thái hệ thống.'
    : connected
      ? 'Máy chủ đang phản hồi và sẵn sàng tiếp nhận yêu cầu.'
      : 'Không nhận được phản hồi. Hãy kiểm tra máy chủ và thử lại.';

  return (
    <section className="connection-card" aria-labelledby="connection-heading">
      <div className="connection-topline">
        <span className="section-label">TRẠNG THÁI KẾT NỐI</span>
        <span className={`status-dot status-dot--${state}`} aria-hidden="true" />
      </div>
      <div className="connection-content" role="status" aria-live="polite">
        <span className={`connection-icon connection-icon--${state}`} aria-hidden="true">
          <Icon size={19} className={checking ? 'spin' : undefined} />
        </span>
        <div>
          <h2 id="connection-heading">{label}</h2>
          <p>{detail}</p>
        </div>
      </div>
      {!connected && !checking && (
        <button className="retry-button" onClick={onRetry}>
          <RefreshCw size={15} aria-hidden="true" /> Thử kết nối lại
        </button>
      )}
    </section>
  );
}
