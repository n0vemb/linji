import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePermission } from './usePermission';
import { useAppStore } from '@/store/useAppStore';
import { DEFAULT_USER } from '@/data/mock/users';

/**
 * 权限门控测试：直接渲染 usePermission(creatorID) 钩子，
 * 通过切换 store.currentUser 验证 本人 / 非本人 / 管理员 的返回。
 * 覆盖 PRD §7.1 / 架构 §7.3：管理员对他人内容不得误开放编辑 / 删除入口。
 */

function setCurrentUser(id: string, role: 'creator' | 'admin'): void {
  useAppStore.setState({
    currentUser: { id, name: id, role },
  });
}

beforeEach(() => {
  useAppStore.setState({ currentUser: DEFAULT_USER });
});

describe('usePermission 权限门控', () => {
  it('本人（currentUser.id === creatorID）→ 可查看 / 可编辑 / 可删除', () => {
    setCurrentUser('user_xu', 'creator');
    const { result } = renderHook(() => usePermission('user_xu'));
    expect(result.current.canView).toBe(true);
    expect(result.current.canEdit).toBe(true);
    expect(result.current.canDelete).toBe(true);
  });

  it('非本人（其他创作者内容）→ 仅可查看，编辑 / 删除全部 false', () => {
    setCurrentUser('user_lin', 'creator');
    const { result } = renderHook(() => usePermission('user_xu'));
    expect(result.current.canView).toBe(true);
    expect(result.current.canEdit).toBe(false);
    expect(result.current.canDelete).toBe(false);
  });

  it('管理员对他人内容 → 不误开放编辑 / 删除入口（全部 false）', () => {
    setCurrentUser('user_gao', 'admin');
    const { result } = renderHook(() => usePermission('user_xu'));
    expect(result.current.canView).toBe(true);
    expect(result.current.canEdit).toBe(false);
    expect(result.current.canDelete).toBe(false);
  });

  it('creatorID 变化（rerender）→ 权限随之重算（记忆依赖正确）', () => {
    setCurrentUser('user_xu', 'creator');
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => usePermission(id),
      { initialProps: { id: 'user_xu' } }
    );
    expect(result.current.canEdit).toBe(true);
    rerender({ id: 'user_lin' });
    expect(result.current.canEdit).toBe(false);
    expect(result.current.canDelete).toBe(false);
  });
});
