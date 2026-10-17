import { Box, Typography, Card } from '@mui/material';
import { COLORS } from '@/styles/tokens';
import { useAppStore } from '@/store/useAppStore';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useIsMobile } from '@/hooks/useBreakpoint';
import { selectByCreator, selectMineStats } from '@/store/selectors';
import InspirationCard, { estimateCardHeight } from '@/components/inspiration/InspirationCard';
import MasonryGrid from '@/components/common/MasonryGrid';

/**
 * 05 我的灵感（节点 2:494）。
 * 统计卡 + 本人列表（编辑 / 删除，权限门控仅本人）。他人内容不会出现（按 creatorID 过滤）。
 */
export default function MinePage() {
  const inspirations = useAppStore((state) => state.inspirations);
  const { currentUser } = useCurrentUser();
  const isMobile = useIsMobile();

  const mine = selectByCreator(inspirations, currentUser.id);
  const stats = selectMineStats(inspirations, currentUser.id);

  const statItems = [
    { label: '总计', value: stats.total, color: COLORS.ink },
    { label: '已通过', value: stats.approved, color: COLORS.status.pass },
    { label: '待审核', value: stats.pending, color: COLORS.status['warn-deep'] },
    { label: '草稿', value: stats.draft, color: COLORS.sub2 },
    { label: '已驳回', value: stats.rejected, color: COLORS.status.reject },
  ];

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
        我的灵感
      </Typography>
      <Typography sx={{ fontSize: isMobile ? 12 : 13, color: COLORS.sub2, mb: 3 }}>
        {isMobile
          ? '点击卡片进入详情可编辑 / 删除'
          : `${currentUser.name} · 仅展示你创建的灵感，点击卡片进入详情可编辑 / 删除`}
      </Typography>

      {/* 统计卡：手机端 2 列换行（5 张挤一行会太窄） */}
      <Box
        className="grid gap-3"
        sx={{
          gridTemplateColumns: isMobile
            ? 'repeat(2, 1fr)'
            : 'repeat(5, 1fr)',
          mb: 4,
        }}
      >
        {statItems.map((s) => (
          <Card key={s.label} elevation={0} sx={{ p: 2, borderRadius: '14px', border: `1px solid ${COLORS.line}` }}>
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
            borderRadius: '14px',
          }}
        >
          你还没有创建灵感，去「上传灵感」沉淀第一条吧
        </Box>
      ) : (
        <MasonryGrid
          maxColumns={4}
          items={mine.map((insp) => ({
            key: insp.id,
            estimate: (w) => estimateCardHeight(insp.id, insp.title, w),
            node: <InspirationCard inspiration={insp} />,
          }))}
        />
      )}
    </Box>
  );
}
