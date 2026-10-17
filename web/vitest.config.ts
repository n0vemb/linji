import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// 独立 vitest 配置：不污染 vite.config.ts（避免影响 `tsc && vite build`）。
// jsdom 环境用于 clipboard / download 的 DOM 依赖；@ 别名与 vite.config 保持一致。
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    include: [
      'src/**/*.test.{ts,tsx}',
      // 后端集成测试（文件头有 @vitest-environment node 覆盖环境）
      'server/src/**/*.test.ts',
    ],
    clearMocks: true,
  },
});
