/**
 * 小红书采集：短链展开（xsec_token 就在跳转后的 URL 上）→
 * 笔记详情页 SSR 的 __INITIAL_STATE__ → 结构化笔记数据。
 *
 * 实测结论（2026-10，curl 传输）：
 * - 短链展开稳定，展开后 URL 自带 xsec_token / xsec_source（关键！）
 * - 详情页 SSR 含 __INITIAL_STATE__，实测**可完整解析**：
 *   正文 desc（含 #话题）、imageList（原图直链）、type、user
 * - __INITIAL_STATE__ 的 JSON 里混有 undefined 字面量与裸 key，
 *   直接 JSON.parse 会炸，需先宽松化
 * - 注意结构版本差异（2026 实测）：新版数据在
 *   `state.noteData.data.noteData`；旧版在 `state.note.noteDetailMap[id].note`。
 *   两个路径都试，谁命中用谁。
 * - 视频笔记的播放地址需要额外签名接口 → 拿封面 + 如实说明
 */
import type { ParsedShare } from '../../../../src/utils/shareLink';
import { extractTags } from '../../../../src/utils/shareLink';
import type { MediaType } from '../../../../src/data/types';
import { UA_MOBILE, fetchFollow } from './http';
import type { PlatformFindings } from './types';

interface XhsImage {
  url?: string;
  urlDefault?: string;
  urlPre?: string;
  infoList?: Array<{ imageScene?: string; url?: string }>;
}

interface XhsNote {
  title?: string;
  desc?: string;
  type?: string;
  imageList?: XhsImage[];
  user?: { nickname?: string };
}

interface InitialState {
  note?: {
    noteDetailMap?: Record<string, { note?: XhsNote }>;
  };
  noteData?: {
    data?: { noteData?: XhsNote };
  };
}

/** 从页面里挖 __INITIAL_STATE__ 并宽松解析 */
function parseInitialState(html: string): InitialState | null {
  const m = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\})<\/script>/);
  if (!m) return null;
  const json = m[1]
    .replace(/":undefined/g, '":null')
    // 裸 key 补引号（{"noteId": ...} → {"noteId": ...} 已是字符串的不管）
    .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":');
  try {
    return JSON.parse(json) as InitialState;
  } catch {
    return null;
  }
}

/** 按 noteId 找笔记：新版 noteData.data.noteData → 旧版 note.noteDetailMap */
function findNote(state: InitialState, noteId: string): XhsNote | null {
  const newPath = state.noteData?.data?.noteData;
  if (newPath && (newPath.desc || newPath.imageList?.length)) return newPath;
  const map = state.note?.noteDetailMap ?? {};
  const entry =
    (noteId ? map[noteId] : undefined) ??
    Object.values(map).find((v) => v?.note);
  return entry?.note ?? null;
}

/** 图片条目里挑可用的直链（新版字段是 url，旧版是 urlDefault / urlPre） */
function imageUrl(img: XhsImage): string {
  if (img.url) return img.url;
  const detail = img.infoList?.find((i) => i.imageScene === 'H5_DTL')?.url;
  if (detail) return detail;
  return img.urlDefault ?? img.urlPre ?? '';
}

export async function collectXiaohongshu(
  parsed: ParsedShare
): Promise<PlatformFindings> {
  const findings: PlatformFindings = { fetched: [] };

  // ── 1. 短链展开：拿带 xsec_token 的最终 URL ──
  let targetUrl = parsed.url;
  let realId = parsed.contentId;
  if (parsed.isShortLink) {
    const page = await fetchFollow(parsed.url, { ua: UA_MOBILE });
    if (page.status && page.status < 400 && page.url !== parsed.url) {
      targetUrl = page.url;
      const m = page.url.match(/\/explore\/([a-f0-9]{20,})/i)
        ?? page.url.match(/\/discovery\/item\/([a-f0-9]{20,})/i);
      if (m) realId = m[1];
      findings.finalUrl = page.url;
    } else if (page.status === 0) {
      findings.limitation = '小红书短链展开失败（网络不可达 / 抓取通道缺失）';
      return findings;
    } else {
      findings.limitation = '小红书短链展开失败（链接可能已过期）';
      return findings;
    }
  }

  // ── 2. 拉详情页（带 token 的 URL + 移动端 UA） ──
  const page = await fetchFollow(targetUrl, {
    ua: UA_MOBILE,
    referer: 'https://www.xiaohongshu.com/',
  });
  if (!page.text) {
    findings.limitation =
      page.status === 404
        ? '笔记不存在或已删除'
        : '小红书页面未返回内容（可能触发验证 / 需登录），已提取分享文案中的线索';
    return findings;
  }

  const state = parseInitialState(page.text);
  const note = state ? findNote(state, realId) : null;

  if (!note) {
    findings.limitation =
      '未能从页面解析出笔记数据（小红书结构调整 / 需登录），已提取分享文案中的线索';
    return findings;
  }

  findings.fetched.push('笔记详情');
  const desc = note.desc ?? '';
  // desc 首行比 share 卡片 title（「昵称｜身份」格式）更像真标题
  if (desc) {
    findings.copy = desc;
    findings.title = desc.split('\n')[0]?.trim().slice(0, 40) ?? '';
    // 小红书话题格式是「#话题名[话题]#」，剥掉 [话题] 尾缀才是干净话题
    findings.tags = extractTags(desc).map((t) =>
      t.replace(/\[话题[^\s#]*$/, '')
    );
  } else if (note.title) {
    findings.title = note.title;
  }
  if (note.user?.nickname) findings.author = note.user.nickname;

  const images = (note.imageList ?? [])
    .map(imageUrl)
    .filter((u): u is string => !!u)
    .slice(0, 9);
  if (images.length > 0) {
    findings.images = images;
    findings.fetched.push(`${images.length} 张图片`);
  }

  const mediaType: MediaType = note.type === 'video' ? 'video' : 'image';
  findings.mediaType = mediaType;
  if (mediaType === 'video') {
    findings.limitation =
      '视频笔记的播放地址需要小红书签名接口，当前未接入；已取到封面与文案';
  }
  return findings;
}
