import { Box, Typography } from '@mui/material';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import { COLORS } from '@/styles/tokens';
import type { MediaType } from '@/data/types';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToastStore } from '@/components/common/Toast';
import { downloadMedia, downloadImage } from '@/utils/download';
import SaveToPhoneBtn from './SaveToPhoneBtn';

interface MediaPreviewProps {
  mediaType: MediaType;
  coverImage: string;
  videoUrl: string | null;
  title: string;
  /** 是否显示「保存到手机」浮层（默认 true） */
  showSave?: boolean;
  /** 容器宽高比，如 '16 / 9' | '4 / 3' */
  aspectRatio?: string;
}

/** 判断是否为可真实加载的媒体（blob:/http/data:），否则渲染渐变占位 */
function isRealMedia(url: string | null | undefined): url is string {
  return (
    !!url &&
    (url.startsWith('blob:') ||
      url.startsWith('http') ||
      url.startsWith('data:'))
  );
}

/** 由标题派生稳定渐变色（占位封面 / 视频用） */
function gradientFromTitle(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i += 1) {
    hash = (hash * 31 + title.charCodeAt(i)) % 360;
  }
  const h1 = hash;
  const h2 = (hash + 40) % 360;
  return `linear-gradient(135deg, hsl(${h1} 70% 72%), hsl(${h2} 70% 60%))`;
}

/**
 * 视频 / 封面预览 + 「保存到手机」浮层（节点 2:154 / 2:161）。
 * 真实资源（blob: 本地预览）直接播放 / 显示；mock 占位渲染渐变 + 标题。
 */
export default function MediaPreview({
  mediaType,
  coverImage,
  videoUrl,
  title,
  showSave = true,
  aspectRatio = '16 / 9',
}: MediaPreviewProps) {
  const { currentUser } = useCurrentUser();
  const showToast = useToastStore((state) => state.show);
  const isVideo = mediaType === 'video';
  const realVideo = isVideo && isRealMedia(videoUrl);
  const realCover = isRealMedia(coverImage);
  const placeholder = !realVideo && !realCover;

  const handleSave = () => {
    const result = isVideo
      ? downloadMedia(videoUrl, `${title || 'video'}.mp4`)
      : downloadImage(coverImage, `${title || 'cover'}.jpg`);
    showToast(
      result.success
        ? isVideo
          ? '已开始保存到手机'
          : '封面已保存'
        : '保存失败，请重试'
    );
  };

  const gradient = gradientFromTitle(title);

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        aspectRatio,
        borderRadius: 1.5,
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
            background: gradient,
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
          src={coverImage}
          alt={title}
          sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )}

      {!isVideo && !realCover && (
        <Box
          sx={{
            width: '100%',
            height: '100%',
            background: gradient,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
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

      {/* 平台角标（小字提示，非必需） */}
      <Box
        sx={{
          position: 'absolute',
          left: 10,
          top: 10,
          zIndex: 1,
          backgroundColor: 'rgba(0,0,0,0.45)',
          color: '#fff',
          fontSize: 10,
          fontWeight: 600,
          px: 0.75,
          py: 0.25,
          borderRadius: 1,
        }}
      >
        {currentUser.role === 'admin' ? '管理员' : '创作者'}视角
      </Box>
    </Box>
  );
}
