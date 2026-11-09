import { useSyncExternalStore } from 'react';
import { Laptop, LogOut, Moon, ShieldCheck, Sun, UserRound } from 'lucide-react';
import { useTheme, type ThemePreference } from '@/app/providers/theme-context';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/use-auth';

function motionSnapshot() {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
function subscribeMotion(listener: () => void) {
  if (typeof window.matchMedia !== 'function') return () => {};
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}
const choices: { value: ThemePreference; label: string; description: string; icon: typeof Sun }[] =
  [
    { value: 'light', label: 'Sáng', description: 'Giao diện sáng, rõ ràng.', icon: Sun },
    { value: 'dark', label: 'Tối', description: 'Dịu mắt trong môi trường tối.', icon: Moon },
    { value: 'system', label: 'Theo hệ thống', description: 'Tự đổi theo thiết bị.', icon: Laptop },
  ];
export default function SettingsPage() {
  const auth = useAuth();
  const { theme, preference, setPreference } = useTheme();
  const reducedMotion = useSyncExternalStore(subscribeMotion, motionSnapshot, () => false);
  return (
    <AppShell>
      <div className="account-page account-settings">
        <div className="account-page-heading">
          <div>
            <p className="page-eyebrow">
              <ShieldCheck size={14} aria-hidden="true" /> KHÔNG GIAN CÁ NHÂN
            </p>
            <h1>
              Cài đặt<span className="heading-dot">.</span>
            </h1>
            <p>Điều chỉnh trải nghiệm và quản lý phiên của bạn.</p>
          </div>
        </div>
        <section className="settings-card" aria-labelledby="settings-profile">
          <div className="settings-section-header">
            <span className="settings-heading-icon">
              <UserRound size={19} aria-hidden="true" />
            </span>
            <div>
              <h2 id="settings-profile">Tài khoản</h2>
              <p>Thông tin của phiên đăng nhập hiện tại.</p>
            </div>
          </div>
          <div className="settings-profile">
            <div>
              <span>ĐỊA CHỈ EMAIL</span>
              <strong>{auth.user?.email}</strong>
            </div>
            <span className="settings-session">Đã đăng nhập</span>
          </div>
          <div className="settings-logout">
            <p>Đăng xuất khỏi phiên hiện tại trên thiết bị này.</p>
            <Button variant="secondary" onClick={() => void auth.logout()}>
              <LogOut size={16} aria-hidden="true" /> Đăng xuất
            </Button>
          </div>
        </section>
        <section className="settings-card" aria-labelledby="settings-appearance">
          <div className="settings-section-header">
            <span className="settings-heading-icon">
              <Sun size={19} aria-hidden="true" />
            </span>
            <div>
              <h2 id="settings-appearance">Giao diện</h2>
              <p>Chọn cách DocuMind hiển thị trên thiết bị này.</p>
            </div>
          </div>
          <fieldset className="theme-choices">
            <legend>Chế độ màu</legend>
            {choices.map(({ value, label, description, icon: Icon }) => (
              <label
                className={`theme-choice ${preference === value ? 'theme-choice--selected' : ''}`}
                key={value}
              >
                <input
                  type="radio"
                  aria-label={label}
                  name="theme"
                  value={value}
                  checked={preference === value}
                  onChange={() => setPreference(value)}
                />
                <Icon size={18} aria-hidden="true" />
                <span>
                  <strong>{label}</strong>
                  <small>{description}</small>
                </span>
              </label>
            ))}
          </fieldset>
          <p className="settings-hint">
            Đang hiển thị giao diện {theme === 'dark' ? 'tối' : 'sáng'}.
          </p>
          <div className="settings-motion">
            <div>
              <strong>Giảm chuyển động</strong>
              <p>DocuMind sử dụng cài đặt trợ năng của hệ điều hành.</p>
            </div>
            <span>{reducedMotion ? 'Đang bật' : 'Theo hệ thống'}</span>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
