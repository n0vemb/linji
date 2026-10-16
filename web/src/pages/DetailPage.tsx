import React, { useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Card, Chip, Button } from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { COLORS } from '@/styles/tokens';
import type { HealthReport } from '@/data/types';
import { useAppStore } from '@/store/useAppStore';
import { usePermission } from '@/hooks/usePermission';
import { getMockReport } from '@/data/mock/reports';
import MediaPreview from '@/components/common/MediaPreview';
import ReportPanel from '@/components/inspiration/ReportPanel';
import CopyButton from '@/components/common/CopyButton';
import StatusChip from '@/components/common/StatusChip';
import { healthPath, editPath } from '@/router/paths';

/** 无 mock 报告时由灵感字段构造最小报告（上传的待审项等） */
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
    compliance: { level: insp.compliance, blockingReason: insp.compliance === 'block' ? '存在合规硬阻断，需整改后提交' : null },
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
 * 02 灵感详情（节点 2:100）。
 * 左栏素材（视频预览浮层「保存到手机」+ 封面缩略图保存入口）；
 * 右栏三张卡片（标题/文案/话题）各带复制图标、体检报告卡；
 * 非创建者显示「仅创建者可编辑」(82:55) 且无编辑入口。
 */
export default function DetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const inspiration = useInspiration(id);

  const setActiveInspiration = useAppStore((state) => state.setActiveInspiration);

  // 详情上下文（供顶栏「一键复制」全量复制）
  useEffect(() => {
    if (inspiration) setActiveInspiration(inspiration);
    return () => setActiveInspiration(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspiration?.id]);

  const permission = usePermission(inspiration?.creatorID ?? '');

  const report = useMemo<HealthReport | null>(() => {
    if (!inspiration) return null;
    return getMockReport(inspiration.id) ?? fallbackReport(inspiration);
  }, [inspiration]);

  if (!inspiration) {
    return (
      <Box sx={{ p: 6, textAlign: 'center', color: COLORS.sub3 }}>
        未找到该灵感
      </Box>
    );
  }

  // 非创建者：只读提示；创建者：可编辑提示
  const editHint = permission.canEdit
    ? '你是创建者，可编辑本灵感'
    : '仅创建者可编辑';

  return (
    <Box>
      {/* 头部：标题 + 创作者 + 状态 + 编辑 + 完整报告入口 */}
      <Box className="flex items-start justify-between" sx={{ mb: 3, gap: 2 }}>
        <Box>
          <Typography sx={{ fontSize: 22, fontWeight: 700, color: COLORS.ink }}>
            {inspiration.title}
          </Typography>
          <Box className="flex items-center gap-2" sx={{ mt: 1 }}>
            <Typography sx={{ fontSize: 13, color: COLORS.sub2 }}>
              {inspiration.creatorName}
            </Typography>
            <StatusChip status={inspiration.status} />
          </Box>
        </Box>
        <Box className="flex items-center gap-2">
          <Button
            endIcon={<ChevronRightIcon />}
            onClick={() => navigate(healthPath(inspiration.id))}
            sx={{ color: COLORS.primary, textTransform: 'none', fontWeight: 600 }}
          >
            查看完整报告
          </Button>
          {permission.canEdit && (
            <Button
              variant="outlined"
              startIcon={<EditOutlinedIcon />}
              onClick={() => navigate(editPath(inspiration.id))}
              sx={{ borderRadius: 2, borderColor: COLORS.primary, color: COLORS.primary }}
            >
              编辑
            </Button>
          )}
        </Box>
      </Box>

      {/* 两栏：左素材 / 右内容 + 报告 */}
      <Box
        className="grid gap-5"
        sx={{ gridTemplateColumns: { xs: '1fr', md: '1.1fr 1fr' } }}
      >
        {/* 左栏：视频预览 + 封面缩略图 */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <MediaPreview
            mediaType={inspiration.mediaType}
            coverImage={inspiration.coverImage}
            videoUrl={inspiration.videoUrl}
            title={inspiration.title}
            aspectRatio="16 / 9"
          />
          <MediaPreview
            mediaType="image"
            coverImage={inspiration.coverImage}
            videoUrl={null}
            title={`${inspiration.title} · 封面`}
            aspectRatio="4 / 3"
          />
        </Box>

        {/* 右栏：标题 / 文案 / 话题 卡片 + 体检报告 */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* 标题卡片（复制-标题，节点 93:8） */}
          <ContentCard label="标题" getText={() => inspiration.title} message="标题已复制">
            <Typography sx={{ fontSize: 15, fontWeight: 600, color: COLORS.ink, lineHeight: 1.5 }}>
              {inspiration.title}
            </Typography>
          </ContentCard>

          {/* 文案卡片（复制-文案，节点 93:11） */}
          <ContentCard label="文案" getText={() => inspiration.copy} message="文案已复制">
            <Typography sx={{ fontSize: 14, color: COLORS.sub1, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {inspiration.copy}
            </Typography>
          </ContentCard>

          {/* 话题卡片（复制-标签，节点 93:14） */}
          <ContentCard
            label="话题"
            getText={() => inspiration.tags.join(' ')}
            message="标签已复制"
          >
            <Box className="flex flex-wrap gap-1.5">
              {inspiration.tags.map((t) => (
                <Chip
                  key={t}
                  label={t}
                  size="small"
                  sx={{ backgroundColor: 'rgba(59,130,246,0.08)', color: COLORS.primary, fontWeight: 600 }}
                />
              ))}
            </Box>
          </ContentCard>

          {/* 体检报告卡（只读提示「仅创建者可编辑」） */}
          {report && (
            <ReportPanel
              report={report}
              title="体检报告"
              editHint={permission.canEdit ? undefined : '仅创建者可编辑'}
            />
          )}
          {!report && (
            <Typography sx={{ fontSize: 12, color: COLORS.sub3 }}>
              {editHint}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
}

/** 右栏内容卡片（标题行带复制图标，开发文档 §6.1） */
function ContentCard({
  label,
  getText,
  message,
  children,
}: {
  label: string;
  getText: () => string;
  message: string;
  children: React.ReactNode;
}) {
  return (
    <Card sx={{ p: 2 }}>
      <Box className="flex items-center justify-between" sx={{ mb: 1 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: COLORS.sub2 }}>
          {label}
        </Typography>
        <CopyButton getText={getText} message={message} title={`复制${label}`} />
      </Box>
      {children}
    </Card>
  );
}
