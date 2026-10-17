import { useState } from 'react';
import { Box, Typography } from '@mui/material';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { COLORS } from '@/styles/tokens';
import type { MediaType } from '@/data/types';
import { useToastStore } from '@/components/common/Toast';
import { downloadMedia, downloadImage } from '@/utils/download';
import SaveToPhoneBtn from './SaveToPhoneBtn';

interface MediaGalleryProps {
  mediaType: MediaType;
  /** 图片素材（images[0] 为封面）；视频类型时用于展示封面帧 */
  images: string[];
  videoUrl: string | null;
  title: string;
  /** 是否显示「保存到手机」（默认 true） */
  showSave?: boolean;
  /** 容器宽高比，如 '16 / 9' | '4 / 3' */
  aspectRatio?: string;
}

/** 是否为可真实加载的媒体（blob:/http/data:/服务端 /media 路径） */
function isRealMedia(url: string | null | undefined): url is string {
  return (
    !!url &&
    (url.startsWith('blob:') ||
      url.startsWith('http') ||
      url.startsWith('data:') ||
      url.startsWith('/media/'))
  );
}

/** 由标题派生稳定平涂底色（占位封面 / 视频用，无渐变） */
function tintFromTitle(title: string, dark = false): string {
  let hash = 0;
  for (let i = 0; i < title.length; i += 1) {
    hash = (hash * 31 + title.charCodeAt(i)) % 360;
  }
  return dark ? `hsl(${hash} 30% 32%)` : `hsl(${hash} 50% 88%)`;
}

/** 解析 '16 / 9' 这类比例字符串为数值；解析失败回退 16/9 */
function parseRatio(r: string): number {
  const m = r.split('/').map((s) => Number(s.trim()));
  if (m.length === 2 && m[0] > 0 && m[1] > 0) return m[0] / m[1];
  return 16 / 9;
}

/**
 * 素材画廊（详情页 / 体检页共用）。
 * - 视频：单播放器 + 保存到手机
 * - 图片组：可左右切换的轮播 + 底部缩略图条 + 计数指示
 *
 * 取代原先详情页里两个 MediaPreview 并排（同一张封面渲染两遍）的问题，
 * 也去掉了原先左上角那个与素材无关的「创作者视角 / 管理员视角」角标。
 */
export default function MediaGallery({
  mediaType,
  images,
  videoUrl,
  title,
  showSave = true,
  aspectRatio = '16 / 9',
}: MediaGalleryProps) {
  const showToast = useToastStore((state) => state.show);
  const [index, setIndex] = useState(0);
  /**
   * 图片真实宽高比（naturalW / naturalH）。
   * 读到后用它替代传入的 aspectRatio，让框**贴合图片原始比例、不裁切**；
   * 读不到（mock 占位 / 加载中）才回退到传入比例。
   */
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  const isVideo = mediaType === 'video';
  const realVideo = isVideo && isRealMedia(videoUrl);
  const list = images.filter((u) => !!u);
  const safeIndex = list.length > 0 ? Math.min(index, list.length - 1) : 0;
  const current = list[safeIndex];
  const realCurrent = isRealMedia(current);

  /**
   * 可切换条件：图片类型 且 有 2 张以上素材。
   * 不要求素材是真实图片 —— mock 占位（mock: 前缀）同样要能切换，
   * 否则演示环境下「多图」能力完全看不见。
   */
  const switchable = !isVideo && list.length > 1;

  /** 每张图比例可能不同 → 切换时重置，等 onLoad 重新测量 */
  const resetNatural = () => setNatural(null);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    }
  };

  /**
   * 视频固定比例；图片读到真实比例则用真实比例。
   * 注意：这里**不能用 maxHeight** 去限高 —— 一旦限高，aspectRatio 会被打破，
   * 框就不再贴合原图比例（图片虽不裁切，但会左右留白）。
   * 改为按比例算出显式高度：宽度交给父级，高度 = 宽度 / 比例。
   */
  const effectiveRatio =
    !isVideo && natural && natural.h > 0
      ? natural.w / natural.h
      : parseRatio(aspectRatio);

  const handleSave = () => {
    const result = isVideo
      ? downloadMedia(videoUrl, `${title || 'video'}.mp4`)
      : downloadImage(current, `${title || 'cover'}.jpg`);
    showToast(
      result.success
        ? isVideo
          ? '已开始保存到手机'
          : '封面已保存'
        : '保存失败，请重试'
    );
  };

  const go = (delta: number) => {
    resetNatural();
    setIndex((i) => (i + delta + list.length) % list.length);
  };

  const containerRadius = '12px';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          // aspectRatio 让浏览器按比例算高度；maxHeight 只在极端长图时兜底，
          // 且用 min() 保证不超过上限同时仍尽量贴合比例。
          aspectRatio: effectiveRatio,
          // 上限放宽到 78vh：极长竖图（如 2:3 竖屏）在常见 1440/900px 视口下
          // 基本都能按原比例完整呈现，不留白、不裁切；再极端的长图才由上限兜底。
          maxHeight: '78vh',
          borderRadius: containerRadius,
          overflow: 'hidden',
          backgroundColor: realVideo || realCurrent ? COLORS.line : 'transparent',
        }}
      >
        {/* 视频播放器 */}
        {isVideo && realVideo && (
          <video
            src={videoUrl as string}
            controls
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        )}

        {/* 视频占位 */}
        {isVideo && !realVideo && (
          <Box
            sx={{
              width: '100%',
              height: '100%',
              background: tintFromTitle(title, true),
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.5,
              color: '#fff',
            }}
          >
            <PlayCircleOutlineIcon style={{ fontSize: 44, opacity: 0.92 }} />
            <Typography sx={{ fontSize: 13, fontWeight: 600, px: 1, textAlign: 'center' }}>
              {title}
            </Typography>
            <Typography sx={{ fontSize: 11, opacity: 0.8 }}>视频预览（mock 占位）</Typography>
          </Box>
        )}

        {/* 图片：真实媒体 —— contain 完整显示原图，不裁切 */}
        {!isVideo && realCurrent && (
          <Box
            component="img"
            src={current}
            alt={`${title}（第 ${safeIndex + 1} 张）`}
            onLoad={handleLoad}
            onError={resetNatural}
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        )}

        {/* 图片：占位 */}
        {!isVideo && !realCurrent && (
          <Box
            sx={{
              width: '100%',
              height: '100%',
              background: tintFromTitle(`${title}${safeIndex}`, false),
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              color: COLORS.ink,
              textAlign: 'center',
              p: 2,
            }}
          >
            <Typography sx={{ fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>
              {title}
            </Typography>
            {/* 占位图区分度：多图时标明是第几张，避免三张占位看起来一样 */}
            {switchable && (
              <Typography sx={{ fontSize: 11, color: COLORS.sub2 }}>
                图片占位 · 第 {safeIndex + 1} 张
              </Typography>
            )}
          </Box>
        )}

        {/* 左右切换 */}
        {switchable && (
          <>
            <GalleryArrow side="left" onClick={() => go(-1)} />
            <GalleryArrow side="right" onClick={() => go(1)} />
          </>
        )}

        {/* 计数指示（多图时） */}
        {switchable && (
          <Box
            sx={{
              position: 'absolute',
              right: 10,
              top: 10,
              zIndex: 2,
              backgroundColor: 'rgba(0,0,0,0.55)',
              color: '#fff',
              fontSize: 11,
              fontWeight: 600,
              px: '8px',
              py: '3px',
              borderRadius: '999px',
            }}
          >
            {safeIndex + 1} / {list.length}
          </Box>
        )}

        {/* 保存到手机浮层 */}
        {showSave && (
          <Box sx={{ position: 'absolute', right: 10, bottom: 10, zIndex: 2 }}>
            <SaveToPhoneBtn onClick={handleSave} />
          </Box>
        )}
      </Box>

      {/* 缩略图条（多图时） */}
      {switchable && (
        <Box className="flex gap-2" sx={{ overflowX: 'auto', pb: '2px' }}>
          {list.map((url, i) => {
            const real = isRealMedia(url);
            const active = i === safeIndex;
            return (
              <Box
                key={`${url}-${i}`}
                onClick={() => {
                  resetNatural();
                  setIndex(i);
                }}
                sx={{
                  flexShrink: 0,
                  // 手机端缩略图更大，方便手指点按切换
                  width: 72,
                  height: 72,
                  borderRadius: '8px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  background: real ? COLORS.line : tintFromTitle(`${title}${i}`, false),
                  border: active ? `2px solid ${COLORS.primary}` : `2px solid transparent`,
                  opacity: active ? 1 : 0.62,
                  transition: 'all .15s ease',
                  WebkitTapHighlightColor: 'transparent',
                  '&:hover': { opacity: 1 },
                  '&:active': { opacity: 1 },
                }}
              >
                {real && (
                  <Box
                    component="img"
                    src={url}
                    alt={`缩略图 ${i + 1}`}
                    sx={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      display: 'block',
                    }}
                  />
                )}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

/** 轮播左右箭头（半透明黑底圆形按钮） */
function GalleryArrow({
  side,
  onClick,
}: {
  side: 'left' | 'right';
  onClick: () => void;
}) {
  const isLeft = side === 'left';
  return (
    <Box
      component="button"
      type="button"
      aria-label={isLeft ? '上一张' : '下一张'}
      onClick={onClick}
      sx={{
        position: 'absolute',
        top: '50%',
        transform: 'translateY(-50%)',
        [isLeft ? 'left' : 'right']: 10,
        zIndex: 2,
        width: 36,
        height: 36,
        borderRadius: '50%',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        color: '#fff',
        // 扩大触摸热区到 44px（视觉仍为 36px 圆钮）
        minWidth: 44,
        minHeight: 44,
        WebkitTapHighlightColor: 'transparent',
        '&:hover': { backgroundColor: 'rgba(0,0,0,0.72)' },
        '&:active': { backgroundColor: 'rgba(0,0,0,0.85)' },
      }}
    >
      {isLeft ? (
        <NavigateBeforeIcon style={{ fontSize: 22 }} />
      ) : (
        <NavigateNextIcon style={{ fontSize: 22 }} />
      )}
    </Box>
  );
}