import type {
  HealthReport,
  HealthDimension,
  HealthDimensionKey,
  HealthCompliance,
  ComplianceLevel,
  MediaType,
  Platform,
} from '../types';

/**
 * 本地评分器（启发式，稳定非随机）。
 * 基于：标题利益点 / 文案长度 / 话题数 / 封面有无 → 四维度分。
 * 合规：交给 compliance.ts 规则引擎（高置信硬阻断 + 广告法极限词风险提示）。
 *
 * 架构 §8 待确认问题 #5 的默认建议：用本地函数让数据更真实，而非纯随机。
 */

import { checkCompliance } from './compliance';
import { generateLongTailWords } from './longTail';

const BENEFIT_WORDS = [
  '教程', '攻略', '如何', '秘籍', '推荐', '盘点', '必备', '分享', '测评',
  '避坑', '技巧', '方法', '合集', '清单', '干货', '速通', '实测', '对比',
  '搭配', '显瘦', '显高', '种草',
];

function clamp(value: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.round(value)));
}

function scoreTitle(title: string): number {
  const t = title.trim();
  const len = t.length;
  let score = 58;
  const hasBenefit = BENEFIT_WORDS.some((w) => t.includes(w));
  if (hasBenefit) score += 20;
  if (len >= 8 && len <= 26) score += 12;
  else if (len > 26) score += 4;
  else score -= 12;
  return clamp(score);
}

function scoreCopy(copy: string): number {
  const len = copy.trim().length;
  if (len >= 80) return 88;
  if (len >= 40) return 78;
  if (len >= 15) return 65;
  return 45;
}

function scoreTopics(tags: string[]): number {
  const n = tags.length;
  if (n >= 5) return 90;
  if (n >= 3) return 80;
  if (n === 2) return 65;
  if (n === 1) return 50;
  return 35;
}

function scoreCover(imageCount: number, mediaType: MediaType): number {
  if (imageCount <= 0) return 35;
  // 多图组图在小红书 / 抖音图文笔记里是加分项（信息量更足）
  const base = 70 + Math.min(imageCount, 6) * 2;
  return clamp(base + (mediaType === 'video' ? 6 : 4));
}

function levelOf(score: number): ComplianceLevel {
  if (score >= 80) return 'pass';
  if (score >= 60) return 'warn';
  return 'block';
}

function buildDimension(
  key: HealthDimensionKey,
  name: string,
  score: number,
  detail: string
): HealthDimension {
  return { key, name, score, level: levelOf(score), detail };
}

export interface ScoreInput {
  inspirationID: string;
  title: string;
  copy: string;
  tags: string[];
  mediaType: MediaType;
  images: string[];
  platform: Platform;
}

/**
 * 生成体检报告（稳定确定性）。上传即生成，提交审核前展示。
 */
export function generateReport(input: ScoreInput): HealthReport {
  const titleScore = scoreTitle(input.title);
  const copyScore = scoreCopy(input.copy);
  const topicsScore = scoreTopics(input.tags);
  const coverScore = scoreCover(input.images.length, input.mediaType);

  const dimensions: HealthDimension[] = [
    buildDimension('title', '标题吸引力', titleScore, detailFor('title', titleScore, input.title)),
    buildDimension('copy', '文案完整度', copyScore, detailFor('copy', copyScore, input.copy)),
    buildDimension('topics', '话题覆盖', topicsScore, detailFor('topics', topicsScore, input.tags.join(' '))),
    buildDimension('cover', '封面表现', coverScore, detailFor('cover', coverScore, input.images)),
  ];

  const totalScore = clamp(
    titleScore * 0.25 + copyScore * 0.3 + topicsScore * 0.2 + coverScore * 0.25
  );

  // 合规判定：规则引擎（高置信硬阻断 / 广告法极限词风险提示）
  const complianceResult = checkCompliance({
    title: input.title,
    copy: input.copy,
    tags: input.tags,
  });
  const overall = complianceResult.overall;

  // 合规 warn 优先于维度 warn：只要有风险提示就不是纯通过
  const compliance: HealthCompliance = {
    level:
      overall.level !== 'pass'
        ? overall.level
        : titleScore < 60 || copyScore < 60 || topicsScore < 60 || coverScore < 60
          ? 'warn'
          : 'pass',
    blockingReason: overall.blockingReason,
    hits: overall.hits,
  };

  // 长尾词建议：基于当前内容推导（品类/场景/人群/意图组合）
  const longTailSuggestions = generateLongTailWords({
    title: input.title,
    copy: input.copy,
    tags: input.tags,
  });

  return {
    id: `rpt_${input.inspirationID}`,
    inspirationID: input.inspirationID,
    totalScore,
    scoreLabel: '内部经验模型 · 非平台权威数据',
    dimensions,
    compliance,
    longTailWords: longTailSuggestions.map((s) => s.word),
    longTailDetails: longTailSuggestions,
    editableByCreator: true,
    generatedAt: new Date().toISOString(),
  };
}

function detailFor(
  kind: HealthDimensionKey,
  score: number,
  raw: string | string[]
): string {
  switch (kind) {
    case 'title':
      return score >= 80
        ? '标题含明确利益点，吸引力强'
        : score >= 60
          ? '标题平稳，建议补充利益点（如教程/实测）'
          : '标题偏短或缺乏利益点，吸引力不足';
    case 'copy':
      return score >= 80
        ? '文案信息充分，结构清晰'
        : score >= 60
          ? '文案结构尚可，建议补充细节'
          : `文案偏短（${(raw as string).trim().length} 字），信息不足`;
    case 'topics':
      return score >= 80
        ? '话题覆盖全面'
        : score >= 60
          ? '话题数量适中，建议补充长尾词'
          : '话题过少，建议补充 #话题 提升覆盖';
    case 'cover': {
      const imgs = raw as string[];
      if (score < 60) return '缺少封面或封面表现一般，建议优化';
      const n = imgs.length;
      if (n <= 1) return '封面主体突出，表现优秀';
      return `已上传 ${n} 张组图，封面主体突出`;
    }
    default:
      return '';
  }
}
