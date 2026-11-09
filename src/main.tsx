import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/400-italic.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import '@fontsource/be-vietnam-pro/700-italic.css';
import '@/app/styles/global.css';

const root = document.getElementById('root');
if (!root) throw new Error('Không tìm thấy vùng hiển thị ứng dụng.');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
