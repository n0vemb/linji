import { useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Card, Chip, Button } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { COLORS, TOUCH } from '@/styles/tokens';
import type { HealthReport } from '@/data/types';
import { useAppStore } from '@/store/useAppStore';
import { useIsMobile } from '@/hooks/useBreakpoint';
import { getMockReport } from '@/data/mock/reports';
import MediaGallery from '@/components/common/MediaGallery';
import ReportPanel from '@/components/inspiration/ReportPanel';
import StatusChip from '@/components/common/StatusChip';
import { inspirationPath } from '@/router/paths';

function fallbackReport(insp: NonNullable<ReturnType<typeof useInspiration>>): HealthReport {
  const b = insp.healthBreakdown;
  return {
    id: `rpt_${insp.id}`,
    inspirationID: insp.id,
    totalScore: insp.healthScore,
    scoreLabel: '内部经验模型 · 非平台权威数据',
    dimensions: [
      { key: 'title', name: '标题吸引力', score: b.title, level: b.title >= 80 ? 'pass' : b.title >= 60 ? 'warn' : 'block', detail: '' },
      { key: 'copy', name: '文案完整度', score: b.copy, level: b.copy >= 80 ? 'pass' : b.copy >= 60 ? 'warn' : 'block', detail: '' },
      { key: 'topics', name: '话题覆盖', score: b.topics, level: b.topics >= 80 ? 'pass' : b.topics >= 60 ? 'warn' : 'block', detail: '' },
      { key: 'cover', name: '封面表现', score: b.cover, level: b.cover >= 80 ? 'pass' : b.cover >= 60 ? 'warn' : 'block', detail: '' },
    ],
    compliance: {
      level: insp.compliance,
      blockingReason:
        insp.compliance === 'block' ? '存在合规硬阻断，需整改后提交' : null,
      hits: [],
    },
    longTailWords: insp.longTailWords,
    editableByCreator: true,
    generatedAt: insp.updatedAt,
  };
}

function useInspiration(id: string | undefined) {
  const inspirations = useAppStore((state) => state.inspirations);
  return inspirations.find((i) => i.id === id);
}

/**
 * 06 灵感体检（节点 80:1）。
 * 完整版体检报告（健康分 + 四维度 + 合规硬阻断 + 长尾词建议 + 提升建议）。
 * 各页「查看完整报告 →」目的地。
 */
export default function HealthPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const inspiration = useInspiration(id);
  const isMobile = useIsMobile();

  const setActiveInspiration = useAppStore((state) => state.setActiveInspiration);
  useEffect(() => {
    if (inspiration) setActiveInspiration(inspiration);
    return () => setActiveInspiration(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspiration?.id]);

  const report = useMemo<HealthReport | null>(() => {
    if (!inspiration) return null;
    // live 模式用后端报告；mock 模式用预烘焙报告；都没有则本地兜底生成
    return (
      inspiration.healthReport ??
      getMockReport(inspiration.id) ??
      fallbackReport(inspiration)
    );
  }, [inspiration]);

  if (!inspiration || !report) {
    return (
      <Box sx={{ p: 6, textAlign: 'center', color: COLORS.sub3 }}>
        未找到该灵感的体检报告
      </Box>
    );
  }

  return (
    <Box>
      <Box className="flex items-center justify-between" sx={{ mb: 3, gap: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: isMobile ? 22 : 26,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: COLORS.ink,
            }}
          >
            完整体检报告
          </Typography>
          <Box className="flex items-center gap-2" sx={{ mt: 0.5, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: isMobile ? 12 : 13, color: COLORS.sub2 }}>
              {inspiration.title} · {inspiration.creatorName}
            </Typography>
            <StatusChip status={inspiration.status} />
          </Box>
        </Box>
        <Button
          endIcon={<ChevronRightIcon />}
          onClick={() => navigate(inspirationPath(inspiration.id))}
          sx={{
            color: COLORS.primary,
            textTransform: 'none',
            fontWeight: 600,
            flexShrink: 0,
            minHeight: isMobile ? TOUCH.minTarget : undefined,
            whiteSpace: 'nowrap',
          }}
        >
          返回详情
        </Button>
      </Box>

      <Box
        className="grid gap-5"
        sx={{ gridTemplateColumns: { xs: '1fr', md: '1fr 1.1fr' } }}
      >
        {/* 左栏：素材 + 内容上下文 */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <MediaGallery
            mediaType={inspiration.mediaType}
            images={inspiration.images}
            videoUrl={inspiration.videoUrl}
            title={inspiration.title}
            showSave={false}
            aspectRatio="16 / 9"
          />
          <Card elevation={0} sx={{ p: 2, borderRadius: '14px', border: `1px solid ${COLORS.line}` }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: COLORS.sub2, mb: 0.5 }}>
              标题
            </Typography>
            <Typography sx={{ fontSize: 15, fontWeight: 600, color: COLORS.ink }}>
              {inspiration.title}
            </Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: COLORS.sub2, mt: 1.5, mb: 0.5 }}>
              文案
            </Typography>
            <Typography sx={{ fontSize: 14, color: COLORS.sub1, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {inspiration.copy}
            </Typography>
            <Box className="flex flex-wrap gap-1.5" sx={{ mt: 1.5 }}>
              {inspiration.tags.map((t) => (
                <Chip
                  key={t}
                  label={t}
                  size="small"
                  sx={{ backgroundColor: 'rgba(59,130,246,0.08)', color: COLORS.primary, fontWeight: 600 }}
                />
              ))}
            </Box>
          </Card>
        </Box>

        {/* 右栏：完整体检报告 */}
        <ReportPanel report={report} title="完整体检报告" />
      </Box>
    </Box>
  );
}
