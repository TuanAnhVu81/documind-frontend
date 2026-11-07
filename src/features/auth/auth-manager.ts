import { authApi } from '@/api/auth';
import { ApiError } from '@/api/errors';
import type { Credentials, Session, User } from '@/api/types';
import { clearSessionCache } from '@/app/query-client';

type AuthState = {
  status: 'checking' | 'authenticated' | 'guest';
  user: User | null;
  notice: string | null;
  logoutUnconfirmed: boolean;
};
type SharedMessage = (
  | { type: 'request-session' }
  | { type: 'session'; session: Session; expiresAt: number }
  | { type: 'logout' }
  | { type: 'logout-confirmed' }
  | { type: 'session-ended' }
) & { generation: string };
const pendingKey = 'documind-logout-pending';
const generationKey = 'documind-session-generation';
const loginPrefix = 'documind-login-inflight-';
const channelName = 'documind-auth-v1';
const lockName = 'documind-auth-v1';
const guest: AuthState = { status: 'guest', user: null, notice: null, logoutUnconfirmed: false };
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

class AuthManager {
  private state: AuthState = { ...guest, status: 'checking' };
  private listeners = new Set<() => void>();
  private channel: BroadcastChannel | null = null;
  private session: Session | null = null;
  private sessionGeneration: string | null = null;
  private memoryGeneration = crypto.randomUUID();
  private expiresAt = 0;
  private epoch = 0;
  private flight: Promise<void> | null = null;
  private clearing: Promise<void> = Promise.resolve();
  private started = false;
  private loggingOut = false;
  private authenticating = false;
  private streams = new Set<AbortController>();
  private logoutFlight: Promise<boolean> | null = null;

  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private setState(next: AuthState) {
    this.state = next;
    this.listeners.forEach((listener) => listener());
  }
  private pending(): boolean {
    try {
      return localStorage.getItem(pendingKey) === '1';
    } catch {
      return this.loggingOut;
    }
  }
  private setPending(value: boolean) {
    try {
      if (value) localStorage.setItem(pendingKey, '1');
      else localStorage.removeItem(pendingKey);
    } catch {
      /* memory fallback */
    }
  }
  private generation(): string {
    try {
      const existing = localStorage.getItem(generationKey);
      if (existing) return existing;
      localStorage.setItem(generationKey, this.memoryGeneration);
      return localStorage.getItem(generationKey) ?? this.memoryGeneration;
    } catch {
      return this.memoryGeneration;
    }
  }
  private advanceGeneration(): string {
    const generation = crypto.randomUUID();
    this.memoryGeneration = generation;
    try {
      localStorage.setItem(generationKey, generation);
    } catch {
      /* memory fallback */
    }
    return generation;
  }
  private post(message: SharedMessage) {
    this.channel?.postMessage(message);
  }
  private async withLock<T>(work: () => Promise<T>): Promise<T> {
    if (navigator.locks) return navigator.locks.request(lockName, work);
    return work();
  }
  private clearPrivateData() {
    this.streams.forEach((controller) => controller.abort());
    this.streams.clear();
    this.clearing = this.clearing.then(() => clearSessionCache());
    return this.clearing;
  }
  private async discard(notice: string | null = null, pending = this.pending()) {
    const epoch = ++this.epoch;
    this.session = null;
    this.sessionGeneration = null;
    this.expiresAt = 0;
    this.setState({ ...guest, status: 'checking', notice: null, logoutUnconfirmed: pending });
    await this.clearPrivateData();
    if (this.epoch === epoch)
      this.setState({ ...guest, notice, logoutUnconfirmed: this.pending() });
  }
  private async accept(
    session: Session,
    expiresAt: number,
    expectedEpoch: number,
    generation: string,
    share: boolean,
  ) {
    if (
      this.epoch !== expectedEpoch ||
      this.loggingOut ||
      this.pending() ||
      this.generation() !== generation
    )
      return;
    if (
      this.session &&
      (this.session.user.id !== session.user.id || this.sessionGeneration !== generation)
    ) {
      this.session = null;
      this.sessionGeneration = null;
      this.expiresAt = 0;
      this.setState({ ...guest, status: 'checking' });
      await this.clearPrivateData();
    } else {
      await this.clearing;
    }
    if (
      this.epoch !== expectedEpoch ||
      this.loggingOut ||
      this.pending() ||
      this.generation() !== generation
    )
      return;
    this.session = session;
    this.sessionGeneration = generation;
    this.expiresAt = expiresAt;
    this.setState({
      status: 'authenticated',
      user: session.user,
      notice: null,
      logoutUnconfirmed: false,
    });
    if (share) this.post({ type: 'session', session, expiresAt, generation });
  }
  private onStorage(event: StorageEvent) {
    if (event.storageArea !== localStorage) return;
    if (event.key === pendingKey && event.newValue === '1') {
      this.loggingOut = true;
      void this.discard('Đang đăng xuất trên một thẻ khác.', true);
    } else if (event.key === pendingKey && event.newValue === null && this.loggingOut) {
      this.loggingOut = false;
      if (this.state.status !== 'checking')
        this.setState({ ...guest, notice: 'Bạn đã đăng xuất.' });
    } else if (
      event.key === generationKey &&
      event.newValue &&
      this.sessionGeneration &&
      event.newValue !== this.sessionGeneration
    ) {
      void this.discard('Phiên đã thay đổi trên một thẻ khác.', this.pending());
    }
  }
  start() {
    if (this.started) return;
    this.started = true;
    this.generation();
    window.addEventListener('storage', (event) => this.onStorage(event));
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(channelName);
      this.channel.onmessage = (event: MessageEvent<SharedMessage>) => {
        const message = event.data;
        if (!message || typeof message !== 'object' || message.generation !== this.generation())
          return;
        if (message.type === 'logout') {
          this.loggingOut = true;
          void this.discard('Đang đăng xuất trên một thẻ khác.', true);
        } else if (message.type === 'logout-confirmed') {
          if (this.pending()) return;
          this.loggingOut = false;
          if (this.state.status !== 'checking')
            this.setState({ ...guest, notice: 'Bạn đã đăng xuất.' });
        } else if (message.type === 'session-ended') {
          void this.discard('Phiên đã hết hạn. Vui lòng đăng nhập lại.', false);
        } else if (message.type === 'request-session') {
          if (
            this.session &&
            this.sessionGeneration === message.generation &&
            this.expiresAt > Date.now() + 30_000 &&
            !this.loggingOut &&
            !this.pending()
          )
            this.post({
              type: 'session',
              session: this.session,
              expiresAt: this.expiresAt,
              generation: message.generation,
            });
        } else if (
          message.type === 'session' &&
          !this.loggingOut &&
          !this.authenticating &&
          !this.pending() &&
          message.session?.accessToken &&
          message.expiresAt > Date.now()
        ) {
          const epoch = ++this.epoch;
          void this.accept(message.session, message.expiresAt, epoch, message.generation, false);
        }
      };
    }
    if (this.pending()) {
      this.loggingOut = true;
      void this.discard('Chưa xác nhận đăng xuất với máy chủ. Vui lòng thử lại.', true);
      return;
    }
    void this.refresh().catch(() => {});
  }
  async refresh(): Promise<void> {
    if (this.flight) return this.flight;
    const epoch = this.epoch;
    const generation = this.generation();
    this.flight = this.withLock(async () => {
      if (
        this.loggingOut ||
        this.pending() ||
        epoch !== this.epoch ||
        generation !== this.generation()
      )
        return;
      this.post({ type: 'request-session', generation });
      await wait(120);
      if (
        this.session &&
        this.sessionGeneration === generation &&
        this.expiresAt > Date.now() + 30_000
      )
        return;
      if (
        this.loggingOut ||
        this.pending() ||
        epoch !== this.epoch ||
        generation !== this.generation()
      )
        return;
      const csrf = await authApi.csrf();
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const result = await authApi.refresh(csrf);
          await this.accept(result, Date.now() + result.expiresIn * 1000, epoch, generation, true);
          return;
        } catch (error) {
          if (error instanceof ApiError && error.code === 'REFRESH_RACE' && attempt === 0) {
            const seconds = Number(error.retryAfter);
            await wait(Math.max(1, Number.isFinite(seconds) ? seconds : 1) * 1000);
            if (
              epoch !== this.epoch ||
              this.loggingOut ||
              this.pending() ||
              generation !== this.generation()
            )
              return;
            if (
              this.session &&
              this.sessionGeneration === generation &&
              this.expiresAt > Date.now() + 30_000
            )
              return;
            continue;
          }
          if (
            epoch !== this.epoch ||
            this.loggingOut ||
            this.pending() ||
            generation !== this.generation()
          )
            return;
          if (
            error instanceof ApiError &&
            (error.code === 'REFRESH_INVALID' || error.code === 'REFRESH_REUSED')
          ) {
            this.post({ type: 'session-ended', generation });
            await this.discard();
          } else {
            this.setState({
              ...this.state,
              status: this.session ? 'authenticated' : 'checking',
              notice:
                error instanceof ApiError
                  ? error.message
                  : 'Không thể kiểm tra phiên. Vui lòng thử lại.',
            });
          }
          throw error;
        }
      }
    })
      .catch((error: unknown) => {
        if (
          epoch === this.epoch &&
          generation === this.generation() &&
          !this.loggingOut &&
          !this.pending() &&
          !this.state.notice
        )
          this.setState({
            ...this.state,
            status: this.session ? 'authenticated' : 'checking',
            notice:
              error instanceof ApiError
                ? error.message
                : 'Không thể kiểm tra phiên. Vui lòng thử lại.',
          });
        throw error;
      })
      .finally(() => {
        this.flight = null;
      });
    return this.flight;
  }
  async login(credentials: Credentials) {
    const epoch = ++this.epoch;
    const generation = this.generation();
    this.authenticating = true;
    try {
      await this.withLock(async () => {
        if (
          this.epoch !== epoch ||
          this.loggingOut ||
          this.pending() ||
          this.generation() !== generation
        )
          return;
        const operationKey = `${loginPrefix}${crypto.randomUUID()}`;
        try {
          // Register before any network request, so a concurrent logout waits for its response cookie.
          try {
            localStorage.setItem(operationKey, '1');
          } catch {
            if (!navigator.locks)
              throw new ApiError('Trình duyệt cần cho phép lưu trữ để bảo vệ phiên.');
          }
          if (
            this.epoch !== epoch ||
            this.loggingOut ||
            this.pending() ||
            this.generation() !== generation
          )
            return;
          const csrf = await authApi.csrf();
          if (
            this.epoch !== epoch ||
            this.loggingOut ||
            this.pending() ||
            this.generation() !== generation
          )
            return;
          const result = await authApi.login(credentials, csrf);
          if (
            this.epoch !== epoch ||
            this.loggingOut ||
            this.pending() ||
            this.generation() !== generation
          )
            return;
          const nextGeneration = this.advanceGeneration();
          await this.accept(
            result,
            Date.now() + result.expiresIn * 1000,
            epoch,
            nextGeneration,
            true,
          );
        } finally {
          try {
            localStorage.removeItem(operationKey);
          } catch {
            /* no stored operation */
          }
        }
      });
    } finally {
      this.authenticating = false;
    }
  }
  async register(credentials: Credentials) {
    const csrf = await authApi.csrf();
    await authApi.register(credentials, csrf);
  }
  private async waitForLogins() {
    for (let attempt = 0; attempt < 100; attempt++) {
      let inflight: boolean;
      try {
        inflight = Object.keys(localStorage).some((key) => key.startsWith(loginPrefix));
      } catch {
        if (!navigator.locks) throw new Error('Session coordination unavailable');
        return;
      }
      if (!inflight) return;
      await wait(100);
    }
    throw new Error('Login is still in progress');
  }
  async logout(): Promise<boolean> {
    if (this.logoutFlight) return this.logoutFlight;
    this.loggingOut = true;
    this.setPending(true);
    const generation = this.advanceGeneration();
    this.post({ type: 'logout', generation });
    const cleared = this.discard('Đang đăng xuất…', true);
    this.logoutFlight = this.withLock(async () => {
      await cleared;
      try {
        await this.waitForLogins();
        const csrf = await authApi.csrf();
        await authApi.logout(csrf);
        if (this.generation() !== generation) return false;
        this.loggingOut = false;
        this.setPending(false);
        this.post({ type: 'logout-confirmed', generation });
        this.setState({ ...guest, notice: 'Bạn đã đăng xuất.' });
        return true;
      } catch {
        this.setState({
          ...guest,
          notice: 'Chưa xác nhận đăng xuất với máy chủ. Vui lòng thử lại.',
          logoutUnconfirmed: true,
        });
        return false;
      }
    }).finally(() => {
      this.logoutFlight = null;
    });
    return this.logoutFlight;
  }
  async accessToken(): Promise<string | null> {
    if (
      this.loggingOut ||
      this.pending() ||
      (this.sessionGeneration && this.sessionGeneration !== this.generation())
    )
      return null;
    if (!this.session || this.expiresAt <= Date.now() + 30_000) await this.refresh();
    return this.session?.accessToken ?? null;
  }
  trackStream(controller: AbortController) {
    this.streams.add(controller);
    return () => this.streams.delete(controller);
  }
}
export const authManager = new AuthManager();
