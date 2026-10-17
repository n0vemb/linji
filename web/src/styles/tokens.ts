/**
 * 设计 token —— 直接引用开发文档 §4 视觉系统。
 * 所有颜色 / 字体 / 布局常量集中此处，组件与 MUI theme 统一引用，禁止硬编码色值。
 */

/** 颜色 token（画布底 / 卡片 / 主色 / 文字 / 描边 / 状态色） */
export const COLORS = {
  canvas: '#FAFAFA', // 画布底
  surface: '#FFFFFF', // 侧栏卡片 / 白卡
  primary: '#3B82F6', // 主色蓝
  ink: '#0A0A0B', // 深字
  sub1: '#52525B', // 次级字 1（复制图标描边、正文次级）
  sub2: '#71717A', // 次级字 2
  sub3: '#A1A1AA', // 次级字 3（占位 / 弱提示）
  line: '#E4E4E7', // 描边
  status: {
    pass: '#059669', // 通过绿
    reject: '#EF4444', // 驳回红
    warn: '#F59E0B', // 待审 / 风险 琥珀
    'warn-deep': '#D97706', // 琥珀深（文字）
  },
} as const;

/** 字体 token：中文 Noto Sans SC，数字 / 英文 Inter（系统栈兜底，不强制加载网络字体） */
export const FONTS = {
  sans: "'Inter', 'Noto Sans SC', system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif",
} as const;

/** 布局 token：侧栏 232px、顶栏 64px */
export const LAYOUT = {
  sidebarWidth: 232, // 左侧固定侧栏宽度（仅桌面）
  topbarHeight: 64, // 右侧顶栏高度（桌面）；手机端为 52
  mobileTopbarHeight: 52,
  /** 底部标签栏高度（仅手机端） */
  mobileTabBarHeight: 56,
  /** iOS home indicator 安全区 */
  safeAreaBottom: 'env(safe-area-inset-bottom, 0px)',
  safeAreaTop: 'env(safe-area-inset-top, 0px)',
} as const;

/**
 * 手机端交互规格。
 * 依据：Apple HIG / Material 均要求主要触摸目标 ≥ 44px（iOS 44pt / Android 48dp）。
 */
export const TOUCH = {
  /** 最小可点区域 */
  minTarget: 44,
  /** 导航项高度 */
  navItemHeight: 48,
  /** 按钮最小高度 */
  buttonHeight: 40,
  /** 底部固定操作条高度 */
  actionBarHeight: 60,
} as const;

/** 响应式间距：手机端更紧凑，避免滚动过多 */
export const SPACING = {
  pagePaddingMobile: 12,
  pagePaddingDesktop: 28,
  cardGapMobile: 10,
  cardGapDesktop: 16,
} as const;

/** 合规层级 → 颜色映射（pass 绿 / warn 琥珀 / block 红） */
export const COMPLIANCE_COLOR: Record<'pass' | 'warn' | 'block', string> = {
  pass: COLORS.status.pass,
  warn: COLORS.status.warn,
  block: COLORS.status.reject,
};

/** 经验健康分 → 颜色（>=80 绿 / 60-79 琥珀 / <60 红） */
export function healthColor(score: number): string {
  if (score >= 80) return COLORS.status.pass;
  if (score >= 60) return COLORS.status.warn;
  return COLORS.status.reject;
}

/** 灵感状态 → 展示文案（架构 §7.4） */
export const STATUS_TEXT: Record<
  'draft' | 'pending' | 'approved' | 'rejected',
  string
> = {
  draft: '草稿 · 未提交',
  approved: '已通过 · 可编辑',
  pending: '待审核',
  rejected: '已驳回',
};

/** 合规层级 → 文案 */
export const COMPLIANCE_TEXT: Record<'pass' | 'warn' | 'block', string> = {
  pass: '体检通过',
  warn: '风险提示',
  block: '硬阻断',
};
