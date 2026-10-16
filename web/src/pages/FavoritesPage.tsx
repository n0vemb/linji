import { Box, Typography, Card } from '@mui/material';
import { COLORS } from '@/styles/tokens';
import { useAppStore } from '@/store/useAppStore';
import { selectFavorites } from '@/store/selectors';
import InspirationCard from '@/components/inspiration/InspirationCard';

/**
 * 我的收藏（占位 / 基础展示，PRD §8）。
 * 导航保留入口；初版基于 isFavorite 字段展示只读列表，不建完整收藏功能。
 */
export default function FavoritesPage() {
  const inspirations = useAppStore((state) => state.inspirations);
  const favorites = selectFavorites(inspirations);

  return (
    <Box>
      <Typography sx={{ fontSize: 22, fontWeight: 700, color: COLORS.ink, mb: 0.5 }}>
        我的收藏
      </Typography>
      <Typography sx={{ fontSize: 13, color: COLORS.sub2, mb: 3 }}>
        收藏功能即将上线（初版占位）。以下为标记为收藏的灵感预览
      </Typography>

      {favorites.length === 0 ? (
        <Card
          sx={{
            p: 6,
            textAlign: 'center',
            color: COLORS.sub3,
            border: `1px dashed ${COLORS.line}`,
          }}
        >
          暂无收藏内容
        </Card>
      ) : (
        <Box className="gap-4" sx={{ columnGap: 16, columns: { xs: 1, sm: 2, lg: 3 } }}>
          {favorites.map((insp) => (
            <Box key={insp.id} sx={{ mb: 2, breakInside: 'avoid' }}>
              <InspirationCard inspiration={insp} variant="plaza" />
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
