/**
 * 认证服务（live 模式）：登录 / 注册 / 恢复登录态 / 退出。
 * mock 模式下不走这里（store 直接用 DEFAULT_USER）。
 */
import type { CurrentUser } from '../types';
import { api, clearToken, getToken, setToken } from './apiClient';

/** 服务端用户对象（字段名与前端 CurrentUser 不同，这里归一化） */
interface ServerUser {
  id: string;
  username: string;
  displayName: string;
  role: 'creator' | 'admin';
}

function toCurrentUser(u: ServerUser): CurrentUser {
  return { id: u.id, name: u.displayName, role: u.role };
}

export interface AuthResponse {
  token: string;
  user: ServerUser;
}

export async function login(
  username: string,
  password: string
): Promise<CurrentUser> {
  const res = await api.post<AuthResponse>(
    '/auth/login',
    { username, password },
    false
  );
  setToken(res.token);
  return toCurrentUser(res.user);
}

export async function register(
  username: string,
  password: string,
  displayName?: string
): Promise<CurrentUser> {
  const res = await api.post<AuthResponse>(
    '/auth/register',
    { username, password, displayName },
    false
  );
  setToken(res.token);
  return toCurrentUser(res.user);
}

/** 凭已有 token 恢复登录态；失效返回 null */
export async function restore(): Promise<CurrentUser | null> {
  if (!getToken()) return null;
  try {
    const res = await api.get<{ user: ServerUser }>('/auth/me');
    return toCurrentUser(res.user);
  } catch {
    clearToken();
    return null;
  }
}

export function logout(): void {
  clearToken();
}

/** 修改密码（live 模式）：后端校验原密码并更新哈希 */
export async function changePassword(
  oldPassword: string,
  newPassword: string
): Promise<void> {
  await api.post('/auth/change-password', { oldPassword, newPassword });
}
