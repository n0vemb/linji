import { create } from 'zustand';
import type {
  Inspiration,
  AuditItem,
  CurrentUser,
  InspirationDraft,
  InspirationStatus,
} from '@/data/types';
import { DEFAULT_USER } from '@/data/mock/users';
import { STATUS_TEXT } from '@/styles/tokens';
import { apiMode } from '@/data/services/apiMode';
import * as authSvc from '@/data/services/authService';
import * as inspSvc from '@/data/services/inspirationService';
import * as auditSvc from '@/data/services/auditService';
import * as favSvc from '@/data/services/favoriteService';

/**
 * 全局状态（Zustand 单 store）。
 * 持有：灵感列表 + 审核队列 + 当前用户 + 详情上下文（顶栏全量复制用）。
 * 数据操作统一经 service 层（Promise），store 仅镜像状态，调用方不感知实现。
 *
 * 双模式：
 * - live：登录态来自后端 JWT；数据按角色加载（创作者 = 我的 + 广场；管理员 = 全部）
 * - mock：默认演示用户，数据全量内存
 */
interface AppState {
  inspirations: Inspiration[];
  auditQueue: AuditItem[];
  currentUser: CurrentUser;
  /** live 模式登录态（mock 模式恒为 DEFAULT_USER） */
  authUser: CurrentUser | null;
  /** 登录态是否已恢复（避免刷新页面时闪登录页） */
  authReady: boolean;
  initialized: boolean;
  /** 详情页上下文灵感（供顶栏「一键复制」全量复制；非详情页为 null） */
  activeInspiration: Inspiration | null;

  init: () => Promise<void>;
  setCurrentUser: (user: CurrentUser) => void;
  setActiveInspiration: (insp: Inspiration | null) => void;

  /** 认证（live 模式） */
  login: (username: string, password: string) => Promise<CurrentUser>;
  register: (
    username: string,
    password: string,
    displayName?: string
  ) => Promise<CurrentUser>;
  logout: () => void;

  /** 按当前角色重新拉取数据 */
  refresh: () => Promise<void>;

  addInspiration: (
    draft: InspirationDraft,
    options?: { asDraft?: boolean }
  ) => Promise<Inspiration>;
  editInspiration: (
    id: string,
    draft: InspirationDraft
  ) => Promise<Inspiration | null>;
  removeInspiration: (id: string) => Promise<void>;
  /** 草稿提交审核 */
  submitDraft: (id: string) => Promise<Inspiration | null>;
  decide: (
    auditId: string,
    decision: Extract<InspirationStatus, 'approved' | 'rejected'>,
    reason?: string
  ) => Promise<void>;
  /** 收藏 / 取消收藏 */
  toggleFavorite: (id: string) => Promise<boolean>;
}

const isLive = (): boolean => apiMode() === 'live';

export const useAppStore = create<AppState>((set, get) => ({
  inspirations: [],
  auditQueue: [],
  currentUser: DEFAULT_USER,
  authUser: null,
  authReady: false,
  initialized: false,
  activeInspiration: null,

  init: async () => {
    if (isLive()) {
      // 1. 恢复登录态（token 可能已失效）
      const user = await authSvc.restore();
      set({ authUser: user, authReady: true, currentUser: user ?? DEFAULT_USER });
      // 2. 已登录才加载数据；未登录由 AuthGate 展示登录页
      if (user) {
        await get().refresh();
      }
      set({ initialized: true });
      return;
    }
    // mock 模式：原逻辑
    const [inspirations, auditQueue] = await Promise.all([
      inspSvc.fetchInspirations(),
      auditSvc.fetchAuditQueue(),
    ]);
    set({
      inspirations: favSvc.applyMockFavorites(inspirations),
      auditQueue,
      authUser: DEFAULT_USER,
      authReady: true,
      initialized: true,
    });
  },

  setCurrentUser: (user) => set({ currentUser: user, authUser: user }),

  setActiveInspiration: (insp) => set({ activeInspiration: insp }),

  login: async (username, password) => {
    const user = await authSvc.login(username, password);
    set({ authUser: user, currentUser: user });
    await get().refresh();
    return user;
  },

  register: async (username, password, displayName) => {
    const user = await authSvc.register(username, password, displayName);
    set({ authUser: user, currentUser: user });
    await get().refresh();
    return user;
  },

  logout: () => {
    authSvc.logout();
    set({
      authUser: null,
      currentUser: DEFAULT_USER,
      inspirations: [],
      auditQueue: [],
      activeInspiration: null,
      initialized: false,
    });
  },

  refresh: async () => {
    const user = get().authUser;
    if (isLive()) {
      if (!user) return;
      const queue =
        user.role === 'admin'
          ? await auditSvc.fetchAuditQueue().catch(() => [] as AuditItem[])
          : [];
      const inspirations =
        user.role === 'admin'
          ? await inspSvc.fetchInspirations('all')
          : [
              ...(await inspSvc.fetchInspirations('mine')),
              ...(await inspSvc.fetchInspirations('plaza')),
            ].filter(
              (i, idx, arr) => arr.findIndex((x) => x.id === i.id) === idx
            );
      set({ inspirations, auditQueue: queue, initialized: true });
      return;
    }
    const [inspirations, auditQueue] = await Promise.all([
      inspSvc.fetchInspirations(),
      auditSvc.fetchAuditQueue(),
    ]);
    set({
      inspirations: favSvc.applyMockFavorites(inspirations),
      auditQueue,
      initialized: true,
    });
  },

  addInspiration: async (draft, options) => {
    const asDraft = options?.asDraft ?? false;
    const creator = get().currentUser;
    const inspiration = await inspSvc.createInspiration(
      draft,
      { id: creator.id, name: creator.name },
      asDraft
    );
    // 草稿不进入审核队列（只有真正提交的才需要审核）
    const auditItem = asDraft
      ? null
      : await auditSvc.createAuditItem(inspiration);
    set((state) => ({
      inspirations: [...state.inspirations, inspiration],
      auditQueue: auditItem
        ? [...state.auditQueue, auditItem]
        : state.auditQueue,
    }));
    return inspiration;
  },

  editInspiration: async (id, draft) => {
    const updated = await inspSvc.updateInspiration(id, draft);
    if (!updated) return null;
    set((state) => ({
      inspirations: state.inspirations.map((i) =>
        i.id === id ? updated : i
      ),
      activeInspiration:
        state.activeInspiration?.id === id ? updated : state.activeInspiration,
    }));
    return updated;
  },

  removeInspiration: async (id) => {
    await inspSvc.deleteInspiration(id);
    set((state) => ({
      inspirations: state.inspirations.filter((i) => i.id !== id),
      auditQueue: state.auditQueue.filter((a) => a.inspirationID !== id),
      activeInspiration:
        state.activeInspiration?.id === id ? null : state.activeInspiration,
    }));
  },

  submitDraft: async (id) => {
    const updated = await inspSvc.submitDraft(id);
    const auditItem = await auditSvc.createAuditItem(updated);
    set((state) => ({
      inspirations: state.inspirations.map((i) => (i.id === id ? updated : i)),
      auditQueue: [...state.auditQueue, auditItem],
    }));
    return updated;
  },

  decide: async (auditId, decision, reason) => {
    const { audit, inspirationID } = await auditSvc.decideAudit(
      auditId,
      decision,
      reason
    );
    const inspiration = (audit as { inspiration?: Inspiration }).inspiration;
    set((state) => ({
      auditQueue: state.auditQueue.map((a) =>
        a.id === auditId ? audit : a
      ),
      inspirations: state.inspirations.map((i) =>
        i.id === inspirationID
          ? inspiration
            ? { ...i, ...inspiration }
            : {
                ...i,
                status: decision,
                rejectReason: decision === 'rejected' ? reason : undefined,
                auditStatusText:
                  decision === 'approved' ? STATUS_TEXT.approved : undefined,
                updatedAt: new Date().toISOString(),
              }
          : i
      ),
    }));
  },

  toggleFavorite: async (id) => {
    const isFavorite = await favSvc.toggleFavorite(id);
    set((state) => ({
      inspirations: state.inspirations.map((i) =>
        i.id === id ? { ...i, isFavorite } : i
      ),
      activeInspiration:
        state.activeInspiration?.id === id
          ? { ...state.activeInspiration, isFavorite }
          : state.activeInspiration,
    }));
    return isFavorite;
  },
}));
