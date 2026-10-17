/**
 * yt-dlp 通用采集通道（YouTube / 抖音 / TikTok 的兜底或主通道）。
 *
 * 为什么用 yt-dlp：公开内容无需登录即可解析（多个开源项目验证），
 * 与产品「不手搓签名、不依赖 cookie」的取向一致；TikTok 经 yt-dlp 拿到的
 * 即是**无水印**原片。抖音经 yt-dlp 可能带水印，故仅作为 sidecar 全失败后的兜底，
 * 不覆盖 sidecar 的「无水印」优先通道。
 *
 * 依赖：系统安装 yt-dlp（Dockerfile 已装）。未安装时返回带 limitation 的空 findings，
 * 由编排层继续走别的通道或如实降级。
 */
import type { ParsedShare } from '../../../../src/utils/shareLink';
import { extractTags } from '../../../../src/utils/shareLink';
import { ytDlpDumpJson } from './ytdlp';
import { downloadImage } from './download';
import { config } from '../../env';
import type { PlatformFindings } from './types';

/**
 * 用 yt-dlp 拉取帖子的元数据 + 直链媒体，写入 PlatformFindings。
 * 适用于 YouTube / 抖音 / TikTok（Instagram 有独立的 instagram.ts，逻辑类似）。
 */
export async function collectViaYtDlp(
  parsed: ParsedShare
): Promise<PlatformFindings> {
  const findings: PlatformFindings = { fetched: [] };

  const meta = await ytDlpDumpJson(parsed.url, config.collectProxy || undefined);
  if (!meta) {
    findings.limitation = 'yt-dlp 未安装或抓取失败，未能通过通用通道获取';
    return findings;
  }

  findings.fetched.push('帖子详情（yt-dlp）');

  const desc = meta.description ?? '';
  if (desc) {
    findings.copy = desc;
    findings.title =
      meta.title || desc.split('\n')[0]?.trim().slice(0, 40) || '';
    findings.tags = extractTags(desc);
  } else if (meta.title) {
    findings.title = meta.title;
  }
  if (meta.uploader) findings.author = meta.uploader;

  // 视频直链（reel / 视频帖 / YouTube）
  if (meta.videoUrl) {
    findings.videoUrl = meta.videoUrl;
    findings.mediaType = 'video';
    findings.fetched.push('视频地址（无水印）');
  } else {
    findings.mediaType = 'image';
  }

  // 图集（sidecar）：entries 里逐条找缩略图
  const entryImages: string[] = [];
  for (const entry of meta.entries) {
    if (entry.thumbnail) entryImages.push(entry.thumbnail);
  }
  if (entryImages.length > 0) {
    findings.images = entryImages.slice(0, 9);
    findings.fetched.push(`${findings.images.length} 张图片`);
  }

  // 封面（缩略图）交给编排层转存；这里直接下载更可控
  if (meta.thumbnail) {
    const local = await downloadImage(meta.thumbnail);
    if (local) {
      findings.coverLocalUrl = local;
      findings.fetched.push('封面');
    }
  }

  return findings;
}
