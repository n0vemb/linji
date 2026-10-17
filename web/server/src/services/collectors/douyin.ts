/**
 * 抖音采集：短链 302 展开拿 itemId → iteminfo 接口拿详情。
 *
 * 实测结论（2026-10，curl 传输 + 海外视角）：
 * - 短链展开稳定：v.douyin.com/xxx → 302 → iesdouyin.com/share/video/{itemId}
 * - iteminfo 接口（web/api/v2/aweme/iteminfo）对无签名请求返回**空 200**
 *   （平台风控）；分享页 _ROUTER_DATA 也只是懒加载空壳。
 * - 因此抖音的现实边界：itemId + 分享文案线索（标题/作者/话题）真实可用，
 *   正文与媒体需签名接口 —— 如实降级，不编内容。
 */
import type { ParsedShare } from '../../../../src/utils/shareLink';
import { extractTags } from '../../../../src/utils/shareLink';
import type { MediaType } from '../../../../src/data/types';
import { UA_MOBILE, fetchFollow, fetchJson } from './http';
import type { PlatformFindings } from './types';

interface DouyinImage {
  url_list?: string[];
}

interface DouyinAweme {
  desc?: string;
  nickname?: string;
  images?: DouyinImage[];
  video?: {
    play_addr?: { url_list?: string[] };
    cover?: { url_list?: string[] };
  };
}

interface ItemInfoResponse {
  status_code?: number;
  item_list?: DouyinAweme[];
}

/** 从展开后的 URL 里提取作品 ID */
function itemIdFromUrl(url: string): string {
  const m = url.match(/\/video\/(\d{6,})/);
  return m ? m[1] : '';
}

/** desc 首行当标题（抖音的 desc 是「标题 + 话题」混排） */
function titleFromDesc(desc: string): string {
  const firstLine = desc.split('\n')[0]?.trim() ?? '';
  const cut = firstLine.split(/\s{2,}|#/)[0]?.trim() ?? firstLine;
  return cut.slice(0, 40);
}

export async function collectDouyin(
  parsed: ParsedShare
): Promise<PlatformFindings> {
  const findings: PlatformFindings = { fetched: [] };

  // ── 1. 解析真实 itemId ──
  let itemId = /^\d{6,}$/.test(parsed.contentId) ? parsed.contentId : '';
  let finalUrl = parsed.url;

  if (parsed.isShortLink) {
    const page = await fetchFollow(parsed.url, { ua: UA_MOBILE });
    if (page.status === 0) {
      findings.limitation = '短链展开失败（网络不可达 / 抓取通道缺失）';
      return findings;
    }
    finalUrl = page.url;
    // 展开结果立即回传（即使后续接口失败，调用方也能拿到真实 URL / ID）
    findings.finalUrl = finalUrl;
    if (!itemId) itemId = itemIdFromUrl(page.url);
  }

  if (!itemId) {
    findings.limitation = '短链展开失败，未能拿到作品 ID（链接可能已失效）';
    return findings;
  }
  findings.fetched.push(`作品 ID ${itemId}`);

  // ── 2. iteminfo 接口 ──
  const api = `https://www.iesdouyin.com/web/api/v2/aweme/iteminfo/?item_ids=${itemId}`;
  const { status, data } = await fetchJson<ItemInfoResponse>(api, {
    ua: UA_MOBILE,
    referer: 'https://www.iesdouyin.com/',
  });

  const aweme = data?.item_list?.[0];
  if (status !== 200 || !aweme) {
    findings.limitation =
      '抖音详情接口未返回数据（平台风控 / 需签名），已提取分享文案中的线索';
    return findings;
  }

  const desc = aweme.desc ?? '';
  findings.fetched.push('作品详情');
  if (desc) {
    findings.copy = desc;
    findings.title = titleFromDesc(desc);
    findings.tags = extractTags(desc);
  }
  if (aweme.nickname) findings.author = aweme.nickname;

  // 图集（aweme.images[].url_list，通常 url_list[0] 为最高清）
  const images = (aweme.images ?? [])
    .map((img) => img.url_list?.[0])
    .filter((u): u is string => !!u)
    .slice(0, 9);
  if (images.length > 0) {
    findings.images = images;
    findings.fetched.push(`${images.length} 张图片`);
  }

  // 视频地址（play_addr 常因缺签名 403，转存失败会由编排层降级）
  const videoUrl = aweme.video?.play_addr?.url_list?.[0] ?? null;
  if (videoUrl) {
    findings.videoUrl = videoUrl;
    findings.fetched.push('视频地址');
  }

  const mediaType: MediaType = videoUrl ? 'video' : images.length > 0 ? 'image' : 'video';
  findings.mediaType = mediaType;
  findings.finalUrl = finalUrl;
  return findings;
}