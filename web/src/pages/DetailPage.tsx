import React, { useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Card, Chip, Button, IconButton } from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorderOutlined';
import FavoriteIcon from '@mui/icons-material/FavoriteOutlined';
import { COLORS, TOUCH, LAYOUT } from '@/styles/tokens';
import type { HealthReport } from '@/data/types';
import { useAppStore } from '@/store/useAppStore';
import { usePermission } from '@/hooks/usePermission';
import { useIsMobile } from '@/hooks/useBreakpoint';
import { getMockReport } from '@/data/mock/reports';
import MediaGallery from '@/components/common/MediaGallery';
import ReportPanel from '@/components/inspiration/ReportPanel';
import CopyButton from '@/components/common/CopyButton';
import StatusChip from '@/components/common/StatusChip';
import { useToastStore } from '@/components/common/Toast';
import { healthPath, editPath, PATHS } from '@/router/paths';

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
  const removeInspiration = useAppStore((state) => state.removeInspiration);
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);
  const showToast = useToastStore((state) => state.show);

  // 详情上下文（供顶栏「一键复制」全量复制）
  useEffect(() => {
    if (inspiration) setActiveInspiration(inspiration);
    return () => setActiveInspiration(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspiration?.id]);

  const permission = usePermission(inspiration?.creatorID ?? '');
  // ⚠️ useIsMobile 必须在早退之前调用：直接打开详情 URL 时数据未加载，
  // inspiration 为 undefined 会走「未找到」分支；若 hook 在早退后调用，
  // 数据到达后 hook 数量变化会触发 React #310（Rendered fewer hooks）。
  const isMobile = useIsMobile();

  const handleDelete = () => {
    if (!inspiration) return;
    if (window.confirm(`确定删除「${inspiration.title}」？此操作不可撤销。`)) {
      void removeInspiration(inspiration.id).then(() => {
        showToast('已删除灵感');
        navigate(PATHS.MINE);
      });
    }
  };

  const report = useMemo<HealthReport | null>(() => {
    if (!inspiration) return null;
    // live 模式用后端报告；mock 模式用预烘焙报告；都没有则本地兜底生成
    return (
      inspiration.healthReport ??
      getMockReport(inspiration.id) ??
      fallbackReport(inspiration)
    );
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
    <Box
      // 手机端底部有固定操作条（标签栏 + 操作条 ≈ 130px），需留出空间
      sx={
        isMobile && permission.canEdit
          ? { pb: `calc(${LAYOUT.mobileTabBarHeight}px + ${TOUCH.actionBarHeight}px + ${LAYOUT.safeAreaBottom} + 12px)` }
          : undefined
      }
    >
      {/* 头部：标题 + 创作者 + 状态 + 编辑 + 完整报告入口 */}
      <Box
        className={
          isMobile ? 'flex flex-col' : 'flex items-start justify-between'
        }
        sx={{ mb: 3, gap: isMobile ? 1.5 : 2 }}
      >
        <Box>
          <Typography
            sx={{
              fontSize: isMobile ? 22 : 28,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: COLORS.ink,
              lineHeight: 1.3,
            }}
          >
            {inspiration.title}
          </Typography>
          <Box className="flex items-center gap-2" sx={{ mt: 1, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: 13, color: COLORS.sub2 }}>
              {inspiration.creatorName}
            </Typography>
            <StatusChip status={inspiration.status} />
          </Box>
        </Box>

        {/* 手机端：完整报告入口放这里，编辑/删除移到底部操作条 */}
        <Box className="flex items-center gap-2" sx={{ flexWrap: 'wrap' }}>
          {/* 收藏（所有人可用；创作者收藏自己的也允许） */}
          <IconButton
            onClick={() => {
              void toggleFavorite(inspiration.id).then((fav) => {
                showToast(fav ? '已收藏' : '已取消收藏');
              });
            }}
            aria-label={inspiration.isFavorite ? '取消收藏' : '收藏'}
            sx={{
              width: 40,
              height: 40,
              color: inspiration.isFavorite ? '#EF4444' : COLORS.sub2,
              backgroundColor: inspiration.isFavorite ? 'rgba(239,68,68,0.08)' : 'transparent',
              '&:active': { transform: 'scale(0.92)' },
            }}
          >
            {inspiration.isFavorite ? <FavoriteIcon /> : <FavoriteBorderIcon />}
          </IconButton>
          <Button
            endIcon={<ChevronRightIcon />}
            onClick={() => navigate(healthPath(inspiration.id))}
            sx={{
              color: COLORS.primary,
              textTransform: 'none',
              fontWeight: 600,
              // 触摸目标
              minHeight: isMobile ? TOUCH.minTarget : undefined,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            查看完整报告
          </Button>
          {!isMobile && permission.canEdit && (
            <>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteOutlineIcon />}
                onClick={handleDelete}
                sx={{ borderRadius: '999px', borderColor: COLORS.status.reject, color: COLORS.status.reject }}
              >
                删除
              </Button>
              <Button
                variant="contained"
                startIcon={<EditOutlinedIcon />}
                onClick={() => navigate(editPath(inspiration.id))}
                sx={{ borderRadius: '999px' }}
              >
                编辑
              </Button>
            </>
          )}
        </Box>
      </Box>

      {/* 驳回理由横幅：创作者必须知道「为什么被拒」，否则无法改进 */}
      {inspiration.status === 'rejected' && inspiration.rejectReason && (
        <Box
          sx={{
            p: 1.5,
            mb: 3,
            borderRadius: '12px',
            backgroundColor: 'rgba(239,68,68,0.06)',
            border: '1px solid rgba(239,68,68,0.22)',
          }}
        >
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: COLORS.status.reject, mb: 0.5 }}>
            驳回理由
          </Typography>
          <Typography sx={{ fontSize: 13, color: COLORS.sub1, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {inspiration.rejectReason}
          </Typography>
          {permission.canEdit && (
            <Typography sx={{ fontSize: 11, color: COLORS.sub3, mt: 0.75 }}>
              按理由修改后重新提交，将再次进入审核
            </Typography>
          )}
        </Box>
      )}

      {/* 两栏：左素材 / 右内容 + 报告 */}
      <Box
        className="grid gap-5"
        sx={{ gridTemplateColumns: { xs: '1fr', md: '1.1fr 1fr' } }}
      >
        {/* 左栏：素材画廊（视频单播 / 图片组轮播 + 保存到手机） */}
        <Box>
          <MediaGallery
            mediaType={inspiration.mediaType}
            images={inspiration.images}
            videoUrl={inspiration.videoUrl}
            title={inspiration.title}
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

      {/* 手机端：底部固定操作条（拇指热区，放最主要且破坏性的操作） */}
      {isMobile && permission.canEdit && (
        <Box
          sx={{
            position: 'fixed',
            left: 0,
            right: 0,
            // 浮在底部标签栏之上
            bottom: `calc(${LAYOUT.mobileTabBarHeight}px + ${LAYOUT.safeAreaBottom})`,
            zIndex: 1100,
            display: 'flex',
            gap: '10px',
            padding: '10px 12px',
            backgroundColor: COLORS.surface,
            borderTop: `1px solid ${COLORS.line}`,
          }}
        >
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteOutlineIcon />}
            onClick={handleDelete}
            sx={{
              flex: 1,
              minHeight: TOUCH.minTarget,
              borderRadius: '999px',
              borderColor: COLORS.status.reject,
              color: COLORS.status.reject,
            }}
          >
            删除
          </Button>
          <Button
            variant="contained"
            startIcon={<EditOutlinedIcon />}
            onClick={() => navigate(editPath(inspiration.id))}
            sx={{ flex: 2, minHeight: TOUCH.minTarget, borderRadius: '999px' }}
          >
            编辑
          </Button>
        </Box>
      )}
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
    <Card elevation={0} sx={{ p: 2, borderRadius: '14px', border: `1px solid ${COLORS.line}` }}>
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
