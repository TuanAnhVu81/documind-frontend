import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BackendStatus } from '@/components/feedback/BackendStatus';
import NotFoundPage from '@/pages/NotFoundPage';

afterEach(cleanup);

describe('nền tảng giao diện', () => {
  it('hiển thị trạng thái không kết nối và cho phép kiểm tra lại', () => {
    const retry = vi.fn();
    render(<BackendStatus state="unavailable" onRetry={retry} />);
    expect(screen.getByRole('heading', { name: 'Chưa kết nối được máy chủ' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Thử kết nối lại' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('hiển thị kết nối thành công mà không đưa nút thử lại', () => {
    render(<BackendStatus state="connected" onRetry={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Đã kết nối máy chủ' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Thử kết nối lại' })).not.toBeInTheDocument();
  });

  it('cho phép trở về trang chủ khi không tìm thấy trang', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Không tìm thấy trang' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Về trang chủ' })).toHaveAttribute('href', '/');
  });
});
