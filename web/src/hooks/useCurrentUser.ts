import { useAppStore } from '@/store/useAppStore';

/**
 * 读取当前用户 / 角色（mock 登录态，D3 Deferred）。
 * 返回 currentUser 及便捷布尔量。角色切换器修改 currentUser。
 */
export function useCurrentUser() {
  const currentUser = useAppStore((state) => state.currentUser);
  return {
    currentUser,
    isAdmin: currentUser.role === 'admin',
    isCreator: currentUser.role === 'creator',
  };
}
