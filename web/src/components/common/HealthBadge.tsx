import { Box } from '@mui/material';
import { COLORS, healthColor } from '@/styles/tokens';

interface HealthBadgeProps {
  score: number;
  size?: 'sm' | 'md';
}

/**
 * 经验健康分徽标（节点 82:53）。
 * 色阶随分数：>=80 绿 / 60-79 琥珀 / <60 红。白底半透明，落在封面左上角。
 */
export default function HealthBadge({ score, size = 'md' }: HealthBadgeProps) {
  const color = healthColor(score);
  const big = size === 'md';
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 0.25,
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderRadius: '999px',
        px: big ? 1 : 0.75,
        py: 0.25,
        border: `1px solid ${color}`,
      }}
    >
      <Box
        component="span"
        sx={{ color, fontWeight: 700, fontSize: big ? 14 : 12, lineHeight: 1 }}
      >
        {score}
      </Box>
      <Box
        component="span"
        sx={{ color: COLORS.sub2, fontSize: big ? 10 : 9, lineHeight: 1 }}
      >
        分
      </Box>
    </Box>
  );
}
