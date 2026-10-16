import { Box, Card, Typography, Button } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import { COLORS, COMPLIANCE_COLOR, COMPLIANCE_TEXT } from '@/styles/tokens';
import type { AuditItem, Inspiration } from '@/data/types';
import { useAppStore } from '@/store/useAppStore';
import { useToastStore } from '@/components/common/Toast';

interface AuditPanelProps {
  auditItem: AuditItem;
  inspiration?: Inspiration;
}

/**
 * 审核面板（审核台）：创作者体检摘要（只读）+ 通过 / 驳回。
 * 管理员视角；通过 / 驳回仅切换内存状态（D2 Deferred，刷新重置）。
 */
export default function AuditPanel({ auditItem, inspiration }: AuditPanelProps) {
  const decide = useAppStore((state) => state.decide);
  const showToast = useToastStore((state) => state.show);
  const { reportSummary } = auditItem;
  const isPending = auditItem.status === 'pending';

  const handleDecide = async (
    decision: 'approved' | 'rejected'
  ) => {
    await decide(auditItem.id, decision);
    showToast(decision === 'approved' ? '已通过审核' : '已驳回');
  };

  return (
    <Card sx={{ p: 2.5 }}>
      {/* 头部：创作者 + 标题 */}
      <Box className="flex items-center justify-between" sx={{ mb: 1.5 }}>
        <Box>
          <Typography sx={{ fontSize: 15, fontWeight: 700, color: COLORS.ink }}>
            {inspiration?.title ?? auditItem.inspirationID}
          </Typography>
          <Typography sx={{ fontSize: 12, color: COLORS.sub2, mt: 0.25 }}>
            创作者 · {auditItem.creatorName}
          </Typography>
        </Box>
        {!isPending && (
          <Typography
            sx={{
              fontSize: 12,
              fontWeight: 700,
              color:
                auditItem.status === 'approved'
                  ? COLORS.status.pass
                  : COLORS.status.reject,
            }}
          >
            {auditItem.status === 'approved' ? '已通过' : '已驳回'}
          </Typography>
        )}
      </Box>

      {/* 只读摘要 */}
      <Box
        sx={{
          p: 1.5,
          borderRadius: 1.5,
          backgroundColor: COLORS.canvas,
          border: `1px solid ${COLORS.line}`,
          mb: 2,
        }}
      >
        <Typography
          sx={{ fontSize: 12, fontWeight: 600, color: COLORS.sub3, mb: 1 }}
        >
          创作者体检摘要（只读）
        </Typography>
        <Box className="flex items-center gap-4" sx={{ mb: 1 }}>
          <Box>
            <Typography sx={{ fontSize: 11, color: COLORS.sub2 }}>
              经验健康分
            </Typography>
            <Typography
              sx={{
                fontSize: 18,
                fontWeight: 800,
                color: COLORS.ink,
                lineHeight: 1,
              }}
            >
              {reportSummary.healthScore}
            </Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: 11, color: COLORS.sub2 }}>
              合规
            </Typography>
            <Typography
              sx={{
                fontSize: 14,
                fontWeight: 700,
                color: COMPLIANCE_COLOR[reportSummary.compliance],
              }}
            >
              {COMPLIANCE_TEXT[reportSummary.compliance]}
            </Typography>
          </Box>
        </Box>
        <Typography sx={{ fontSize: 12, color: COLORS.sub1, lineHeight: 1.5 }}>
          {reportSummary.note}
        </Typography>
      </Box>

      {/* 通过 / 驳回 */}
      {isPending ? (
        <Box className="flex gap-2">
          <Button
            variant="contained"
            startIcon={<CheckCircleOutlineIcon />}
            onClick={() => void handleDecide('approved')}
            sx={{
              flex: 1,
              borderRadius: 2,
              backgroundColor: COLORS.status.pass,
              '&:hover': { backgroundColor: '#047857' },
            }}
          >
            通过
          </Button>
          <Button
            variant="outlined"
            startIcon={<CancelOutlinedIcon />}
            onClick={() => void handleDecide('rejected')}
            sx={{
              flex: 1,
              borderRadius: 2,
              borderColor: COLORS.status.reject,
              color: COLORS.status.reject,
            }}
          >
            驳回
          </Button>
        </Box>
      ) : (
        <Typography sx={{ fontSize: 12, color: COLORS.sub3 }}>
          已于 {auditItem.decidedAt ?? '—'} 完成审核处置
        </Typography>
      )}
    </Card>
  );
}
