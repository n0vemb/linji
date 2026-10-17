/**
 * 采集 service —— live 模式实现：直接调后端 /api/collect。
 * 真正的平台抓取（短链展开 / oEmbed / 页面解析 / 媒体转存）在服务端完成，
 * 浏览器不直连平台（CORS + 签名接口都要求服务端做）。
 */
import type { CollectResponse } from './collectTypes';
import type { ParsedShare } from '@/utils/shareLink';
import { api } from './apiClient';

/** 已解析的分享信息 → 采集（live 模式直接把原始文案发给后端重新解析，保证服务端为准） */
export async function collectFromParsed(
  parsed: ParsedShare
): Promise<CollectResponse> {
  return collectFromShareText(parsed.raw);
}

export async function collectFromShareText(
  shareText: string
): Promise<CollectResponse> {
  try {
    return await api.post<CollectResponse>('/collect', { raw: shareText });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 0;
    if (status === 0) {
      return {
        ok: false,
        reason: 'network',
        message: '无法连接服务器，采集需要后端支持（请确认服务已启动）',
      };
    }
    // 后端的 4xx 错误已带可操作的中文提示，直接透传
    const payload = err as { message?: string };
    return {
      ok: false,
      reason:
        status === 400
          ? 'invalid-link'
          : status === 401
            ? 'network'
            : 'unknown',
      message: payload.message ?? '采集失败，请稍后重试',
    };
  }
}
