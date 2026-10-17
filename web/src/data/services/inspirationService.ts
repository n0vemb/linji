/**
 * 灵感 service —— 模式分发：live（真实后端）/ mock（纯前端演示）。
 * 调用方（store / 页面）只 import 这一个文件，不感知模式。
 */
import type { Inspiration, InspirationDraft, InspirationStatus } from '../types';
import { apiMode } from './apiMode';
import * as mock from './inspirationService.mock';
import * as live from './inspirationService.live';

export type { InspirationScope } from './inspirationService.live';

const LIVE = (): boolean => apiMode() === 'live';

export function fetchInspirations(
  scope: 'plaza' | 'mine' | 'all' = 'plaza'
): Promise<Inspiration[]> {
  return LIVE() ? live.fetchInspirations(scope) : mock.fetchInspirations();
}

export function getInspiration(id: string): Promise<Inspiration | null> {
  return LIVE() ? live.getInspiration(id) : mock.getInspiration(id);
}

export function createInspiration(
  draft: InspirationDraft,
  creator: { id: string; name: string },
  asDraft = false
): Promise<Inspiration> {
  return LIVE()
    ? live.createInspiration(draft, creator, asDraft)
    : mock.createInspiration(draft, creator, asDraft);
}

export function updateInspiration(
  id: string,
  draft: InspirationDraft
): Promise<Inspiration | null> {
  return LIVE() ? live.updateInspiration(id, draft) : mock.updateInspiration(id, draft);
}

export function deleteInspiration(id: string): Promise<void> {
  return LIVE() ? live.deleteInspiration(id) : mock.deleteInspiration(id);
}

export function setInspirationStatus(
  id: string,
  status: InspirationStatus,
  rejectReason?: string
): Promise<void> {
  return LIVE()
    ? live.setInspirationStatus(id, status, rejectReason)
    : mock.setInspirationStatus(id, status, rejectReason);
}

/** 草稿提交审核：draft → pending */
export function submitDraft(id: string): Promise<Inspiration> {
  return LIVE() ? live.submitDraft(id) : mock.submitDraft(id);
}
