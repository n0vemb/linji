/**
 * 灵感 service —— live 模式实现（真实后端 API）。
 * 与 mock 实现保持同一函数签名，调用方无感知。
 *
 * 注意：体检报告由**服务端**现算（不信任客户端分数），
 * 上传页本地生成的报告只是预览。
 */
import type {
  Inspiration,
  InspirationDraft,
  InspirationStatus,
} from '../types';
import { api } from './apiClient';

export type InspirationScope = 'plaza' | 'mine' | 'all';

export async function fetchInspirations(
  scope: InspirationScope = 'plaza'
): Promise<Inspiration[]> {
  const res = await api.get<{ inspirations: Inspiration[] }>(
    `/inspirations?scope=${scope}`
  );
  return res.inspirations;
}

export async function getInspiration(id: string): Promise<Inspiration | null> {
  try {
    const res = await api.get<{ inspiration: Inspiration }>(`/inspirations/${id}`);
    return res.inspiration;
  } catch (err) {
    if ((err as { status?: number }).status === 404) return null;
    throw err;
  }
}

export async function createInspiration(
  draft: InspirationDraft,
  _creator: { id: string; name: string },
  asDraft = false
): Promise<Inspiration> {
  // creator 参数忽略：后端从 JWT 取当前用户，客户端传什么都不算数
  const res = await api.post<{ inspiration: Inspiration }>('/inspirations', {
    draft,
    asDraft,
  });
  return res.inspiration;
}

/** 编辑（仅创建者）。已通过 / 已驳回的内容会被后端打回待审。 */
export async function updateInspiration(
  id: string,
  draft: InspirationDraft
): Promise<Inspiration | null> {
  const res = await api.put<{ inspiration: Inspiration }>(
    `/inspirations/${id}`,
    { draft }
  );
  return res.inspiration;
}

export async function deleteInspiration(id: string): Promise<void> {
  await api.del(`/inspirations/${id}`);
}

/** 草稿提交审核 */
export async function submitDraft(id: string): Promise<Inspiration> {
  const res = await api.post<{ inspiration: Inspiration }>(
    `/inspirations/${id}/submit`
  );
  return res.inspiration;
}

/** 仅供 auditService 调用：同步灵感审核状态（live 模式由审核接口直接完成，这里空转） */
export async function setInspirationStatus(
  _id: string,
  _status: InspirationStatus,
  _rejectReason?: string
): Promise<void> {
  // live 模式下审核决定由 /audit/:id/approve|reject 一站式完成，
  // 灵感状态随之更新，无需单独同步。
}
