/**
 * 收藏路由：per-user 多对多。
 * 灵感行上不存 isFavorite（那是 per-user 状态），列表时按当前用户回填。
 */
import type { FastifyInstance } from 'fastify';
import type { Inspiration } from '../../../src/data/types';
import { getDb } from '../db';
import { notFound } from '../lib/apiError';
import { nowIso } from '../lib/id';
import { rowToInspiration, type InspirationRow } from '../lib/rowMap';

const SELECT_WITH_FAV = `
  SELECT i.*, u.display_name AS creator_name,
         CASE WHEN f.user_id IS NULL THEN 0 ELSE 1 END AS is_favorite
  FROM inspirations i
  JOIN users u ON u.id = i.creator_id
  LEFT JOIN favorites f
    ON f.inspiration_id = i.id AND f.user_id = @userId
`;

export default async function favoriteRoutes(fastify: FastifyInstance) {
  const db = getDb();
  const auth = [fastify.requireAuth];

  /** 我的收藏列表（仅已通过的他人内容才有收藏意义；本人内容也允许收藏） */
  fastify.get('/favorites', { preHandler: auth }, async (request) => {
    const me = request.authUser!;
    const rows = db
      .prepare(
        `${SELECT_WITH_FAV}
         JOIN favorites fav ON fav.inspiration_id = i.id AND fav.user_id = @userId
         ORDER BY fav.created_at DESC`
      )
      .all({ userId: me.id }) as InspirationRow[];
    return { inspirations: rows.map(rowToInspiration) as Inspiration[] };
  });

  /** 收藏 / 取消收藏（同一端点切换，幂等） */
  fastify.post<{ Params: { id: string } }>(
    '/inspirations/:id/favorite',
    { preHandler: auth },
    async (request) => {
      const me = request.authUser!;
      const exists = db
        .prepare('SELECT id FROM inspirations WHERE id = ?')
        .get(request.params.id);
      if (!exists) throw notFound('灵感不存在');

      const already = db
        .prepare(
          'SELECT 1 AS x FROM favorites WHERE user_id = ? AND inspiration_id = ?'
        )
        .get(me.id, request.params.id);
      if (already) {
        db.prepare(
          'DELETE FROM favorites WHERE user_id = ? AND inspiration_id = ?'
        ).run(me.id, request.params.id);
        return { isFavorite: false };
      }
      db.prepare(
        'INSERT INTO favorites (user_id, inspiration_id, created_at) VALUES (?, ?, ?)'
      ).run(me.id, request.params.id, nowIso());
      return { isFavorite: true };
    }
  );
}
