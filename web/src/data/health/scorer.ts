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
 * 合规：敏感词命中 → 硬阻断(block)；否则任意维度 < 60 → 风险(warn)；否则通过(pass)。
 *
 * 架构 §8 待确认问题 #5 的默认建议：用本地函数让数据更真实，而非纯随机。
 */

const BENEFIT_WORDS = [
  '教程', '攻略', '如何', '秘籍', '推荐', '盘点', '必备', '分享', '测评',
  '避坑', '技巧', '方法', '合集', '清单', '干货', '速通', '实测', '对比',
  '搭配', '显瘦', '显高', '种草',
];

/** 广告法 / 平台敏感词（命中即硬阻断） */
const SENSITIVE_WORDS = [
  '最', '第一', '国家级', '唯一', '绝对', '百分百', '限时', '点击链接',
  '二维码', '秒杀', '最低价', '史上', ' guaranteed', '代购', '加微信', '微信',
  '联系方式', '私聊',
];

const LONG_TAIL_POOL_HIGH = ['爆款标题公式', '高转化文案', '封面构图'];
const LONG_TAIL_POOL_LOW = [
  '夏日穿搭小个子', '通勤穿搭显高', '基础款叠穿', '梨形身材穿搭',
  '平价好物', '学生党必备', '显瘦神裤', '氛围感拍照',
];

function clamp(value: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.round(value)));
}

function findSensitive(text: string): string | null {
  const lower = text.toLowerCase();
  for (const word of SENSITIVE_WORDS) {
    if (lower.includes(word.toLowerCase())) return word;
  }
  return null;
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

function scoreCover(hasCover: boolean, mediaType: MediaType): number {
  if (!hasCover) return 35;
  return clamp(74 + (mediaType === 'video' ? 6 : 4));
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
  coverImage: string;
  platform: Platform;
}

/**
 * 生成体检报告（稳定确定性）。上传即生成，提交审核前展示。
 */
export function generateReport(input: ScoreInput): HealthReport {
  const titleScore = scoreTitle(input.title);
  const copyScore = scoreCopy(input.copy);
  const topicsScore = scoreTopics(input.tags);
  const coverScore = scoreCover(!!input.coverImage, input.mediaType);

  const dimensions: HealthDimension[] = [
    buildDimension('title', '标题吸引力', titleScore, detailFor('title', titleScore, input.title)),
    buildDimension('copy', '文案完整度', copyScore, detailFor('copy', copyScore, input.copy)),
    buildDimension('topics', '话题覆盖', topicsScore, detailFor('topics', topicsScore, input.tags.join(' '))),
    buildDimension('cover', '封面表现', coverScore, detailFor('cover', coverScore, input.coverImage)),
  ];

  const totalScore = clamp(
    titleScore * 0.25 + copyScore * 0.3 + topicsScore * 0.2 + coverScore * 0.25
  );

  const sensitive = findSensitive(
    `${input.title} ${input.copy} ${input.tags.join(' ')}`
  );
  let compliance: HealthCompliance;
  if (sensitive) {
    compliance = {
      level: 'block',
      blockingReason: `检测到敏感词「${sensitive}」，违反广告合规，需修改后提交`,
    };
  } else if (
    titleScore < 60 ||
    copyScore < 60 ||
    topicsScore < 60 ||
    coverScore < 60
  ) {
    compliance = { level: 'warn', blockingReason: null };
  } else {
    compliance = { level: 'pass', blockingReason: null };
  }

  const longTailWords =
    topicsScore < 80 ? LONG_TAIL_POOL_LOW.slice(0, 3) : LONG_TAIL_POOL_HIGH.slice(0, 3);

  return {
    id: `rpt_${input.inspirationID}`,
    inspirationID: input.inspirationID,
    totalScore,
    scoreLabel: '内部经验模型 · 非平台权威数据',
    dimensions,
    compliance,
    longTailWords,
    editableByCreator: true,
    generatedAt: new Date().toISOString(),
  };
}

function detailFor(kind: HealthDimensionKey, score: number, raw: string): string {
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
          : `文案偏短（${raw.trim().length} 字），信息不足`;
    case 'topics':
      return score >= 80
        ? '话题覆盖全面'
        : score >= 60
          ? '话题数量适中，建议补充长尾词'
          : '话题过少，建议补充 #话题 提升覆盖';
    case 'cover':
      return score >= 80
        ? '封面主体突出，表现优秀'
        : score >= 60
          ? '封面观感良好，建议提升对比度'
          : '缺少封面或封面表现一般，建议优化';
    default:
      return '';
  }
}
