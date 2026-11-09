import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { useTheme } from '@/app/providers/theme-context';

function Selector() {
  const { theme, preference, setPreference } = useTheme();
  return (
    <>
      <span data-testid="theme">
        {theme}:{preference}
      </span>
      <button onClick={() => setPreference('system')}>Hệ thống</button>
      <button onClick={() => setPreference('light')}>Sáng</button>
    </>
  );
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});
describe('Chế độ màu', () => {
  it('theo dõi hệ điều hành trong chế độ system và giữ lựa chọn thủ công', () => {
    let dark = false;
    let listener: (() => void) | undefined;
    vi.stubGlobal('matchMedia', () => ({
      get matches() {
        return dark;
      },
      addEventListener: (_name: string, callback: () => void) => {
        listener = callback;
      },
      removeEventListener: () => {},
    }));
    render(
      <ThemeProvider>
        <Selector />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('theme')).toHaveTextContent('light:system');
    dark = true;
    fireEvent.click(screen.getByRole('button', { name: 'Hệ thống' }));
    if (!listener) throw new Error('Thiếu listener OS');
    act(() => listener?.());
    expect(screen.getByTestId('theme')).toHaveTextContent('dark:system');
    fireEvent.click(screen.getByRole('button', { name: 'Sáng' }));
    expect(localStorage.getItem('documind-theme')).toBe('light');
    expect(screen.getByTestId('theme')).toHaveTextContent('light:light');
  });
  it('nhận lựa chọn giao diện từ tab khác', () => {
    render(
      <ThemeProvider>
        <Selector />
      </ThemeProvider>,
    );
    act(() =>
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'documind-theme',
          newValue: 'dark',
          storageArea: localStorage,
        }),
      ),
    );
    expect(screen.getByTestId('theme')).toHaveTextContent('dark:dark');
  });
});
