import { useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';

export interface Permission {
  canView: boolean; // 任何人可查看
  canEdit: boolean; // 仅创建者可编辑本人内容（管理员仅在审核台面板处置）
  canDelete: boolean; // 删除仅限本人
}

/**
 * 权限门控唯一入口（架构 §7.3 / 开发文档 §5）。
 * 基于 currentUser（来自 store）与灵感 creatorID 返回 {canView, canEdit, canDelete}。
 *
 * 铁律：任何页面渲染「编辑 / 删除」按钮前，必须调用本 hook 校验
 * `currentUser.id === creatorID`，否则隐藏入口（修复 §7.1 全局渲染坑）。
 */
export function usePermission(creatorID: string): Permission {
  const currentUser = useAppStore((state) => state.currentUser);

  return useMemo<Permission>(() => {
    const isSelf = currentUser.id === creatorID;
    return {
      canView: true,
      canEdit: isSelf,
      canDelete: isSelf,
    };
  }, [currentUser.id, creatorID]);
}
