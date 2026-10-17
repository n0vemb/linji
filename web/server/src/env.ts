/**
 * 环境变量集中管理 —— 所有 process.env 只在这里读一次，
 * 其他地方 import config，避免散落的 env 读取与默认值分叉。
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
/** server/src → server → web → 项目根 */
export const PROJECT_ROOT = path.resolve(here, '..', '..', '..');
export const WEB_ROOT = path.resolve(here, '..', '..');

function str(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : fallback;
}

function int(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) ? v : fallback;
}

export const config = {
  env: str('NODE_ENV', 'development'),
  port: int('PORT', 8787),
  host: str('HOST', '0.0.0.0'),

  /** SQLite 数据目录（库文件 + 上传媒体都放这里，挂 volume 即可持久化） */
  dataDir: str('DATA_DIR', path.join(WEB_ROOT, 'server', 'data')),
  /** 前端构建产物目录（生产模式静态托管） */
  distDir: str('DIST_DIR', path.join(WEB_ROOT, 'dist')),

  /** JWT 密钥：生产必须显式设置，开发用固定值保证重启后 token 仍有效 */
  jwtSecret: str('JWT_SECRET', 'linji-dev-secret-change-me'),
  jwtExpiresIn: str('JWT_EXPIRES_IN', '7d'),

  /**
   * 采集抓取走的 HTTP 代理（仅本地调试需要）。
   * 服务器部署在海外，直连平台即可，留空。
   * 例：COLLECT_PROXY=http://127.0.0.1:10808
   */
  collectProxy: str('COLLECT_PROXY', ''),

  /**
   * Douyin_TikTok_Download_API sidecar 地址（可选）。
   * 设置后抖音 / TikTok 解析走该服务（纯 Python 实现 X-Bogus/a_bogus 签名，
   * 见 docker-compose.yml 的 douyin-api service）。未设置则走
   * 分享页 / iteminfo 降级链（拿不到就如实告知）。
   */
  douyinApiUrl: str('DOUYIN_API_URL', ''),

  /** yt-dlp 可执行文件路径（Instagram / TikTok 元数据，Dockerfile 已装） */
  ytDlpPath: str('YTDLP_PATH', 'yt-dlp'),

  /** 上传体积上限（字节） */
  maxImageBytes: int('MAX_IMAGE_BYTES', 15 * 1024 * 1024),
  maxVideoBytes: int('MAX_VIDEO_BYTES', 200 * 1024 * 1024),

  /** 采集时下载单张媒体的体积上限 */
  maxCollectMediaBytes: int('MAX_COLLECT_MEDIA_BYTES', 20 * 1024 * 1024),

  /** 抓取超时（毫秒） */
  fetchTimeoutMs: int('FETCH_TIMEOUT_MS', 15_000),
} as const;

export const isProd = config.env === 'production';
