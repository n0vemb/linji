/**
 * 抖音作品数据提取（树遍历，shape 无关）。
 *
 * 为什么用树遍历而不是按固定 JSON 路径：同一份 aweme 数据来自三个不同来源
 * （分享页 _ROUTER_DATA 的 videoInfoRes、iteminfo 接口、Douyin_TikTok_Download_API
 * sidecar 的响应），三处的包装结构都可能随平台改版变化。按 key 递归查找
 * （参考 zouzanyan/douyin_crawl 的做法）对结构变化免疫。
 */
import type { MediaType } from '../../../../src/data/types';

export interface AwemeExtract {
  desc: string;
  nickname: string;
  /** 播放地址候选（play_addr / download_addr 的 url_list） */
  playUrls: string[];
  /** 视频 ID（uri，形如 v0xxx...）*/
  videoUri: string;
  /** 图集图片直链 */
  imageUrls: string[];
}

const EMPTY: AwemeExtract = {
  desc: '',
  nickname: '',
  playUrls: [],
  videoUri: '',
  imageUrls: [],
};

/** 递归遍历 JSON 树，抽取抖音作品的关键字段 */
export function extractAweme(input: unknown): AwemeExtract {
  const out: AwemeExtract = { ...EMPTY, playUrls: [], imageUrls: [] };

  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!node || typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;

    // 播放地址（play_addr / download_addr 的 url_list）
    const urlList = obj.url_list;
    if (Array.isArray(urlList) && urlList.length > 0) {
      const urls = urlList.filter((u): u is string => typeof u === 'string' && !!u);
      if (urls.some((u) => u.includes('/aweme/v1/play') || u.includes('video_id='))) {
        for (const u of urls) {
          if (!out.playUrls.includes(u)) out.playUrls.push(u);
        }
      }
    }

    // 视频 ID
    const uri = obj.uri;
    if (!out.videoUri && typeof uri === 'string' && /^v[0-9a-f]+$/.test(uri)) {
      out.videoUri = uri;
    }

    // 标题 / 作者
    if (!out.desc && typeof obj.desc === 'string' && obj.desc.trim()) {
      out.desc = obj.desc;
    }
    if (!out.nickname && typeof obj.nickname === 'string' && obj.nickname.trim()) {
      out.nickname = obj.nickname;
    }

    // 图集图片（images[].url_list / download_url_list）
    if (Array.isArray(obj.images) && obj.images.length > 0) {
      for (const img of obj.images) {
        if (!img || typeof img !== 'object') continue;
        const im = img as Record<string, unknown>;
        const dl = Array.isArray(im.download_url_list) ? im.download_url_list : null;
        const ul = Array.isArray(im.url_list) ? im.url_list : null;
        const url =
          (dl && typeof dl[0] === 'string' && dl[0]) ||
          (ul && typeof ul[0] === 'string' && ul[0]) ||
          '';
        if (url && !out.imageUrls.includes(url)) out.imageUrls.push(url);
      }
    }

    for (const v of Object.values(obj)) walk(v);
  };

  walk(input);
  return out;
}

/**
 * 由 videoUri 或已有播放地址构造**无水印**播放地址。
 * 原理：抖音同时存在 playwm（带水印）与 play（无水印）两条流，
 * 把地址里的 playwm 换成 play 即可（ratio 控制画质）。
 */
export function buildNoWatermarkUrl(
  videoUri: string,
  template?: string
): string {
  if (template) {
    const m = template.match(/(https?:\/\/[^/]+\/aweme\/v1\/play(?:wm)?\/)/);
    if (m) {
      const prefix = m[1].replace('playwm', 'play');
      const lineMatch = template.match(/&(line=\d+)/);
      return `${prefix}?video_id=${videoUri}&ratio=default${
        lineMatch ? `&${lineMatch[1]}` : '&line=0'
      }`;
    }
  }
  return `https://aweme.snssdk.com/aweme/v1/play/?video_id=${videoUri}&ratio=default&line=0`;
}

/** 判断是否图集作品 */
export function isAlbum(ex: AwemeExtract): boolean {
  return ex.imageUrls.length > 0;
}

/** 推断素材类型 */
export function douyinMediaType(ex: AwemeExtract): MediaType {
  return ex.imageUrls.length > 0 && ex.playUrls.length === 0 ? 'image' : 'video';
}
