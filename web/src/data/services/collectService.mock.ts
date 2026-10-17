import {
  parseShareText,
  PLATFORM_META,
  detectRetiredPlatform,
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
 * | 平台 | 链接解析 | 标题/作者/封面 | 视频/图片/话题 |
 * |---|---|---|---|
 * | YouTube    | ✅ | ✅ yt-dlp 元数据 | ✅ 视频转存（ffmpeg 合并 DASH 流） |
 * | 小红书     | ✅ 短链展开 | ✅ 笔记详情 SSR | ✅ 视频/图片直链转存（yt-dlp 兜底） |
 * | Instagram  | ✅ | ✅ yt-dlp 免登录 | ✅ 视频/图片转存 |
 *
 * 已下线：抖音 / TikTok —— 取流接口需登录态 cookie，长期 403（2026-10 移除）。
 *
 * 关键事实（影响架构决策）：
 * 1. 小红书的**分享文案本身就是链接载体** —— 短链 + 标题 + #话题已足够
 *    完成大部分预填，这是本功能最可靠的价值来源。
 * 2. 小红书的**正文与图片列表是 JS 运行时渲染或需签名接口**，
 *    纯服务端 HTML 抓取只能拿到 SSR 兜底内容，故视频走 yt-dlp 兜底。
 * 3. 因此本服务**绝不伪造数据**：拿不到就如实降级为「链接已识别，请手动补全」，
 *    把平台能力和缺口明确告诉用户，而不是编一段假文案假装采集成功。
 *
 * 前端定位：mock 实现只做本地启发式解析（不发起网络请求），
 * 真实网络抓取由后端 `/api/collect` 承接（live 模式）。
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
    source === 'xiaohongshu'
      ? 338 + (seed % 30)
      : source === 'youtube'
        ? 0 + (seed % 20)
        : 280 + (seed % 30); // Instagram
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
    // 链接有效但平台已下线：给准确原因，别让用户白检查文案格式
    const retired = detectRetiredPlatform(shareText);
    if (retired) {
      return {
        ok: false,
        reason: 'unsupported-platform',
        message: `已识别为${retired}链接，但${retired}采集已于 2026-10 下线（其取流接口需登录态，长期不可用）。当前支持采集的来源：小红书、Instagram、YouTube。`,
      };
    }
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
  } else if (parsed.platform === 'youtube') {
    note = `已识别为${platformLabel}链接。标题、封面与视频由后端 yt-dlp 抓取并转存；请手动补充封面图。`;
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
    // YouTube 默认按 video；小红书 / Instagram 按 image（视频型由后端实测判定）
    mediaType: parsed.platform === 'youtube' ? 'video' : 'image',
    coverImage: placeholderCover(parsed.platform, seed),
    videoUrl: null,
    authorName: parsed.authorHint,
    completeness,
    note,
  };
}
