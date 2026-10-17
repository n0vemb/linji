/**
 * 采集路由：粘贴分享文案 → 真实抓取 → 媒体转存。
 * 必须登录（抓取是重操作，且转存的媒体要归属到用户工作流）。
 */
import type { FastifyInstance } from 'fastify';
import { collectFromShareText } from '../services/collectors';
import { badRequest } from '../lib/apiError';

export default async function collectRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: { raw?: string } }>(
    '/collect',
    { preHandler: [fastify.requireAuth] },
    async (request) => {
      const raw = request.body?.raw ?? '';
      if (!raw.trim()) throw badRequest('请粘贴分享文案');
      return collectFromShareText(raw);
    }
  );
}
