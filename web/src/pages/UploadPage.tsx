import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  TextField,
  Button,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import StarIcon from '@mui/icons-material/Star';
import { COLORS, TOUCH, LAYOUT } from '@/styles/tokens';
import type { InspirationDraft, MediaType, Platform } from '@/data/types';
import { useAppStore } from '@/store/useAppStore';
import { useToastStore } from '@/components/common/Toast';
import { useIsMobile } from '@/hooks/useBreakpoint';
import { apiMode } from '@/data/services/apiMode';
import { api as apiClient } from '@/data/services/apiClient';
import { generateReport } from '@/data/health/scorer';
import MediaPreview from '@/components/common/MediaPreview';
import CollectPanel from '@/components/inspiration/CollectPanel';
import ReportPanel from '@/components/inspiration/ReportPanel';
import { inspirationPath } from '@/router/paths';

/** 解析话题输入：按空白 / 逗号分隔，统一加 # 前缀 */
function parseTags(input: string): string[] {
  return input
    .split(/[\s,，、]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith('#') ? t : `#${t}`));
}

/** blob: URL → File（提交前上传到服务端用） */
async function blobToFile(url: string): Promise<File> {
  const res = await fetch(url);
  const blob = await res.blob();
  const ext = (blob.type.split('/')[1] ?? 'bin').split('+')[0];
  return new File([blob], `upload_${Date.now()}.${ext}`, { type: blob.type });
}

/**
 * 提交前把本地 blob: 媒体上传到服务端，返回可持久化的 URL。
 * 已经是 /media 服务端 URL 的（采集回填 / 编辑已有）原样保留。
 */
async function persistMedia(
  images: string[],
  videoUrl: string | null
): Promise<{ images: string[]; videoUrl: string | null }> {
  const blobImages = images.filter((u) => u.startsWith('blob:'));
  const needVideo = !!videoUrl && videoUrl.startsWith('blob:');
  if (blobImages.length === 0 && !needVideo) {
    return { images, videoUrl };
  }
  const files: File[] = [];
  for (const u of blobImages) files.push(await blobToFile(u));
  if (needVideo && videoUrl) files.push(await blobToFile(videoUrl));

  const { files: uploaded } = await apiClient.uploadFiles(files);

  let imgIdx = 0;
  const nextImages = images.map((u) => {
    if (!u.startsWith('blob:')) return u;
    // 按顺序消费返回的非视频 URL
    while (imgIdx < uploaded.length && uploaded[imgIdx].isVideo) imgIdx += 1;
    const f = uploaded[imgIdx];
    imgIdx += 1;
    return f ? f.url : u;
  });
  const nextVideo = needVideo
    ? uploaded.find((f) => f.isVideo)?.url ?? null
    : videoUrl;
  return { images: nextImages, videoUrl: nextVideo };
}

/**
 * 03 上传灵感（节点 2:220）。
 * 表单 + 本地预览(objectURL) + 即时体检报告 + 提交审核 / 保存草稿。
 * 编辑模式（/edit/:id）：预填，提交为「保存修改」（保留原状态）。
 * 不真正上传（D4 Deferred），提交即生成 mock 待审项进入审核台。
 */
export default function UploadPage() {
  const { id: editId } = useParams<{ id: string }>();
  const isEdit = !!editId;
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const inspirations = useAppStore((state) => state.inspirations);
  const addInspiration = useAppStore((state) => state.addInspiration);
  const editInspiration = useAppStore((state) => state.editInspiration);
  const showToast = useToastStore((state) => state.show);

  const [title, setTitle] = useState('');
  const [copy, setCopy] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [platform, setPlatform] = useState<Platform>('douyin');
  const [mediaType, setMediaType] = useState<MediaType>('video');
  const [images, setImages] = useState<string[]>([]);
  /** 各图真实宽高比（缩略图按原比例展示，不裁切、不变形） */
  const [imgNaturalRatio, setImgNaturalRatio] = useState<Record<string, number>>({});
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // 编辑模式：预填
  useEffect(() => {
    if (!editId) return;
    const target = inspirations.find((i) => i.id === editId);
    if (!target) return;
    setTitle(target.title);
    setCopy(target.copy);
    setTagsInput(target.tags.join(' '));
    setPlatform(target.platform);
    setMediaType(target.mediaType);
    setImages(target.images);
    setImgNaturalRatio({});
    setVideoUrl(target.videoUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const tags = useMemo(() => parseTags(tagsInput), [tagsInput]);

  const draft: InspirationDraft = useMemo(
    () => ({
      title,
      copy,
      tags,
      mediaType,
      images,
      videoUrl,
      platform,
    }),
    [title, copy, tags, mediaType, images, videoUrl, platform]
  );

  // 即时体检报告（本地启发式，稳定非随机）
  const report = useMemo(
    () =>
      generateReport({
        inspirationID: editId ?? 'draft',
        ...draft,
      }),
    [editId, draft]
  );

  const blocked = report.compliance.level === 'block';
  const canSubmit = title.trim().length > 0 && copy.trim().length > 0;

  /** 多图选择：追加而非覆盖，首张自动成为封面 */
  const handleImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setImages((prev) => [
      ...prev,
      ...files.map((f) => URL.createObjectURL(f)),
    ]);
    // 允许重复选同一文件
    e.target.value = '';
  };

  /** 删除某张图（删封面时自动补位） */
  const removeImage = (idx: number) => {
    setImages((prev) => {
      const target = prev[idx];
      if (target) {
        setImgNaturalRatio((r) => {
          const next = { ...r };
          delete next[target];
          return next;
        });
      }
      return prev.filter((_, i) => i !== idx);
    });
  };

  /** 设为封面 */
  const makeCover = (idx: number) => {
    setImages((prev) => {
      if (idx === 0) return prev;
      const next = [...prev];
      const [picked] = next.splice(idx, 1);
      return [picked, ...next];
    });
  };

  const handleVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setVideoUrl(URL.createObjectURL(file));
  };

  /**
   * 提交逻辑：
   * - 硬阻断只拦截「提交审核 / 保存修改」，**不拦截保存草稿**
   *   （草稿是创作者自己的半成品，不进入审核队列，允许带病保存）
   * - live 模式：先把本地 blob 媒体上传到服务端再提交
   */
  const handleSubmit = async (asDraft: boolean) => {
    if (!canSubmit) {
      showToast('请填写标题与文案');
      return;
    }
    if (blocked && !asDraft) {
      showToast('存在合规硬阻断，需修改后才能提交审核');
      return;
    }

    // live 模式：媒体先落服务端（灵感行里存可访问 URL，刷新不丢）
    let finalDraft = draft;
    if (apiMode() === 'live') {
      try {
        const persisted = await persistMedia(draft.images, draft.videoUrl);
        finalDraft = { ...draft, ...persisted };
        setImages(persisted.images);
        setVideoUrl(persisted.videoUrl);
      } catch (err) {
        showToast((err as Error).message || '媒体上传失败，请重试');
        return;
      }
    }

    if (isEdit && editId) {
      const before = inspirations.find((i) => i.id === editId);
      await editInspiration(editId, finalDraft);
      // 已通过 / 已驳回的内容被编辑后，后端会打回待审（内容变了结论就失效）
      if (before && (before.status === 'approved' || before.status === 'rejected')) {
        showToast('已保存修改，内容有变动需重新审核');
      } else {
        showToast('已保存修改');
      }
      navigate(inspirationPath(editId));
    } else {
      await addInspiration(finalDraft, { asDraft });
      showToast(asDraft ? '已存为草稿' : '已提交审核');
      navigate('/mine');
    }
  };

  return (
    <Box
      // 手机端底部有固定提交条 + 标签栏，需留白避免遮挡最后一块内容
      sx={
        isMobile
          ? {
              pb: `calc(${LAYOUT.mobileTabBarHeight}px + ${TOUCH.actionBarHeight}px + ${LAYOUT.safeAreaBottom} + 12px)`,
            }
          : undefined
      }
    >
      <Typography
        sx={{
          fontSize: isMobile ? 24 : 28,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          color: COLORS.ink,
          mb: 0.5,
        }}
      >
        {isEdit ? '编辑灵感' : '上传灵感'}
      </Typography>
      <Typography sx={{ fontSize: isMobile ? 12 : 13, color: COLORS.sub2, mb: 3 }}>
        {isEdit
          ? '修改内容后会重新生成体检报告；已通过 / 已驳回的内容将回到待审重新审核'
          : '填写素材后立即生成体检报告，提交后进入审核台'}
      </Typography>

      {/* 网络采集：粘贴分享文案自动预填（仅新建时提供，编辑已有内容无需采集） */}
      {!isEdit && (
        <CollectPanel
          onFilled={(d) => {
            if (d.title) setTitle(d.title);
            if (d.copy) setCopy((prev) => (prev ? `${prev}\n${d.copy}` : d.copy));
            if (d.tags.length > 0) {
              const existing = parseTags(tagsInput);
              setTagsInput(
                Array.from(new Set([...existing, ...d.tags])).join(' ')
              );
            }
            setMediaType(d.mediaType);
            setPlatform(d.platform);
            // 采集转存的真实素材（live 模式）直接进表单
            if (d.images && d.images.length > 0) {
              setImages(d.images);
              setImgNaturalRatio({});
            }
            if (d.videoUrl) setVideoUrl(d.videoUrl);
          }}
        />
      )}

      <Box
        className="grid gap-5"
        sx={{ gridTemplateColumns: { xs: '1fr', md: '1.1fr 1fr' } }}
      >
        {/* 左栏：表单 */}
        <Card elevation={0} sx={{ p: isMobile ? 2 : 2.5, borderRadius: '14px', border: `1px solid ${COLORS.line}`, backgroundColor: COLORS.surface }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 2.5 : 2 }}>
            <TextField
              label="灵感标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              fullWidth
              size="small"
              // 手机端输入框更高更好点，且 iOS 聚焦时应自动放大到 16px 字号
              inputProps={{ style: isMobile ? { fontSize: 16, minHeight: TOUCH.minTarget } : undefined }}
            />
            <TextField
              label="文案正文"
              value={copy}
              onChange={(e) => setCopy(e.target.value)}
              fullWidth
              size="small"
              multiline
              minRows={isMobile ? 5 : 4}
              inputProps={{ style: isMobile ? { fontSize: 16, lineHeight: 1.7 } : undefined }}
            />
            <TextField
              label="话题标签（空格 / 逗号分隔，自动加 #）"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              fullWidth
              size="small"
              placeholder="#穿搭 #夏日 #vlog"
              inputProps={{ style: isMobile ? { fontSize: 16, minHeight: TOUCH.minTarget } : undefined }}
            />

            <Box className="flex gap-2">
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>平台</InputLabel>
                <Select
                  label="平台"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as Platform)}
                >
                  <MenuItem value="douyin">抖音</MenuItem>
                  <MenuItem value="xiaohongshu">小红书</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>素材类型</InputLabel>
                <Select
                  label="素材类型"
                  value={mediaType}
                  onChange={(e) => setMediaType(e.target.value as MediaType)}
                >
                  <MenuItem value="video">视频</MenuItem>
                  <MenuItem value="image">图片</MenuItem>
                </Select>
              </FormControl>
            </Box>

            {/* 本地选图 / 选视频（不真正上传，D4 Deferred） */}
            <Box className="flex gap-2 flex-wrap items-center">
              <Button component="label" variant="outlined" sx={{ borderRadius: '999px', borderColor: COLORS.line, color: COLORS.sub1, minHeight: isMobile ? TOUCH.minTarget : undefined, px: isMobile ? 2.5 : undefined, transition: 'all .15s ease', '&:hover': { borderColor: COLORS.sub1, backgroundColor: COLORS.canvas }, '&:active': { transform: 'scale(0.98)' } }}>
                {images.length > 0 ? '继续添加图片' : '上传图片'}
                <input
                  hidden
                  multiple
                  accept="image/*"
                  type="file"
                  onChange={handleImages}
                />
              </Button>
              {mediaType === 'video' && (
              <Button component="label" variant="outlined" sx={{ borderRadius: '999px', borderColor: COLORS.line, color: COLORS.sub1, minHeight: isMobile ? TOUCH.minTarget : undefined, px: isMobile ? 2.5 : undefined, transition: 'all .15s ease', '&:hover': { borderColor: COLORS.sub1, backgroundColor: COLORS.canvas }, '&:active': { transform: 'scale(0.98)' } }}>
                上传视频
                  <input
                    hidden
                    accept="video/*"
                    type="file"
                    onChange={handleVideo}
                  />
                </Button>
              )}
              {images.length > 0 && (
                <Typography sx={{ fontSize: 12, color: COLORS.sub3 }}>
                  已选 {images.length} 张 · 首张为封面
                </Typography>
              )}
            </Box>

            {/* 图片组缩略图管理（删除 / 设为封面） */}
            {images.length > 0 && (
              <Box className="flex gap-2 flex-wrap items-start">
                {images.map((url, idx) => (
                  <Box
                    key={`${url}-${idx}`}
                    sx={{
                      position: 'relative',
                      // 手机端缩略图更大，方便手指点按
                      width: isMobile ? 96 : 84,
                      // 缩略图按原图比例展示，不裁切：竖图高一些、方图方形、横图扁一些
                      height: 'auto',
                      aspectRatio: imgNaturalRatio[url] ? String(imgNaturalRatio[url]) : '3 / 4',
                      maxHeight: isMobile ? 160 : 140,
                      borderRadius: '10px',
                      overflow: 'hidden',
                      border: idx === 0 ? `2px solid ${COLORS.primary}` : `1px solid ${COLORS.line}`,
                      backgroundColor: COLORS.canvas,
                    }}
                  >
                    <Box
                      component="img"
                      src={url}
                      alt={`图片 ${idx + 1}`}
                      onLoad={(e) => {
                        const img = e.currentTarget;
                        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                          setImgNaturalRatio((prev) => ({
                            ...prev,
                            [url]: img.naturalWidth / img.naturalHeight,
                          }));
                        }
                      }}
                      sx={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                    />
                    {idx === 0 && (
                      <Box
                        sx={{
                          position: 'absolute',
                          left: 0,
                          bottom: 0,
                          right: 0,
                          backgroundColor: COLORS.primary,
                          color: '#fff',
                          fontSize: 10,
                          fontWeight: 700,
                          textAlign: 'center',
                          py: '2px',
                        }}
                      >
                        封面
                      </Box>
                    )}
                    {/* 设为封面 */}
                    {idx !== 0 && (
                      <IconButton
                        aria-label="设为封面"
                        onClick={() => makeCover(idx)}
                        sx={{
                          position: 'absolute',
                          top: 2,
                          left: 2,
                          // 触摸目标 ≥ 44px（HIG），视觉用小图标居中
                          width: TOUCH.minTarget,
                          height: TOUCH.minTarget,
                          backgroundColor: 'rgba(0,0,0,0.45)',
                          color: '#fff',
                          '&:hover': { backgroundColor: 'rgba(0,0,0,0.7)' },
                          '&:active': { backgroundColor: 'rgba(0,0,0,0.85)' },
                        }}
                      >
                        <StarIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    )}
                    {/* 删除 */}
                    <IconButton
                      aria-label="删除该图片"
                      onClick={() => removeImage(idx)}
                      sx={{
                        position: 'absolute',
                        top: 2,
                        right: 2,
                        width: TOUCH.minTarget,
                        height: TOUCH.minTarget,
                        backgroundColor: 'rgba(0,0,0,0.45)',
                        color: '#fff',
                        '&:hover': { backgroundColor: 'rgba(239,68,68,0.85)' },
                        '&:active': { backgroundColor: COLORS.status.reject },
                      }}
                    >
                      <CloseIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            )}

            {/* 预览 */}
            {(images.length > 0 || videoUrl) && (
              <MediaPreview
                mediaType={mediaType}
                images={images}
                videoUrl={videoUrl}
                title={title || '预览'}
                showSave={false}
                aspectRatio={mediaType === 'video' ? '16 / 9' : '4 / 3'}
              />
            )}

            {/* 提交区 */}
            <Box className="flex gap-2" sx={{ mt: 1 }}>
              {isEdit ? (
                <Button
                  variant="contained"
                  onClick={() => void handleSubmit(false)}
                  sx={{ flex: 1, borderRadius: '999px', transition: 'all .15s ease', '&:active': { transform: 'scale(0.98)' } }}
                >
                  保存修改
                </Button>
              ) : (
                <>
                  <Button
                    variant="contained"
                    onClick={() => void handleSubmit(false)}
                    disabled={!canSubmit || blocked}
                    sx={{ flex: 1, borderRadius: '999px', transition: 'all .15s ease', '&:active': { transform: 'scale(0.98)' } }}
                  >
                    提交审核
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => void handleSubmit(true)}
                    disabled={!canSubmit}
                    sx={{ borderRadius: '999px', borderColor: COLORS.line, color: COLORS.sub1, transition: 'all .15s ease', '&:hover': { borderColor: COLORS.sub1, backgroundColor: COLORS.canvas }, '&:active': { transform: 'scale(0.98)' } }}
                  >
                    保存草稿
                  </Button>
                </>
              )}
            </Box>
            {blocked && (
              <Box
                sx={{
                  p: '10px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(239,68,68,0.07)',
                  border: `1px solid rgba(239,68,68,0.25)`,
                }}
              >
                <Typography sx={{ fontSize: 12, color: COLORS.status.reject, lineHeight: 1.5 }}>
                  红 = 硬阻断，暂不能提交审核：{report.compliance.blockingReason}
                </Typography>
                {!isEdit && (
                  <Typography sx={{ fontSize: 11, color: COLORS.sub2, mt: '4px', lineHeight: 1.5 }}>
                    可以先「保存草稿」——草稿只有你自己可见，不进入审核队列，改完再提交。
                  </Typography>
                )}
              </Box>
            )}
            {blocked && isEdit && (
              <Typography sx={{ fontSize: 12, color: COLORS.sub2 }}>
                当前内容仍有硬阻断，保存后会保持原审核状态，不会重新进入审核队列。
              </Typography>
            )}
          </Box>
        </Card>

        {/* 右栏：即时体检报告 */}
        <ReportPanel report={report} title="体检报告（即时）" />
      </Box>

      {/* 手机端：底部固定提交条 —— 表单很长，滚动到底才能看到提交按钮
          是移动端最常见的「表单劝退」点。固定在拇指热区随时可提交。 */}
      {isMobile && (
        <Box
          sx={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: `calc(${LAYOUT.mobileTabBarHeight}px + ${LAYOUT.safeAreaBottom})`,
            zIndex: 1100,
            padding: '10px 12px',
            backgroundColor: COLORS.surface,
            borderTop: `1px solid ${COLORS.line}`,
          }}
        >
          <Box className="flex gap-2">
            {isEdit ? (
              <Button
                variant="contained"
                onClick={() => void handleSubmit(false)}
                sx={{ flex: 1, minHeight: TOUCH.minTarget, borderRadius: '999px' }}
              >
                保存修改
              </Button>
            ) : (
              <>
                <Button
                  variant="contained"
                  onClick={() => void handleSubmit(false)}
                  disabled={!canSubmit || blocked}
                  sx={{ flex: 2, minHeight: TOUCH.minTarget, borderRadius: '999px' }}
                >
                  提交审核
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => void handleSubmit(true)}
                  disabled={!canSubmit}
                  sx={{
                    flex: 1,
                    minHeight: TOUCH.minTarget,
                    borderRadius: '999px',
                    borderColor: COLORS.line,
                    color: COLORS.sub1,
                  }}
                >
                  保存草稿
                </Button>
              </>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}
