/**
 * 采集编排：分享文案解析 → 平台抓取 → 媒体转存 → 诚实的结果。
 *
 * 平台通道分工：
 * - YouTube / TikTok：官方 oEmbed（TikTok 配置 sidecar 时优先走 sidecar）
 * - 抖音：Douyin_TikTok_Download_API sidecar（推荐）→ 分享页 SSR → iteminfo
 * - 小红书：短链展开 + __INITIAL_STATE__ 解析（已验证完整可用）
 * - Instagram：yt-dlp（公开内容免登录）
 *
 * 铁律：**拿不到就说拿不到**。每个字段标注来源（share = 分享文案 /
 * platform = 平台接口），完整度只按真实拿到的数据算，
 * 缺口在 note 里明说。绝不编一段假文案假装采集成功。
 */
import type { MediaType, Platform } from '../../../../src/data/types';
import {
  PLATFORM_META,
  parseShareText,
  type ParsedShare,
} from '../../../../src/utils/shareLink';
import { fetchBinary, UA_MOBILE } from './http';
import { fetchOEmbed } from './oembed';
import { collectDouyin } from './douyin';
import { collectXiaohongshu } from './xiaohongshu';
import { collectInstagram } from './instagram';
import { collectViaDouyinApi } from './douyinApi';
import { collectViaYtDlp } from './ytDlpCollect';
import { downloadImage } from './download';
import type { PlatformFindings } from './types';
import { saveBuffer, extFromMime } from '../mediaStore';
import { config } from '../../env';

/** 字段来源（ provenance，界面可展示「这条从哪来」） */
export type FieldSource = 'share' | 'platform' | 'none';

export interface CollectOutcome {
  ok: boolean;
  source: ParsedShare['platform'];
  platformLabel: string;
  targetPlatform: Platform;
  raw: string;
  url: string;
  contentId: string;
  isShortLink: boolean;
  title: string;
  copy: string;
  tags: string[];
  mediaType: MediaType;
  /** 转存到本地的图片 URL 列表（/media/...） */
  images: string[];
  coverImage: string;
  videoUrl: string | null;
  authorName: string | null;
  completeness: 'full' | 'partial';
  note: string | null;
  fieldSources: {
    title: FieldSource;
    copy: FieldSource;
    tags: FieldSource;
    images: FieldSource;
  };
}

export interface CollectFailure {
  ok: false;
  reason:
    | 'invalid-link'
    | 'unsupported-platform'
    | 'network'
    | 'need-backend'
    | 'not-found'
    | 'unknown';
  message: string;
}

export type CollectResponse = ({ ok: true } & CollectOutcome) | CollectFailure;

/** 采集源平台 → 本平台的目标发布平台（与前端 collectService 同口径） */
function mapToTargetPlatform(source: ParsedShare['platform']): Platform {
  return source === 'douyin' || source === 'tiktok' ? 'douyin' : 'xiaohongshu';
}

export async function collectFromShareText(
  raw: string
): Promise<CollectResponse> {
  const parsed = parseShareText(raw);
  if (!parsed) {
    return {
      ok: false,
      reason: 'invalid-link',
      message:
        '没能从这段文案里识别出链接。请确认复制的是「分享」得到的完整文案（含链接），而不是纯标题。',
    };
  }

  const platformLabel = PLATFORM_META[parsed.platform].label;
  // 提出局部常量：闭包（applyFindings）里 TS 不保留对 parsed 的收窄
  const srcPlatform = parsed.platform;

  // ── 分享文案线索（一定真实存在，但可能不完整） ──
  let title = parsed.titleHint ?? '';
  let author = parsed.authorHint;
  let tags = [...parsed.tagHints];
  /** 分享文案能拼出的初始正文线索（作者 + 话题） */
  let shareCopy: string[] = [];
  if (author) shareCopy.push(`原作者：${author}`);
  if (tags.length > 0) shareCopy.push(tags.join(' '));
  /** 平台抓到的正文（优先于 shareCopy） */
  let platformCopy = '';

  let images: string[] = [];
  let coverImage = '';
  let videoUrl: string | null = null;
  let mediaType: MediaType =
    parsed.platform === 'douyin' ||
    parsed.platform === 'tiktok' ||
    parsed.platform === 'youtube'
      ? 'video'
      : 'image';
  let contentId = parsed.contentId;
  let finalUrl = parsed.url;
  let limitation = '';

  // ── 按平台抓取 ──
  try {
    if (parsed.platform === 'youtube') {
      // 主通道：yt-dlp 拉真视频（免登录，公开内容）。仅 oEmbed 拿不到视频。
      const ydl = await collectViaYtDlp(parsed);
      if (ydl.videoUrl) {
        await applyFindings(ydl);
      } else {
        // 兜底：oEmbed 至少给标题 / 作者 / 封面
        const oembed = await fetchOEmbed(parsed.platform, parsed.url);
        if (oembed) {
          if (oembed.title) title = oembed.title;
          if (oembed.author) author = oembed.author;
          if (oembed.thumbnail) {
            const local = await downloadImage(oembed.thumbnail);
            if (local) coverImage = local;
          }
        } else {
          limitation = `${platformLabel} 抓取未返回数据，已提取分享文案中的线索`;
        }
      }
    } else if (parsed.platform === 'tiktok') {
      // 配置了 sidecar 优先走它（无水印）；否则 oEmbed 仅给标题/作者/封面
      if (config.douyinApiUrl) {
        await applyFindings(await collectViaDouyinApi(parsed));
      } else {
        const oembed = await fetchOEmbed(parsed.platform, parsed.url);
        if (oembed) {
          if (oembed.title) title = oembed.title;
          if (oembed.author) author = oembed.author;
          if (oembed.thumbnail) {
            const local = await downloadImage(oembed.thumbnail);
            if (local) coverImage = local;
          }
        } else {
          limitation = `${platformLabel} oEmbed 未返回数据，已提取分享文案中的线索`;
        }
      }
    } else if (parsed.platform === 'douyin') {
      await applyFindings(await collectDouyin(parsed));
    } else if (parsed.platform === 'xiaohongshu') {
      await applyFindings(await collectXiaohongshu(parsed));
    } else if (parsed.platform === 'instagram') {
      await applyFindings(await collectInstagram(parsed));
    }

    // 兜底：抖音 / TikTok 主通道（sidecar / SSR / iteminfo / oEmbed）没拿到视频时，
    // 用 yt-dlp 再试（免登录；TikTok 天然无水印，抖音可能带水印，作为最后手段）。
    // YouTube 已在上面分支优先走 yt-dlp，这里不再重复。
    if (
      !videoUrl &&
      (parsed.platform === 'douyin' || parsed.platform === 'tiktok')
    ) {
      await applyFindings(await collectViaYtDlp(parsed));
    }
  } catch (err) {
    limitation = `抓取过程出错（${(err as Error).message}），已提取分享文案中的线索`;
  }

  async function applyFindings(f: PlatformFindings): Promise<void> {
    if (f.finalUrl) finalUrl = f.finalUrl;
    if (f.title) title = f.title;
    if (f.author) author = f.author;
    if (f.copy) platformCopy = f.copy;
    if (f.tags && f.tags.length > 0) {
      tags = Array.from(new Set([...tags, ...f.tags]));
    }
    if (f.mediaType) mediaType = f.mediaType;

    // 采集器已自行转存的封面
    if (f.coverLocalUrl) coverImage = f.coverLocalUrl;

    if (f.images && f.images.length > 0) {
      // 并发转存（限制并发 4，避免把平台 CDN 打急）
      const locals: string[] = [];
      const queue = [...f.images];
      const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
        for (;;) {
          const next = queue.shift();
          if (!next) return;
          const local = await downloadImage(next);
          if (local) locals.push(local);
        }
      });
      await Promise.all(workers);
      images = locals;
      if (images.length > 0 && !coverImage) coverImage = images[0];
    }

    if (f.videoUrl) {
      videoUrl = f.videoUrl; // 视频地址先记下，转存失败则置空并说明
      const bin = await fetchBinary(f.videoUrl, {
        ua: UA_MOBILE,
        // 按平台带 Referer（抖音 CDN 校验；Instagram 的 scontent 一般不需要）
        referer:
          srcPlatform === 'douyin'
            ? 'https://www.douyin.com/'
            : srcPlatform === 'instagram'
              ? 'https://www.instagram.com/'
              : srcPlatform === 'xiaohongshu'
                ? 'https://www.xiaohongshu.com/'
                : undefined,
        maxBytes: 200 * 1024 * 1024,
      });
      if (bin && bin.byteLength > 0 && bin.contentType.startsWith('video/')) {
        try {
          videoUrl = saveBuffer(
            Buffer.from(bin.buffer),
            extFromMime(bin.contentType.split(';')[0] ?? '') ?? 'mp4',
            'collected'
          );
        } catch {
          videoUrl = null;
        }
      } else {
        videoUrl = null;
        limitation =
          (limitation ? limitation + '；' : '') +
          '视频文件未能转存（平台地址需签名 / 已失效），请手动补充视频';
      }
    }

    if (f.limitation) {
      limitation = limitation ? `${limitation}；${f.limitation}` : f.limitation;
    }
  }

  // contentId：短链展开后更新为真实 ID
  if (parsed.isShortLink) {
    const m = finalUrl.match(/\/video\/(\d{6,})/)
      ?? finalUrl.match(/\/explore\/([a-f0-9]{20,})/i)
      ?? finalUrl.match(/\/discovery\/item\/([a-f0-9]{20,})/i);
    if (m) contentId = m[1];
  }

  // ── 组装结果 ──
  const copy = platformCopy || shareCopy.join('\n');
  const gotFromPlatform: string[] = [];
  if (title && title !== parsed.titleHint) gotFromPlatform.push('标题');
  if (platformCopy) gotFromPlatform.push('正文');
  if (images.length > 0) gotFromPlatform.push(`${images.length} 张图片`);
  if (videoUrl) gotFromPlatform.push('视频');

  const hasMedia = images.length > 0 || !!coverImage || !!videoUrl;
  const completeness: 'full' | 'partial' =
    title.length > 0 && hasMedia ? 'full' : 'partial';

  const noteParts: string[] = [];
  noteParts.push(
    `已识别为${platformLabel}${parsed.isShortLink ? '分享短链' : '链接'}` +
      (gotFromPlatform.length > 0
        ? `，从平台抓取到${gotFromPlatform.join('、')}`
        : '，分享文案中未含可用标题') +
      '。'
  );
  if (limitation) noteParts.push(limitation + '。');
  if (completeness === 'partial') {
    noteParts.push('请下方手动补充缺失内容后提交。');
  }

  return {
    ok: true,
    source: parsed.platform,
    platformLabel,
    targetPlatform: mapToTargetPlatform(parsed.platform),
    raw: parsed.raw,
    url: finalUrl,
    contentId,
    isShortLink: parsed.isShortLink,
    title,
    copy,
    tags,
    mediaType,
    images,
    coverImage,
    videoUrl,
    authorName: author,
    completeness,
    note: noteParts.join(''),
    fieldSources: {
      title: title && title !== parsed.titleHint ? 'platform' : title ? 'share' : 'none',
      copy: platformCopy ? 'platform' : shareCopy.length > 0 ? 'share' : 'none',
      tags: tags.length > parsed.tagHints.length ? 'platform' : tags.length > 0 ? 'share' : 'none',
      images: images.length > 0 ? 'platform' : 'none',
    },
  };
}
