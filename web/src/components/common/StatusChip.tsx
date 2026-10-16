import { Box } from '@mui/material';
import { COLORS, STATUS_TEXT } from '@/styles/tokens';
import type { InspirationStatus } from '@/data/types';

interface StatusChipProps {
  status: InspirationStatus;
}

/** 状态标签：待审 / 已通过 / 已驳回（绿 / 红 / 琥珀，架构 §7.4） */
export default function StatusChip({ status }: StatusChipProps) {
  const map: Record<
    InspirationStatus,
    { text: string; color: string; bg: string }
  > = {
    approved: {
      text: STATUS_TEXT.approved,
      color: COLORS.status.pass,
      bg: 'rgba(5,150,105,0.10)',
    },
    pending: {
      text: STATUS_TEXT.pending,
      color: COLORS.status['warn-deep'],
      bg: 'rgba(245,158,11,0.14)',
    },
    rejected: {
      text: STATUS_TEXT.rejected,
      color: COLORS.status.reject,
      bg: 'rgba(239,68,68,0.10)',
    },
  };
  const { text, color, bg } = map[status];
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1,
        py: 0.25,
        borderRadius: 1,
        fontSize: 12,
        fontWeight: 600,
        color,
        backgroundColor: bg,
        whiteSpace: 'nowrap',
      }}
    >
      <Box
        component="span"
        sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: color }}
      />
      {text}
    </Box>
  );
}
