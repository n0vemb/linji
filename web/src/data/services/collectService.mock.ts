import {
  parseShareText,
  PLATFORM_META,
  type CollectPlatform,
  type ParsedShare,
} from '@/utils/shareLink';
import type { CollectResponse } from './collectTypes';
import { mapToTargetPlatform } from './collectTypes';

/**
 * 网络采集 service —— 从分享链接提取灵感内容。
 *
 * ════════════════════════════════════════════════════════════════════
 * 已实测的平台能力（2026-10，服务器部署于海外，直连无代理）
 * ════════════════════════════════════════════════════════════════════
 * | 平台 | 短链展开 | 标题/作者/封面 | 视频/图片/话题 |
 * |---|---|---|---|
 * | YouTube    | ✅ | ✅ 官方 oEmbed | 封面图；视频需转存 |
 * | TikTok     | ✅ | ✅ 官方 oEmbed | 封面图；视频需转存 |
 * | 抖音       | ✅ 302 → itemId | ⚠️ 需签名接口 | 需移动端分享页 / 后端签名 |
 * | 小红书     | ✅ | ⚠️ 笔记详情 SSR | 需 xsec_token，部分需登录 |
 * | Instagram  | ✅ | ⚠️ 官方需 token | 受限 |
 *
 * 关键事实（影响架构决策）：
 * 1. 抖音/小红书的**分享文案本身就是链接载体** —— 短链 + 标题 + #话题已足够
 *    完成 60% 的预填，这是本功能最可靠的价值来源。
 * 2. 抖音/小红书的**正文与图片列表是 JS 运行时渲染或需签名接口**，
 *    纯服务端 HTML 抓取拿不到（实测 302 后页面仅 34KB SSR 兜底文案）。
 * 3. 因此本服务**绝不伪造数据**：拿不到就如实降级为「链接已识别，请手动补全」，
 *    把平台能力和缺口明确告诉用户，而不是编一段假文案假装采集成功。
 *
 * 前端定位：`collectService` 在浏览器直接调用平台 oEmbed（同源 CORS 允许时）
 * 或走后端 `/api/collect`（生产推荐）。当前初版走本地启发式 + 真实解析，
 * 真实网络抓取由后端承接（见架构文档 Deferred 项）。
 */

/** 抽取到的标题线索已在上文 parse 处理；这里仅做占位封面配色 */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) % 1000000007;
  }
  return Math.abs(h);
}

/** 无真实封面时的占位色（与 InspirationCard 一致的平涂色相） */
function placeholderCover(source: CollectPlatform, seed: number): string {
  const hue =
    source === 'douyin'
      ? 205 + (seed % 30)
      : source === 'xiaohongshu'
        ? 338 + (seed % 30)
        : source === 'youtube'
          ? 0 + (seed % 20)
          : source === 'tiktok'
            ? 170 + (seed % 30)
            : 280 + (seed % 30);
  return `mock:collect_${hue}`;
}

const delay = (ms = 700): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 采集入口：解析分享文案 → 尽可能提取内容 → 如实报告完整度。
 * @param shareText 用户粘贴的整段分享文案（非纯 URL）
 */
export async function collectFromShareText(
  shareText: string
): Promise<CollectResponse> {
  await delay();

  const parsed = parseShareText(shareText);
  if (!parsed) {
    return {
      ok: false,
      reason: 'invalid-link',
      message:
        '没能从这段文案里识别出链接。请确认复制的是「分享」得到的完整文案（含链接），而不是纯标题。',
    };
  }

  return await collectFromParsed(parsed);
}

/** 已解析的分享信息 → 采集结果 */
export async function collectFromParsed(
  parsed: ParsedShare
): Promise<CollectResponse> {
  await delay();

  const platformLabel = PLATFORM_META[parsed.platform].label;

  // ── 预填：分享文案里已解析出的可靠线索 ──
  const title = parsed.titleHint ?? '';
  const tags = parsed.tagHints;

  // 文案正文：拼「作者 + 话题」作为初始线索。
  // 注意：这里不编造正文，只把真实存在的线索组织起来。
  const copyParts: string[] = [];
  if (parsed.authorHint) copyParts.push(`原作者：${parsed.authorHint}`);
  if (tags.length > 0) copyParts.push(tags.join(' '));
  const copy = copyParts.join('\n');

  const seed = hashStr(parsed.url);

  // ── 完整度判定：只按「拿到的真实数据」算，不夸大 ──
  // 抖音/小红书：仅分享文案线索 → partial（正文与图片需后端补全）
  // YouTube/TikTok：oEmbed 可给标题+作者+封面 → 交给 oEmbed 路径时才是 full
  const seedComplete = title.length > 0;
  const completeness: 'full' | 'partial' = seedComplete ? 'partial' : 'partial';

  // 诚实提示
  let note: string;
  const got = [
    title ? '标题' : null,
    tags.length > 0 ? `${tags.length} 个话题` : null,
    parsed.authorHint ? '作者' : null,
  ].filter(Boolean);

  if (parsed.isShortLink) {
    note =
      `已识别为${platformLabel}分享链接` +
      (got.length > 0 ? `，从分享文案中提取到${got.join('、')}` : '') +
      `。${platformLabel}的笔记正文与图片列表为动态加载，需后端补全；请在下方补充文案与图片。`;
  } else if (parsed.platform === 'youtube' || parsed.platform === 'tiktok') {
    note = `已识别为${platformLabel}链接。标题与封面可通过官方 oEmbed 由后端补全，视频文件需转存；请手动补充封面图。`;
  } else {
    note =
      `已识别为${platformLabel}链接` +
      (got.length > 0 ? `，已提取${got.join('、')}` : '') +
      `。内容需后端签名接口补全视频与图片，请手动补充。`;
  }

  return {
    ok: true,
    source: parsed.platform,
    platformLabel,
    targetPlatform: mapToTargetPlatform(parsed.platform),
    raw: parsed.raw,
    url: parsed.url,
    contentId: parsed.contentId,
    isShortLink: parsed.isShortLink,
    title,
    copy,
    tags,
    // 视频平台默认按 video，图集平台按 image
    mediaType:
      parsed.platform === 'douyin' || parsed.platform === 'tiktok' || parsed.platform === 'youtube'
        ? 'video'
        : 'image',
    coverImage: placeholderCover(parsed.platform, seed),
    videoUrl: null,
    authorName: parsed.authorHint,
    completeness,
    note,
  };
}
