import type { Inspiration } from '@/data/types';

/** 复制结果 */
export interface CopyResult {
  success: boolean;
}

/** 写入剪贴板（优先 navigator.clipboard，失败回退 execCommand） */
async function writeText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 回退到 textarea + execCommand
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** 复制任意文本 */
export async function copyText(text: string): Promise<CopyResult> {
  const success = await writeText(text);
  return { success };
}

/** 复制标题 */
export async function copyTitle(title: string): Promise<CopyResult> {
  return copyText(title);
}

/** 复制文案正文 */
export async function copyCopy(copy: string): Promise<CopyResult> {
  return copyText(copy);
}

/** 复制 #话题标签组 */
export async function copyTags(tags: string[]): Promise<CopyResult> {
  return copyText(tags.join(' '));
}

/** 全量复制：标题 + 文案 + 话题（顶栏一键复制） */
export async function copyFullInspiration(
  insp: Inspiration
): Promise<CopyResult> {
  const parts = [insp.title, insp.copy, insp.tags.join(' ')].filter(Boolean);
  return copyText(parts.join('\n\n'));
}
