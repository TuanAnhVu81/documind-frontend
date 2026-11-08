import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { AppErrorBoundary } from '@/components/feedback/AppErrorBoundary';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { ToastProvider } from '@/components/ui/Feedback';
import { queryClient } from '@/app/query-client';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { useAuth } from '@/features/auth/use-auth';
import { DocumentsSync } from '@/features/documents/DocumentsSync';

const HomePage = lazy(() => import('@/pages/HomePage'));
const DocumentsPage = lazy(() => import('@/features/documents/DocumentsPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const AuthPage = lazy(() =>
  import('@/pages/AuthPage').then((module) => ({ default: module.AuthPage })),
);

function ProtectedPage({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();
  if (auth.status === 'checking')
    return (
      <main className="page-loading" role="status">
        {auth.notice ?? 'Đang kiểm tra phiên đăng nhập…'}{' '}
        {auth.notice && (
          <button type="button" onClick={() => void auth.refresh().catch(() => {})}>
            Thử lại
          </button>
        )}
      </main>
    );
  if (auth.status === 'guest')
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children;
}

export function App() {
  return (
    <AppErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <QueryClientProvider client={queryClient}>
              <DocumentsSync />
              <BrowserRouter>
                <Suspense
                  fallback={
                    <main className="page-loading" role="status">
                      Đang tải trang…
                    </main>
                  }
                >
                  <Routes>
                    <Route path="/" element={<Navigate to="/app" replace />} />
                    <Route
                      path="/app"
                      element={
                        <ProtectedPage>
                          <HomePage />
                        </ProtectedPage>
                      }
                    />
                    <Route
                      path="/app/documents"
                      element={
                        <ProtectedPage>
                          <DocumentsPage />
                        </ProtectedPage>
                      }
                    />
                    <Route path="/login" element={<AuthPage mode="login" />} />
                    <Route path="/register" element={<AuthPage mode="register" />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </QueryClientProvider>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}
