/**
 * 数据模型（TypeScript interface）—— 锁死字段契约，为后续真实后端预留。
 * 直接对齐架构设计 §3。
 */

/** 平台：抖音 / 小红书 */
export type Platform = 'douyin' | 'xiaohongshu';

/** 媒体类型：图片 / 视频 */
export type MediaType = 'image' | 'video';

/** 灵感状态：草稿 / 待审 / 已通过 / 已驳回 */
export type InspirationStatus = 'draft' | 'pending' | 'approved' | 'rejected';

/** 合规层级：通过(绿) / 风险(琥珀) / 阻断(红) */
export type ComplianceLevel = 'pass' | 'warn' | 'block';

/** 合规规则命中详情（可解释：命中什么 / 为什么 / 怎么改） */
export interface ComplianceHit {
  /** 命中的词（界面高亮用） */
  word: string;
  /** 类别：站外引流 / 违规交易 / 虚假资质 / 广告法极限词 */
  category: 'diversion' | 'transaction' | 'false_claim' | 'absolute';
  /** 严重级别：block = 硬阻断；warn = 风险提示 */
  severity: 'block' | 'warn';
  /** 为什么会命中 */
  reason: string;
  /** 建议改法（仅 warn 级给出替换建议） */
  suggestion?: string;
}

/** 体检维度 key：标题吸引力 / 文案完整度 / 话题覆盖 / 封面表现 */
export type HealthDimensionKey = 'title' | 'copy' | 'topics' | 'cover';

/** 体检维度 */
export interface HealthDimension {
  key: HealthDimensionKey;
  name: string; // '标题吸引力' | '文案完整度' | '话题覆盖' | '封面表现'
  score: number; // 0-100
  level: ComplianceLevel; // 维度级通过 / 风险 / 阻断
  detail: string; // 维度说明文案
}

/** 合规结论 */
export interface HealthCompliance {
  level: ComplianceLevel; // pass | warn | block
  blockingReason: string | null; // 硬阻断原因（block 时非空）
  /** 规则命中明细，供界面解释「为什么」+「怎么改」 */
  hits: ComplianceHit[];
}

/** 体检报告（全生命周期对象） */
export interface HealthReport {
  id: string;
  inspirationID: string;
  totalScore: number; // 经验健康分 0-100
  scoreLabel: string; // 固定：'内部经验模型 · 非平台权威数据'
  dimensions: HealthDimension[]; // 4 个维度
  compliance: HealthCompliance;
  longTailWords: string[]; // 长尾词建议[]
  /** 长尾词推导依据（可解释：为什么给你这个词） */
  longTailDetails?: { word: string; reason: string }[];
  editableByCreator: boolean;
  generatedAt: string; // ISO 8601 UTC
}

/** 体检维度拆分（卡片 / 详情 / 体检展示用） */
export interface HealthBreakdown {
  title: number; // 标题吸引力
  copy: number; // 文案完整度
  topics: number; // 话题覆盖
  cover: number; // 封面表现
}

/** 灵感对象（核心业务实体） */
export interface Inspiration {
  id: string;
  creatorID: string; // 创建者 ID（权限门控依据）
  creatorName: string;
  title: string; // 灵感标题
  copy: string; // 文案正文
  tags: string[]; // 话题标签[]，如 ['#穿搭', '#夏日']
  mediaType: MediaType; // image | video
  images: string[]; // 图片素材 URL 数组（mock: 占位 或 blob: 真实）；images[0] 为封面
  videoUrl: string | null; // 视频 URL（image 时为 null）
  platform: Platform; // 抖音 / 小红书
  status: InspirationStatus; // 待审 / 已通过 / 已驳回
  healthScore: number; // 经验健康分（如 76）
  healthBreakdown: HealthBreakdown; // 维度拆分
  compliance: ComplianceLevel; // 通过 / 风险 / 阻断项
  longTailWords: string[]; // 长尾词建议[]
  isFavorite: boolean; // 收藏态（收藏占位页用）
  createdAt: string; // ISO 8601 UTC
  updatedAt: string; // ISO 8601 UTC
  auditStatusText?: string; // 审核状态文案，如 '已通过 · 可编辑'
  /** 驳回理由（status = rejected 时非空；创作者详情页要能看到「为什么被拒」） */
  rejectReason?: string;
  /** 完整体检报告（详情页 / 体检页用；列表接口可省略以瘦身） */
  healthReport?: HealthReport;
}

/** 审核项（审核台用，含只读摘要） */
export interface AuditItem {
  id: string;
  inspirationID: string;
  creatorName: string;
  status: InspirationStatus;
  reportSummary: {
    // 创作者体检摘要（只读）
    healthScore: number;
    compliance: ComplianceLevel;
    note: string; // 如 '话题含营销敏感词，建议修改'
  };
  decidedAt: string | null; // 审核决定时间，未决为 null
}

/** 当前用户 / 角色（mock 登录态，D3 Deferred） */
export interface CurrentUser {
  id: string;
  name: string;
  role: 'creator' | 'admin'; // 创建者 / 管理员（演示切换）
}

/** 新建 / 编辑灵感的表单载荷（上传页提交用） */
export interface InspirationDraft {
  title: string;
  copy: string;
  tags: string[];
  mediaType: MediaType;
  images: string[];
  videoUrl: string | null;
  platform: Platform;
}
