/**
 * 审核路由（仅管理员）：
 * - 队列：pending 优先，已决定的按决定时间倒序；每项**内嵌完整灵感**
 *   （审核人要看到素材 / 标题 / 文案 / 话题，而不是只看评分摘要）
 * - 通过 / 驳回：驳回**必须填理由**（创作者看不到理由就无法改进），
 *   每次决定写 audit_logs 留痕。
 */
import type { FastifyInstance } from 'fastify';
import type { AuditItem, Inspiration } from '../../../src/data/types';
import { getDb } from '../db';
import { badRequest, notFound } from '../lib/apiError';
import { newId, nowIso } from '../lib/id';
import { auditNote, rowToInspiration, type InspirationRow } from '../lib/rowMap';

const SELECT_ALL = `
  SELECT i.*, u.display_name AS creator_name
  FROM inspirations i
  JOIN users u ON u.id = i.creator_id
`;

function toAuditItem(row: InspirationRow): AuditItem & { inspiration: Inspiration } {
  const inspiration = rowToInspiration(row);
  const report = inspiration.healthReport;
  return {
    // 与前端既有口径一致：audit_<inspirationId>
    id: `audit_${row.id}`,
    inspirationID: row.id,
    creatorName: row.creator_name,
    status: row.status as AuditItem['status'],
    reportSummary: {
      healthScore: row.health_score,
      compliance: row.compliance as AuditItem['reportSummary']['compliance'],
      note: auditNote(
        row.compliance as AuditItem['reportSummary']['compliance'],
        report?.compliance.blockingReason ?? null
      ),
    },
    decidedAt: null,
    inspiration,
  };
}

export default async function auditRoutes(fastify: FastifyInstance) {
  const db = getDb();

  const guard = [fastify.requireAuth, fastify.requireAdmin];

  /** 审核队列。status=pending（默认）只看待审；all 看全部（含已决定） */
  fastify.get<{ Querystring: { status?: string } }>(
    '/audit/queue',
    { preHandler: guard },
    async (request) => {
      const only = request.query.status ?? 'pending';
      const rows = (
        only === 'all'
          ? db.prepare(`${SELECT_ALL} ORDER BY i.submitted_at DESC NULLS LAST, i.created_at DESC`)
          : db.prepare(`${SELECT_ALL} WHERE i.status = 'pending' ORDER BY i.submitted_at ASC, i.created_at ASC`)
      ).all() as InspirationRow[];
      // pending 优先，其余按提交时间倒序（与前端 mock 口径一致）
      const sorted = [...rows].sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return 0;
      });
      return { queue: sorted.map(toAuditItem) };
    }
  );

  /** 通过 */
  fastify.post<{ Params: { id: string } }>(
    '/audit/:id/approve',
    { preHandler: guard },
    async (request) => {
      const auditor = request.authUser!;
      const row = db
        .prepare('SELECT * FROM inspirations WHERE id = ?')
        .get(request.params.id) as InspirationRow | undefined;
      if (!row) throw notFound('灵感不存在');
      if (row.status !== 'pending') throw badRequest('该灵感不在待审状态');

      const now = nowIso();
      const decide = db.transaction(() => {
        db.prepare(
          `UPDATE inspirations SET status = 'approved', reject_reason = NULL, updated_at = ?
           WHERE id = ?`
        ).run(now, row.id);
        db.prepare(
          `INSERT INTO audit_logs (id, inspiration_id, auditor_id, action, reason, created_at)
           VALUES (?, ?, ?, 'approve', NULL, ?)`
        ).run(newId('audit'), row.id, auditor.id, now);
      });
      decide();

      const updated = db
        .prepare(`${SELECT_ALL} WHERE i.id = ?`)
        .get(row.id) as InspirationRow;
      return { audit: toAuditItem(updated) };
    }
  );

  /** 驳回：理由必填（trim 后至少 2 字），写流水 */
  fastify.post<{ Params: { id: string }; Body: { reason?: string } }>(
    '/audit/:id/reject',
    { preHandler: guard },
    async (request) => {
      const auditor = request.authUser!;
      const reason = request.body?.reason?.trim() ?? '';
      if (reason.length < 2) {
        throw badRequest('驳回必须填写理由（至少 2 个字），创作者需要知道怎么改');
      }
      const row = db
        .prepare('SELECT * FROM inspirations WHERE id = ?')
        .get(request.params.id) as InspirationRow | undefined;
      if (!row) throw notFound('灵感不存在');
      if (row.status !== 'pending') throw badRequest('该灵感不在待审状态');

      const now = nowIso();
      const decide = db.transaction(() => {
        db.prepare(
          `UPDATE inspirations SET status = 'rejected', reject_reason = ?, updated_at = ?
           WHERE id = ?`
        ).run(reason, now, row.id);
        db.prepare(
          `INSERT INTO audit_logs (id, inspiration_id, auditor_id, action, reason, created_at)
           VALUES (?, ?, ?, 'reject', ?, ?)`
        ).run(newId('audit'), row.id, auditor.id, reason, now);
      });
      decide();

      const updated = db
        .prepare(`${SELECT_ALL} WHERE i.id = ?`)
        .get(row.id) as InspirationRow;
      return { audit: toAuditItem(updated) };
    }
  );
}
