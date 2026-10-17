/**
 * YouTube / TikTok：官方 oEmbed，无需鉴权、无需签名。
 * 这是五个平台里唯一能稳定拿到「标题 + 作者 + 封面」的通道（实测可用）。
 * 视频文件本身拿不到（需转存），如实降级。
 */
import type { CollectPlatform } from '../../../../src/utils/shareLink';
import { UA_DESKTOP, fetchJson } from './http';

interface OEmbedResponse {
  title?: string;
  author_name?: string;
  author_url?: string;
  thumbnail_url?: string;
  html?: string;
}

export interface OEmbedFindings {
  title: string;
  author: string | null;
  thumbnail: string | null;
}

const ENDPOINTS: Partial<Record<CollectPlatform, (url: string) => string>> = {
  youtube: (url) =>
    `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
  tiktok: (url) =>
    `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
};

export async function fetchOEmbed(
  platform: CollectPlatform,
  url: string
): Promise<OEmbedFindings | null> {
  const build = ENDPOINTS[platform];
  if (!build) return null;
  const { data } = await fetchJson<OEmbedResponse>(build(url), {
    ua: UA_DESKTOP,
  });
  if (!data?.title) return null;
  return {
    title: data.title,
    author: data.author_name ?? null,
    thumbnail: data.thumbnail_url ?? null,
  };
}
