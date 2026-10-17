import { useState } from 'react';
import { Box, Card, Typography, TextField, Button, Chip, IconButton } from '@mui/material';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { COLORS, TOUCH } from '@/styles/tokens';
import {
  collectFromShareText,
  PLATFORM_INFO,
  type CollectResponse,
} from '@/data/services/collectService';
import { useToastStore } from '@/components/common/Toast';

interface CollectPanelProps {
  /** 采集成功后把内容回填到表单 */
  onFilled: (data: {
    title: string;
    copy: string;
    tags: string[];
    mediaType: 'image' | 'video';
    platform: 'douyin' | 'xiaohongshu';
    /** 采集转存的图片 URL（live 模式真实图片） */
    images?: string[];
    /** 采集转存的视频 URL */
    videoUrl?: string | null;
  }) => void;
}

/**
 * 网络采集面板 —— 粘贴分享文案，自动预填灵感内容。
 *
 * 设计取舍（重要，不是实现偷懒）：
 * 小红书的分享文案本身就是链接载体，短链 + 标题 + #话题能可靠解析出来，
 * 这部分**真实可用**。但正文与图片列表是 JS 运行时渲染 / 需签名接口，
 * 纯前端拿不到 —— 所以这里如实展示「已提取 / 需补全」的边界，
 * 而不是编造内容假装采集成功。视频转存由后端完成（yt-dlp + ffmpeg）。
 *
 * 采集来源（2026-10 起）：小红书 / Instagram / YouTube。
 * 抖音 / TikTok 已下线 —— 其取流接口需登录态 cookie，长期 403。
 */
export default function CollectPanel({ onFilled }: CollectPanelProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CollectResponse | null>(null);
  const showToast = useToastStore((state) => state.show);

  const handleCollect = async () => {
    if (!text.trim()) {
      showToast('请粘贴分享文案');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const r = await collectFromShareText(text);
      setResult(r);
    } finally {
      setLoading(false);
    }
  };

  const handleFill = () => {
    if (!result || !result.ok) return;
    onFilled({
      title: result.title,
      copy: result.copy,
      tags: result.tags,
      mediaType: result.mediaType,
      platform: result.targetPlatform,
      images: result.images,
      videoUrl: result.videoUrl,
    });
    showToast('已回填到表单，可继续编辑补充');
    setOpen(false);
  };

  return (
    <Card
      elevation={0}
      sx={{
        p: 2,
        borderRadius: '14px',
        border: `1px solid ${COLORS.line}`,
        backgroundColor: COLORS.surface,
        mb: 2.5,
      }}
    >
      {/* 收起态：一行入口 */}
      {!open && (
        <Box
          className="flex items-center justify-between"
          sx={{ gap: 1.5 }}
        >
          <Box className="flex items-center gap-2" sx={{ minWidth: 0 }}>
            <Box
              sx={{
                width: 30,
                height: 30,
                borderRadius: '9px',
                backgroundColor: 'rgba(59,130,246,0.10)',
                color: COLORS.primary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <LinkOutlinedIcon style={{ fontSize: 17 }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: COLORS.ink }}>
                从分享链接快速采集
              </Typography>
              <Typography sx={{ fontSize: 11, color: COLORS.sub3 }}>
                支持抖音 / 小红书 / TikTok / Instagram / YouTube
              </Typography>
            </Box>
          </Box>
          <Button
            size="small"
            endIcon={<AutoAwesomeIcon style={{ fontSize: 15 }} />}
            onClick={() => setOpen(true)}
            sx={{
              borderRadius: '999px',
              color: COLORS.primary,
              flexShrink: 0,
              minHeight: 34,
              whiteSpace: 'nowrap',
            }}
          >
            采集
          </Button>
        </Box>
      )}

      {/* 展开态 */}
      {open && (
        <Box>
          <Box className="flex items-center justify-between" sx={{ mb: 1.5 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: COLORS.ink }}>
              从分享链接采集
            </Typography>
            <IconButton
              onClick={() => {
                setOpen(false);
                setResult(null);
              }}
              aria-label="关闭采集面板"
              sx={{
                width: TOUCH.minTarget,
                height: TOUCH.minTarget,
                color: COLORS.sub3,
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>

          <Typography sx={{ fontSize: 11, color: COLORS.sub3, mb: 1.25, lineHeight: 1.6 }}>
            粘贴平台「分享」得到的<strong>整段文案</strong>（含链接）。小红书的分享文案不是纯网址，直接粘链接会识别失败。
          </Typography>

          <TextField
            fullWidth
            multiline
            minRows={3}
            size="small"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'31 【小个子显高穿搭 - 小鹿 | 小红书 - 你的生活指南】 xhslink.com/a/xxxxx 复制本条信息，打开【小红书】App查看精彩内容！'}
            inputProps={{ style: { fontSize: 12, lineHeight: 1.6 } }}
            sx={{ mb: 1.25 }}
          />

          <Box className="flex items-center gap-2">
            <Button
              variant="contained"
              onClick={() => void handleCollect()}
              disabled={loading || !text.trim()}
              startIcon={<AutoAwesomeIcon style={{ fontSize: 16 }} />}
              sx={{
                borderRadius: '999px',
                minHeight: TOUCH.buttonHeight,
              }}
            >
              {loading ? '识别中…' : '识别链接'}
            </Button>
            <Button
              size="small"
              onClick={() => {
                setText('');
                setResult(null);
              }}
              sx={{ color: COLORS.sub3, minHeight: TOUCH.buttonHeight }}
            >
              清空
            </Button>
          </Box>

          {/* 采集结果 */}
          {result && (
            <Box sx={{ mt: 2 }}>
              {result.ok ? (
                <>
                  {/* 平台识别 */}
                  <Box
                    className="flex items-center gap-1.5"
                    sx={{ mb: 1.25, flexWrap: 'wrap' }}
                  >
                    <Chip
                      label={result.platformLabel}
                      size="small"
                      sx={{
                        backgroundColor: 'rgba(59,130,246,0.10)',
                        color: COLORS.primary,
                        fontWeight: 700,
                        fontSize: 11,
                      }}
                    />
                    <Chip
                      label={`完整度 ${result.completeness === 'full' ? '完整' : '部分'}`}
                      size="small"
                      sx={{
                        backgroundColor:
                          result.completeness === 'full'
                            ? 'rgba(5,150,105,0.10)'
                            : 'rgba(245,158,11,0.14)',
                        color:
                          result.completeness === 'full'
                            ? COLORS.status.pass
                            : COLORS.status['warn-deep'],
                        fontWeight: 600,
                        fontSize: 11,
                      }}
                    />
                  </Box>

                  {/* 提取到的字段 */}
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: '10px',
                      backgroundColor: COLORS.canvas,
                      border: `1px solid ${COLORS.line}`,
                      mb: 1.25,
                    }}
                  >
                    <Field label="标题" value={result.title} />
                    {result.authorName && (
                      <Field label="作者" value={result.authorName} />
                    )}
                    <Field label="正文" value={result.copy} />
                    <Box className="flex items-start gap-2" sx={{ mt: 0.75 }}>
                      <Typography sx={{ fontSize: 11, color: COLORS.sub3, minWidth: 28, flexShrink: 0 }}>
                        话题
                      </Typography>
                      <Box className="flex flex-wrap gap-1">
                        {result.tags.length > 0 ? (
                          result.tags.map((t) => (
                            <Chip
                              key={t}
                              label={t}
                              size="small"
                              sx={{ fontSize: 11, height: 20 }}
                            />
                          ))
                        ) : (
                          <Typography sx={{ fontSize: 12, color: COLORS.sub3 }}>
                            未识别到
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </Box>

                  {/* 缺口说明：诚实告知 */}
                  {result.note && (
                    <Typography
                      sx={{
                        fontSize: 11,
                        color: COLORS.sub2,
                        lineHeight: 1.6,
                        mb: 1.25,
                      }}
                    >
                      {result.note}
                    </Typography>
                  )}

                  {/* 采集到的素材预览（live 模式真实图片 / 视频） */}
                  {(result.images?.length || result.videoUrl) && (
                    <Box sx={{ mb: 1.25 }}>
                      <Typography sx={{ fontSize: 11, color: COLORS.sub3, mb: 0.75 }}>
                        采集到的素材（已转存到服务端）
                      </Typography>
                      <Box className="flex gap-1.5" sx={{ overflowX: 'auto', pb: 0.5 }}>
                        {result.images?.map((url, i) => (
                          <Box
                            key={url}
                            component="img"
                            src={url}
                            alt={`素材 ${i + 1}`}
                            sx={{
                              width: 64,
                              height: 64,
                              objectFit: 'cover',
                              borderRadius: '8px',
                              border: `1px solid ${COLORS.line}`,
                              flexShrink: 0,
                            }}
                          />
                        ))}
                        {result.videoUrl && (
                          <Box
                            sx={{
                              width: 64,
                              height: 64,
                              borderRadius: '8px',
                              backgroundColor: 'rgba(59,130,246,0.10)',
                              color: COLORS.primary,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 11,
                              fontWeight: 600,
                              flexShrink: 0,
                            }}
                          >
                            视频
                          </Box>
                        )}
                      </Box>
                    </Box>
                  )}

                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<CheckCircleOutlineIcon />}
                    onClick={handleFill}
                    disabled={!result.title && !result.copy}
                    sx={{ borderRadius: '999px', minHeight: TOUCH.buttonHeight }}
                  >
                    回填到表单并继续编辑
                  </Button>
                </>
              ) : (
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: '10px',
                    backgroundColor: 'rgba(239,68,68,0.07)',
                    border: `1px solid rgba(239,68,68,0.25)`,
                  }}
                >
                  <Typography sx={{ fontSize: 12, color: COLORS.status.reject, lineHeight: 1.6 }}>
                    {result.message}
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </Box>
      )}
    </Card>
  );
}

/** 只读字段展示 */
function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <Box className="flex items-start gap-2" sx={{ mb: 0.75 }}>
      <Typography sx={{ fontSize: 11, color: COLORS.sub3, minWidth: 28, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography
        sx={{ fontSize: 12, color: COLORS.sub1, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
      >
        {value}
      </Typography>
    </Box>
  );
}

/** 平台信息（面板内展示支持的平台标签） */
export { PLATFORM_INFO };