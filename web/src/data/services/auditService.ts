/**
 * 审核 service —— 模式分发：live / mock。
 */
import type { AuditItem, InspirationStatus } from '../types';
import { apiMode } from './apiMode';
import * as mock from './auditService.mock';
import * as live from './auditService.live';

export type { AuditItemWithInspiration } from './auditService.live';

const LIVE = (): boolean => apiMode() === 'live';

export function fetchAuditQueue(): Promise<AuditItem[]> {
  return LIVE() ? live.fetchAuditQueue() : mock.fetchAuditQueue();
}

export function createAuditItem(
  inspiration: import('../types').Inspiration
): Promise<AuditItem> {
  return LIVE()
    ? live.createAuditItem(inspiration)
    : mock.createAuditItem(inspiration);
}

/**
 * 通过 / 驳回。
 * @param reason 驳回理由（live 模式必填，后端校验；mock 模式记录到本地）
 */
export function decideAudit(
  auditId: string,
  decision: Extract<InspirationStatus, 'approved' | 'rejected'>,
  reason?: string
): Promise<{ audit: AuditItem; inspirationID: string }> {
  return LIVE()
    ? live.decideAudit(auditId, decision, reason)
    : mock.decideAudit(auditId, decision, reason);
}
