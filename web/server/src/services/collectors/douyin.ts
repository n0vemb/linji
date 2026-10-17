/**
 * 抖音采集：按优先级尝试三条通道，全部失败才降级到分享文案线索。
 *
 * 通道 1（推荐）：Douyin_TikTok_Download_API sidecar（DOUYIN_API_URL 配置时）
 *   —— 上游项目纯 Python 实现 X-Bogus/a_bogus 签名，20k+ star 持续维护，
 *      签名的风控演进成本不该由我们承担。
 * 通道 2：移动端分享页 SSR（_ROUTER_DATA 的 videoInfoRes）
 *   —— 无 cookie 无签名；实测部分网络 / UA 下服务端不吐数据（videoInfoRes=null），
 *      所以只作为不依赖外部服务的尝试。
 * 通道 3：iteminfo 接口 —— 实测对无签名请求返回空 200（风控），保留兼容。
 *
 * 任何通道拿不到都如实降级（limitation + note），绝不编造内容。
 */
import type { ParsedShare } from '../../../../src/utils/shareLink';
import { extractTags } from '../../../../src/utils/shareLink';
import type { MediaType } from '../../../../src/data/types';
import { UA_MOBILE, fetchFollow, fetchJson } from './http';
import {
  buildNoWatermarkUrl,
  douyinMediaType,
  extractAweme,
} from './douyinParse';
import { collectViaDouyinApi, douyinApiEnabled } from './douyinApi';
import type { PlatformFindings } from './types';

interface ItemInfoResponse {
  status_code?: number;
  item_list?: unknown[];
}

/** 从展开后的 URL 里提取作品 ID */
function itemIdFromUrl(url: string): string {
  const m = url.match(/\/video\/(\d{6,})/);
  return m ? m[1] : '';
}

/** desc 首行当标题（抖音 desc 常是「标题 + 话题」混排） */
function titleFromDesc(desc: string): string {
  const firstLine = desc.split('\n')[0]?.trim() ?? '';
  const cut = firstLine.split(/\s{2,}|#/)[0]?.trim() ?? firstLine;
  return cut.slice(0, 40);
}

/** 通道 2：分享页 SSR（无 cookie） */
async function collectFromSharePage(
  itemId: string
): Promise<PlatformFindings> {
  const findings: PlatformFindings = { fetched: [] };
  // www.douyin.com 的分享页（实测 iesdouyin.com 的只返回空壳）
  const page = await fetchFollow(
    `https://www.douyin.com/share/video/${itemId}/?from_ssr=1`,
    { ua: UA_MOBILE, referer: 'https://www.douyin.com/' }
  );
  if (!page.text) {
    findings.limitation = '分享页未返回内容';
    return findings;
  }
  const m = page.text.match(/window\._ROUTER_DATA\s*=\s*(\{[\s\S]*?\})<\/script>/);
  if (!m) {
    findings.limitation = '分享页无 _ROUTER_DATA';
    return findings;
  }
  let routerData: unknown;
  try {
    routerData = JSON.parse(m[1]);
  } catch {
    findings.limitation = '分享页数据解析失败';
    return findings;
  }
  const ex = extractAweme(routerData);
  if (!ex.desc && ex.playUrls.length === 0 && ex.imageUrls.length === 0) {
    // 实测常见：结构在但 videoInfoRes 为 null（服务端不为该请求 SSR）
    findings.limitation = '分享页未包含作品数据（服务端未 SSR）';
    return findings;
  }
  return applyExtract(ex, findings);
}

/** 通道 3：iteminfo 接口（兼容旧行为） */
async function collectFromItemInfo(
  itemId: string
): Promise<PlatformFindings> {
  const findings: PlatformFindings = { fetched: [] };
  const api = `https://www.iesdouyin.com/web/api/v2/aweme/iteminfo/?item_ids=${itemId}`;
  const { status, data } = await fetchJson<ItemInfoResponse>(api, {
    ua: UA_MOBILE,
    referer: 'https://www.iesdouyin.com/',
  });
  const item = data?.item_list?.[0];
  if (status !== 200 || !item) {
    findings.limitation = '抖音详情接口未返回数据（平台风控 / 需签名）';
    return findings;
  }
  const ex = extractAweme(item);
  return applyExtract(ex, findings);
}

/** 把提取结果写进 findings（三个通道共用） */
function applyExtract(
  ex: ReturnType<typeof extractAweme>,
  findings: PlatformFindings
): PlatformFindings {
  if (ex.desc) {
    findings.copy = ex.desc;
    findings.title = titleFromDesc(ex.desc);
    findings.tags = extractTags(ex.desc);
  }
  if (ex.nickname) findings.author = ex.nickname;

  const mediaType: MediaType = douyinMediaType(ex);
  findings.mediaType = mediaType;

  if (ex.imageUrls.length > 0) {
    findings.images = ex.imageUrls.slice(0, 9);
    findings.fetched.push(`${findings.images.length} 张图片`);
  }
  if (ex.playUrls.length > 0 && ex.videoUri) {
    const template = ex.playUrls.find((u) => u.includes('video_id='));
    findings.videoUrl = buildNoWatermarkUrl(ex.videoUri, template);
    findings.fetched.push('无水印视频地址');
  }
  if (findings.fetched.length === 0) {
    findings.limitation = '页面未包含可提取的作品数据';
  } else {
    findings.fetched.unshift('作品详情');
  }
  return findings;
}

export async function collectDouyin(
  parsed: ParsedShare
): Promise<PlatformFindings> {
  // ── 1. 解析真实 itemId（短链 302 展开） ──
  let itemId = /^\d{6,}$/.test(parsed.contentId) ? parsed.contentId : '';
  let finalUrl = parsed.url;

  if (parsed.isShortLink) {
    const page = await fetchFollow(parsed.url, { ua: UA_MOBILE });
    if (page.status === 0) {
      return {
        fetched: [],
        limitation: '短链展开失败（网络不可达 / 抓取通道缺失）',
      };
    }
    finalUrl = page.url;
    if (!itemId) itemId = itemIdFromUrl(page.url);
  }

  if (!itemId) {
    return {
      fetched: [],
      limitation: '短链展开失败，未能拿到作品 ID（链接可能已失效）',
    };
  }

  const base: PlatformFindings = {
    fetched: [`作品 ID ${itemId}`],
    finalUrl,
  };

  // ── 2. 通道 1：sidecar（配置了 DOUYIN_API_URL 时优先） ──
  if (douyinApiEnabled()) {
    const f = await collectViaDouyinApi(parsed);
    f.finalUrl = finalUrl;
    f.fetched = [`作品 ID ${itemId}`, ...f.fetched];
    if (f.fetched.length > 1 || f.images?.length || f.videoUrl) {
      return { ...base, ...f, fetched: f.fetched };
    }
    // sidecar 失败：记录原因，继续降级
    base.limitation = f.limitation ?? '解析服务未返回数据';
  }

  // ── 3. 通道 2：分享页 SSR ──
  const share = await collectFromSharePage(itemId);
  if (!share.limitation) {
    share.finalUrl = finalUrl;
    share.fetched = [`作品 ID ${itemId}`, ...share.fetched];
    return share;
  }

  // ── 4. 通道 3：iteminfo ──
  const info = await collectFromItemInfo(itemId);
  if (!info.limitation) {
    info.finalUrl = finalUrl;
    info.fetched = [`作品 ID ${itemId}`, ...info.fetched];
    return info;
  }

  // ── 5. 全部失败：如实降级（保留已拿到的 itemId 与分享文案线索） ──
  const limitation = [base.limitation, share.limitation, info.limitation]
    .filter(Boolean)
    .join('；');
  return {
    ...base,
    limitation: limitation || '所有解析通道均未返回数据',
  };
}
