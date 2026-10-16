import { useCallback } from 'react';
import { useToastStore } from '@/components/common/Toast';
import { copyText } from '@/utils/clipboard';

/**
 * 复制 hook：封装剪贴板写入 + toast 反馈。
 * 返回 copy(text, message)，成功/失败均给出提示。
 */
export function useClipboard() {
  const showToast = useToastStore((state) => state.show);

  const copy = useCallback(
    async (text: string, message: string): Promise<boolean> => {
      const result = await copyText(text);
      showToast(result.success ? message : '复制失败，请重试');
      return result.success;
    },
    [showToast]
  );

  return { copy };
}
