import { Component, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { failed: boolean };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="fallback-page">
          <p className="eyebrow">DOCUMIND</p>
          <h1>Trang chưa thể hiển thị</h1>
          <p>Đã có lỗi xảy ra. Bạn có thể tải lại trang để thử tiếp.</p>
          <button className="button button-primary" onClick={() => window.location.reload()}>
            Tải lại trang
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}
