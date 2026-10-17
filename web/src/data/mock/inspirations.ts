import type { Inspiration } from '../types';
import type { InspirationSeed } from './seedData';
import { SEEDS } from './seedData';
import { STATUS_TEXT } from '@/styles/tokens';
import { MOCK_REPORTS } from './reports';

/**
 * 灵感种子数据（前端 mock 模式）。
 * healthScore / healthBreakdown / compliance / longTailWords 全部由
 * MOCK_REPORTS 派生，保证与体检报告一致。
 *
 * 封面 / 视频 URL 使用 `mock:` 前缀占位（运行时 MediaPreview 渲染渐变占位，不依赖真实文件）；
 * 上传页本地预览使用 `blob:` URL（真实可下载）。
 *
 * SEEDS 纯数据已抽到 seedData.ts（与后端 seed 共用同一份内容）。
 */

function buildInspiration(seed: InspirationSeed): Inspiration {
  const report = MOCK_REPORTS[seed.id];
  if (!report) {
    throw new Error(`Missing mock report for inspiration ${seed.id}`);
  }
  const scoreOf = (key: 'title' | 'copy' | 'topics' | 'cover'): number =>
    report.dimensions.find((d) => d.key === key)?.score ?? 0;

  return {
    id: seed.id,
    creatorID: seed.creatorID,
    creatorName: seed.creatorName,
    title: seed.title,
    copy: seed.copy,
    tags: seed.tags,
    mediaType: seed.mediaType,
    images: seed.images,
    videoUrl: seed.videoUrl,
    platform: seed.platform,
    status: seed.status,
    healthScore: report.totalScore,
    healthBreakdown: {
      title: scoreOf('title'),
      copy: scoreOf('copy'),
      topics: scoreOf('topics'),
      cover: scoreOf('cover'),
    },
    compliance: report.compliance.level,
    longTailWords: report.longTailWords,
    isFavorite: seed.isFavorite,
    createdAt: seed.createdAt,
    updatedAt: seed.updatedAt,
    auditStatusText:
      seed.status === 'approved' ? STATUS_TEXT.approved : undefined,
  };
}

/** 灵感种子（已派生 health 字段） */
export const MOCK_INSPIRATIONS: Inspiration[] = SEEDS.map(buildInspiration);
