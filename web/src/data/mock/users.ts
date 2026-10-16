import type { CurrentUser } from '../types';

/**
 * mock 用户（创建者 / 管理员 演示视角）。
 * 默认当前用户为创建者「许清楚」，可通过顶栏角色切换器切换到管理员「高见远」演示权限门控。
 * 对应架构 §8 待确认问题 #2 / #4 的默认建议。
 */
export const MOCK_USERS: CurrentUser[] = [
  { id: 'user_xu', name: '许清楚', role: 'creator' },
  { id: 'user_gao', name: '高见远', role: 'admin' },
];

/** 默认当前用户（创建者视角） */
export const DEFAULT_USER: CurrentUser = MOCK_USERS[0];

/** 其他创作者（用于演示「他人内容仅可查看」） */
export const OTHER_CREATORS: CurrentUser[] = [
  { id: 'user_lin', name: '林夕', role: 'creator' },
  { id: 'user_mu', name: '沐沐', role: 'creator' },
];
