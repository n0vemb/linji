import { useEffect, useState } from 'react';
import { useTheme } from '@mui/material/styles';

/**
 * 响应式断点 hook —— 移动优先的基础设施。
 * 手机端（< 768px）是主场景：绝大多数创作者用手机浏览 / 上传。
 *
 * 用法：
 *   const isMobile = useIsMobile();
 *   {isMobile ? <MobileLayout/> : <DesktopLayout/>}
 *
 * 注意：SSR / 首帧可能拿到 false，依赖宽度敏感的布局建议用
 * CSS media query 做「能缩就缩」，本 hook 只用于「结构完全不同」的场景
 * （侧栏变抽屉、标签栏出现、提交区变底部条）。
 */

export const BREAKPOINTS = {
  /** 手机竖屏（iPhone SE ~ 16 Pro Max） */
  mobile: 0,
  /** 大屏手机横屏 / 小平板竖屏 */
  tablet: 768,
  /** 平板横屏 / 小笔记本 */
  laptop: 1024,
  desktop: 1280,
} as const;

export function useBreakpoint(): 'mobile' | 'tablet' | 'laptop' | 'desktop' {
  const [bp, setBp] = useState<'mobile' | 'tablet' | 'laptop' | 'desktop'>(
    'desktop'
  );

  useEffect(() => {
    const measure = () => {
      const w = window.innerWidth;
      if (w < BREAKPOINTS.tablet) setBp('mobile');
      else if (w < BREAKPOINTS.laptop) setBp('tablet');
      else if (w < BREAKPOINTS.desktop) setBp('laptop');
      else setBp('desktop');
    };
    measure();
    window.addEventListener('resize', measure);
    // 手机横竖屏切换时也要重算
    window.addEventListener('orientationchange', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, []);

  return bp;
}

/** 是否手机端（< 768px） */
export function useIsMobile(): boolean {
  return useBreakpoint() === 'mobile';
}

/** 是否窄屏（手机 + 平板，< 1024px） */
export function useIsCompact(): boolean {
  const bp = useBreakpoint();
  return bp === 'mobile' || bp === 'tablet';
}

/**
 * 触摸设备粗略判断。
 * 用于决定是否给卡片加 hover 缩放等**仅鼠标可用**的动效。
 */
export function useHasHover(): boolean {
  const [has, setHas] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const measure = () => setHas(mq.matches);
    measure();
    mq.addEventListener('change', measure);
    return () => mq.removeEventListener('change', measure);
  }, []);
  return has;
}

/** 内容区左右安全边距：手机更窄，避免贴边 */
export function useContentPadding(): number {
  return useIsMobile() ? 12 : 28;
}

/**
 * 是否手机端（需在 MUI ThemeProvider 内使用；MUI 的 `down()` 返回媒体查询字符串）。
 */
export function useThemeMobile(): boolean {
  const theme = useTheme();
  const query = theme.breakpoints.down('md');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(query);
    const measure = () => setIsMobile(mq.matches);
    measure();
    mq.addEventListener('change', measure);
    return () => mq.removeEventListener('change', measure);
  }, [query]);

  return isMobile;
}
