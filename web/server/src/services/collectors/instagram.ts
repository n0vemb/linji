/**
 * Instagram 采集：yt-dlp（公开 reel / 帖子免登录）。
 *
 * 实测结论：Instagram 官方 oEmbed 需要 access token、页面有登录墙；
 * yt-dlp 的 Instagram extractor 直接读页面内嵌 JSON，公开内容无需登录
 * （多个开源项目验证）。私密内容才需要 cookies —— 我们只采公开内容。
 *
 * 图集（sidecar）帖子：yt-json 的 entries 会展开多条，逐条取图。
 * 拿不到就如实降级，不编造。
 */
import type { ParsedShare } from '../../../../src/utils/shareLink';
import { extractTags } from '../../../../src/utils/shareLink';
import { ytDlpDumpJson } from './ytdlp';
import { downloadImage } from './download';
import { config } from '../../env';
import type { PlatformFindings } from './types';

export async function collectInstagram(
  parsed: ParsedShare
): Promise<PlatformFindings> {
  const findings: PlatformFindings = { fetched: [] };

  const meta = await ytDlpDumpJson(parsed.url, config.collectProxy || undefined);
  if (!meta) {
    findings.limitation =
      'Instagram 抓取失败（yt-dlp 未安装 / 内容需登录 / 已删除）';
    return findings;
  }

  findings.fetched.push('帖子详情');

  // 标题：优先 title，取 description 首行
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

  findings.mediaType = 'video';

  // 视频直链（reel / 视频帖）
  if (meta.videoUrl) {
    findings.videoUrl = meta.videoUrl;
    findings.fetched.push('视频地址');
  }

  // 图集（sidecar）：entries 里逐条找图片
  const entryImages: string[] = [];
  for (const entry of meta.entries) {
    if (entry.thumbnail) entryImages.push(entry.thumbnail);
  }
  if (entryImages.length > 0) {
    findings.images = entryImages.slice(0, 9);
    findings.fetched.push(`${findings.images.length} 张图片`);
  }

  // 封面（缩略图）交给编排层转存；这里只给远程地址不方便，
  // 所以直接在这里下载（编排层的 downloadImage 同款逻辑）
  if (meta.thumbnail) {
    const local = await downloadImage(meta.thumbnail);
    if (local) {
      findings.coverLocalUrl = local;
      findings.fetched.push('封面');
    }
  }

  return findings;
}
