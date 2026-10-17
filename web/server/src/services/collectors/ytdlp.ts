/**
 * yt-dlp 封装（Instagram / TikTok 元数据与媒体）。
 *
 * 为什么用 yt-dlp：Instagram 公开 reel / 帖子无需登录即可解析
 * （yt-dlp extractor 直接读页面内嵌 JSON）；抖音的 a_bogus 签名则由
 * Douyin_TikTok_Download_API sidecar 处理，不走这里。
 *
 * 依赖：系统安装 yt-dlp + ffmpeg（Dockerfile 已装；本地 brew install yt-dlp ffmpeg）。
 * 未安装时返回 null，由调用方降级并如实告知。
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from '../../env';

const execFileAsync = promisify(execFile);

let ytDlpUsable: boolean | null = null;

async function hasYtDlp(): Promise<boolean> {
  if (ytDlpUsable !== null) return ytDlpUsable;
  try {
    await execFileAsync(config.ytDlpPath, ['--version'], { timeout: 5000 });
    ytDlpUsable = true;
  } catch {
    ytDlpUsable = false;
    console.warn('[collect] 系统缺少 yt-dlp，Instagram/TikTok 抓取将不可用');
  }
  return ytDlpUsable;
}

export interface YtDlpMeta {
  title: string;
  description: string;
  uploader: string;
  thumbnail: string | null;
  duration: number;
  webpageUrl: string;
  /** 最佳画质直链（视频） */
  videoUrl: string | null;
  /** 图集 / 多条目（Instagram sidecar） */
  entries: YtDlpMeta[];
}

/** 提取 JSON 里的字段（容错：yt-dlp 各版本字段基本稳定，仍防御性读取） */
function toMeta(raw: Record<string, unknown>): YtDlpMeta {
  const formats = Array.isArray(raw.formats) ? raw.formats : [];
  // 找带直链的最佳视频格式（优先 mp4）
  let videoUrl: string | null = null;
  let bestHeight = -1;
  for (const f of formats) {
    if (!f || typeof f !== 'object') continue;
    const fo = f as Record<string, unknown>;
    const u = fo.url;
    if (typeof u !== 'string' || !u) continue;
    const h = typeof fo.height === 'number' ? fo.height : 0;
    if (h >= bestHeight) {
      bestHeight = h;
      videoUrl = u;
    }
  }
  const entries = Array.isArray(raw.entries)
    ? (raw.entries as Record<string, unknown>[]).map((e) => toMeta(e))
    : [];

  return {
    title: typeof raw.title === 'string' ? raw.title : '',
    description: typeof raw.description === 'string' ? raw.description : '',
    uploader: typeof raw.uploader === 'string' ? raw.uploader : '',
    thumbnail: typeof raw.thumbnail === 'string' ? raw.thumbnail : null,
    duration: typeof raw.duration === 'number' ? raw.duration : 0,
    webpageUrl: typeof raw.webpage_url === 'string' ? raw.webpage_url : '',
    videoUrl,
    entries,
  };
}

/**
 * 拉取 yt-dlp 元数据（--dump-single-json，不下载文件）。
 * @param url 帖子 / reel 链接
 * @param proxy 可选代理（海外域名本地调试用；yt-dlp 原生读 http_proxy 环境变量，
 *              这里显式传入更可控）
 */
export async function ytDlpDumpJson(
  url: string,
  proxy?: string
): Promise<YtDlpMeta | null> {
  if (!(await hasYtDlp())) return null;

  const args = [
    '--dump-single-json',
    '--no-warnings',
    '--no-playlist',
    '--no-progress',
    // Instagram 公开内容免登录；加 UA 降低被识别为机器人的概率
    '--user-agent',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    url,
  ];
  const env = { ...process.env };
  if (proxy) {
    env.http_proxy = proxy;
    env.https_proxy = proxy;
  }

  try {
    const { stdout } = await execFileAsync(config.ytDlpPath, args, {
      timeout: 45_000,
      maxBuffer: 32 * 1024 * 1024,
      encoding: 'utf8',
      env,
    });
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    return toMeta(parsed);
  } catch {
    return null;
  }
}

/** yt-dlp 是否可用（供启动日志 / 降级提示） */
export async function ytDlpAvailable(): Promise<boolean> {
  return hasYtDlp();
}

export interface DownloadedMedia {
  buffer: Buffer;
  /** 文件扩展名（不含点），如 mp4 / webm */
  ext: string;
}

/**
 * 直接下载视频文件（而非只取直链）。
 *
 * 为什么不直接用直链 fetch：YouTube / TikTok 的直链带签名、常要求特定 UA / Range，
 * 用 curl 二次拉取极易失败（"视频文件未能转存"）。让 yt-dlp 自己把文件下下来最稳，
 * 且天然免登录、TikTok 拿到的即无水印原片。
 *
 * 格式选择 `bestvideo+bestaudio`：YouTube / 多数平台只提供 DASH 分离流
 * （视频、音频各自独立），必须靠 ffmpeg 合并成单文件（镜像已装 ffmpeg）。
 * 优先挑 mp4(h264) + m4a(aac) 避免重编码；`--merge-output-format mp4`
 * 兜底统一封装。720p 上限控制体积与转存耗时。
 */
export async function ytDlpDownload(
  url: string,
  proxy?: string
): Promise<DownloadedMedia | null> {
  if (!(await hasYtDlp())) return null;

  const safe = `linji-yt-${process.pid}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const outTemplate = path.join(os.tmpdir(), `${safe}.%(ext)s`);
  const args = [
    '-f',
    'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best',
    '--merge-output-format',
    'mp4',
    '-o',
    outTemplate,
    '--no-warnings',
    '--no-playlist',
    '--no-progress',
    '--user-agent',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    url,
  ];
  const env = { ...process.env };
  if (proxy) {
    env.http_proxy = proxy;
    env.https_proxy = proxy;
  }

  const cleanup = () => {
    try {
      for (const f of fs.readdirSync(os.tmpdir())) {
        if (f.startsWith(safe)) fs.unlinkSync(path.join(os.tmpdir(), f));
      }
    } catch {
      /* ignore */
    }
  };

  try {
    await execFileAsync(config.ytDlpPath, args, {
      timeout: 120_000,
      maxBuffer: 64 * 1024 * 1024,
      env,
    });
    const files = fs
      .readdirSync(os.tmpdir())
      .filter((f) => f.startsWith(safe))
      .map((f) => path.join(os.tmpdir(), f));
    if (files.length === 0) return null;
    const file = files[0];
    const buffer = fs.readFileSync(file);
    const ext = path.extname(file).replace(/^\./, '') || 'mp4';
    cleanup();
    return buffer.byteLength > 0 ? { buffer, ext } : null;
  } catch {
    cleanup();
    return null;
  }
}
