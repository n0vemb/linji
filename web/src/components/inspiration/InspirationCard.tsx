import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Card, Typography } from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { COLORS } from '@/styles/tokens';
import type { Inspiration } from '@/data/types';
import { usePermission } from '@/hooks/usePermission';
import { useAppStore } from '@/store/useAppStore';
import { useToastStore } from '@/components/common/Toast';
import HealthBadge from '@/components/common/HealthBadge';
import StatusChip from '@/components/common/StatusChip';
import CopyButton from '@/components/common/CopyButton';
import { inspirationPath, editPath } from '@/router/paths';

interface InspirationCardProps {
  inspiration: Inspiration;
  /** plaza：广场卡片；mine：我的灵感卡片（编辑/删除更突出） */
  variant?: 'plaza' | 'mine';
}

/** 由标题派生稳定渐变（封面占位） */
function gradientFromTitle(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i += 1) {
    hash = (hash * 31 + title.charCodeAt(i)) % 360;
  }
  const h1 = hash;
  const h2 = (hash + 40) % 360;
  return `linear-gradient(135deg, hsl(${h1} 70% 72%), hsl(${h2} 70% 60%))`;
}

function isRealMedia(url: string | null | undefined): url is string {
  return (
    !!url &&
    (url.startsWith('blob:') ||
      url.startsWith('http') ||
      url.startsWith('data:'))
  );
}

/**
 * 灵感卡片（广场 / 我的灵感复用）。
 * 封面(2:76) + 信息区(2:82) + 健康分徽标(82:53) + 复制图标 + 编辑按钮(93:17 根节点，不被裁切)。
 * 编辑 / 删除入口严格按 usePermission(creatorID) 门控（架构 §7.1）。
 */
export default function InspirationCard({
  inspiration,
  variant = 'plaza',
}: InspirationCardProps) {
  const navigate = useNavigate();
  const permission = usePermission(inspiration.creatorID);
  const removeInspiration = useAppStore((state) => state.removeInspiration);
  const showToast = useToastStore((state) => state.show);

  const realCover = isRealMedia(inspiration.coverImage);

  const goDetail = () => navigate(inspirationPath(inspiration.id));
  const goEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(editPath(inspiration.id));
  };
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`确定删除「${inspiration.title}」？此操作不可撤销。`)) {
      void removeInspiration(inspiration.id).then(() =>
        showToast('已删除灵感')
      );
    }
  };

  return (
    <Card
      onClick={goDetail}
      sx={{
        position: 'relative',
        cursor: 'pointer',
        width: '100%',
        overflow: 'hidden',
        transition: 'box-shadow .15s, transform .15s',
        '&:hover': {
          boxShadow: '0 6px 20px rgba(0,0,0,0.08)',
          transform: 'translateY(-2px)',
        },
      }}
    >
      {/* 封面 + 健康分徽标 */}
      <Box sx={{ position: 'relative', aspectRatio: '4 / 3' }}>
        {realCover ? (
          <Box
            component="img"
            src={inspiration.coverImage}
            alt={inspiration.title}
            sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <Box
            sx={{
              width: '100%',
              height: '100%',
              background: gradientFromTitle(inspiration.title),
            }}
          />
        )}
        <Box sx={{ position: 'absolute', left: 10, top: 10 }}>
          <HealthBadge score={inspiration.healthScore} size="sm" />
        </Box>

        {/* 复制图标（分字段：复制标题） */}
        <Box
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            backgroundColor: 'rgba(255,255,255,0.9)',
            borderRadius: '50%',
          }}
        >
          <CopyButton
            getText={() => inspiration.title}
            message="标题已复制"
            title="复制标题"
            size={16}
          />
        </Box>
      </Box>

      {/* 信息区（clipsContent 区域：标题 / 创作者 / 状态） */}
      <Box sx={{ p: 1.5 }}>
        <Typography
          sx={{
            fontSize: 14,
            fontWeight: 600,
            color: COLORS.ink,
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {inspiration.title}
        </Typography>
        <Box
          className="flex items-center justify-between"
          sx={{ mt: 1, gap: 1 }}
        >
          <Typography sx={{ fontSize: 12, color: COLORS.sub2 }} noWrap>
            {inspiration.creatorName}
          </Typography>
          <StatusChip status={inspiration.status} />
        </Box>
      </Box>

      {/* 编辑按钮（根节点，不被信息区裁切；权限门控仅本人可见） */}
      {permission.canEdit && (
        <Box
          sx={{
            position: 'absolute',
            right: 10,
            bottom: 10,
            zIndex: 3,
            display: 'flex',
            gap: 0.5,
          }}
        >
          {variant === 'mine' && permission.canDelete && (
            <Box
              onClick={handleDelete}
              sx={{
                width: 30,
                height: 30,
                borderRadius: 1.5,
                border: `1px solid ${COLORS.line}`,
                backgroundColor: COLORS.surface,
                color: COLORS.status.reject,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                '&:hover': { backgroundColor: 'rgba(239,68,68,0.08)' },
              }}
              title="删除"
            >
              <DeleteOutlineIcon style={{ fontSize: 18 }} />
            </Box>
          )}
          <Box
            onClick={goEdit}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1.25,
              height: 30,
              borderRadius: 1.5,
              border: `1px solid ${COLORS.primary}`,
              backgroundColor: COLORS.surface,
              color: COLORS.primary,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              '&:hover': { backgroundColor: 'rgba(59,130,246,0.06)' },
            }}
          >
            <EditOutlinedIcon style={{ fontSize: 16 }} />
            编辑
          </Box>
        </Box>
      )}
    </Card>
  );
}
