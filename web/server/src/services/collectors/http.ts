/**
 * 采集用 HTTP 基座。
 *
 * ════════════════════════════════════════════════════════════════
 * 为什么用 curl 子进程而不是 Node 内置 fetch（实测结论，2026-10）：
 * ════════════════════════════════════════════════════════════════
 * 小红书的短链服务带 JS 风控挑战（formula-runtime），
 * 按客户端 TLS 指纹分流：undici（Node fetch 底层）请求 100% 拿到挑战页，
 * curl 3/3 稳定拿到 302 跳转。浏览器指纹差异无法在 Node 层消除，
 * 因此小红书抓取走系统 curl；YouTube / Instagram 无此限制，
 * 但统一走 curl 行为更一致（curl 同样支持 -x 代理）。
 *
 * 代理策略（本地调试实测）：
 * 本机代理（10808）只覆盖海外域名，对国内域名直接 connection failed；
 * 生产服务器在海外直连一切。因此按域名分流：小红书直连，
 * 海外平台（YouTube/Instagram）才走 COLLECT_PROXY。
 *
 * curl 不可用时（极少数精简镜像）降级 undici：YouTube/Instagram 仍可用，
 * 小红书会明示「抓取通道不可用」而不是假装成功。
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { ProxyAgent } from 'undici';
import { config } from '../../env';

const execFileAsync = promisify(execFile);

/** 国内平台域名：直连，不走代理 */
const DOMESTIC_HOSTS = [
  'xhslink.com',
  'xhslink.cn',
  'xiaohongshu.com',
];

export const UA_MOBILE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
export const UA_DESKTOP =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** body 与元数据的分隔符（极不可能出现在页面内容里） */
const META_SEP = '\n@@CURLMETA@@\n';

function isDomestic(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return DOMESTIC_HOSTS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

function proxyFor(url: string): string | undefined {
  if (!config.collectProxy || isDomestic(url)) return undefined;
  return config.collectProxy;
}

// ── curl 可用性探测（每次进程探测一次，结果缓存） ──
let curlUsable: boolean | null = null;

async function hasCurl(): Promise<boolean> {
  if (curlUsable !== null) return curlUsable;
  try {
    await execFileAsync('curl', ['--version'], { timeout: 5000 });
    curlUsable = true;
  } catch {
    curlUsable = false;
    console.warn('[collect] 系统缺少 curl，国内平台抓取将不可用（建议镜像内安装 curl）');
  }
  return curlUsable;
}

export interface CurlResult {
  status: number;
  /** 最终 URL（跟随跳转后） */
  url: string;
  contentType: string;
  text: string;
}

function baseArgs(
  url: string,
  opts: { ua: string; referer?: string; timeoutMs: number; cookieJar?: string }
): string[] {
  const args = [
    '-sS', // 静默但保留错误
    '-L', // 跟随重定向（短链展开的关键）
    '--compressed',
    '--max-time',
    String(Math.ceil(opts.timeoutMs / 1000)),
    '-A',
    opts.ua,
    '-H',
    'Accept-Language: zh-CN,zh;q=0.9',
  ];
  const proxy = proxyFor(url);
  if (proxy) args.push('-x', proxy);
  if (opts.referer) args.push('-H', `Referer: ${opts.referer}`);
  if (opts.cookieJar) args.push('-b', opts.cookieJar, '-c', opts.cookieJar);
  return args;
}

/** curl 拉文本（HTML / JSON）。跳转由 -L 自动处理，元数据用 -w 带回 */
async function curlText(
  url: string,
  opts: {
    ua?: string;
    referer?: string;
    timeoutMs?: number;
    cookieJar?: string;
  } = {}
): Promise<CurlResult | null> {
  const args = [
    ...baseArgs(url, {
      ua: opts.ua ?? UA_DESKTOP,
      referer: opts.referer,
      timeoutMs: opts.timeoutMs ?? config.fetchTimeoutMs,
      cookieJar: opts.cookieJar,
    }),
    '-w',
    `${META_SEP}%{http_code}\t%{url_effective}\t%{content_type}`,
    url,
  ];
  try {
    const { stdout } = await execFileAsync('curl', args, {
      timeout: (opts.timeoutMs ?? config.fetchTimeoutMs) + 5000,
      maxBuffer: 32 * 1024 * 1024,
      encoding: 'utf8',
    });
    const sepAt = stdout.lastIndexOf(META_SEP);
    if (sepAt === -1) return null;
    const text = stdout.slice(0, sepAt);
    const [code, finalUrl, contentType] = stdout
      .slice(sepAt + META_SEP.length)
      .split('\t');
    return {
      status: Number(code) || 0,
      url: finalUrl || url,
      contentType: contentType || '',
      text,
    };
  } catch {
    return null;
  }
}

/** curl 拉二进制（媒体转存）：body 落临时文件，stdout 只带元数据 */
async function curlBinary(
  url: string,
  opts: {
    ua?: string;
    referer?: string;
    timeoutMs?: number;
    maxBytes?: number;
  } = {}
): Promise<{ status: number; contentType: string; buffer: Buffer } | null> {
  const maxBytes = opts.maxBytes ?? config.maxCollectMediaBytes;
  const tmp = path.join(
    os.tmpdir(),
    `linji_collect_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  );
  const args = [
    ...baseArgs(url, {
      ua: opts.ua ?? UA_DESKTOP,
      referer: opts.referer,
      timeoutMs: opts.timeoutMs ?? config.fetchTimeoutMs,
    }),
    '-o',
    tmp,
    '-w',
    `%{http_code}\t%{content_type}\t%{size_download}`,
    url,
  ];
  try {
    const { stdout } = await execFileAsync('curl', args, {
      timeout: (opts.timeoutMs ?? config.fetchTimeoutMs) + 5000,
      maxBuffer: 1024,
      encoding: 'utf8',
    });
    const [code, contentType, size] = stdout.split('\t');
    const status = Number(code) || 0;
    if (status < 200 || status >= 300) {
      safeUnlink(tmp);
      return null;
    }
    const declared = Number(size) || 0;
    if (declared > maxBytes) {
      safeUnlink(tmp);
      return null;
    }
    const buffer = fs.readFileSync(tmp);
    safeUnlink(tmp);
    if (buffer.byteLength > maxBytes) return null;
    return { status, contentType: contentType || '', buffer };
  } catch {
    safeUnlink(tmp);
    return null;
  }
}

function safeUnlink(p: string): void {
  try {
    fs.unlinkSync(p);
  } catch {
    /* 临时文件清理失败不影响主流程 */
  }
}

// ── undici 降级通道（curl 缺失时；YouTube/Instagram 可用，小红书会被风控拦截） ──
let proxyAgent: ProxyAgent | null = null;

function undiciAgentFor(url: string): ProxyAgent | undefined {
  const proxy = proxyFor(url);
  if (!proxy) return undefined;
  if (!proxyAgent) proxyAgent = new ProxyAgent(proxy);
  return proxyAgent;
}

async function undiciOnce(
  url: string,
  init: RequestInit & { timeoutMs: number }
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs);
  const dispatcher = undiciAgentFor(url);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      ...(dispatcher ? { dispatcher } : {}),
    } as RequestInit);
  } finally {
    clearTimeout(timer);
  }
}

// ────────────────────────────────────────────────────────────────
// 对外统一接口（与调用方约定不变，内部按可用性路由）
// ────────────────────────────────────────────────────────────────

export interface FetchedPage {
  status: number;
  url: string;
  text: string | null;
  contentType: string;
  cookie: string;
}

export interface FetchedBinary {
  status: number;
  contentType: string;
  buffer: ArrayBuffer;
  byteLength: number;
}

/**
 * GET 页面并跟随重定向，返回最终页面。
 * curl 优先；不可用时走 undici 手动跟随（国内平台预计被风控拦截，
 * 由调用方的 limitation 说明兜底）。
 */
export async function fetchFollow(
  url: string,
  opts: {
    ua?: string;
    referer?: string;
    accept?: string;
    timeoutMs?: number;
    maxRedirects?: number;
  } = {}
): Promise<FetchedPage> {
  if (await hasCurl()) {
    // 瞬断重试一次：国内 CDN 节点偶发 TLS 握手失败（实测本地网络），
    // 生产环境通常一次成功；重试只多花一次超时，不改变失败语义。
    let r = await curlText(url, opts);
    if (!r) r = await curlText(url, opts);
    if (!r) {
      return { status: 0, url, text: null, contentType: '', cookie: '' };
    }
    return {
      status: r.status,
      url: r.url,
      text: r.status >= 200 && r.status < 300 ? r.text : null,
      contentType: r.contentType,
      // curl 内部管理 cookie，外部不需要感知
      cookie: '',
    };
  }
  return undiciFetchFollow(url, opts);
}

async function undiciFetchFollow(
  url: string,
  opts: {
    ua?: string;
    referer?: string;
    timeoutMs?: number;
    maxRedirects?: number;
  }
): Promise<FetchedPage> {
  const timeoutMs = opts.timeoutMs ?? config.fetchTimeoutMs;
  const maxRedirects = opts.maxRedirects ?? 6;
  const jar = new Map<string, string>();

  let current = url;
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const headers: Record<string, string> = {
      'User-Agent': opts.ua ?? UA_DESKTOP,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9',
    };
    if (opts.referer) headers.Referer = opts.referer;
    const cookie = Array.from(jar.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
    if (cookie) headers.Cookie = cookie;

    let res: Response;
    try {
      res = await undiciOnce(current, { headers, timeoutMs });
    } catch {
      return { status: 0, url: current, text: null, contentType: '', cookie };
    }
    const setCookie =
      typeof res.headers.getSetCookie === 'function'
        ? res.headers.getSetCookie()
        : [];
    for (const raw of setCookie) {
      const pair = raw.split(';')[0] ?? '';
      const eq = pair.indexOf('=');
      if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) break;
      current = new URL(location, current).toString();
      continue;
    }
    const text = res.ok ? await res.text().catch(() => null) : null;
    return {
      status: res.status,
      url: current,
      text,
      contentType: res.headers.get('content-type') ?? '',
      cookie,
    };
  }
  return {
    status: 0,
    url: current,
    text: null,
    contentType: '',
    cookie: Array.from(jar.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; '),
  };
}

/** GET JSON（平台 JSON 接口用；curl 优先，缺失时降级 undici） */
export async function fetchJson<T>(
  url: string,
  opts: { ua?: string; referer?: string; timeoutMs?: number } = {}
): Promise<{ status: number; data: T | null }> {
  if (await hasCurl()) {
    const r = await curlText(url, opts);
    if (!r || r.status !== 200) return { status: r?.status ?? 0, data: null };
    try {
      return { status: 200, data: JSON.parse(r.text) as T };
    } catch {
      return { status: 200, data: null };
    }
  }
  // undici 降级
  try {
    const res = await undiciOnce(url, {
      headers: {
        'User-Agent': opts.ua ?? UA_DESKTOP,
        Accept: 'application/json',
        ...(opts.referer ? { Referer: opts.referer } : {}),
      },
      timeoutMs: opts.timeoutMs ?? config.fetchTimeoutMs,
    });
    if (!res.ok) return { status: res.status, data: null };
    const text = await res.text();
    try {
      return { status: res.status, data: JSON.parse(text) as T };
    } catch {
      return { status: res.status, data: null };
    }
  } catch {
    return { status: 0, data: null };
  }
}

/** 下载二进制（媒体转存用），带体积上限 */
export async function fetchBinary(
  url: string,
  opts: {
    ua?: string;
    referer?: string;
    timeoutMs?: number;
    maxBytes?: number;
  } = {}
): Promise<FetchedBinary | null> {
  if (await hasCurl()) {
    const r = await curlBinary(url, opts);
    if (!r) return null;
    return {
      status: r.status,
      contentType: r.contentType,
      buffer: r.buffer.buffer.slice(
        r.buffer.byteOffset,
        r.buffer.byteOffset + r.buffer.byteLength
      ) as ArrayBuffer,
      byteLength: r.buffer.byteLength,
    };
  }
  try {
    const res = await undiciOnce(url, {
      headers: { 'User-Agent': opts.ua ?? UA_DESKTOP },
      timeoutMs: opts.timeoutMs ?? config.fetchTimeoutMs,
    });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > (opts.maxBytes ?? config.maxCollectMediaBytes)) {
      return null;
    }
    return {
      status: res.status,
      contentType: res.headers.get('content-type') ?? '',
      buffer,
      byteLength: buffer.byteLength,
    };
  } catch {
    return null;
  }
}
