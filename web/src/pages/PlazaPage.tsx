import { Box, Typography } from '@mui/material';
import { COLORS } from '@/styles/tokens';
import { useAppStore } from '@/store/useAppStore';
import { selectApproved } from '@/store/selectors';
import InspirationCard from '@/components/inspiration/InspirationCard';

/**
 * 01 灵感广场（节点 2:1）。
 * 仅展示已通过内容（status === 'approved'），卡片瀑布流。
 */
export default function PlazaPage() {
  const inspirations = useAppStore((state) => state.inspirations);
  const approved = selectApproved(inspirations);

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: 22, fontWeight: 700, color: COLORS.ink }}>
          灵感广场
        </Typography>
        <Typography sx={{ fontSize: 13, color: COLORS.sub2, mt: 0.5 }}>
          已通过审核的灵感素材，点击卡片查看详情与体检报告
        </Typography>
      </Box>

      {approved.length === 0 ? (
        <Box
          sx={{
            p: 6,
            textAlign: 'center',
            color: COLORS.sub3,
            border: `1px dashed ${COLORS.line}`,
            borderRadius: 2,
          }}
        >
          暂无已通过的灵感
        </Box>
      ) : (
        <Box
          className="gap-4"
          sx={{
            columnGap: 16,
            columns: { xs: 1, sm: 2, lg: 3, xl: 4 },
          }}
        >
          {approved.map((insp) => (
            <Box
              key={insp.id}
              sx={{ mb: 2, breakInside: 'avoid' }}
            >
              <InspirationCard inspiration={insp} variant="plaza" />
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
