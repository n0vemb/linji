import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadMedia, downloadImage } from './download';

/**
 * 保存到手机测试：验证 downloadMedia / downloadImage 触发 <a download> 下载，
 * 以及 url 为空时短路返回 success=false。
 * jsdom 25 未实现 URL.createObjectURL，需手动定义 stub。
 */

describe('download 工具', () => {
  let clickSpy: ReturnType<typeof vi.spyOn>;
  let createObjectURLMock: ReturnType<typeof vi.fn>;
  let revokeObjectURLMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click');
    createObjectURLMock = vi.fn().mockReturnValue('blob:placeholder');
    revokeObjectURLMock = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      value: createObjectURLMock,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: revokeObjectURLMock,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('url 为 null → 返回 success=false，不触发下载', () => {
    const res = downloadMedia(null, 'x.mp4');
    expect(res.success).toBe(false);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('blob: 真实资源 → 直接触发 a[download] 点击且 download/href 正确', () => {
    const res = downloadMedia('blob:abc123', 'video.mp4');
    expect(res.success).toBe(true);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    const a = clickSpy.mock.instances[0] as HTMLAnchorElement;
    expect(a.getAttribute('download')).toBe('video.mp4');
    expect(a.getAttribute('href')).toContain('blob:abc123');
  });

  it('mock 占位资源 → 生成占位 blob 并触发下载', () => {
    const res = downloadMedia('mock:cover', 'cover.jpg');
    expect(res.success).toBe(true);
    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    const a = clickSpy.mock.instances[0] as HTMLAnchorElement;
    expect(a.getAttribute('download')).toBe('cover.jpg');
    expect(a.getAttribute('href')).toContain('blob:placeholder');
  });

  it('downloadImage 复用 downloadMedia（图片保存入口）', () => {
    downloadImage('blob:img', 'a.jpg');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    const a = clickSpy.mock.instances[0] as HTMLAnchorElement;
    expect(a.getAttribute('download')).toBe('a.jpg');
  });

  it('占位资源下载后安排 revokeObjectURL（setTimeout 回收）', () => {
    vi.useFakeTimers();
    downloadMedia('mock:x', 'y.mp4');
    expect(revokeObjectURLMock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:placeholder');
    vi.useRealTimers();
  });
});
