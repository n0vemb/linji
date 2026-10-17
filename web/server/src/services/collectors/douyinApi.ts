/**
 * Douyin_TikTok_Download_API sidecar 客户端。
 *
 * 为什么不自己搓签名：抖音 Web API 需要 X-Bogus / a_bogus 签名（纯 Python 实现、
 * 随风控持续演进），Douyin_TikTok_Download_API（20k+ star，Apache-2.0）已经处理了
 * 这些，且 Docker 一键部署。我们只做 HTTP 客户端，签名的演进成本转移给上游项目。
 *
 * 端点（v4）：GET /api/hybrid/video_data?url=<链接>&minimal=false
 * 返回结构随版本可能变化 → 用树遍历提取（douyinParse.ts），对 shape 免疫。
 *
 * 启用：设置环境变量 DOUYIN_API_URL（如 http://douyin-api:80）。
 * 未设置时该通道自动跳过，走分享页 / iteminfo 降级链。
 */
import type { ParsedShare } from '../../../../src/utils/shareLink';
import { config } from '../../env';
import { fetchJson } from './http';
import {
  buildNoWatermarkUrl,
  douyinMediaType,
  extractAweme,
} from './douyinParse';
import type { PlatformFindings } from './types';

/** sidecar 是否配置 */
export function douyinApiEnabled(): boolean {
  return !!config.douyinApiUrl;
}

interface SidecarResponse {
  code?: number;
  message?: string;
  data?: unknown;
}

/**
 * 调 sidecar 解析抖音 / TikTok 作品。
 * 返回 PlatformFindings；失败 / 未配置时 limitation 说明原因。
 */
export async function collectViaDouyinApi(
  parsed: ParsedShare
): Promise<PlatformFindings> {
  const findings: PlatformFindings = { fetched: [] };

  if (!config.douyinApiUrl) {
    findings.limitation = '抖音解析服务未配置（DOUYIN_API_URL）';
    return findings;
  }

  const base = config.douyinApiUrl.replace(/\/+$/, '');
  const url = `${base}/api/hybrid/video_data?url=${encodeURIComponent(
    parsed.url
  )}&minimal=false`;

  const { status, data } = await fetchJson<SidecarResponse>(url, {
    timeoutMs: 30_000,
  });

  if (status !== 200 || !data) {
    findings.limitation = `抖音解析服务无响应（HTTP ${status}）`;
    return findings;
  }
  // 业务错误码（如 403 风控）也如实报告
  if (typeof data.code === 'number' && data.code !== 200) {
    findings.limitation = `抖音解析服务返回错误：${data.message ?? data.code}`;
    return findings;
  }

  // 树遍历提取（对响应结构变化免疫）
  const ex = extractAweme(data.data ?? data);
  if (!ex.desc && ex.playUrls.length === 0 && ex.imageUrls.length === 0) {
    findings.limitation = '抖音解析服务未返回有效数据';
    return findings;
  }

  findings.fetched.push('作品详情（解析服务）');
  if (ex.desc) {
    findings.copy = ex.desc;
    findings.title = ex.desc.split('\n')[0]?.trim().slice(0, 40) ?? '';
  }
  if (ex.nickname) findings.author = ex.nickname;

  const mediaType = douyinMediaType(ex);
  findings.mediaType = mediaType;

  if (ex.imageUrls.length > 0) {
    findings.images = ex.imageUrls.slice(0, 9);
    findings.fetched.push(`${findings.images.length} 张图片`);
  }

  if (ex.playUrls.length > 0 && ex.videoUri) {
    // 无水印播放地址（playwm → play）
    const template = ex.playUrls.find((u) => u.includes('video_id='));
    findings.videoUrl = buildNoWatermarkUrl(ex.videoUri, template);
    findings.fetched.push('无水印视频地址');
  }

  return findings;
}
