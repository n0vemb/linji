/**
 * LinJi·灵集 后端入口。
 *
 * 一个进程同时提供：
 * - /api/*   业务 API（认证 / 灵感 / 审核 / 收藏 / 采集 / 上传）
 * - /media/* 上传与采集转存的媒体文件
 * - /*       生产模式托管前端构建产物（dist）+ SPA fallback
 *
 * 开发模式：vite（5173）通过 proxy 把 /api 与 /media 转到这里（8787）。
 */
import fastify from 'fastify';
import multipart from '@fastify/multipart';
import staticPlugin from '@fastify/static';
import fs from 'node:fs';
import path from 'node:path';
import { config, isProd } from './env';
import { initDb } from './db';
import { authPlugin } from './auth';
import { ApiError } from './lib/apiError';
import authRoutes from './routes/auth.routes';
import inspirationRoutes from './routes/inspiration.routes';
import auditRoutes from './routes/audit.routes';
import favoriteRoutes from './routes/favorite.routes';
import collectRoutes from './routes/collect.routes';
import mediaRoutes from './routes/media.routes';

export async function buildServer() {
  const app = fastify({
    logger: {
      // 生产只留 warn/error，别把每次请求都刷进日志
      level: isProd ? 'warn' : 'info',
    },
    bodyLimit: 10 * 1024 * 1024,
  });

  await app.register(multipart, {
    limits: {
      fileSize: config.maxVideoBytes,
      files: 20,
    },
  });
  await app.register(authPlugin);

  // 统一错误出口：ApiError → 带状态码的 JSON；未知错误 → 500
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      reply.status(error.status).send({
        error: { message: error.message, status: error.status },
      });
      return;
    }
    // Fastify 自带的 body 解析错误等
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    if (status >= 400 && status < 500) {
      reply.status(status).send({
        error: { message: error.message, status },
      });
      return;
    }
    request.log.error(error);
    reply.status(500).send({
      error: { message: '服务器内部错误，请稍后重试', status: 500 },
    });
  });

  // 健康检查（不依赖 DB，便于探活）
  app.get('/api/health', async () => ({
    ok: true,
    env: config.env,
    time: new Date().toISOString(),
  }));

  const apiPrefix = '/api';
  await app.register(
    async (instance) => {
      await instance.register(authRoutes);
      await instance.register(inspirationRoutes);
      await instance.register(auditRoutes);
      await instance.register(favoriteRoutes);
      await instance.register(collectRoutes);
      await instance.register(mediaRoutes);
    },
    { prefix: apiPrefix }
  );

  // 媒体静态目录（上传 + 采集转存）
  const uploadsRoot = path.join(config.dataDir, 'uploads');
  fs.mkdirSync(uploadsRoot, { recursive: true });
  await app.register(staticPlugin, {
    root: uploadsRoot,
    prefix: '/media/',
    decorateReply: false,
  });

  // 生产模式：托管前端产物 + SPA fallback（非 /api / /media 的 GET 都回 index.html）
  if (isProd && fs.existsSync(config.distDir)) {
    await app.register(staticPlugin, {
      root: config.distDir,
      prefix: '/',
      decorateReply: false,
    });
    const indexHtml = path.join(config.distDir, 'index.html');
    app.setNotFoundHandler((request, reply) => {
      if (
        request.method === 'GET' &&
        !request.url.startsWith('/api') &&
        !request.url.startsWith('/media')
      ) {
        // 直接读文件发送（不依赖 reply.sendFile，避免与 /media 的装饰器冲突）
        reply
          .type('text/html; charset=utf-8')
          .send(fs.readFileSync(indexHtml));
        return;
      }
      reply.status(404).send({
        error: { message: '接口不存在', status: 404 },
      });
    });
  }

  return app;
}

/** 直接运行（tsx server/src/index.ts）时启动 */
async function main() {
  initDb();
  const app = await buildServer();
  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(
      `[server] API 已启动：http://${config.host === '0.0.0.0' ? '127.0.0.1' : config.host}:${config.port}`
    );
    if (isProd) console.log(`[server] 前端产物托管自：${config.distDir}`);
    if (config.collectProxy) {
      console.log(`[server] 采集抓取走代理：${config.collectProxy}`);
    } else {
      console.log('[server] 采集抓取直连（海外部署）');
    }
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// 被直接执行时才启动（测试里 import buildServer 不应起服务）
const isDirectRun =
  process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]));
if (isDirectRun) {
  void main();
}
