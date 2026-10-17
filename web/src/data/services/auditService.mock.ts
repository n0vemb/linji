import type { AuditItem, Inspiration, InspirationStatus } from '../types';
import { MOCK_INSPIRATIONS } from '../mock/inspirations';
import { getMockReport } from '../mock/reports';
import { setInspirationStatus } from './inspirationService';

/**
 * 审核 service 层（全 Promise 化）。
 * 维护审核队列（内存，刷新重置）。通过 / 驳回仅切换内存状态（D2 Deferred）。
 */

const delay = (ms = 300): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** 由灵感构建审核项（只读摘要） */
function buildAuditItem(insp: Inspiration): AuditItem {
  const report = getMockReport(insp.id);
  const note =
    insp.compliance === 'block'
      ? report?.compliance.blockingReason ?? '存在合规硬阻断，需整改后重新提交'
      : insp.compliance === 'warn'
        ? '存在风险提示，建议优化后提交'
        : '体检通过，可提交审核';

  return {
    id: `audit_${insp.id}`,
    inspirationID: insp.id,
    creatorName: insp.creatorName,
    status: insp.status,
    reportSummary: {
      healthScore: insp.healthScore,
      compliance: insp.compliance,
      note,
    },
    decidedAt: null,
  };
}

/** 种子：仅 pending 灵感进入审核队列 */
let db: AuditItem[] = clone(
  MOCK_INSPIRATIONS.filter((i) => i.status === 'pending').map(buildAuditItem)
);

/** 上传新建灵感后追加审核项 */
export async function createAuditItem(insp: Inspiration): Promise<AuditItem> {
  await delay(120);
  const item = buildAuditItem(insp);
  db = [...db, item];
  return clone(item);
}

export async function fetchAuditQueue(): Promise<AuditItem[]> {
  await delay();
  // pending 优先，已决定的按决定时间倒序
  const sorted = [...db].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return 0;
  });
  return clone(sorted);
}

/** 通过 / 驳回：同时更新审核项与对应灵感状态 */
export async function decideAudit(
  auditId: string,
  decision: Extract<InspirationStatus, 'approved' | 'rejected'>,
  reason?: string
): Promise<{ audit: AuditItem; inspirationID: string }> {
  await delay();
  const item = db.find((a) => a.id === auditId);
  if (!item) throw new Error(`Audit item ${auditId} not found`);
  const now = new Date().toISOString();
  db = db.map((a) =>
    a.id === auditId ? { ...a, status: decision, decidedAt: now } : a
  );
  await setInspirationStatus(item.inspirationID, decision, reason);
  const updated = db.find((a) => a.id === auditId)!;
  return { audit: clone(updated), inspirationID: item.inspirationID };
}
