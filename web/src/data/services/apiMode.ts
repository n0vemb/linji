/**
 * API 模式判定：live（真实后端）/ mock（纯前端演示）。
 *
 * - 默认 live：后端已是产品的一部分（持久化 / 审核 / 采集都靠它）
 * - URL 加 ?mock=1 可临时切回纯前端演示（无需启动后端，便于快速看界面）
 * - VITE_API_MODE=mock 可编译期锁定（.env 文件）
 */

export type ApiMode = 'live' | 'mock';

function fromEnv(): ApiMode | null {
  const v = import.meta.env.VITE_API_MODE;
  return v === 'mock' || v === 'live' ? v : null;
}

function fromUrl(): ApiMode | null {
  if (typeof window === 'undefined') return null;
  const v = new URLSearchParams(window.location.search).get('mock');
  return v === '1' ? 'mock' : null;
}

export function apiMode(): ApiMode {
  return fromUrl() ?? fromEnv() ?? 'live';
}

export function isLiveMode(): boolean {
  return apiMode() === 'live';
}
