/**
 * 认证路由：注册 / 登录 / 当前用户。
 * 注册只产生 creator 角色；admin 只能由种子数据或直接改库产生（内部工具）。
 */
import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { getDb } from '../db';
import { badRequest, unauthorized } from '../lib/apiError';
import { newId, nowIso } from '../lib/id';
import type { AuthUser } from '../auth';

interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  display_name: string;
  role: string;
}

function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role as AuthUser['role'],
  };
}

export default async function authRoutes(fastify: FastifyInstance) {
  const db = getDb();

  /** 登录：username + password → JWT */
  fastify.post<{ Body: { username?: string; password?: string } }>(
    '/auth/login',
    async (request) => {
      const { username, password } = request.body ?? {};
      if (!username?.trim() || !password) {
        throw badRequest('请输入用户名和密码');
      }
      const row = db
        .prepare('SELECT * FROM users WHERE username = ?')
        .get(username.trim()) as UserRow | undefined;
      if (!row || !bcrypt.compareSync(password, row.password_hash)) {
        throw unauthorized('用户名或密码错误');
      }
      const user = toAuthUser(row);
      const token = fastify.jwt.sign(user);
      return { token, user };
    }
  );

  /** 注册：默认 creator */
  fastify.post<{
    Body: { username?: string; password?: string; displayName?: string };
  }>('/auth/register', async (request) => {
    const { username, password, displayName } = request.body ?? {};
    const u = username?.trim() ?? '';
    if (!/^[a-zA-Z0-9_]{2,20}$/.test(u)) {
      throw badRequest('用户名需为 2-20 位字母 / 数字 / 下划线');
    }
    if (!password || password.length < 6) {
      throw badRequest('密码至少 6 位');
    }
    const exists = db
      .prepare('SELECT id FROM users WHERE username = ?')
      .get(u);
    if (exists) throw badRequest('用户名已被占用');

    const id = newId('user');
    db.prepare(
      `INSERT INTO users (id, username, password_hash, display_name, role, created_at)
       VALUES (?, ?, ?, ?, 'creator', ?)`
    ).run(
      id,
      u,
      bcrypt.hashSync(password, 10),
      displayName?.trim() || u,
      nowIso()
    );
    const user: AuthUser = {
      id,
      username: u,
      displayName: displayName?.trim() || u,
      role: 'creator',
    };
    const token = fastify.jwt.sign(user);
    return { token, user };
  });

  /** 当前登录用户（前端刷新页面后凭 token 恢复登录态） */
  fastify.get('/auth/me', { preHandler: [fastify.requireAuth] }, async (request) => {
    const { id } = request.authUser!;
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as
      | UserRow
      | undefined;
    if (!row) throw unauthorized('账号不存在');
    return { user: toAuthUser(row) };
  });
}
