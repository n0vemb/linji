import { useEffect, useState } from 'react';
import { Box, Typography, Card } from '@mui/material';
import { COLORS } from '@/styles/tokens';
import { useAppStore } from '@/store/useAppStore';
import { selectFavorites } from '@/store/selectors';
import { useIsMobile } from '@/hooks/useBreakpoint';
import { apiMode } from '@/data/services/apiMode';
import { fetchFavorites } from '@/data/services/favoriteService';
import type { Inspiration } from '@/data/types';
import InspirationCard, { estimateCardHeight } from '@/components/inspiration/InspirationCard';
import MasonryGrid from '@/components/common/MasonryGrid';

/**
 * 我的收藏。
 * live 模式：从后端 favorites 表按当前用户拉取（刷新不丢）；
 * mock 模式：基于内存 isFavorite 字段过滤。
 */
export default function FavoritesPage() {
  const inspirations = useAppStore((state) => state.inspirations);
  const isMobile = useIsMobile();
  const live = apiMode() === 'live';

  const [serverFavorites, setServerFavorites] = useState<Inspiration[] | null>(null);

  useEffect(() => {
    if (!live) return;
    let alive = true;
    void fetchFavorites().then((list) => {
      if (alive) setServerFavorites(list);
    });
    return () => {
      alive = false;
    };
  }, [live, inspirations]);

  // live：服务端列表（加载中显示空态）；mock：本地过滤
  const favorites = live ? (serverFavorites ?? []) : selectFavorites(inspirations);

  return (
    <Box>
      <Typography
        sx={{
          fontSize: isMobile ? 24 : 28,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          color: COLORS.ink,
          mb: 0.5,
        }}
      >
        我的收藏
      </Typography>
      <Typography sx={{ fontSize: isMobile ? 12 : 13, color: COLORS.sub2, mb: 3 }}>
        在广场或详情页点击心形即可收藏，收藏内容随账号同步
      </Typography>

      {favorites.length === 0 ? (
        <Card
          elevation={0}
          sx={{
            p: 6,
            textAlign: 'center',
            color: COLORS.sub3,
            border: `1px dashed ${COLORS.line}`,
            borderRadius: '14px',
          }}
        >
          暂无收藏内容
        </Card>
      ) : (
        <MasonryGrid
          maxColumns={4}
          items={favorites.map((insp) => ({
            key: insp.id,
            estimate: (w) => estimateCardHeight(insp.id, insp.title, w),
            node: <InspirationCard inspiration={insp} />,
          }))}
        />
      )}
    </Box>
  );
}
