import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { act } from 'react';
import { useIsMobile, useIsCompact, useHasHover, useBreakpoint, useContentPadding, BREAKPOINTS } from './useBreakpoint';

/**
 * 移动端断点 hook 测试。
 * 核心保证：手机端（< 768px）必须被正确识别 —— 这是全站移动适配的地基，
 * 识别错了会导致侧栏不隐藏、底部栏不出现等一整类问题。
 */

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
}

/** 用一个探针组件把 hook 返回值暴露出来 */
function probe<T>(hook: () => T) {
  let captured!: T;
  function Probe() {
    captured = hook();
    return null;
  }
  render(<Probe />);
  return () => captured;
}

afterEach(() => {
  cleanup();
  setViewport(1024);
  if (typeof window.matchMedia === 'function') {
    // 还原 matchMedia 为 hover: hover（桌面默认）
    (window.matchMedia as unknown as (q: string) => MediaQueryList) = ((q: string) => ({
      matches: /hover: hover/.test(q),
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }
});

describe('useBreakpoint 断点划分', () => {
  it('320 / 390 / 430 等常见手机宽度 → mobile', () => {
    [320, 360, 375, 390, 412, 430].forEach((w) => {
      setViewport(w);
      const get = probe(useBreakpoint);
      expect(get(), `${w}px 应为 mobile`).toBe('mobile');
    });
  });

  it('768~1023 → tablet', () => {
    [768, 820, 1023].forEach((w) => {
      setViewport(w);
      const get = probe(useBreakpoint);
      expect(get(), `${w}px 应为 tablet`).toBe('tablet');
    });
  });

  it('1024~1279 → laptop，≥1280 → desktop', () => {
    setViewport(1280);
    expect(probe(useBreakpoint)()).toBe('desktop');
    setViewport(1100);
    expect(probe(useBreakpoint)()).toBe('laptop');
  });

  it('BREAKPOINTS 常量与文档一致：tablet=768', () => {
    expect(BREAKPOINTS.tablet).toBe(768);
    expect(BREAKPOINTS.laptop).toBe(1024);
    expect(BREAKPOINTS.desktop).toBe(1280);
  });
});

describe('useIsMobile（最关键：决定布局分叉）', () => {
  it('390px 手机 → true（侧栏进抽屉、底部栏出现）', () => {
    setViewport(390);
    expect(probe(useIsMobile)()).toBe(true);
  });

  it('1440px 桌面 → false（保留固定侧栏）', () => {
    setViewport(1440);
    expect(probe(useIsMobile)()).toBe(false);
  });

  it('768px 边界值 → false（tablet 不算 mobile）', () => {
    setViewport(768);
    expect(probe(useIsMobile)()).toBe(false);
  });
});

describe('useIsCompact', () => {
  it('手机与平板均为 true，笔记本及以上为 false', () => {
    setViewport(390);
    expect(probe(useIsCompact)()).toBe(true);
    setViewport(820);
    expect(probe(useIsCompact)()).toBe(true);
    setViewport(1440);
    expect(probe(useIsCompact)()).toBe(false);
  });
});

describe('useContentPadding', () => {
  it('手机 12px，桌面 28px（手机更紧凑，减少滚动）', () => {
    setViewport(390);
    expect(probe(useContentPadding)()).toBe(12);
    setViewport(1440);
    expect(probe(useContentPadding)()).toBe(28);
  });
});

describe('useHasHover（触摸设备不挂 hover 效果）', () => {
  it('无 hover 能力的设备（手机） → false，卡片改用 :active 反馈', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (q: string) => ({
        matches: false, // 模拟触摸设备
        media: q,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        onchange: null,
        dispatchEvent: () => false,
      }),
    });
    expect(probe(useHasHover)()).toBe(false);
  });

  it('支持 hover 的设备（桌面鼠标） → true', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (q: string) => ({
        matches: true,
        media: q,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        onchange: null,
        dispatchEvent: () => false,
      }),
    });
    expect(probe(useHasHover)()).toBe(true);
  });
});

describe('resize 响应', () => {
  it('运行时从桌面缩到手机，应切换为 mobile', () => {
    setViewport(1440);
    const get = probe(useBreakpoint);
    expect(get()).toBe('desktop');

    act(() => {
      setViewport(390);
      window.dispatchEvent(new Event('resize'));
    });
    expect(get()).toBe('mobile');
  });

  it('orientationchange（横竖屏切换）同样触发重算', () => {
    setViewport(844);
    const get = probe(useBreakpoint);
    expect(get()).toBe('tablet');

    act(() => {
      setViewport(390);
      window.dispatchEvent(new Event('orientationchange'));
    });
    expect(get()).toBe('mobile');
  });
});