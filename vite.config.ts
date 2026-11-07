import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'BACKEND_');
  const target = env.BACKEND_PROXY_TARGET || 'http://localhost:8080';
  let url: URL;
  try {
    url = new URL(target);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      throw new Error('invalid target');
    }
  } catch {
    throw new Error(
      'BACKEND_PROXY_TARGET phải là HTTP(S) origin, không chứa mật khẩu, đường dẫn hoặc query.',
    );
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api/v1': { target: url.origin, changeOrigin: true },
        '^/actuator/health$': { target: url.origin, changeOrigin: true },
      },
    },
    test: { environment: 'jsdom', setupFiles: ['./src/tests/setup.ts'] },
  };
});
