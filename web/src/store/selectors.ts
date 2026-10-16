import type { Inspiration, AuditItem } from '@/data/types';

/**
 * 派生选择器（纯函数，输入 state 切片，返回过滤 / 聚合结果）。
 * 组件中以 useAppStore(selector) 订阅对应切片后再调用这些函数。
 */

/** 仅通过内容（灵感广场使用） */
export function selectApproved(inspirations: Inspiration[]): Inspiration[] {
  return inspirations.filter((i) => i.status === 'approved');
}

/** 按创建者过滤（我的灵感使用） */
export function selectByCreator(
  inspirations: Inspiration[],
  creatorID: string
): Inspiration[] {
  return inspirations.filter((i) => i.creatorID === creatorID);
}

/** 仅待审审核项（审核台队列使用） */
export function selectPendingAudits(auditQueue: AuditItem[]): AuditItem[] {
  return auditQueue.filter((a) => a.status === 'pending');
}

/** 我的灵感统计卡 */
export interface MineStats {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
}

export function selectMineStats(
  inspirations: Inspiration[],
  creatorID: string
): MineStats {
  const mine = selectByCreator(inspirations, creatorID);
  return {
    total: mine.length,
    approved: mine.filter((i) => i.status === 'approved').length,
    pending: mine.filter((i) => i.status === 'pending').length,
    rejected: mine.filter((i) => i.status === 'rejected').length,
  };
}

/** 收藏列表（基于 isFavorite） */
export function selectFavorites(inspirations: Inspiration[]): Inspiration[] {
  return inspirations.filter((i) => i.isFavorite);
}
