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
} from '@mui/material';
import { COLORS } from '@/styles/tokens';
import type { InspirationDraft, MediaType, Platform } from '@/data/types';
import { useAppStore } from '@/store/useAppStore';
import { useToastStore } from '@/components/common/Toast';
import { generateReport } from '@/data/health/scorer';
import MediaPreview from '@/components/common/MediaPreview';
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

/**
 * 03 上传灵感（节点 2:220）。
 * 表单 + 本地预览(objectURL) + 即时体检报告 + 提交审核 / 保存草稿。
 * 编辑模式（/edit/:id）：预填，提交为「保存修改」（保留原状态）。
 * 不真正上传（D4 Deferred），提交即生成 mock 待审项进入审核台。
 */
export default function UploadPage() {
  const { id: editId } = useParams<{ id: string }>();
  const isEdit = !!editId;
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
  const [coverImage, setCoverImage] = useState('');
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
    setCoverImage(target.coverImage);
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
      coverImage,
      videoUrl,
      platform,
    }),
    [title, copy, tags, mediaType, coverImage, videoUrl, platform]
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

  const handleCover = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setCoverImage(URL.createObjectURL(file));
  };
  const handleVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setVideoUrl(URL.createObjectURL(file));
  };

  const handleSubmit = async (asDraft: boolean) => {
    if (!canSubmit) {
      showToast('请填写标题与文案');
      return;
    }
    if (blocked) {
      showToast('存在合规硬阻断，需修改后提交');
      return;
    }
    if (isEdit && editId) {
      await editInspiration(editId, draft);
      showToast('已保存修改');
      navigate(inspirationPath(editId));
    } else {
      await addInspiration(draft);
      showToast(asDraft ? '已存为草稿' : '已提交审核');
      navigate('/mine');
    }
  };

  return (
    <Box>
      <Typography sx={{ fontSize: 22, fontWeight: 700, color: COLORS.ink, mb: 0.5 }}>
        {isEdit ? '编辑灵感' : '上传灵感'}
      </Typography>
      <Typography sx={{ fontSize: 13, color: COLORS.sub2, mb: 3 }}>
        {isEdit
          ? '修改内容后会重新生成体检报告，保留原审核状态'
          : '填写素材后立即生成体检报告，提交后进入审核台'}
      </Typography>

      <Box
        className="grid gap-5"
        sx={{ gridTemplateColumns: { xs: '1fr', md: '1.1fr 1fr' } }}
      >
        {/* 左栏：表单 */}
        <Card sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="灵感标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              fullWidth
              size="small"
            />
            <TextField
              label="文案正文"
              value={copy}
              onChange={(e) => setCopy(e.target.value)}
              fullWidth
              size="small"
              multiline
              minRows={4}
            />
            <TextField
              label="话题标签（空格 / 逗号分隔，自动加 #）"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              fullWidth
              size="small"
              placeholder="#穿搭 #夏日 #vlog"
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
            <Box className="flex gap-2 flex-wrap">
              <Button component="label" variant="outlined" sx={{ borderRadius: 2 }}>
                上传封面
                <input
                  hidden
                  accept="image/*"
                  type="file"
                  onChange={handleCover}
                />
              </Button>
              {mediaType === 'video' && (
                <Button component="label" variant="outlined" sx={{ borderRadius: 2 }}>
                  上传视频
                  <input
                    hidden
                    accept="video/*"
                    type="file"
                    onChange={handleVideo}
                  />
                </Button>
              )}
            </Box>

            {/* 预览 */}
            {(coverImage || videoUrl) && (
              <MediaPreview
                mediaType={mediaType}
                coverImage={coverImage}
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
                  sx={{ flex: 1, borderRadius: 2 }}
                >
                  保存修改
                </Button>
              ) : (
                <>
                  <Button
                    variant="contained"
                    onClick={() => void handleSubmit(false)}
                    disabled={!canSubmit || blocked}
                    sx={{ flex: 1, borderRadius: 2 }}
                  >
                    提交审核
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => void handleSubmit(true)}
                    disabled={!canSubmit}
                    sx={{ borderRadius: 2, borderColor: COLORS.line, color: COLORS.sub1 }}
                  >
                    保存草稿
                  </Button>
                </>
              )}
            </Box>
            {blocked && (
              <Typography sx={{ fontSize: 12, color: COLORS.status.reject }}>
                红 = 硬阻断，不可提交：{report.compliance.blockingReason}
              </Typography>
            )}
          </Box>
        </Card>

        {/* 右栏：即时体检报告 */}
        <ReportPanel report={report} title="体检报告（即时）" />
      </Box>
    </Box>
  );
}
