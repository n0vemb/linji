/**
 * API 客户端：与后端（server/）对话的唯一出口。
 *
 * - token 存 localStorage，请求自动带 Authorization
 * - 错误统一成 ApiError { status, message }，界面直接展示后端给出的中文提示
 * - 401 时清理 token（登录态失效，AuthGate 会弹登录页）
 */

const BASE: string = import.meta.env.VITE_API_URL ?? '/api';
const TOKEN_KEY = 'linji_token';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* 隐私模式等场景下存不进去，退化为仅内存登录态 */
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  /** 是否带登录态（默认 true；登录 / 注册接口除外） */
  auth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.auth !== false) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, '无法连接服务器，请确认后端已启动（npm run dev:all）');
  }

  if (res.status === 401) clearToken();

  const text = await res.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      /* 非 JSON 响应（如静态资源错误页） */
    }
  }

  if (!res.ok) {
    const err = (payload as { error?: { message?: string } } | null)?.error;
    throw new ApiError(res.status, err?.message ?? `请求失败（${res.status}）`);
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown, auth = true) =>
    request<T>(path, { method: 'POST', body, auth }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),

  /**  multipart 上传（上传页提交前把本地文件换成服务端 URL） */
  uploadFiles: async (
    files: File[]
  ): Promise<{ files: Array<{ url: string; isVideo: boolean }> }> => {
    const form = new FormData();
    for (const f of files) form.append('files', f);
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    let res: Response;
    try {
      res = await fetch(`${BASE}/upload`, { method: 'POST', headers, body: form });
    } catch {
      throw new ApiError(0, '无法连接服务器，上传失败');
    }
    const payload = (await res.json().catch(() => null)) as {
      files?: Array<{ url: string; isVideo: boolean }>;
      error?: { message?: string };
    } | null;
    if (!res.ok) {
      throw new ApiError(res.status, payload?.error?.message ?? '上传失败');
    }
    return { files: payload?.files ?? [] };
  },
};
