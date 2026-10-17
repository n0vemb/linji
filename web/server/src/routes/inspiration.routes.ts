/**
 * 灵感路由：CRUD + 草稿提交。
 *
 * 权限模型（与产品 spec 一致）：
 * - 广场（scope=plaza）：所有人可见，仅 approved
 * - 我的（scope=mine）：仅本人全部状态
 * - 管理员（scope=all）：全部（审计需要）
 * - 编辑 / 删除：**仅创建者本人**，管理员也不行（管理员的工具是驳回，不是删别人东西）
 *
 * 体检报告由**服务端**用同一套 scorer 现算（不信任客户端上传的分数）——
 * 前端页面上的即时报告只是预览，落库以服务端为准。
 */
import type { FastifyInstance } from 'fastify';
import type {
  Inspiration,
  InspirationDraft,
  InspirationStatus,
} from '../../../src/data/types';
import { generateReport } from '../../../src/data/health/scorer';
import { getDb } from '../db';
import { badRequest, forbidden, notFound } from '../lib/apiError';
import { newId, nowIso } from '../lib/id';
import {
  rowToInspiration,
  type InspirationRow,
} from '../lib/rowMap';

/** 列表查询：isFavorite 按当前用户 LEFT JOIN 回填 */
const SELECT_WITH_FAV = `
  SELECT i.*, u.display_name AS creator_name,
         CASE WHEN f.user_id IS NULL THEN 0 ELSE 1 END AS is_favorite
  FROM inspirations i
  JOIN users u ON u.id = i.creator_id
  LEFT JOIN favorites f
    ON f.inspiration_id = i.id AND f.user_id = @userId
`;

function listRows(
  where: string,
  params: Record<string, unknown>,
  orderBy = 'i.created_at DESC'
): InspirationRow[] {
  const db = getDb();
  const stmt = db.prepare(`${SELECT_WITH_FAV} WHERE ${where} ORDER BY ${orderBy}`);
  return stmt.all(params) as InspirationRow[];
}

function getRow(id: string, userId: string): InspirationRow | null {
  const db = getDb();
  const stmt = db.prepare(`${SELECT_WITH_FAV} WHERE i.id = @id`);
  return (stmt.get({ id, userId }) as InspirationRow | undefined) ?? null;
}

function requireDraft(draft: InspirationDraft | undefined): InspirationDraft {
  if (!draft || !draft.title?.trim() || !draft.copy?.trim()) {
    throw badRequest('标题与文案不能为空');
  }
  if (!['image', 'video'].includes(draft.mediaType)) {
    throw badRequest('素材类型必须是 image / video');
  }
  if (!['douyin', 'xiaohongshu'].includes(draft.platform)) {
    throw badRequest('目标平台必须是抖音 / 小红书');
  }
  return draft;
}

export default async function inspirationRoutes(fastify: FastifyInstance) {
  const db = getDb();

  /** 列表：scope = plaza（默认，仅已通过）| mine（本人全部）| all（管理员） */
  fastify.get<{ Querystring: { scope?: string; status?: string } }>(
    '/inspirations',
    { preHandler: [fastify.requireAuth] },
    async (request) => {
      const me = request.authUser!;
      const scope = request.query.scope ?? 'plaza';
      const status = request.query.status as InspirationStatus | undefined;

      let where: string;
      const params: Record<string, unknown> = { userId: me.id };

      if (scope === 'mine') {
        where = 'i.creator_id = @userId';
      } else if (scope === 'all') {
        if (me.role !== 'admin') throw forbidden('仅管理员可查看全部灵感');
        where = '1 = 1';
      } else {
        where = "i.status = 'approved'";
      }
      if (status) {
        where += ' AND i.status = @status';
        params.status = status;
      }

      const rows = listRows(where, params);
      return { inspirations: rows.map(rowToInspiration) as Inspiration[] };
    }
  );

  /** 详情：本人任意状态 / 他人仅已通过 */
  fastify.get<{ Params: { id: string } }>(
    '/inspirations/:id',
    { preHandler: [fastify.requireAuth] },
    async (request) => {
      const me = request.authUser!;
      const row = getRow(request.params.id, me.id);
      if (!row) throw notFound('灵感不存在或无权查看');
      if (row.creator_id !== me.id && row.status !== 'approved') {
        throw notFound('灵感不存在或无权查看');
      }
      return { inspiration: rowToInspiration(row) };
    }
  );

  /**
   * 新建：asDraft = true → 草稿（不进审核队列）；
   * false → 待审。两种情况都服务端现算体检报告（草稿也要能看体检）。
   */
  fastify.post<{
    Body: { draft?: InspirationDraft; asDraft?: boolean };
  }>('/inspirations', { preHandler: [fastify.requireAuth] }, async (request) => {
    const me = request.authUser!;
    const draft = requireDraft(request.body?.draft);
    const asDraft = request.body?.asDraft ?? false;

    const id = newId('insp');
    const report = generateReport({ inspirationID: id, ...draft });
    const now = nowIso();

    db.prepare(
      `INSERT INTO inspirations (
        id, creator_id, title, copy, tags_json, media_type, images_json,
        video_url, platform, status, reject_reason, health_score,
        health_breakdown_json, compliance, long_tail_json, health_report_json,
        submitted_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      me.id,
      draft.title.trim(),
      draft.copy,
      JSON.stringify(draft.tags),
      draft.mediaType,
      JSON.stringify(draft.images),
      draft.videoUrl,
      draft.platform,
      asDraft ? 'draft' : 'pending',
      report.totalScore,
      JSON.stringify(report.dimensions),
      report.compliance.level,
      JSON.stringify(report.longTailWords),
      JSON.stringify(report),
      asDraft ? null : now,
      now,
      now
    );

    const row = getRow(id, me.id)!;
    return { inspiration: rowToInspiration(row) };
  });

  /**
   * 编辑（仅创建者）。重新现算体检报告。
   *
   * 状态语义（产品决策）：已通过 / 已驳回的内容被修改后**回到待审**——
   * 审核是对「那一版内容」的结论，内容变了结论就失效，必须重审。
   * 否则广场上会出现「通过了审核但内容已改」的合规漏洞。
   */
  fastify.put<{ Params: { id: string }; Body: { draft?: InspirationDraft } }>(
    '/inspirations/:id',
    { preHandler: [fastify.requireAuth] },
    async (request) => {
      const me = request.authUser!;
      const draft = requireDraft(request.body?.draft);
      const existing = getRow(request.params.id, me.id);
      if (!existing) throw notFound('灵感不存在');
      if (existing.creator_id !== me.id) {
        throw forbidden('只有创建者可以编辑该灵感');
      }

      const report = generateReport({
        inspirationID: existing.id,
        ...draft,
      });
      const now = nowIso();
      const wasDecided =
        existing.status === 'approved' || existing.status === 'rejected';
      const nextStatus: InspirationStatus = wasDecided
        ? 'pending'
        : (existing.status as InspirationStatus);

      db.prepare(
        `UPDATE inspirations SET
          title = ?, copy = ?, tags_json = ?, media_type = ?, images_json = ?,
          video_url = ?, platform = ?, status = ?, reject_reason = NULL,
          health_score = ?, health_breakdown_json = ?, compliance = ?,
          long_tail_json = ?, health_report_json = ?,
          submitted_at = ?, updated_at = ?
        WHERE id = ?`
      ).run(
        draft.title.trim(),
        draft.copy,
        JSON.stringify(draft.tags),
        draft.mediaType,
        JSON.stringify(draft.images),
        draft.videoUrl,
        draft.platform,
        nextStatus,
        report.totalScore,
        JSON.stringify(report.dimensions),
        report.compliance.level,
        JSON.stringify(report.longTailWords),
        JSON.stringify(report),
        wasDecided || existing.status === 'pending' ? now : null,
        now,
        existing.id
      );

      const row = getRow(existing.id, me.id)!;
      return { inspiration: rowToInspiration(row) };
    }
  );

  /** 删除（仅创建者本人） */
  fastify.delete<{ Params: { id: string } }>(
    '/inspirations/:id',
    { preHandler: [fastify.requireAuth] },
    async (request) => {
      const me = request.authUser!;
      const existing = db
        .prepare('SELECT id, creator_id FROM inspirations WHERE id = ?')
        .get(request.params.id) as
        | { id: string; creator_id: string }
        | undefined;
      if (!existing) throw notFound('灵感不存在');
      // 创建者本人可删；管理员拥有审核下架权限（管理员的工具是「驳回 + 下架」，
      // 不是编辑他人内容）。普通创作者（非创建者）一律禁止。
      const isOwner = existing.creator_id === me.id;
      const isAdmin = me.role === 'admin';
      if (!isOwner && !isAdmin) {
        throw forbidden('只有创建者或管理员可以删除该灵感');
      }
      db.prepare('DELETE FROM favorites WHERE inspiration_id = ?').run(existing.id);
      db.prepare('DELETE FROM inspirations WHERE id = ?').run(existing.id);
      return { ok: true };
    }
  );

  /** 草稿提交审核：draft → pending（补齐草稿闭环） */
  fastify.post<{ Params: { id: string } }>(
    '/inspirations/:id/submit',
    { preHandler: [fastify.requireAuth] },
    async (request) => {
      const me = request.authUser!;
      const existing = db
        .prepare('SELECT * FROM inspirations WHERE id = ?')
        .get(request.params.id) as InspirationRow | undefined;
      if (!existing) throw notFound('灵感不存在');
      if (existing.creator_id !== me.id) {
        throw forbidden('只有创建者可以提交该灵感');
      }
      if (existing.status !== 'draft') {
        throw badRequest('该灵感不是草稿状态');
      }
      db.prepare(
        `UPDATE inspirations SET status = 'pending', submitted_at = ?, updated_at = ?
         WHERE id = ?`
      ).run(nowIso(), nowIso(), existing.id);
      const row = getRow(existing.id, me.id)!;
      return { inspiration: rowToInspiration(row) };
    }
  );
}
