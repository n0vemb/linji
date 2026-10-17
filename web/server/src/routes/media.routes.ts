/**
 * 媒体上传：multipart files[] → 落盘 → 返回 /media URL 列表。
 * 上传页提交前先把本地 blob: 文件换成服务端 URL，灵感行里存的就是可访问地址。
 */
import type { FastifyInstance } from 'fastify';
import { saveUpload } from '../services/mediaStore';
import { badRequest } from '../lib/apiError';

export default async function mediaRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/upload',
    { preHandler: [fastify.requireAuth] },
    async (request) => {
      const files: Array<{ url: string; isVideo: boolean }> = [];
      const parts = request.files();
      for await (const part of parts) {
        if (part.type !== 'file') continue;
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) {
          chunks.push(chunk as Buffer);
        }
        const saved = saveUpload(Buffer.concat(chunks), part.mimetype);
        files.push({ url: saved.url, isVideo: saved.isVideo });
      }
      if (files.length === 0) throw badRequest('没有收到文件');
      return { files };
    }
  );
}
