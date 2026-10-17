/**
 * 认证：JWT 签发 + 路由守卫。
 * 密码哈希用 bcryptjs（纯 JS，无原生编译，跨平台省心）。
 */
import fp from 'fastify-plugin';
import fjwt from '@fastify/jwt';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { unauthorized } from './lib/apiError';
import { config } from './env';

/** JWT payload 里带的最小用户信息 */
export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: 'creator' | 'admin';
}

declare module 'fastify' {
  interface FastifyRequest {
    /** requireAuth 通过后注入 */
    authUser?: AuthUser;
  }
}

export const authPlugin = fp(async (fastify) => {
  await fastify.register(fjwt, {
    secret: config.jwtSecret,
    sign: { expiresIn: config.jwtExpiresIn },
  });

  /** 必须登录。挂在路由的 preHandler 上。 */
  fastify.decorate(
    'requireAuth',
    async (request: FastifyRequest, _reply: FastifyReply) => {
      try {
        const payload = await request.jwtVerify<AuthUser>();
        request.authUser = payload;
      } catch {
        throw unauthorized('登录已过期，请重新登录');
      }
    }
  );

  /** 必须管理员。挂在 requireAuth 之后。 */
  fastify.decorate(
    'requireAdmin',
    async (request: FastifyRequest, _reply: FastifyReply) => {
      if (request.authUser?.role !== 'admin') {
        throw unauthorized('需要管理员权限');
      }
    }
  );
});

declare module 'fastify' {
  interface FastifyInstance {
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
