import { useState } from 'react';
import { Box, Typography } from '@mui/material';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import { COLORS } from '@/styles/tokens';
import type { MediaType } from '@/data/types';
import { useToastStore } from '@/components/common/Toast';
import { downloadMedia, downloadImage } from '@/utils/download';
import SaveToPhoneBtn from './SaveToPhoneBtn';

interface MediaPreviewProps {
  mediaType: MediaType;
  /** 图片素材（images[0] 为封面） */
  images: string[];
  videoUrl: string | null;
  title: string;
  /** 是否显示「保存到手机」浮层（默认 true） */
  showSave?: boolean;
  /** 容器宽高比，如 '16 / 9' | '4 / 3' */
  aspectRatio?: string;
}

/** 判断是否为可真实加载的媒体（blob:/http/data:/服务端 /media 路径），否则渲染平涂占位 */
function isRealMedia(url: string | null | undefined): url is string {
  return (
    !!url &&
    (url.startsWith('blob:') ||
      url.startsWith('http') ||
      url.startsWith('data:') ||
      url.startsWith('/media/'))
  );
}

/** 解析 '16 / 9' 这类比例字符串为数值；解析失败回退 16/9 */
function parseRatio(r: string): number {
  const m = r.split('/').map((s) => Number(s.trim()));
  if (m.length === 2 && m[0] > 0 && m[1] > 0) return m[0] / m[1];
  return 16 / 9;
}

/** 由标题派生稳定平涂底色（占位封面 / 视频用，无渐变） */
function tintFromTitle(title: string, dark = false): string {
  let hash = 0;
  for (let i = 0; i < title.length; i += 1) {
    hash = (hash * 31 + title.charCodeAt(i)) % 360;
  }
  return dark ? `hsl(${hash} 30% 32%)` : `hsl(${hash} 50% 88%)`;
}

/**
 * 单张素材预览（上传页实时预览用，只展示 images[0] 封面）。
 * 详情页 / 体检页的多图轮播请用 MediaGallery。
 */
export default function MediaPreview({
  mediaType,
  images,
  videoUrl,
  title,
  showSave = true,
  aspectRatio = '16 / 9',
}: MediaPreviewProps) {
  const showToast = useToastStore((state) => state.show);
  /** 图片真实宽高比：读到后贴合原图比例，不裁切；读不到回退传入比例 */
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  const isVideo = mediaType === 'video';
  const realVideo = isVideo && isRealMedia(videoUrl);
  const current = images[0];
  const realCover = isRealMedia(current);
  const placeholder = !realVideo && !realCover;

  const effectiveRatio =
    !isVideo && natural && natural.h > 0
      ? natural.w / natural.h
      : parseRatio(aspectRatio);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    }
  };

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

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        aspectRatio: effectiveRatio,
        maxHeight: '72vh',
        borderRadius: '12px',
        overflow: 'hidden',
        backgroundColor: placeholder ? 'transparent' : COLORS.line,
      }}
    >
      {isVideo && realVideo && (
        <video
          src={videoUrl as string}
          controls
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )}

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
          <Typography sx={{ fontSize: 11, opacity: 0.8 }}>
            视频预览（mock 占位）
          </Typography>
        </Box>
      )}

      {!isVideo && realCover && (
        <Box
          component="img"
          src={current}
          alt={title}
          onLoad={handleLoad}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
          }}
        />
      )}

      {!isVideo && !realCover && (
        <Box
          sx={{
            width: '100%',
            height: '100%',
            background: tintFromTitle(title, false),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: COLORS.ink,
            fontSize: 13,
            fontWeight: 600,
            px: 1,
            textAlign: 'center',
          }}
        >
          {title}
        </Box>
      )}

      {/* 保存到手机浮层（右下，半透明黑底） */}
      {showSave && (
        <Box
          sx={{
            position: 'absolute',
            right: 10,
            bottom: 10,
            zIndex: 2,
          }}
        >
          <SaveToPhoneBtn onClick={handleSave} />
        </Box>
      )}
    </Box>
  );
}