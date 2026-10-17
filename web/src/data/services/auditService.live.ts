/**
 * 审核 service —— live 模式实现（真实后端 API）。
 * 队列项内嵌完整灵感（审核人要看到素材 / 标题 / 文案 / 话题）。
 * 驳回理由由后端强制校验（必填），并写入 audit_logs 留痕。
 */
import type { AuditItem, Inspiration, InspirationStatus } from '../types';
import { api } from './apiClient';

/** 队列项（内嵌完整灵感，供审核面板直接渲染） */
export type AuditItemWithInspiration = AuditItem & { inspiration: Inspiration };

export async function fetchAuditQueue(
  status: 'pending' | 'all' = 'pending'
): Promise<AuditItemWithInspiration[]> {
  const res = await api.get<{ queue: AuditItemWithInspiration[] }>(
    `/audit/queue?status=${status}`
  );
  return res.queue;
}

/**
 * 新建灵感进入审核队列。
 * live 模式下后端在建 pending 灵感时已自动入队，
 * 这里只在本地构造一个同构对象供 store 立即渲染（无需再请求一次）。
 */
export async function createAuditItem(
  inspiration: Inspiration
): Promise<AuditItemWithInspiration> {
  const note =
    inspiration.compliance === 'block'
      ? inspiration.healthReport?.compliance.blockingReason ??
        '存在合规硬阻断，需整改后重新提交'
      : inspiration.compliance === 'warn'
        ? '存在风险提示，建议优化后提交'
        : '体检通过，可提交审核';
  return {
    id: `audit_${inspiration.id}`,
    inspirationID: inspiration.id,
    creatorName: inspiration.creatorName,
    status: inspiration.status,
    reportSummary: {
      healthScore: inspiration.healthScore,
      compliance: inspiration.compliance,
      note,
    },
    decidedAt: null,
    inspiration,
  };
}

/** 通过 / 驳回（驳回必须带理由，后端会校验） */
export async function decideAudit(
  auditId: string,
  decision: Extract<InspirationStatus, 'approved' | 'rejected'>,
  reason?: string
): Promise<{ audit: AuditItemWithInspiration; inspirationID: string }> {
  // auditId 形如 audit_<inspirationId>，后端按灵感 ID 寻址
  const inspirationID = auditId.replace(/^audit_/, '');
  const path =
    decision === 'approved'
      ? `/audit/${inspirationID}/approve`
      : `/audit/${inspirationID}/reject`;
  const res = await api.post<{ audit: AuditItemWithInspiration }>(
    path,
    decision === 'rejected' ? { reason } : undefined
  );
  return { audit: res.audit, inspirationID };
}
