/**
 * 采集共享类型与纯函数（mock / live / 面板共用）。
 * 从原 collectService.ts 抽出，避免分发器与实现互相 import。
 */
import type { MediaType, Platform } from '../types';
import type { CollectPlatform } from '@/utils/shareLink';

/** 采集失败原因分类，用于界面给出可行动提示 */
export type CollectFailureReason =
  | 'invalid-link'
  | 'unsupported-platform'
  | 'network'
  | 'need-backend'
  | 'not-found'
  | 'unknown';

/** 字段来源（live 模式由后端标注：这条数据从哪来） */
export type FieldSource = 'share' | 'platform' | 'none';

export interface CollectResult {
  source: CollectPlatform;
  platformLabel: string;
  /** 建议的目标发布平台（采集源 ≠ 发布平台） */
  targetPlatform: Platform;
  raw: string;
  url: string;
  contentId: string;
  isShortLink: boolean;
  title: string;
  copy: string;
  tags: string[];
  mediaType: MediaType;
  /** 转存到服务端的图片 URL 列表（live 模式真实图片） */
  images?: string[];
  coverImage: string;
  videoUrl: string | null;
  authorName: string | null;
  completeness: 'full' | 'partial';
  note: string | null;
  /** 各字段来源（live 模式；mock 模式为 undefined） */
  fieldSources?: {
    title: FieldSource;
    copy: FieldSource;
    tags: FieldSource;
    images: FieldSource;
  };
}

export interface CollectFailure {
  ok: false;
  reason: CollectFailureReason;
  message: string;
}

export type CollectResponse =
  | ({ ok: true } & CollectResult)
  | CollectFailure;

/** 把来源平台映射到本平台的目标发布平台 */
export function mapToTargetPlatform(source: CollectPlatform): Platform {
  // 抖音 / TikTok → 抖音；小红书 / Instagram / YouTube → 小红书
  return source === 'douyin' || source === 'tiktok' ? 'douyin' : 'xiaohongshu';
}

/** 支持的平台（面板展示用） */
export const PLATFORM_INFO = [
  { key: 'douyin' as CollectPlatform, label: '抖音' },
  { key: 'xiaohongshu' as CollectPlatform, label: '小红书' },
  { key: 'tiktok' as CollectPlatform, label: 'TikTok' },
  { key: 'instagram' as CollectPlatform, label: 'Instagram' },
  { key: 'youtube' as CollectPlatform, label: 'YouTube' },
];
