import { useNavigate } from 'react-router-dom';
import { Box, Typography, Avatar, IconButton } from '@mui/material';
import FavoriteBorderOutlinedIcon from '@mui/icons-material/FavoriteBorderOutlined';
import FavoriteIcon from '@mui/icons-material/Favorite';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import { COLORS } from '@/styles/tokens';
import type { Inspiration, Platform } from '@/data/types';
import HealthBadge from '@/components/common/HealthBadge';
import { inspirationPath } from '@/router/paths';
import { useHasHover } from '@/hooks/useBreakpoint';
import { useAppStore } from '@/store/useAppStore';
import { useToastStore } from '@/components/common/Toast';

interface InspirationCardProps {
  inspiration: Inspiration;
}

/** 稳定字符串哈希（用于派生封面比例 / 点赞数 / 头像色，保证同卡片表现一致） */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) % 1_000_000_003;
  }
  return Math.abs(h);
}

/**
 * 封面比例池：以竖图为主（3:4 / 4:5），少量方图；
 * 不混入横图，避免瀑布流出现 185px 与 329px 并存的强落差。
 */
const RATIOS = ['3 / 4', '4 / 5', '1 / 1', '3 / 4', '4 / 5', '1 / 1'];

/** 由 id 派生封面比例（稳定、可复现） */
export function cardRatio(id: string): string {
  return RATIOS[hashStr(id) % RATIOS.length];
}

/** 由 id 派生点赞数（稳定、可复现，给瀑布流卡片小红书式互动感） */
export function cardLikes(id: string): number {
  return 12 + (hashStr(id) % 1988);
}

/**
 * 估算卡片在给定列宽下的总高度（封面 + 标题 + 作者行）。
 * 供瀑布流按「最短列优先」分配，避免某列独长、底部参差。
 */
export function estimateCardHeight(id: string, title: string, columnWidth: number): number {
  const [w, h] = cardRatio(id)
    .split('/')
    .map((n) => Number(n.trim()));
  const coverHeight = columnWidth * (h / w);

  const charsPerLine = Math.max(8, Math.floor(columnWidth / 14));
  const titleLines = Math.min(2, Math.max(1, Math.ceil(title.length / charsPerLine)));

  // 10(上内距) + 标题行高 21 + 8(间距) + 20(作者行)
  const infoHeight = 10 + titleLines * 21 + 8 + 20;
  return coverHeight + infoHeight;
}

/** 封面占位底色（按平台区分色相，平涂无渐变，待真实用户图替换） */
function tintFor(platform: Platform, seed: number): string {
  if (platform === 'douyin') {
    return `hsl(${205 + (seed % 30)} 48% 82%)`;
  }
  return `hsl(${338 + (seed % 30)} 55% 86%)`;
}

function isRealMedia(url: string | null | undefined): url is string {
  return (
    !!url &&
    (url.startsWith('blob:') ||
      url.startsWith('http') ||
      url.startsWith('data:') ||
      url.startsWith('/media/'))
  );
}

const PLATFORM_TEXT: Record<Platform, string> = {
  douyin: '抖音',
  xiaohongshu: '小红书',
};

/**
 * 灵感卡片（小红书 web 风格）。
 * 结构：圆角封面图 + 下方标题/作者，无白卡容器、无边框、无阴影；
 * 卡片上不放置编辑 / 删除 / 复制入口，统一在详情页（门控）完成。
 *
 * ⚠️ 封面这里是**唯一有意裁切**（objectFit: cover + 固定比例）的地方：
 * 瀑布流要求所有卡片同列等宽且高度可控，若按原图比例展示会因长宽不一
 * 导致列高剧烈参差、底部参差 300px+，视觉反而更差。
 * 详情页 / 上传预览（MediaGallery / MediaPreview）则一律 contain 完整展示原图。
 */
export default function InspirationCard({ inspiration }: InspirationCardProps) {
  const navigate = useNavigate();
  const hasHover = useHasHover();
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);
  const submitDraft = useAppStore((state) => state.submitDraft);
  const showToast = useToastStore((state) => state.show);

  const cover = inspiration.images[0] ?? '';
  const realCover = isRealMedia(cover);
  const imageCount = inspiration.images.length;
  const ratio = cardRatio(inspiration.id);
  const likes = cardLikes(inspiration.id);
  const avatarHue = hashStr(inspiration.creatorName) % 360;
  const isDraft = inspiration.status === 'draft';

  const goDetail = () => navigate(inspirationPath(inspiration.id));

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    void toggleFavorite(inspiration.id).then((fav) => {
      showToast(fav ? '已收藏' : '已取消收藏');
    });
  };

  const handleSubmitDraft = (e: React.MouseEvent) => {
    e.stopPropagation();
    void submitDraft(inspiration.id)
      .then(() => showToast('已提交审核'))
      .catch((err) => showToast((err as Error).message || '提交失败'));
  };

  return (
    <Box
      onClick={goDetail}
      sx={{
        cursor: 'pointer',
        // 手机端 hover 效果永远不触发，改用按压反馈（:active 在触摸设备有效）
        ...(hasHover
          ? {
              '&:hover .card-cover': { transform: 'scale(1.025)' },
              '&:hover .card-title': { color: COLORS.primary },
              transition: 'opacity .15s ease',
              '&:active': { opacity: 0.7 },
            }
          : {
              '&:active .card-cover': { transform: 'scale(0.985)' },
              '&:active': { opacity: 0.7 },
            }),
        // 禁止长按选中 / 禁止 iOS 弹出菜单，更接近原生 App
        WebkitTapHighlightColor: 'transparent',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        touchAction: 'manipulation',
      }}
    >
      {/* 封面：圆角图片主导 */}
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          aspectRatio: ratio,
          borderRadius: '16px',
          overflow: 'hidden',
          backgroundColor: COLORS.canvas,
        }}
      >
        {realCover ? (
          <Box
            component="img"
            className="card-cover"
            src={cover}
            alt={inspiration.title}
            sx={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              transition: 'transform .35s ease',
            }}
          />
        ) : (
          <Box
            className="card-cover"
            sx={{
              position: 'absolute',
              inset: 0,
              background: tintFor(inspiration.platform, hashStr(inspiration.id)),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform .35s ease',
            }}
          >
            <Typography
              sx={{
                fontSize: 38,
                fontWeight: 800,
                color: '#fff',
                opacity: 0.28,
                letterSpacing: '-0.02em',
                userSelect: 'none',
              }}
            >
              {PLATFORM_TEXT[inspiration.platform]}
            </Typography>
          </Box>
        )}

        {/* 底部轻微压暗：仅在真实图片上，保证健康分徽标可读（平涂占位不需要） */}
        {realCover && (
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: '42%',
              background: 'linear-gradient(to top, rgba(0,0,0,0.28), rgba(0,0,0,0))',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* 经验健康分（左下角，克制） */}
        <Box sx={{ position: 'absolute', left: 10, bottom: 10 }}>
          <HealthBadge score={inspiration.healthScore} size="sm" />
        </Box>

        {/* 收藏（右下角，与健康分对称；点击不进详情） */}
        <Box sx={{ position: 'absolute', right: 10, bottom: 10 }}>
          <IconButton
            onClick={handleFavorite}
            aria-label={inspiration.isFavorite ? '取消收藏' : '收藏'}
            sx={{
              width: 30,
              height: 30,
              backgroundColor: 'rgba(255,255,255,0.92)',
              color: inspiration.isFavorite ? '#EF4444' : COLORS.sub2,
              '&:active': { transform: 'scale(0.92)' },
              transition: 'all .15s ease',
              // 热区扩展到 44px（视觉仍是 30px 小按钮，但手指够得中）
              '&::after': {
                content: '""',
                position: 'absolute',
                inset: '-7px',
              },
            }}
          >
            {inspiration.isFavorite ? (
              <FavoriteIcon style={{ fontSize: 16 }} />
            ) : (
              <FavoriteBorderOutlinedIcon style={{ fontSize: 16 }} />
            )}
          </IconButton>
        </Box>

        {/* 平台小标（右上角，平涂白底无玻璃） */}
        <Box
          sx={{
            position: 'absolute',
            right: 10,
            top: 10,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          {/* 组图计数（多图时，提示可切换） */}
          {imageCount > 1 && (
            <Box
              sx={{
                px: '8px',
                py: '3px',
                borderRadius: '999px',
                backgroundColor: 'rgba(0,0,0,0.55)',
                color: '#fff',
                fontSize: 11,
                fontWeight: 600,
                lineHeight: 1.3,
              }}
            >
              {imageCount} 图
            </Box>
          )}
          <Box
            sx={{
              px: '8px',
              py: '3px',
              borderRadius: '999px',
              backgroundColor: 'rgba(255,255,255,0.95)',
              fontSize: 11,
              fontWeight: 600,
              color: COLORS.ink,
              lineHeight: 1.3,
            }}
          >
            {PLATFORM_TEXT[inspiration.platform]}
          </Box>
        </Box>
      </Box>

      {/* 信息区：标题 + 作者 / 点赞（与封面左对齐，无额外白底） */}
      <Box sx={{ pt: '10px' }}>
        <Typography
          className="card-title"
          sx={{
            fontSize: 14,
            fontWeight: 600,
            color: COLORS.ink,
            lineHeight: 1.5,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            transition: 'color .15s ease',
          }}
        >
          {inspiration.title}
        </Typography>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mt: '8px',
            gap: '8px',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
            <Avatar
              sx={{
                width: 20,
                height: 20,
                fontSize: 10,
                fontWeight: 700,
                bgcolor: `hsl(${avatarHue} 58% 55%)`,
                color: '#fff',
                flexShrink: 0,
              }}
            >
              {inspiration.creatorName.slice(0, 1)}
            </Avatar>
            <Typography
              sx={{
                fontSize: 12,
                color: COLORS.sub2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {inspiration.creatorName}
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              flexShrink: 0,
              color: COLORS.sub3,
            }}
          >
            {/* 草稿卡：直接提交审核（补齐草稿闭环，不用先进详情） */}
            {isDraft && (
              <Box
                component="span"
                role="button"
                tabIndex={0}
                onClick={handleSubmitDraft}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSubmitDraft(e as unknown as React.MouseEvent);
                }}
                className="flex items-center gap-1"
                sx={{
                  px: '10px',
                  py: '3px',
                  mr: '4px',
                  borderRadius: '999px',
                  backgroundColor: 'rgba(59,130,246,0.10)',
                  color: COLORS.primary,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  '&:active': { opacity: 0.7 },
                }}
              >
                <SendOutlinedIcon style={{ fontSize: 12 }} />
                提交审核
              </Box>
            )}
            <FavoriteBorderOutlinedIcon style={{ fontSize: 13 }} />
            <Typography sx={{ fontSize: 12, color: COLORS.sub2 }}>{likes}</Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
