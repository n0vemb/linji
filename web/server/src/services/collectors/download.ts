/** 媒体下载转存（采集器共用）：远程 URL → 本地 /media URL */
import { UA_MOBILE, fetchBinary } from './http';
import { extFromMime, saveBuffer } from '../mediaStore';

const IMAGE_EXT_FALLBACK = 'jpg';

function extFromUrl(url: string, contentType: string): string {
  const fromMime = extFromMime(contentType.split(';')[0] ?? '');
  if (fromMime) return fromMime;
  const m = url.match(/\.(jpg|jpeg|png|webp|gif|avif)(?:\?|$)/i);
  return m ? (m[1] === 'jpeg' ? 'jpg' : m[1].toLowerCase()) : IMAGE_EXT_FALLBACK;
}

/** 下载远程图片并转存；失败返回 null（由调用方降级） */
export async function downloadImage(url: string): Promise<string | null> {
  const bin = await fetchBinary(url, { ua: UA_MOBILE, maxBytes: 20 * 1024 * 1024 });
  if (!bin || bin.byteLength === 0) return null;
  // 内容类型不是图片（拿到的是错误页 HTML 之类）→ 拒绝
  if (bin.contentType && !bin.contentType.startsWith('image/')) return null;
  const ext = extFromUrl(url, bin.contentType);
  try {
    return saveBuffer(Buffer.from(bin.buffer), ext, 'collected');
  } catch {
    return null;
  }
}
