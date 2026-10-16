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
import * as inspSvc from '@/data/services/inspirationService';
import * as auditSvc from '@/data/services/auditService';

/**
 * 全局状态（Zustand 单 store）。
 * 持有：灵感列表 + 审核队列 + 当前用户 + 详情上下文（顶栏全量复制用）。
 * 数据操作统一经 service 层（Promise），store 仅镜像状态，调用方不感知实现（R4）。
 */
interface AppState {
  inspirations: Inspiration[];
  auditQueue: AuditItem[];
  currentUser: CurrentUser;
  initialized: boolean;
  /** 详情页上下文灵感（供顶栏「一键复制」全量复制；非详情页为 null） */
  activeInspiration: Inspiration | null;

  init: () => Promise<void>;
  setCurrentUser: (user: CurrentUser) => void;
  setActiveInspiration: (insp: Inspiration | null) => void;

  addInspiration: (draft: InspirationDraft) => Promise<Inspiration>;
  editInspiration: (
    id: string,
    draft: InspirationDraft
  ) => Promise<Inspiration | null>;
  removeInspiration: (id: string) => Promise<void>;
  decide: (
    auditId: string,
    decision: Extract<InspirationStatus, 'approved' | 'rejected'>
  ) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  inspirations: [],
  auditQueue: [],
  currentUser: DEFAULT_USER,
  initialized: false,
  activeInspiration: null,

  init: async () => {
    const [inspirations, auditQueue] = await Promise.all([
      inspSvc.fetchInspirations(),
      auditSvc.fetchAuditQueue(),
    ]);
    set({ inspirations, auditQueue, initialized: true });
  },

  setCurrentUser: (user) => set({ currentUser: user }),

  setActiveInspiration: (insp) => set({ activeInspiration: insp }),

  addInspiration: async (draft) => {
    const creator = get().currentUser;
    const inspiration = await inspSvc.createInspiration(draft, {
      id: creator.id,
      name: creator.name,
    });
    const auditItem = await auditSvc.createAuditItem(inspiration);
    set((state) => ({
      inspirations: [...state.inspirations, inspiration],
      auditQueue: [...state.auditQueue, auditItem],
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

  decide: async (auditId, decision) => {
    const { inspirationID } = await auditSvc.decideAudit(auditId, decision);
    const now = new Date().toISOString();
    set((state) => ({
      auditQueue: state.auditQueue.map((a) =>
        a.id === auditId
          ? { ...a, status: decision, decidedAt: now }
          : a
      ),
      inspirations: state.inspirations.map((i) =>
        i.id === inspirationID
          ? {
              ...i,
              status: decision,
              auditStatusText:
                decision === 'approved' ? STATUS_TEXT.approved : undefined,
              updatedAt: now,
            }
          : i
      ),
    }));
  },
}));
