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
    { level: 'pass', blockingReason: null, hits: [] },
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
    { level: 'pass', blockingReason: null, hits: [] },
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
    { level: 'warn', blockingReason: null, hits: [] },
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
    { level: 'warn', blockingReason: null, hits: [] },
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
    { level: 'warn', blockingReason: null, hits: [] },
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
    { level: 'warn', blockingReason: null, hits: [] },
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
    { level: 'block', blockingReason: '检测到敏感词「最」，违反广告法绝对化用语，需修改后提交', hits: [] },
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
    { level: 'pass', blockingReason: null, hits: [] },
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
    { level: 'pass', blockingReason: null, hits: [] },
    ['种草好物', '好物盘点', '回购清单'],
    '2025-01-07T12:00:00Z'
  ),

  // 以下为广场内容补充（让瀑布流有真实的多行堆叠效果）
  insp_010: report(
    'insp_010',
    86,
    [
      dim('title', '标题吸引力', 90, '标题含明确场景与时长，点击意愿强'),
      dim('copy', '文案完整度', 84, '文案步骤清晰，可直接照做'),
      dim('topics', '话题覆盖', 86, '话题覆盖通勤与效率场景'),
      dim('cover', '封面表现', 84, '封面主体清晰'),
    ],
    { level: 'pass', blockingReason: null, hits: [] },
    ['早八通勤穿搭', '五分钟出门', '通勤搭配公式'],
    '2025-01-14T09:10:00Z'
  ),

  insp_011: report(
    'insp_011',
    79,
    [
      dim('title', '标题吸引力', 84, '标题带品类与系列，指向明确'),
      dim('copy', '文案完整度', 76, '文案可补充开箱细节'),
      dim('topics', '话题覆盖', 78, '建议补充收藏类长尾词'),
      dim('cover', '封面表现', 78, '封面建议突出主体'),
    ],
    { level: 'pass', blockingReason: null, hits: [] },
    ['盲盒开箱', '隐藏款概率', '系列收藏攻略'],
    '2025-01-14T08:20:00Z'
  ),

  insp_012: report(
    'insp_012',
    88,
    [
      dim('title', '标题吸引力', 92, '标题利益点清晰'),
      dim('copy', '文案完整度', 88, '文案信息完整，含清单结构'),
      dim('topics', '话题覆盖', 86, '话题覆盖季节与场景'),
      dim('cover', '封面表现', 86, '封面明亮，主体突出'),
    ],
    { level: 'pass', blockingReason: null, hits: [] },
    ['夏日防晒', '防晒穿搭', '紫外线防护'],
    '2025-01-13T19:00:00Z'
  ),

  insp_013: report(
    'insp_013',
    75,
    [
      dim('title', '标题吸引力', 80, '标题直白，可增加人群词'),
      dim('copy', '文案完整度', 74, '文案偏短，建议补充搭配思路'),
      dim('topics', '话题覆盖', 72, '话题略少，可补充材质词'),
      dim('cover', '封面表现', 74, '封面对比度可提升'),
    ],
    { level: 'pass', blockingReason: null, hits: [] },
    ['显瘦连衣裙', '连衣裙搭配', '梨形身材裙子'],
    '2025-01-13T16:30:00Z'
  ),

  insp_014: report(
    'insp_014',
    81,
    [
      dim('title', '标题吸引力', 84, '标题人群定位清晰'),
      dim('copy', '文案完整度', 80, '文案结构完整，可补充尺码建议'),
      dim('topics', '话题覆盖', 80, '话题覆盖入门与基础款'),
      dim('cover', '封面表现', 80, '封面表现稳定'),
    ],
    { level: 'pass', blockingReason: null, hits: [] },
    ['男生基础款', '穿搭入门', '基础款清单'],
    '2025-01-12T20:15:00Z'
  ),

  insp_015: report(
    'insp_015',
    91,
    [
      dim('title', '标题吸引力', 94, '标题含量化信息，信任度高'),
      dim('copy', '文案完整度', 90, '文案实测细节充分'),
      dim('topics', '话题覆盖', 90, '话题覆盖测评与通勤场景'),
      dim('cover', '封面表现', 90, '封面表现优秀'),
    ],
    { level: 'pass', blockingReason: null, hits: [] },
    ['通勤包实测', '14寸电脑包', '通勤包推荐'],
    '2025-01-12T18:40:00Z'
  ),

  insp_016: report(
    'insp_016',
    83,
    [
      dim('title', '标题吸引力', 86, '标题含风格关键词，指向明确'),
      dim('copy', '文案完整度', 82, '文案结构清晰，可补充单品链接'),
      dim('topics', '话题覆盖', 84, '话题覆盖风格与季节'),
      dim('cover', '封面表现', 80, '封面表现稳定'),
    ],
    { level: 'pass', blockingReason: null, hits: [] },
    ['法式穿搭', '慵懒风', '秋季搭配'],
    '2025-01-11T21:00:00Z'
  ),

  insp_017: report(
    'insp_017',
    87,
    [
      dim('title', '标题吸引力', 90, '标题含数量与场景，信息密度高'),
      dim('copy', '文案完整度', 86, '文案按天拆分，易读'),
      dim('topics', '话题覆盖', 86, '话题覆盖通勤与效率'),
      dim('cover', '封面表现', 86, '封面统一，识别度高'),
    ],
    { level: 'pass', blockingReason: null, hits: [] },
    ['一周通勤穿搭', '通勤不重样', '打工人穿搭'],
    '2025-01-11T18:30:00Z'
  ),

  insp_018: report(
    'insp_018',
    78,
    [
      dim('title', '标题吸引力', 82, '标题人群与品类明确'),
      dim('copy', '文案完整度', 76, '文案可补充身高参考'),
      dim('topics', '话题覆盖', 76, '建议补充版型长尾词'),
      dim('cover', '封面表现', 78, '封面清晰，可提升对比度'),
    ],
    { level: 'pass', blockingReason: null, hits: [] },
    ['半身裙长度', '小个子裙子', '裙长对照表'],
    '2025-01-10T20:10:00Z'
  ),

  insp_019: report(
    'insp_019',
    81,
    [
      dim('title', '标题吸引力', 84, '标题含人群与利益点'),
      dim('copy', '文案完整度', 80, '文案细节充分'),
      dim('topics', '话题覆盖', 80, '话题覆盖身材与版型'),
      dim('cover', '封面表现', 80, '封面主体清晰'),
    ],
    { level: 'pass', blockingReason: null, hits: [] },
    ['大码显瘦', '显瘦技巧', '版型选择'],
    '2025-01-10T15:50:00Z'
  ),
};

/** 取某灵感对应的体检报告（不存在则返回 null） */
export function getMockReport(inspirationID: string): HealthReport | null {
  return MOCK_REPORTS[inspirationID] ?? null;
}
