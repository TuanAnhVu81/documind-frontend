import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { useTheme } from '@/app/providers/theme-context';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Dialog, Sheet } from '@/components/ui/Dialog';
import { ErrorState, Progress, Toast, ToastProvider } from '@/components/ui/Feedback';
import { Input, Textarea } from '@/components/ui/Input';
import { Tabs } from '@/components/ui/Tabs';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
});

function ThemeExample() {
  const { theme, toggleTheme } = useTheme();
  return <button onClick={toggleTheme}>Giao diện {theme}</button>;
}

function DialogExample() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Mở hộp thoại</button>
      <Dialog open={open} onOpenChange={setOpen} title="Xác nhận" description="Kiểm tra focus.">
        <p>Nội dung</p>
      </Dialog>
    </>
  );
}

function ToastExample() {
  const [open, setOpen] = useState(true);
  return (
    <ToastProvider>
      <Toast open={open} onOpenChange={setOpen} title="Đã lưu" description="Thông báo." />
    </ToastProvider>
  );
}

describe('hệ thống thiết kế', () => {
  it('đổi theme và lưu lựa chọn giao diện', async () => {
    render(
      <ThemeProvider>
        <ThemeExample />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Giao diện light' }));
    expect(screen.getByRole('button', { name: 'Giao diện dark' })).toBeInTheDocument();
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
    expect(window.localStorage.getItem('documind-theme')).toBe('dark');
  });

  it('nút đang tải bị vô hiệu và không thực hiện hành động', () => {
    const action = vi.fn();
    render(
      <Button loading onClick={action}>
        Lưu
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Lưu' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(button);
    expect(action).not.toHaveBeenCalled();
  });

  it('chuyển tab và hiển thị đúng nội dung', () => {
    render(
      <Tabs
        label="Thông tin"
        defaultValue="one"
        tabs={[
          { value: 'one', label: 'Một', content: 'Nội dung một' },
          { value: 'two', label: 'Hai', content: 'Nội dung hai' },
        ]}
      />,
    );
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Hai' }), { button: 0, ctrlKey: false });
    expect(screen.getByRole('tab', { name: 'Hai' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Nội dung hai')).toBeInTheDocument();
  });

  it('giới hạn progress và cho phép thử lại khi lỗi', () => {
    const retry = vi.fn();
    render(
      <>
        <Progress label="Tiến độ" value={150} />
        <ErrorState title="Chưa tải được" description="Vui lòng thử lại." onRetry={retry} />
      </>,
    );
    expect(screen.getByRole('progressbar', { name: 'Tiến độ' })).toHaveAttribute(
      'aria-valuenow',
      '100',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('biểu diễn tiến độ chưa xác định khác với 0%', () => {
    render(<Progress label="Đang xử lý" value={null} />);
    const bar = screen.getByRole('progressbar', { name: 'Đang xử lý' });
    expect(bar).not.toHaveAttribute('aria-valuenow');
    expect(bar.firstElementChild).toHaveAttribute('data-state', 'indeterminate');
    expect(bar.firstElementChild).not.toHaveStyle({ width: '0%' });
  });

  it('xếp nhiều thông báo trong cùng một viewport', () => {
    const { container } = render(
      <ToastProvider>
        <Toast open onOpenChange={() => {}} title="Một" description="Thông báo một" />
        <Toast open onOpenChange={() => {}} title="Hai" description="Thông báo hai" />
      </ToastProvider>,
    );
    const viewports = container.querySelectorAll('.ui-toast-viewport');
    expect(viewports).toHaveLength(1);
    expect(viewports[0].querySelectorAll('.ui-toast')).toHaveLength(2);
  });

  it('hỗ trợ sheet từ dưới lên', () => {
    render(
      <Sheet open onOpenChange={() => {}} side="bottom" title="Nguồn" description="Nguồn tài liệu">
        <p>Nội dung</p>
      </Sheet>,
    );
    expect(screen.getByRole('dialog', { name: 'Nguồn' })).toHaveClass('ui-dialog--bottom');
  });

  it('cung cấp tên truy cập và liên kết điều hướng hội thoại, thống kê, cài đặt', () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <AppShell>
            <p>Nội dung</p>
          </AppShell>
        </ThemeProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Thống kê' })).toHaveAttribute('href', '/app/usage');
    expect(screen.getByRole('link', { name: 'Cài đặt' })).toHaveAttribute('href', '/app/settings');
    expect(screen.getByRole('link', { name: 'Hội thoại' })).toHaveAttribute('href', '/app/chat');
  });

  it('giữ nhãn và trạng thái lỗi cho các trường nhập', () => {
    render(
      <>
        <label htmlFor="title">Tiêu đề</label>
        <Input id="title" aria-invalid="true" />
        <label htmlFor="note">Ghi chú</label>
        <Textarea id="note" disabled />
      </>,
    );
    expect(screen.getByRole('textbox', { name: 'Tiêu đề' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.getByRole('textbox', { name: 'Ghi chú' })).toBeDisabled();
  });

  it('đóng thông báo qua nút có nhãn truy cập', async () => {
    render(<ToastExample />);
    expect(screen.getByText('Đã lưu')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Đóng thông báo' }));
    await waitFor(() => expect(screen.queryByText('Đã lưu')).not.toBeInTheDocument());
  });

  it('mở drawer và đóng bằng Escape, khôi phục focus', async () => {
    vi.stubGlobal('innerWidth', 360);
    render(
      <MemoryRouter>
        <ThemeProvider>
          <AppShell>
            <p>Nội dung</p>
          </AppShell>
        </ThemeProvider>
      </MemoryRouter>,
    );
    const trigger = screen.getByRole('button', { name: 'Mở điều hướng' });
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Điều hướng' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Điều hướng' })).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
    vi.unstubAllGlobals();
  });

  it('đóng drawer và chuyển focus sang sidebar khi đổi sang desktop', async () => {
    vi.stubGlobal('innerWidth', 360);
    render(
      <MemoryRouter>
        <ThemeProvider>
          <AppShell>
            <p>Nội dung</p>
          </AppShell>
        </ThemeProvider>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Mở điều hướng' }));
    vi.stubGlobal('innerWidth', 1024);
    fireEvent(window, new Event('resize'));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Điều hướng' })).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(screen.getByRole('link', { name: 'Tổng quan' })).toHaveFocus());
    vi.unstubAllGlobals();
  });

  it('đóng dialog bằng Escape và trả focus về phần tử mở', async () => {
    render(<DialogExample />);
    const trigger = screen.getByRole('button', { name: 'Mở hộp thoại' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Xác nhận' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Xác nhận' })).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
