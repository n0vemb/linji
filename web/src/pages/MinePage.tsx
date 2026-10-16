import { Box, Typography, Card } from '@mui/material';
import { COLORS } from '@/styles/tokens';
import { useAppStore } from '@/store/useAppStore';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { selectByCreator, selectMineStats } from '@/store/selectors';
import InspirationCard from '@/components/inspiration/InspirationCard';

/**
 * 05 我的灵感（节点 2:494）。
 * 统计卡 + 本人列表（编辑 / 删除，权限门控仅本人）。他人内容不会出现（按 creatorID 过滤）。
 */
export default function MinePage() {
  const inspirations = useAppStore((state) => state.inspirations);
  const { currentUser } = useCurrentUser();

  const mine = selectByCreator(inspirations, currentUser.id);
  const stats = selectMineStats(inspirations, currentUser.id);

  const statItems = [
    { label: '总计', value: stats.total, color: COLORS.ink },
    { label: '已通过', value: stats.approved, color: COLORS.status.pass },
    { label: '待审核', value: stats.pending, color: COLORS.status['warn-deep'] },
    { label: '已驳回', value: stats.rejected, color: COLORS.status.reject },
  ];

  return (
    <Box>
      <Typography sx={{ fontSize: 22, fontWeight: 700, color: COLORS.ink, mb: 0.5 }}>
        我的灵感
      </Typography>
      <Typography sx={{ fontSize: 13, color: COLORS.sub2, mb: 3 }}>
        {currentUser.name} · 仅展示你创建的灵感，可编辑 / 删除
      </Typography>

      {/* 统计卡 */}
      <Box className="grid gap-3" sx={{ gridTemplateColumns: { xs: '2fr 2fr', md: '1fr 1fr 1fr 1fr' }, mb: 4 }}>
        {statItems.map((s) => (
          <Card key={s.label} sx={{ p: 2 }}>
            <Typography sx={{ fontSize: 12, color: COLORS.sub2 }}>{s.label}</Typography>
            <Typography sx={{ fontSize: 26, fontWeight: 800, color: s.color, lineHeight: 1.2 }}>
              {s.value}
            </Typography>
          </Card>
        ))}
      </Box>

      {mine.length === 0 ? (
        <Box
          sx={{
            p: 6,
            textAlign: 'center',
            color: COLORS.sub3,
            border: `1px dashed ${COLORS.line}`,
            borderRadius: 2,
          }}
        >
          你还没有创建灵感，去「上传灵感」沉淀第一条吧
        </Box>
      ) : (
        <Box className="gap-4" sx={{ columnGap: 16, columns: { xs: 1, sm: 2, lg: 3 } }}>
          {mine.map((insp) => (
            <Box key={insp.id} sx={{ mb: 2, breakInside: 'avoid' }}>
              <InspirationCard inspiration={insp} variant="mine" />
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
