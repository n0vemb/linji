/**
 * 采集 service —— 模式分发：live（后端真实抓取）/ mock（纯前端启发式解析）。
 * 同时再导出共享类型与工具函数，保持既有 import 路径不变。
 */
import { apiMode } from './apiMode';
import * as mock from './collectService.mock';
import * as live from './collectService.live';

export type {
  CollectFailureReason,
  CollectResponse,
  CollectResult,
  FieldSource,
} from './collectTypes';
export { mapToTargetPlatform, PLATFORM_INFO } from './collectTypes';

export function collectFromShareText(
  shareText: string
): Promise<import('./collectTypes').CollectResponse> {
  return apiMode() === 'live'
    ? live.collectFromShareText(shareText)
    : mock.collectFromShareText(shareText);
}

export function collectFromParsed(
  parsed: import('@/utils/shareLink').ParsedShare
): Promise<import('./collectTypes').CollectResponse> {
  return apiMode() === 'live'
    ? live.collectFromParsed(parsed)
    : mock.collectFromParsed(parsed);
}
