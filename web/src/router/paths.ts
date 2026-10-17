/**
 * 路由路径常量 —— 集中管理，避免硬编码字符串（架构 §7.1）。
 * 各页面跳转统一引用此处。
 */

export const PATHS = {
  PLAZA: '/', // 01 灵感广场
  DETAIL: '/inspiration/:id', // 02 灵感详情
  UPLOAD: '/upload', // 03 上传灵感（新建）
  EDIT: '/edit/:id', // 03 上传灵感（编辑模式，复用 UploadPage）
  AUDIT: '/audit', // 04 审核台
  MINE: '/mine', // 05 我的灵感
  HEALTH: '/health/:id', // 06 灵感体检（完整报告）
  FAVORITES: '/favorites', // 我的收藏（占位 / 基础展示）
} as const;

/** 灵感详情路径 builder */
export const inspirationPath = (id: string): string => `/inspiration/${id}`;

/** 完整体检报告路径 builder */
export const healthPath = (id: string): string => `/health/${id}`;

/** 编辑灵感路径 builder */
export const editPath = (id: string): string => `/edit/${id}`;

/**
 * 侧栏导航顺序（开发文档 §4 / 架构 §7.2）。
 * 不含「灵感体检」：体检报告是挂在**单条灵感**上的对象，必须带 :id，
 * 无法作为独立列表页从侧栏进入；其入口是详情页的「查看完整报告 →」。
 */
export interface NavEntry {
  label: string;
  path: string;
  /** 是否精确匹配（广场为首页 '/'） */
  exact?: boolean;
}

export const NAV_ITEMS: NavEntry[] = [
  { label: '灵感广场', path: PATHS.PLAZA, exact: true },
  { label: '我的灵感', path: PATHS.MINE },
  { label: '我的收藏', path: PATHS.FAVORITES },
  { label: '审核台', path: PATHS.AUDIT },
];
