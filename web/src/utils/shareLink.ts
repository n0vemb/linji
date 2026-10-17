/**
 * 分享链接解析器 —— 从平台「分享」出来的原始文案中提取可用的链接与线索。
 *
 * 为什么需要单独一层：
 * 各平台复制出来的分享文案**都不是纯网址**，而是「引导语 + 链接 + 引导语」的混合文本，
 * 且引导语里混入了标题、作者、话题等有用信息。直接把整段丢给 URL 解析器会失败。
 *
 * 真实样本（线上格式，2025-2026）：
 *   抖音   7.85 复制打开抖音，看看【夏日穿搭分享】的作品 #穿搭 https://v.douyin.com/iRNBho6u/ 复制此链接，打开Dou音搜索，直接观看视频！
 *   小红书 31 【小个子显高穿搭 - 小鹿 | 小红书 - 你的生活指南】😆 xhslink.com/a/xxxxx 复制本条信息，打开【小红书】App查看精彩内容！
 *   TikTok Check out this video: https://www.tiktok.com/@user/video/7123456789012345678
 *   Instagram Check out this reel by @nick: https://www.instagram.com/reel/AbCdEf/
 *   YouTube https://youtu.be/dQw4w9WgXcQ  /  https://www.youtube.com/watch?v=dQw4w9WgXcQ
 *
 * 本模块职责边界（纯函数，可测，无网络）：
 *   ① 清洗分享文案（全角空格、零宽字符、表情）
 *   ② 抽取并规范化 URL（补全 https://、剥离尾部中文标点）
 *   ③ 识别平台、提取内容 ID、标记是否为短链
 *   ④ 顺带抽取分享文案里的标题 / 作者 / #话题线索
 *
 * ⚠️ 不负责「抓取视频和图片」—— 那是 collectService 的事，原因见该文件顶部说明。
 */

/** 可采集的来源平台（注意：与灵感的目标发布平台 Platform 不同） */
export type CollectPlatform =
  | 'douyin'
  | 'xiaohongshu'
  | 'instagram'
  | 'tiktok'
  | 'youtube';

export interface ParsedShare {
  /** 识别到的平台 */
  platform: CollectPlatform;
  /** 规范化后的完整 URL（已补全协议） */
  url: string;
  /** 平台内容 ID；短链只能拿到短码，需服务端 302 展开后才��真实 ID */
  contentId: string;
  /** 是否是短链（v.douyin.com / xhslink.com 这类，需服务端跟随跳转） */
  isShortLink: boolean;
  /** 从分享文案里尽力提取的标题线索（不保证准确，仅用于预填） */
  titleHint: string | null;
  /** 作者线索（抖音/小红书文案里常带） */
  authorHint: string | null;
  /** 分享文案里的 #话题 */
  tagHints: string[];
  /** 原始输入 */
  raw: string;
}

/** 平台元数据：域名、显示名、是否官方支持 oEmbed */
export const PLATFORM_META: Record<
  CollectPlatform,
  { label: string; domains: string[] }
> = {
  douyin: { label: '抖音', domains: ['douyin.com', 'iesdouyin.com'] },
  xiaohongshu: {
    label: '小红书',
    // 实测：分享短链存在 xhslink.com / xhslink.cn / xhslink.cn/o/ 三种形态
    domains: ['xhslink.com', 'xhslink.cn', 'xiaohongshu.com'],
  },
  instagram: { label: 'Instagram', domains: ['instagram.com', 'instagr.am'] },
  tiktok: { label: 'TikTok', domains: ['tiktok.com'] },
  youtube: { label: 'YouTube', domains: ['youtube.com', 'youtu.be'] },
};

const SHORT_DOMAINS = ['v.douyin.com', 'xhslink.com', 'xhslink.cn'];

/** 匹配「带协议的 URL」或「裸域名 + 路径」（小红书/抖音分享里常省略 https://） */
const URL_RE = new RegExp(
  `(https?:\\/\\/[^\\s一-龥]+|(?:[a-z0-9-]+\\.)+(?:com|cn|net|me|tv|co|app|xyz|top|link)\\/[^\\s一-龥]*)`,
  'gi'
);

/**
 * 清洗分享文案：
 *  - 全角空格（U+3000）/ 不换行空格（U+00A0）→ 普通空格
 *  - 零宽字符（U+200B-200D）、BOM（U+FEFF）→ 删除
 *    （小红书 / 抖音分享文案里常有零宽字符，不清会导致链接识别失败）
 *  - emoji → 空格
 */
export function cleanShareText(raw: string): string {
  return raw
    .replace(/[\u3000\u00A0]/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 剥离 URL 尾部粘连的中文引导语与标点 */
function trimUrlTail(u: string): string {
  let out = u;
  // 循环剥离：分享文案里 URL 后常紧跟中文词（如 xxx复制此链接）
  let prev = '';
  while (out !== prev) {
    prev = out;
    out = out.replace(/[^\x21-\x7E]+$/, '');
    out = out.replace(/[.,;:!?)\]}>，。；：！？）】》]+$/, '');
  }
  return out;
}

/** 规范化为完整 URL：裸域名补 https:// */
export function normalizeUrl(url: string): string {
  const trimmed = trimUrlTail(url);
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** 从整段分享文案中抽取第一个可识别平台的 URL */
export function extractUrl(text: string): { url: string; platform: CollectPlatform } | null {
  const cleaned = cleanShareText(text);
  const matches = cleaned.match(URL_RE);
  if (!matches) return null;

  for (const m of matches) {
    const url = normalizeUrl(m);
    if (!url) continue;
    const platform = detectPlatform(url);
    if (platform) return { url, platform };
  }
  return null;
}

/** 按域名识别平台 */
export function detectPlatform(url: string): CollectPlatform | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  for (const [platform, meta] of Object.entries(PLATFORM_META)) {
    if (meta.domains.some((d) => host === d || host.endsWith(`.${d}`))) {
      return platform as CollectPlatform;
    }
  }
  return null;
}

/**
 * 提取内容 ID。
 * 短链（v.douyin.com/xxx、xhslink.com/a/xxx）只能拿到短码，
 * 真实内容 ID 需要服务端跟随 302 后再解析。
 */
export function extractContentId(url: string, platform: CollectPlatform): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return '';
  }
  const host = u.hostname.toLowerCase();
  const path = u.pathname;
  const seg = path.split('/').filter(Boolean);

  switch (platform) {
    case 'youtube': {
      // watch?v=ID
      const v = u.searchParams.get('v');
      if (v) return v;
      // youtu.be/ID
      if (host.endsWith('youtu.be')) return seg[0] ?? '';
      // /shorts/ID、/embed/ID、/live/ID
      if (['shorts', 'embed', 'live'].includes(seg[0] ?? '') && seg[1]) return seg[1];
      return seg[seg.length - 1] ?? '';
    }
    case 'tiktok': {
      // /@user/video/ID
      const vi = seg.findIndex((s) => s === 'video');
      if (vi >= 0 && seg[vi + 1]) return seg[vi + 1];
      // /@user
      const at = seg.find((s) => s.startsWith('@'));
      return at ? at.replace('@', '') : '';
    }
    case 'instagram': {
      // /reel/ID、/p/ID、/tv/ID
      if (['p', 'reel', 'reels', 'tv'].includes(seg[0] ?? '') && seg[1]) return seg[1];
      return '';
    }
    case 'douyin': {
      // /video/ID（长链）
      const vi = seg.findIndex((s) => s === 'video');
      if (vi >= 0 && seg[vi + 1]) return seg[vi + 1];
      // 短链：/xxx
      return seg[seg.length - 1] ?? '';
    }
    case 'xiaohongshu': {
      // /explore/ID、/discovery/item/ID、/a/短码
      if (seg[0] === 'explore' && seg[1]) return seg[1];
      if (seg[0] === 'discovery' && seg[2]) return seg[2];
      return seg[seg.length - 1] ?? '';
    }
    default:
      return '';
  }
}

/** 是否短链（需服务端跟随 302 才能拿到真实内容 ID） */
export function isShortLink(url: string, platform: CollectPlatform): boolean {
  const meta = PLATFORM_META[platform];
  let host = '';
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return SHORT_DOMAINS.includes(host) || meta.domains.some((d) => host === d);
}

/**
 * 抽取分享文案里的 #话题。
 *
 * 注意：平台分享常把话题**截断**成「...#」或「#...」（如抖音样本里的
 * `效果实录#... https://...`），这种不是真话题名，必须过滤掉，
 * 否则会回填一个无意义的 `#...` 到用户表单里。
 */
export function extractTags(text: string): string[] {
  const cleaned = cleanShareText(text);
  const out: string[] = [];
  const re = /#([^\s#，。！？、；：（）【】「」]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null) {
    let tag = m[1].replace(/[.,;:!?)\]}]+$/, '').trim();
    // 平台截断的话题（全是点、或只有一个字符）不是有效话题
    if (!tag) continue;
    if (/^[.。…]+$/.test(tag)) continue;
    if (tag.length < 2) continue;
    out.push(`#${tag}`);
  }
  return Array.from(new Set(out));
}

/** 从分享文案提取标题 / 作者线索 */
function extractHints(
  text: string,
  platform: CollectPlatform
): { title: string | null; author: string | null } {
  const cleaned = cleanShareText(text);

  // 按平台分派：抖音与小红书**都用【】包裹内容**，格式却不同，
  // 先匹配通用【】会把抖音文案误判成小红书（曾导致「小鹿的作品」取不到作者）。
  if (platform === 'xiaohongshu') {
    // 格式 A（App 内分享）：【标题 - 作者 | 小红书 - 你的生活指南】
    const bracket = cleaned.match(/【([^】]+)】/);
    if (bracket && bracket[1].includes('-')) {
      const head = bracket[1].split('|')[0] ?? '';
      const parts = head
        .split(' - ')
        .map((x) => x.trim())
        .filter(Boolean);
      if (parts.length >= 2) return { title: parts[0], author: parts[1] };
      if (parts.length === 1) return { title: parts[0], author: null };
    }

    // 格式 B（实测真实样本，2026）：
    //   「林小牙TinyTooth｜面包师 这衣服也太适合zsiga可动三... https://xhslink.cn/o/xxx」
    //   结构：昵称 ｜ [身份标签] 标题
    //   竖线后可能**没有**身份标签（直接就是标题），所以身份段必须可选。
    //   策略：先用「中文/英文都不含的标点集」定位竖线切出昵称，
    //        再判断竖线后的第一段是否像标题 —— 若首段极短（≤ 12 字）且后面还有内容，
    //        视为身份标签；否则整段都是标题。
    const head = cleaned.split(/https?:\/\//)[0] ?? '';
    const barMatch = head.match(/^([^｜|]+?)[｜|]/);
    if (barMatch) {
      const name = barMatch[1].trim();
      let rest = head.slice(barMatch[0].length).trim();

      // 去掉尾部的平台引导语（「去【小红书】看看这篇宝藏笔记吧！」等已被 split 截断，
      // 这里只需处理粘连在标题后的残余标点）
      rest = rest.replace(/[。.!！?？\s]+$/, '').trim();

      if (rest) {
        // 若第一段很短且后面还有更长的一段，把第一段当身份标签
        const seg = rest.split(/\s+/);
        let title: string;
        if (seg.length >= 2 && seg[0].length <= 12 && !/^的?作品$/.test(seg[0])) {
          title = seg.slice(1).join(' ').trim(); // 丢弃身份标签
        } else {
          title = rest;
        }
        if (name && title) return { title, author: name };
      }
      if (name) return { title: null, author: name };
    }

    return { title: null, author: null };
  }

  if (platform === 'douyin') {
    // 抖音：看看【XXX的作品】→ 作者；看看【XXX】→ 标题
    const m = cleaned.match(/看看【([^】]+)】/);
    if (m) {
      const inner = m[1].trim();
      const authorMatch = inner.match(/^(.+?)的(?:作品|视频|笔记)$/);
      if (authorMatch) return { title: null, author: authorMatch[1].trim() };
      return { title: inner, author: null };
    }
    // 无「看看」前缀时，退化为取【】内文本
    const m2 = cleaned.match(/【([^】]+)】/);
    if (m2) return { title: m2[1].trim(), author: null };
    return { title: null, author: null };
  }

  // 其他平台：分享文案通常不含【】，标题走 oEmbed（后端补全）
  return { title: null, author: null };
}
/**
 * 主入口：解析任意平台分享文案。
 * 返回 null 表示无法识别出平台链接（调用方应提示用户检查格式）。
 */
export function parseShareText(raw: string): ParsedShare | null {
  if (!raw || !raw.trim()) return null;

  const found = extractUrl(raw);
  if (!found) return null;

  const { url, platform } = found;
  const { title, author } = extractHints(raw, platform);

  return {
    platform,
    url,
    contentId: extractContentId(url, platform),
    isShortLink: isShortLink(url, platform),
    titleHint: title,
    authorHint: author,
    tagHints: extractTags(raw),
    raw,
  };
}
