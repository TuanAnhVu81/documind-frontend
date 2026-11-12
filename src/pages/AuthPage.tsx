import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router';
import {
  ArrowLeft,
  BookOpenText,
  Eye,
  EyeOff,
  FileSearch,
  LockKeyhole,
  Sparkles,
} from 'lucide-react';
import { ApiError } from '@/api/errors';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/features/auth/use-auth';
import { credentialsSchema, registrationSchema, type CredentialsForm } from '@/features/auth/validation';

type Props = { mode: 'login' | 'register' };
export function AuthPage({ mode }: Props) {
  const isLogin = mode === 'login';
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | undefined>();
  const [retryingLogout, setRetryingLogout] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CredentialsForm>({
    resolver: zodResolver(isLogin ? credentialsSchema : registrationSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });
  const from = (location.state as { from?: string } | null)?.from;
  const destination = from && /^\/app(?:\/|\?|$)/.test(from) ? from : '/app';
  const registrationMessage = (location.state as { registered?: boolean } | null)?.registered;
  useEffect(() => {
    if (isLogin && auth.status === 'authenticated') navigate(destination, { replace: true });
  }, [isLogin, auth.status, destination, navigate]);
  async function submit(values: CredentialsForm) {
    setError(null);
    setRequestId(undefined);
    try {
      if (isLogin) {
        await auth.login(values);
        if (authManagerStatus() === 'authenticated') navigate(destination, { replace: true });
      } else {
        await auth.register({ email: values.email, password: values.password });
        navigate('/login', { replace: true, state: { registered: true, from: destination } });
      }
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? failure.message
          : 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.',
      );
      if (failure instanceof ApiError) setRequestId(failure.requestId);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-aside" aria-label="Giới thiệu DocuMind">
        <div className="auth-brand">
          <span>
            <BookOpenText size={22} />
          </span>{' '}
          DocuMind
        </div>
        <div className="auth-aside-content">
          <div className="auth-kicker">
            <Sparkles size={15} /> KHÔNG GIAN TRI THỨC CỦA BẠN
          </div>
          <h2>
            Hiểu tài liệu.
            <br />
            <em>Rõ từng câu trả lời</em>
          </h2>
          <p>Một không gian riêng để đọc, đặt câu hỏi và tìm về đúng nguồn thông tin bạn cần.</p>
          <div className="auth-feature">
            <FileSearch size={20} />
            <span>
              <strong>Mọi nguồn trong tầm tay</strong>
              <small>Khám phá tài liệu theo cách tự nhiên hơn.</small>
            </span>
          </div>
          <div className="auth-feature">
            <LockKeyhole size={20} />
            <span>
              <strong>Không gian cá nhân</strong>
              <small>Tài liệu và hội thoại thuộc tài khoản của bạn.</small>
            </span>
          </div>
        </div>
        <div className="auth-aside-footer">
          DOCUMIND <span>·</span> KHÔNG GIAN TÀI LIỆU CỦA BẠN
        </div>
      </section>
      <section className="auth-main" aria-labelledby="auth-title">
        <div className="auth-card">
          {!isLogin && (
            <Link to="/login" className="auth-back" state={{ from: destination }}>
              <ArrowLeft size={16} /> Về đăng nhập
            </Link>
          )}
          <div className="auth-mobile-brand">
            <BookOpenText size={20} /> DocuMind
          </div>
          <p className="auth-eyebrow">{isLogin ? 'CHÀO MỪNG TRỞ LẠI' : 'BẮT ĐẦU CÙNG DOCUMIND'}</p>
          <h1 id="auth-title">{isLogin ? 'Đăng nhập' : 'Tạo tài khoản'}</h1>
          <p className="auth-subtitle">
            {isLogin
              ? 'Tiếp tục khám phá không gian tài liệu của bạn.'
              : 'Tạo không gian riêng để bắt đầu tìm hiểu tài liệu.'}
          </p>
          {registrationMessage && (
            <div className="auth-notice" role="status">
              Tạo tài khoản thành công. Hãy đăng nhập để tiếp tục.
            </div>
          )}
          {auth.notice && (
            <div className="auth-notice" role="status">
              {auth.notice}
            </div>
          )}
          {auth.logoutUnconfirmed && (
            <div className="auth-pending">
              <p>Phiên trên máy chủ có thể vẫn còn hiệu lực.</p>
              <Button
                variant="secondary"
                loading={retryingLogout}
                onClick={() => {
                  setRetryingLogout(true);
                  void auth.logout().finally(() => setRetryingLogout(false));
                }}
              >
                Thử đăng xuất lại
              </Button>
            </div>
          )}
          {error && (
            <div className="auth-error" role="alert">
              {error}
              {requestId && <small>Mã yêu cầu: {requestId}</small>}
            </div>
          )}
          <form noValidate onSubmit={handleSubmit(submit)} className="auth-form">
            <div className="auth-field">
              <label htmlFor="email">Email</label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="ban@example.com"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'email-error' : undefined}
                {...register('email')}
              />
              {errors.email && (
                <p id="email-error" className="auth-field-error">
                  {errors.email.message}
                </p>
              )}
            </div>
            <div className="auth-field">
              <label htmlFor="password">Mật khẩu</label>
              <div className="auth-password">
                <Input
                  id="password"
                  type={visible ? 'text' : 'password'}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  placeholder="Ít nhất 8 ký tự"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  {...register('password')}
                />
                <button
                  type="button"
                  aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" className="auth-field-error">
                  {errors.password.message}
                </p>
              )}
            </div>
            {!isLogin && (
              <div className="auth-field">
                <label htmlFor="confirm-password">Nhập lại mật khẩu</label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Nhập lại mật khẩu"
                  aria-invalid={!!errors.confirmPassword}
                  aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined}
                  {...register('confirmPassword')}
                />
                {errors.confirmPassword && (
                  <p id="confirm-password-error" className="auth-field-error" role="alert">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>
            )}
            <Button
              type="submit"
              loading={isSubmitting}
              disabled={auth.logoutUnconfirmed}
              className="auth-submit"
            >
              {isLogin ? 'Đăng nhập' : 'Tạo tài khoản'}
            </Button>
          </form>
          <p className="auth-switch">
            {isLogin ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}{' '}
            <Link to={isLogin ? '/register' : '/login'} state={{ from: destination }}>
              {isLogin ? 'Tạo tài khoản' : 'Đăng nhập'}
            </Link>
          </p>
          <p className="auth-footnote">
            <LockKeyhole size={14} /> Phiên đăng nhập được bảo vệ trên thiết bị của bạn.
          </p>
        </div>
      </section>
    </main>
  );
}
import { authManager } from '@/features/auth/auth-manager';
function authManagerStatus() {
  return authManager.getSnapshot().status;
}
