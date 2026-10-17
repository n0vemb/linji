/**
 * 媒体存储：上传的文件与采集转存的媒体都落在这里。
 * 目录：<DATA_DIR>/uploads/<subdir>/<YYYY-MM>/<id>.<ext>
 * 对外 URL：/media/<subdir>/<YYYY-MM>/<id>.<ext>（由 @fastify/static 服务）
 *
 * 安全要点：
 * - 文件名一律由服务端生成（id + 白名单扩展名），**绝不使用用户提供的原名**
 *   （防路径穿越 / 特殊字符 / 扩展名伪造）
 * - 上传走 multipart 时校验 MIME 白名单 + 体积上限
 */
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../env';
import { newId } from '../lib/id';
import { ApiError } from '../lib/apiError';

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};

export const UPLOADS_ROOT = path.join(config.dataDir, 'uploads');

export function extFromMime(mime: string): string | null {
  return MIME_EXT[mime.toLowerCase()] ?? null;
}

export function isVideoMime(mime: string): boolean {
  return mime.toLowerCase().startsWith('video/');
}

function monthDir(subdir: string): string {
  const d = new Date();
  const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const dir = path.join(UPLOADS_ROOT, subdir, ym);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** 保存二进制，返回对外 URL（/media/<subdir>/<YYYY-MM>/<id>.<ext>） */
export function saveBuffer(
  buffer: Buffer,
  ext: string,
  subdir = 'collected'
): string {
  const dir = monthDir(subdir);
  const name = `${newId('m')}.${ext}`;
  fs.writeFileSync(path.join(dir, name), buffer);
  // dir = <uploads>/<subdir>/<YYYY-MM>，对外 URL 与其一一对应
  const rel = path.relative(UPLOADS_ROOT, dir).split(path.sep).join('/');
  return `/media/${rel}/${name}`;
}

export interface SavedUpload {
  url: string;
  mime: string;
  bytes: number;
  isVideo: boolean;
}

/**
 * 保存 multipart 上传的单个文件。
 * @param buffer 文件内容
 * @param mime 声明的 MIME（multipart 的 file.mimetype）
 */
export function saveUpload(buffer: Buffer, mime: string): SavedUpload {
  const ext = extFromMime(mime);
  if (!ext) {
    throw new ApiError(400, `不支持的素材格式：${mime || '未知'}（支持 jpg / png / webp / gif / mp4 / mov / webm）`);
  }
  const isVideo = isVideoMime(mime);
  const limit = isVideo ? config.maxVideoBytes : config.maxImageBytes;
  if (buffer.byteLength > limit) {
    throw new ApiError(
      413,
      isVideo
        ? `视频超过 ${Math.round(limit / 1024 / 1024)}MB 上限`
        : `图片超过 ${Math.round(limit / 1024 / 1024)}MB 上限`
    );
  }
  const url = saveBuffer(buffer, ext, 'uploads');
  return { url, mime, bytes: buffer.byteLength, isVideo };
}
