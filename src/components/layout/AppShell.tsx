import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  BookOpenText,
  ChevronDown,
  CircleHelp,
  FileText,
  LayoutGrid,
  Menu,
  MessageSquareText,
  Moon,
  Settings2,
  ShieldCheck,
  Sun,
  UserRound,
  ChartNoAxesCombined,
} from 'lucide-react';
import { useTheme } from '@/app/providers/theme-context';
import { Button } from '@/components/ui/Button';
import { Dropdown, DropdownItem, DropdownLabel, DropdownSeparator } from '@/components/ui/Dropdown';
import { Sheet } from '@/components/ui/Dialog';
import { Tooltip } from '@/components/ui/Tooltip';

const futureNavigation = [
  { label: 'Tài liệu', icon: FileText },
  { label: 'Hội thoại', icon: MessageSquareText },
  { label: 'Thống kê', icon: ChartNoAxesCombined },
  { label: 'Cài đặt', icon: Settings2 },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <Link
        className="shell-brand"
        to="/app"
        aria-label="DocuMind. KHÔNG GIAN TÀI LIỆU"
        onClick={onNavigate}
      >
        <span className="shell-brand-mark">
          <BookOpenText size={21} aria-hidden="true" />
        </span>
        <span className="shell-brand-copy">
          <strong>
            DocuMind<span>.</span>
          </strong>
          <small>KHÔNG GIAN TÀI LIỆU</small>
        </span>
      </Link>
      <nav className="shell-nav" aria-label="Điều hướng chính">
        <p className="shell-nav-label">KHÔNG GIAN LÀM VIỆC</p>
        <Link
          className="shell-nav-link shell-nav-link--active"
          to="/app"
          aria-current="page"
          aria-label="Tổng quan"
          onClick={onNavigate}
        >
          <LayoutGrid size={18} aria-hidden="true" />
          <span>Tổng quan</span>
        </Link>
        {futureNavigation.map(({ label, icon: Icon }) => (
          <div
            key={label}
            className="shell-nav-link shell-nav-link--future"
            role="img"
            aria-label={`${label} — Sắp có`}
            title={`${label} — Sắp có`}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
            <small>Sắp có</small>
          </div>
        ))}
      </nav>
      <div className="shell-sidebar-note">
        <span className="shell-note-icon">
          <ShieldCheck size={17} aria-hidden="true" />
        </span>
        <div>
          <strong>Một nơi cho tài liệu</strong>
          <p>Lưu giữ ngữ cảnh, tìm lại thông tin khi bạn cần.</p>
        </div>
      </div>
      <div className="shell-sidebar-footer">
        DOCUMIND <span>·</span> KHÔNG GIAN CÁ NHÂN
      </div>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const { theme, toggleTheme } = useTheme();

  function handleDrawer(open: boolean) {
    setDrawerOpen(open);
    if (!open)
      window.requestAnimationFrame(() => {
        const target =
          window.innerWidth >= 768
            ? sidebarRef.current?.querySelector<HTMLAnchorElement>('a[aria-current="page"]')
            : menuRef.current;
        target?.focus();
      });
  }

  useEffect(() => {
    if (!drawerOpen) return;
    function handleResize() {
      if (window.innerWidth >= 768) {
        setDrawerOpen(false);
        window.requestAnimationFrame(() =>
          sidebarRef.current?.querySelector<HTMLAnchorElement>('a[aria-current="page"]')?.focus(),
        );
      }
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawerOpen]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Đến nội dung chính
      </a>
      <aside className="shell-sidebar" ref={sidebarRef}>
        <SidebarContent />
      </aside>
      <Sheet
        open={drawerOpen}
        onOpenChange={handleDrawer}
        title="Điều hướng"
        description="Các mục trong không gian DocuMind."
        side="left"
      >
        <div className="shell-drawer-content">
          <SidebarContent onNavigate={() => handleDrawer(false)} />
        </div>
      </Sheet>
      <div className="shell-workspace">
        <header className="shell-header">
          <div className="shell-header-left">
            <Button
              ref={menuRef}
              className="mobile-menu-button"
              variant="ghost"
              size="icon"
              aria-label="Mở điều hướng"
              onClick={() => setDrawerOpen(true)}
            >
              <Menu size={20} />
            </Button>
            <div className="shell-breadcrumb">
              <span>KHÔNG GIAN</span>
              <span className="breadcrumb-divider">/</span>
              <strong>Tổng quan</strong>
            </div>
          </div>
          <div className="shell-header-actions">
            <Tooltip
              content={
                theme === 'light' ? 'Chuyển sang giao diện tối' : 'Chuyển sang giao diện sáng'
              }
            >
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                aria-label={
                  theme === 'light' ? 'Chuyển sang giao diện tối' : 'Chuyển sang giao diện sáng'
                }
              >
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
              </Button>
            </Tooltip>
            <span className="header-separator" />
            <Dropdown
              label="Tài khoản và giao diện"
              trigger={
                <Button variant="ghost" className="account-trigger">
                  <span className="account-avatar">
                    <UserRound size={16} aria-hidden="true" />
                  </span>
                  <span className="account-copy">
                    <strong>Tài khoản</strong>
                    <small>Chưa đăng nhập</small>
                  </span>
                  <span className="sr-only">Mở menu tài khoản</span>
                  <ChevronDown className="account-chevron" size={16} aria-hidden="true" />
                </Button>
              }
            >
              <DropdownLabel>TÀI KHOẢN</DropdownLabel>
              <p className="account-menu-hint">
                Chức năng đăng nhập sẽ có trong phiên bản tiếp theo.
              </p>
              <DropdownSeparator />
              <DropdownItem onSelect={toggleTheme}>
                {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
                {theme === 'light' ? 'Giao diện tối' : 'Giao diện sáng'}
              </DropdownItem>
            </Dropdown>
          </div>
        </header>
        <main id="main-content" className="shell-main">
          {children}
        </main>
        <footer className="shell-footer">
          <span>
            DocuMind <span aria-hidden="true">·</span> Không gian tài liệu của bạn
          </span>
          <span>
            <CircleHelp size={14} aria-hidden="true" /> Bắt đầu từ những điều bạn muốn biết.
          </span>
        </footer>
      </div>
    </div>
  );
}
