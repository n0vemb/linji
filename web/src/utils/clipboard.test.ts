import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  copyText,
  copyTitle,
  copyCopy,
  copyTags,
  copyFullInspiration,
} from './clipboard';
import type { Inspiration } from '@/data/types';

/**
 * 复制工具测试：验证剪贴板写入（navigator.clipboard 优先 + execCommand 回退）
 * 与分字段 / 全量拼接逻辑。
 * jsdom 25 未实现 navigator.clipboard 与 document.execCommand，需手动注入 stub。
 */

interface FakeClipboard {
  writeText: ReturnType<typeof vi.fn>;
}

function setClipboard(stub: unknown): void {
  Object.defineProperty(navigator, 'clipboard', {
    value: stub,
    configurable: true,
    writable: true,
  });
}

describe('clipboard 工具', () => {
  let execCommandMock: ReturnType<typeof vi.fn>;
  let clipboardStub: FakeClipboard;

  beforeEach(() => {
    setClipboard(undefined); // 清空 → 走 execCommand 回退
    // jsdom 25 未实现 document.execCommand，需手动定义以便回退路径可测
    execCommandMock = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', {
      value: execCommandMock,
      configurable: true,
      writable: true,
    });
    clipboardStub = { writeText: vi.fn().mockResolvedValue(undefined) };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('回退路径：execCommand 复制成功 → success=true', async () => {
    execCommandMock.mockReturnValue(true);
    const res = await copyText('hello');
    expect(res.success).toBe(true);
    expect(execCommandMock).toHaveBeenCalledWith('copy');
  });

  it('回退路径：execCommand 失败 → success=false', async () => {
    execCommandMock.mockReturnValue(false);
    const res = await copyText('hello');
    expect(res.success).toBe(false);
  });

  it('优先使用 navigator.clipboard.writeText', async () => {
    setClipboard(clipboardStub);
    const res = await copyText('world');
    expect(clipboardStub.writeText).toHaveBeenCalledWith('world');
    expect(res.success).toBe(true);
    expect(execCommandMock).not.toHaveBeenCalled();
  });

  it('copyTags 用空格拼接 #话题', async () => {
    setClipboard(clipboardStub);
    const res = await copyTags(['#穿搭', '#夏日']);
    expect(res.success).toBe(true);
    expect(clipboardStub.writeText).toHaveBeenCalledWith('#穿搭 #夏日');
  });

  it('copyTitle / copyCopy 透传文案', async () => {
    setClipboard(clipboardStub);
    await copyTitle('我的标题');
    await copyCopy('我的文案');
    expect(clipboardStub.writeText).toHaveBeenNthCalledWith(1, '我的标题');
    expect(clipboardStub.writeText).toHaveBeenNthCalledWith(2, '我的文案');
  });

  it('copyFullInspiration 拼接 标题 + 文案 + 话题（双换行分隔）', async () => {
    setClipboard(clipboardStub);
    const insp = {
      title: 'T',
      copy: 'C',
      tags: ['#a', '#b'],
    } as unknown as Inspiration;
    await copyFullInspiration(insp);
    expect(clipboardStub.writeText).toHaveBeenCalledWith('T\n\nC\n\n#a #b');
  });
});
