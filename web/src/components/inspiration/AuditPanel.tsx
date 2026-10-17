import { useState } from 'react';
import {
  Box,
  Card,
  Typography,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import { COLORS, COMPLIANCE_COLOR, COMPLIANCE_TEXT, TOUCH } from '@/styles/tokens';
import type { AuditItem, Inspiration } from '@/data/types';
import { useAppStore } from '@/store/useAppStore';
import { useToastStore } from '@/components/common/Toast';
import { useIsMobile } from '@/hooks/useBreakpoint';
import MediaGallery from '@/components/common/MediaGallery';

/**
 * 审核面板（审核台）：**完整内容预览** + 体检摘要 + 通过 / 驳回。
 *
 * 设计要点：审核的前提是「看清楚内容」。只给一个评分摘要，审核人无法判断
 * 合规与否（图片有没有违规、文案有没有夸大），等于让人盲审。所以这里必须
 * 直接呈现：图片 / 视频素材、标题、文案正文、话题标签；体检摘要退居辅助位。
 */
export default function AuditPanel({ auditItem, inspiration }: AuditPanelProps) {
  const decide = useAppStore((state) => state.decide);
  const showToast = useToastStore((state) => state.show);
  const isMobile = useIsMobile();
  const { reportSummary } = auditItem;
  const isPending = auditItem.status === 'pending';

  // 驳回理由弹窗（驳回必须给理由，否则创作者无法改进）
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [deciding, setDeciding] = useState(false);

  const handleDecide = async (decision: 'approved' | 'rejected') => {
    if (decision === 'rejected') {
      setRejectOpen(true);
      return;
    }
    setDeciding(true);
    try {
      await decide(auditItem.id, decision);
      showToast('已通过审核');
    } finally {
      setDeciding(false);
    }
  };

  const confirmReject = async () => {
    const trimmed = reason.trim();
    if (trimmed.length < 2) {
      showToast('请填写驳回理由（至少 2 个字）');
      return;
    }
    setDeciding(true);
    try {
      await decide(auditItem.id, 'rejected', trimmed);
      showToast('已驳回，理由已同步给创作者');
      setRejectOpen(false);
      setReason('');
    } catch (err) {
      showToast((err as Error).message || '驳回失败，请重试');
    } finally {
      setDeciding(false);
    }
  };

  return (
    <>
      <Card
      elevation={0}
      sx={{
        p: isMobile ? 1.5 : 2.5,
        borderRadius: '14px',
        border: `1px solid ${COLORS.line}`,
        backgroundColor: COLORS.surface,
        // 待审项用左侧色条标注状态，扫队列时一眼区分
        borderLeft: isPending
          ? `3px solid ${COLORS.status.warn}`
          : `3px solid ${
              auditItem.status === 'approved'
                ? COLORS.status.pass
                : COLORS.status.reject
            }`,
      }}
    >
      {/* 头部：创作者 + 状态 */}
      <Box className="flex items-center justify-between" sx={{ mb: 1.5 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: isMobile ? 15 : 16,
              fontWeight: 700,
              color: COLORS.ink,
            }}
          >
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
              flexShrink: 0,
            }}
          >
            {auditItem.status === 'approved' ? '已通过' : '已驳回'}
          </Typography>
        )}
      </Box>

      {/* 素材预览：多图轮播 / 视频播放 —— 审核必须能看到原始素材 */}
      {inspiration && (
        <Box sx={{ mb: 1.5 }}>
          <MediaGallery
            mediaType={inspiration.mediaType}
            images={inspiration.images}
            videoUrl={inspiration.videoUrl}
            title={inspiration.title}
            showSave={false}
            aspectRatio={isMobile ? '4 / 3' : '16 / 9'}
          />
        </Box>
      )}

      {/* 标题 / 文案 / 话题 —— 审核的三项核心内容 */}
      {inspiration ? (
        <Box sx={{ mb: 1.5 }}>
          {/* 标题 */}
          <Typography
            sx={{
              fontSize: isMobile ? 14 : 15,
              fontWeight: 700,
              color: COLORS.ink,
              lineHeight: 1.5,
              mb: 0.75,
            }}
          >
            {inspiration.title}
          </Typography>

          {/* 文案正文（审核夸大 / 绝对化用语主要看这里） */}
          <Box
            sx={{
              p: 1.25,
              borderRadius: '10px',
              backgroundColor: COLORS.canvas,
              border: `1px solid ${COLORS.line}`,
              mb: 1,
            }}
          >
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: COLORS.sub3, mb: 0.5 }}>
              文案正文
            </Typography>
            <Typography
              sx={{
                fontSize: 13,
                color: COLORS.sub1,
                lineHeight: 1.65,
                whiteSpace: 'pre-wrap',
                // 限制高度，超出可滚动，避免超长文案把面板撑到失控
                maxHeight: '120px',
                overflowY: 'auto',
              }}
            >
              {inspiration.copy}
            </Typography>
          </Box>

          {/* 话题 */}
          <Box className="flex flex-wrap gap-1">
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: COLORS.sub3, mr: 0.5, alignSelf: 'center' }}>
              话题
            </Typography>
            {inspiration.tags.length > 0 ? (
              inspiration.tags.map((t) => (
                <Chip
                  key={t}
                  label={t}
                  size="small"
                  sx={{
                    backgroundColor: 'rgba(59,130,246,0.08)',
                    color: COLORS.primary,
                    fontWeight: 600,
                    fontSize: 12,
                    height: 22,
                  }}
                />
              ))
            ) : (
              <Typography sx={{ fontSize: 12, color: COLORS.sub3, alignSelf: 'center' }}>
                未填话题
              </Typography>
            )}
          </Box>
        </Box>
      ) : (
        <Typography sx={{ fontSize: 13, color: COLORS.sub3, mb: 1.5 }}>
          内容已删除，无法预览
        </Typography>
      )}

      {/* 体检摘要（辅助信息，不替代内容） */}
      <Box
        sx={{
          p: 1.5,
          borderRadius: '10px',
          backgroundColor: COLORS.canvas,
          border: `1px solid ${COLORS.line}`,
          mb: 2,
        }}
      >
        <Typography sx={{ fontSize: 11, fontWeight: 600, color: COLORS.sub3, mb: 1 }}>
          创作者体检摘要（只读）
        </Typography>
        <Box className="flex items-center gap-4" sx={{ mb: 0.75 }}>
          <Box>
            <Typography sx={{ fontSize: 11, color: COLORS.sub2 }}>经验健康分</Typography>
            <Typography
              sx={{ fontSize: 18, fontWeight: 800, color: COLORS.ink, lineHeight: 1 }}
            >
              {reportSummary.healthScore}
            </Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: 11, color: COLORS.sub2 }}>合规</Typography>
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
              borderRadius: '999px',
              minHeight: isMobile ? TOUCH.minTarget : undefined,
              backgroundColor: COLORS.status.pass,
              transition: 'all .15s ease',
              '&:hover': { backgroundColor: '#047857' },
              '&:active': { transform: 'scale(0.98)' },
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
              borderRadius: '999px',
              minHeight: isMobile ? TOUCH.minTarget : undefined,
              borderColor: COLORS.status.reject,
              color: COLORS.status.reject,
              transition: 'all .15s ease',
              '&:hover': { borderColor: '#b91c1c', color: '#b91c1c', backgroundColor: 'rgba(239,68,68,0.06)' },
              '&:active': { transform: 'scale(0.98)' },
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

    {/* 驳回理由弹窗：理由必填，创作者详情页会看到 */}
    <Dialog      open={rejectOpen}
      onClose={() => setRejectOpen(false)}
      fullWidth
      maxWidth="xs"
      PaperProps={{ sx: { borderRadius: '16px' } }}
    >
      <DialogTitle sx={{ fontSize: 16, fontWeight: 700, color: COLORS.ink }}>
        驳回「{inspiration?.title ?? '该灵感'}」
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: 12, color: COLORS.sub2, mb: 1.5, lineHeight: 1.6 }}>
          请说明驳回原因，创作者会在详情页看到这条理由并据此修改。
        </Typography>
        <TextField
          autoFocus
          fullWidth
          multiline
          minRows={3}
          size="small"
          label="驳回理由"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="如：封面含竞品水印，请更换后重新提交"
          inputProps={{ style: { fontSize: 14, lineHeight: 1.6 } }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button
          onClick={() => setRejectOpen(false)}
          sx={{ borderRadius: '999px', color: COLORS.sub2, minHeight: 40 }}
        >
          取消
        </Button>
        <Button
          variant="contained"
          onClick={() => void confirmReject()}
          disabled={deciding || reason.trim().length < 2}
          sx={{
            borderRadius: '999px',
            minHeight: 40,
            backgroundColor: COLORS.status.reject,
            '&:hover': { backgroundColor: '#dc2626' },
          }}
        >
          {deciding ? '提交中…' : '确认驳回'}
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
}

interface AuditPanelProps {
  auditItem: AuditItem;
  inspiration?: Inspiration;
}