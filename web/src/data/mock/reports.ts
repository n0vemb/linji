import type { HealthReport, HealthDimension, HealthDimensionKey } from '../types';

/**
 * 体检报告种子数据 —— 作为 healthScore / healthBreakdown / compliance / longTailWords 的
 * 单一来源（inspirations.ts 由此派生，避免双份数据不一致）。
 * 覆盖边界样本：高分 / 低分(warn) / 硬阻断(block)。
 */

const SCORE_LABEL = '内部经验模型 · 非平台权威数据';

function dim(
  key: HealthDimensionKey,
  name: string,
  score: number,
  detail: string,
  level: HealthDimension['level'] = score >= 80 ? 'pass' : score >= 60 ? 'warn' : 'block'
): HealthDimension {
  return { key, name, score, level, detail };
}

function report(
  inspirationID: string,
  totalScore: number,
  dimensions: HealthDimension[],
  compliance: HealthReport['compliance'],
  longTailWords: string[],
  generatedAt: string
): HealthReport {
  return {
    id: `rpt_${inspirationID}`,
    inspirationID,
    totalScore,
    scoreLabel: SCORE_LABEL,
    dimensions,
    compliance,
    longTailWords,
    editableByCreator: true,
    generatedAt,
  };
}

export const MOCK_REPORTS: Record<string, HealthReport> = {
  // 高分通过（许清楚本人，演示可编辑）
  insp_001: report(
    'insp_001',
    82,
    [
      dim('title', '标题吸引力', 88, '标题含明确利益点（实测/分享），吸引力强'),
      dim('copy', '文案完整度', 82, '文案结构清晰，信息完整'),
      dim('topics', '话题覆盖', 78, '话题数量适中，建议补充长尾词'),
      dim('cover', '封面表现', 80, '主体突出，建议提升对比度'),
    ],
    { level: 'pass', blockingReason: null },
    ['夏日穿搭小个子', '通勤穿搭显高', '基础款叠穿'],
    '2025-01-12T10:00:05Z'
  ),

  // 通过（林夕，他人内容，只读）
  insp_002: report(
    'insp_002',
    76,
    [
      dim('title', '标题吸引力', 70, '标题平稳，可补充利益点'),
      dim('copy', '文案完整度', 80, '文案结构清晰'),
      dim('topics', '话题覆盖', 75, '话题覆盖良好'),
      dim('cover', '封面表现', 78, '封面观感良好'),
    ],
    { level: 'pass', blockingReason: null },
    ['好物分享', '学生党必备', '平价替换'],
    '2025-01-11T09:30:00Z'
  ),

  // 低分 warn（沐沐，他人内容，只读）
  insp_003: report(
    'insp_003',
    68,
    [
      dim('title', '标题吸引力', 62, '标题偏平，建议加入利益点'),
      dim('copy', '文案完整度', 70, '文案尚可，建议补充细节'),
      dim('topics', '话题覆盖', 60, '话题偏少，建议补充 #话题'),
      dim('cover', '封面表现', 78, '封面表现稳定'),
    ],
    { level: 'warn', blockingReason: null },
    ['梨形身材穿搭', '平价好物', '学生党必备'],
    '2025-01-10T14:20:00Z'
  ),

  // 待审 warn（许清楚本人，审核队列）
  insp_004: report(
    'insp_004',
    64,
    [
      dim('title', '标题吸引力', 58, '标题偏短，吸引力不足'),
      dim('copy', '文案完整度', 66, '文案偏短，建议补充细节'),
      dim('topics', '话题覆盖', 55, '话题覆盖偏弱，建议补充'),
      dim('cover', '封面表现', 72, '封面主体清晰'),
    ],
    { level: 'warn', blockingReason: null },
    ['日常通勤穿搭', '小个子显高', '基础款搭配'],
    '2025-01-13T08:10:00Z'
  ),

  // 待审 warn（林夕，审核队列，低分）
  insp_005: report(
    'insp_005',
    55,
    [
      dim('title', '标题吸引力', 50, '标题缺乏利益点'),
      dim('copy', '文案完整度', 60, '文案偏短'),
      dim('topics', '话题覆盖', 45, '话题过少，覆盖不足'),
      dim('cover', '封面表现', 65, '封面可优化对比度'),
    ],
    { level: 'warn', blockingReason: null },
    ['氛围感拍照', '周末出游穿搭', '拍照姿势'],
    '2025-01-13T11:00:00Z'
  ),

  // 已驳回（沐沐，低分）
  insp_006: report(
    'insp_006',
    48,
    [
      dim('title', '标题吸引力', 45, '标题吸引力弱'),
      dim('copy', '文案完整度', 50, '文案信息不足'),
      dim('topics', '话题覆盖', 40, '话题过少'),
      dim('cover', '封面表现', 58, '封面表现一般'),
    ],
    { level: 'warn', blockingReason: null },
    ['新手穿搭', '显瘦技巧', '平价店铺'],
    '2025-01-09T16:40:00Z'
  ),

  // 硬阻断 block（林夕，待审队列，敏感词）
  insp_007: report(
    'insp_007',
    63,
    [
      dim('title', '标题吸引力', 60, '标题含绝对化用语，需整改'),
      dim('copy', '文案完整度', 70, '文案结构尚可'),
      dim('topics', '话题覆盖', 65, '话题覆盖一般'),
      dim('cover', '封面表现', 55, '封面需优化'),
    ],
    { level: 'block', blockingReason: '检测到敏感词「最」，违反广告法绝对化用语，需修改后提交' },
    ['合规表达替换', '客观描述', '避免绝对化'],
    '2025-01-13T13:25:00Z'
  ),

  // 高分通过（许清楚本人，演示可编辑）
  insp_008: report(
    'insp_008',
    90,
    [
      dim('title', '标题吸引力', 92, '标题利益点明确，吸引力强'),
      dim('copy', '文案完整度', 88, '文案信息充分，结构清晰'),
      dim('topics', '话题覆盖', 90, '话题覆盖全面'),
      dim('cover', '封面表现', 88, '封面表现优秀'),
    ],
    { level: 'pass', blockingReason: null },
    ['爆款标题公式', '高转化文案', '封面构图'],
    '2025-01-08T10:00:00Z'
  ),

  // 高分通过 + 收藏（沐沐，他人内容，只读）
  insp_009: report(
    'insp_009',
    84,
    [
      dim('title', '标题吸引力', 86, '标题吸引力强'),
      dim('copy', '文案完整度', 82, '文案完整度高'),
      dim('topics', '话题覆盖', 88, '话题覆盖全面'),
      dim('cover', '封面表现', 80, '封面表现稳定'),
    ],
    { level: 'pass', blockingReason: null },
    ['种草好物', '好物盘点', '回购清单'],
    '2025-01-07T12:00:00Z'
  ),
};

/** 取某灵感对应的体检报告（不存在则返回 null） */
export function getMockReport(inspirationID: string): HealthReport | null {
  return MOCK_REPORTS[inspirationID] ?? null;
}
