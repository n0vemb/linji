import { useEffect, useMemo, useRef, useState } from 'react';
import { Box } from '@mui/material';
import type { ReactNode } from 'react';
import { SPACING } from '@/styles/tokens';
import { useIsMobile } from '@/hooks/useBreakpoint';

export interface MasonryItem {
  key: string;
  /** 给定列宽，估算该项渲染后的总高度（px）——用于投放到最短列 */
  estimate: (columnWidth: number) => number;
  node: ReactNode;
}

interface MasonryGridProps {
  items: MasonryItem[];
  /** 列间距（px） */
  columnGap?: number;
  /** 行间距（px） */
  rowGap?: number;
  /** 最大列数 */
  maxColumns?: number;
  /** 单列最小宽度（px），低于则减少列数 */
  minColumnWidth?: number;
}

/**
 * 瀑布流网格（小红书 web 风格）。
 *
 * 不使用 CSS `columns`：多列布局在卡片高度差异大、且 `break-inside: avoid` 时
 * 无法正确平衡，会出现某列独长、底部严重参差。这里改为「按估算高度投放到当前最短列」，
 * 得到接近等高的列底边，同时保留各列独立堆叠的自然错落。
 */
export default function MasonryGrid({
  items,
  columnGap = 16,
  rowGap = 24,
  maxColumns = 5,
  minColumnWidth = 200,
}: MasonryGridProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const isMobile = useIsMobile();

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => setWidth(el.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /**
   * 手机端固定 2 列：单列太宽（封面 366px 在手机上过大，一屏只看得到 2 个，
   * 信息密度极低，不符合小红书 App 的双列排布）；3 列又太挤看不清图。
   *
   * minColumnWidth 必须下调，否则 390px 屏按 200px 下限只能算出 1 列
   * —— 手机上封面可用宽 366px，够放下两列 178px。
   */
  const effMaxColumns = isMobile ? 2 : maxColumns;
  const effColumnGap = isMobile ? SPACING.cardGapMobile : columnGap;
  const effRowGap = isMobile ? SPACING.cardGapMobile + 4 : rowGap;
  const effMinColumnWidth = isMobile ? 150 : minColumnWidth;

  const columnCount = useMemo(() => {
    if (width <= 0) return 1;
    const fit = Math.floor(
      (width + effColumnGap) / (effMinColumnWidth + effColumnGap)
    );
    return Math.max(1, Math.min(effMaxColumns, fit));
  }, [width, effColumnGap, effMinColumnWidth, effMaxColumns]);

  const columnWidth =
    width > 0
      ? (width - effColumnGap * (columnCount - 1)) / columnCount
      : 0;

  const columns = useMemo(() => {
    const buckets: MasonryItem[][] = Array.from({ length: columnCount }, () => []);
    const heights = new Array<number>(columnCount).fill(0);
    if (columnWidth <= 0) return buckets;

    items.forEach((item) => {
      let target = 0;
      for (let i = 1; i < columnCount; i += 1) {
        if (heights[i] < heights[target] - 0.5) target = i;
      }
      buckets[target].push(item);
      heights[target] += item.estimate(columnWidth) + effRowGap;
    });
    return buckets;
  }, [items, columnCount, columnWidth, effRowGap]);

  return (
    <Box
      ref={ref}
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: `${effColumnGap}px`,
      }}
    >
      {width > 0 &&
        columns.map((column, index) => (
          <Box
            // 列无稳定业务 id，按位置索引即可
            key={`col-${index}`}
            sx={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: `${effRowGap}px`,
            }}
          >
            {column.map((item) => (
              <Box key={item.key}>{item.node}</Box>
            ))}
          </Box>
        ))}
    </Box>
  );
}
