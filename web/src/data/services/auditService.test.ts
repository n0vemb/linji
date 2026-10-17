import { describe, it, expect } from 'vitest';
import {
  fetchAuditQueue,
  decideAudit,
} from './auditService.mock';
import type { InspirationStatus } from '@/data/types';

/**
 * 审核 service 测试：fetchAuditQueue 返回 Promise + 初始仅 pending 队列；
 * decideAudit 通过 / 驳回切换状态并返回灵感 ID（内存切换）。
 */

describe('auditService', () => {
  it('fetchAuditQueue 返回 Promise<AuditItem[]>，初始仅 pending（3 条）', async () => {
    const p = fetchAuditQueue();
    expect(p).toBeInstanceOf(Promise);
    const queue = await p;
    expect(queue.length).toBe(3);
    expect(queue.every((q) => q.status === 'pending')).toBe(true);
    queue.forEach((q) => {
      expect(typeof q.inspirationID).toBe('string');
      expect(typeof q.creatorName).toBe('string');
      expect(q.reportSummary).toHaveProperty('healthScore');
      expect(q.reportSummary).toHaveProperty('compliance');
      expect(q.reportSummary).toHaveProperty('note');
    });
  });

  it('decideAudit 通过 → 切换状态为 approved 并返回灵感 ID', async () => {
    const queue = await fetchAuditQueue();
    const target = queue[0];
    const { audit, inspirationID } = await decideAudit(
      target.id,
      'approved' as Extract<InspirationStatus, 'approved' | 'rejected'>
    );
    expect(audit.status).toBe('approved');
    expect(audit.decidedAt).not.toBeNull();
    expect(inspirationID).toBe(target.inspirationID);
  });
});
