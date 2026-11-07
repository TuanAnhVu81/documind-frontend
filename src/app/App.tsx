import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppErrorBoundary } from '@/components/feedback/AppErrorBoundary';
import { ThemeProvider } from '@/app/providers/ThemeProvider';
import { ToastProvider } from '@/components/ui/Feedback';

const HomePage = lazy(() => import('@/pages/HomePage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

export function App() {
  return (
    <AppErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <QueryClientProvider client={queryClient}>
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
                  <Route path="/app" element={<HomePage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </QueryClientProvider>
        </ToastProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}
