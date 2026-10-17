import { useMemo, useState } from 'react';
import { Box, Typography, TextField } from '@mui/material';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import { COLORS } from '@/styles/tokens';
import { useAppStore } from '@/store/useAppStore';
import { selectApproved } from '@/store/selectors';
import InspirationCard, { cardLikes, estimateCardHeight } from '@/components/inspiration/InspirationCard';
import MasonryGrid from '@/components/common/MasonryGrid';
import { useIsMobile, useHasHover } from '@/hooks/useBreakpoint';
import { TOUCH } from '@/styles/tokens';
import type { Inspiration } from '@/data/types';

type TabKey = 'recommend' | 'latest' | 'hot';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'recommend', label: '推荐' },
  { key: 'latest', label: '最新' },
  { key: 'hot', label: '最热' },
];

/**
 * 01 灵感广场（节点 2:1）。
 * 小红书 web 风格：密集瀑布流 + 顶部「推荐/最新/最热」分类 Tab + 搜索。
 * 仅展示已通过内容（status === 'approved'）。
 */
export default function PlazaPage() {
  const inspirations = useAppStore((state) => state.inspirations);
  const approved = selectApproved(inspirations);
  const isMobile = useIsMobile();
  const hasHover = useHasHover();

  const [tab, setTab] = useState<TabKey>('recommend');
  const [query, setQuery] = useState('');

  const list = useMemo<Inspiration[]>(() => {
    const q = query.trim().toLowerCase();
    let items = approved;
    if (q) {
      items = items.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.tags.some((t) => t.toLowerCase().includes(q)) ||
          i.creatorName.toLowerCase().includes(q),
      );
    }
    const sorted = [...items];
    if (tab === 'latest') {
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } else if (tab === 'hot') {
      sorted.sort((a, b) => cardLikes(b.id) - cardLikes(a.id));
    }
    return sorted;
  }, [approved, tab, query]);

  return (
    <Box>
      {/* 头部：标题 + 搜索（手机端竖向堆叠，搜索占满宽） */}
      <Box
        className={isMobile ? 'flex flex-col' : 'flex items-center justify-between'}
        sx={{ mb: 2.5, gap: isMobile ? 1.5 : 2, flexWrap: 'wrap' }}
      >
        <Box>
          <Typography
            sx={{
              fontSize: isMobile ? 24 : 30,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: COLORS.ink,
            }}
          >
            灵感广场
          </Typography>
          <Typography sx={{ fontSize: isMobile ? 12 : 14, color: COLORS.sub2, mt: 0.5 }}>
            {isMobile ? '点击卡片查看详情' : '精选已通过审核的灵感素材 · 点击卡片查看详情与体检报告'}
          </Typography>
        </Box>
        <TextField
          size="small"
          placeholder="搜索标题 / 话题 / 作者"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          sx={{
            width: isMobile ? '100%' : 280,
            bgcolor: COLORS.surface,
            borderRadius: '999px',
          }}
          InputProps={{
            startAdornment: <SearchOutlinedIcon style={{ fontSize: 18, color: COLORS.sub3, marginRight: 6 }} />,
          }}
        />
      </Box>

      {/* 分类 Tab（推荐 / 最新 / 最热）——手机端可横向滑动，不换行 */}
      <Box
        className="flex items-center gap-1"
        sx={{
          mb: 3,
          overflowX: 'auto',
          overflowY: 'hidden',
          WebkitOverflowScrolling: 'touch',
          // 允许滚动但隐藏滚动条，避免占用宝贵的手机纵向空间
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <Box
              key={t.key}
              onClick={() => setTab(t.key)}
              sx={{
                px: 2,
                py: 0.75,
                borderRadius: '999px',
                cursor: 'pointer',
                // 触摸目标不小于 44px
                minHeight: isMobile ? TOUCH.minTarget : undefined,
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
                fontSize: 14,
                fontWeight: active ? 700 : 500,
                color: active ? COLORS.ink : COLORS.sub2,
                backgroundColor: active ? COLORS.surface : 'transparent',
                border: active ? `1px solid ${COLORS.line}` : '1px solid transparent',
                transition: 'all .15s ease',
                ...(hasHover ? { '&:hover': { color: COLORS.ink } } : {}),
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
                '&:active': { opacity: 0.6 },
              }}
            >
              {t.label}
            </Box>
          );
        })}
        <Typography sx={{ fontSize: 12, color: COLORS.sub3, ml: 'auto', flexShrink: 0, pl: 2 }}>
          共 {list.length} 条
        </Typography>
      </Box>

      {/* 瀑布流（宽屏更密集） */}
      {list.length === 0 ? (
        <Box
          sx={{
            p: 6,
            textAlign: 'center',
            color: COLORS.sub3,
            border: `1px dashed ${COLORS.line}`,
            borderRadius: '8px',
          }}
        >
          {query ? '没有匹配的灵感，换个关键词试试' : '暂无已通过的灵感'}
        </Box>
      ) : (
        <MasonryGrid
          maxColumns={5}
          items={list.map((insp) => ({
            key: insp.id,
            estimate: (w) => estimateCardHeight(insp.id, insp.title, w),
            node: <InspirationCard inspiration={insp} />,
          }))}
        />
      )}
    </Box>
  );
}
