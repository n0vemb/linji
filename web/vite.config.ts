import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Vite 配置：React 插件 + 别名 @ -> src + 后端 API 代理（开发模式）
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    open: false,
    proxy: {
      // 后端 API 与媒体文件统一转到 8787（npm run dev:all 一并启动）
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
      '/media': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
});
