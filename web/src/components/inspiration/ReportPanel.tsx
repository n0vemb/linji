import { Box, Card, Typography, Chip } from '@mui/material';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import { COLORS, healthColor, COMPLIANCE_COLOR, COMPLIANCE_TEXT } from '@/styles/tokens';
import type { HealthReport } from '@/data/types';

interface ReportPanelProps {
  report: HealthReport;
  /** 卡片标题，如「体检报告」「完整体检报告」 */
  title?: string;
  /** 非创建者只读提示（如「仅创建者可编辑」） */
  editHint?: string;
}

const LEVEL_ICON = {
  pass: <CheckCircleRoundedIcon style={{ fontSize: 18 }} />,
  warn: <WarningAmberRoundedIcon style={{ fontSize: 18 }} />,
  block: <BlockRoundedIcon style={{ fontSize: 18 }} />,
};

/**
 * 体检报告面板（详情 / 体检页共用）。
 * 经验健康分 + 四维度 + 合规硬阻断 + 长尾词建议 + 提升建议。
 */
export default function ReportPanel({
  report,
  title = '体检报告',
  editHint,
}: ReportPanelProps) {
  const { totalScore, dimensions, compliance, longTailWords, scoreLabel } = report;

  // 提升建议：维度级非 pass 的 detail
  const improvements = dimensions.filter((d) => d.level !== 'pass');

  return (
    <Card sx={{ p: 2.5 }}>
      {/* 标题 */}
      <Typography sx={{ fontSize: 16, fontWeight: 700, color: COLORS.ink, mb: 1.5 }}>
        {title}
      </Typography>

      {/* 经验健康分 */}
      <Box className="flex items-center gap-3" sx={{ mb: 2 }}>
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            border: `3px solid ${healthColor(totalScore)}`,
            color: healthColor(totalScore),
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Typography sx={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>
            {totalScore}
          </Typography>
          <Typography sx={{ fontSize: 10, color: COLORS.sub2 }}>分</Typography>
        </Box>
        <Box>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: COLORS.ink }}>
            经验健康分
          </Typography>
          <Typography sx={{ fontSize: 11, color: COLORS.sub3, mt: 0.25 }}>
            {scoreLabel}
          </Typography>
        </Box>
      </Box>

      {/* 合规结论 */}
      <Box
        className="flex items-center gap-1.5"
        sx={{
          p: 1.25,
          borderRadius: 1.5,
          mb: 2,
          backgroundColor: `${COMPLIANCE_COLOR[compliance.level]}14`,
          color: COMPLIANCE_COLOR[compliance.level],
        }}
      >
        {LEVEL_ICON[compliance.level]}
        <Box>
          <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
            {COMPLIANCE_TEXT[compliance.level]}
          </Typography>
          {compliance.blockingReason && (
            <Typography sx={{ fontSize: 12, mt: 0.25, lineHeight: 1.4 }}>
              {compliance.blockingReason}
            </Typography>
          )}
        </Box>
      </Box>

      {/* 四维度 */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
        {dimensions.map((d) => (
          <Box key={d.key}>
            <Box className="flex items-center justify-between" sx={{ mb: 0.5 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: COLORS.ink }}>
                {d.name}
              </Typography>
              <Box className="flex items-center gap-1">
                <Box
                  component="span"
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: COMPLIANCE_COLOR[d.level],
                  }}
                />
                <Typography
                  sx={{ fontSize: 13, fontWeight: 700, color: healthColor(d.score) }}
                >
                  {d.score}
                </Typography>
              </Box>
            </Box>
            {/* 分数进度条 */}
            <Box
              sx={{
                height: 6,
                borderRadius: 3,
                backgroundColor: COLORS.line,
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  height: '100%',
                  width: `${d.score}%`,
                  borderRadius: 3,
                  backgroundColor: healthColor(d.score),
                }}
              />
            </Box>
            <Typography sx={{ fontSize: 12, color: COLORS.sub2, mt: 0.5 }}>
              {d.detail}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* 长尾词建议 */}
      <Box sx={{ mb: 2 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: COLORS.ink, mb: 0.75 }}>
          长尾词建议
        </Typography>
        <Box className="flex flex-wrap gap-1.5">
          {longTailWords.map((w) => (
            <Chip
              key={w}
              label={w}
              size="small"
              sx={{
                backgroundColor: 'rgba(59,130,246,0.08)',
                color: COLORS.primary,
                fontWeight: 600,
                fontSize: 12,
              }}
            />
          ))}
        </Box>
      </Box>

      {/* 提升建议（维度级非 pass） */}
      {improvements.length > 0 && (
        <Box>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: COLORS.ink, mb: 0.75 }}>
            提升建议
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {improvements.map((d) => (
              <Typography
                key={d.key}
                sx={{ fontSize: 12, color: COLORS.sub2, lineHeight: 1.5 }}
              >
                · {d.name}：{d.detail}
              </Typography>
            ))}
          </Box>
        </Box>
      )}

      {/* 非创建者只读提示（仅创建者可编辑） */}
      {editHint && (
        <Typography
          sx={{
            fontSize: 12,
            color: COLORS.sub3,
            mt: 2,
            pt: 1.5,
            borderTop: `1px dashed ${COLORS.line}`,
          }}
        >
          {editHint}
        </Typography>
      )}
    </Card>
  );
}
