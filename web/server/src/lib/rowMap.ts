/**
 * DB 行 ↔ 前端 Inspiration 对象的映射。
 * 前端类型契约（src/data/types.ts）不动，这里负责 JSON 列的解析与 per-user 字段回填。
 */
import type {
  Inspiration,
  HealthBreakdown,
  HealthReport,
  ComplianceLevel,
  InspirationStatus,
  MediaType,
  Platform,
} from '../../../src/data/types';
import { STATUS_TEXT } from '../../../src/styles/tokens';

export interface InspirationRow {
  id: string;
  creator_id: string;
  creator_name: string;
  title: string;
  copy: string;
  tags_json: string;
  media_type: string;
  images_json: string;
  video_url: string | null;
  platform: string;
  status: string;
  reject_reason: string | null;
  health_score: number;
  health_breakdown_json: string | null;
  compliance: string;
  long_tail_json: string | null;
  health_report_json: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  is_favorite?: number;
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const EMPTY_BREAKDOWN: HealthBreakdown = { title: 0, copy: 0, topics: 0, cover: 0 };

export function rowToInspiration(row: InspirationRow): Inspiration {
  const report = parseJson<HealthReport | null>(row.health_report_json, null);
  return {
    id: row.id,
    creatorID: row.creator_id,
    creatorName: row.creator_name,
    title: row.title,
    copy: row.copy,
    tags: parseJson<string[]>(row.tags_json, []),
    mediaType: row.media_type as MediaType,
    images: parseJson<string[]>(row.images_json, []),
    videoUrl: row.video_url,
    platform: row.platform as Platform,
    status: row.status as InspirationStatus,
    healthScore: row.health_score,
    healthBreakdown: parseJson<HealthBreakdown>(
      row.health_breakdown_json,
      EMPTY_BREAKDOWN
    ),
    compliance: row.compliance as ComplianceLevel,
    longTailWords: parseJson<string[]>(row.long_tail_json, []),
    isFavorite: !!row.is_favorite,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    auditStatusText:
      row.status === 'approved' ? STATUS_TEXT.approved : undefined,
    // 驳回理由：创作者详情页要能看到「为什么被拒」
    rejectReason: row.reject_reason ?? undefined,
    // 完整报告（详情 / 体检页用）
    healthReport: report ?? undefined,
  };
}

/** 审核摘要 note：与前端 auditService 的口径保持一致 */
export function auditNote(
  compliance: ComplianceLevel,
  blockingReason: string | null
): string {
  if (compliance === 'block') {
    return blockingReason ?? '存在合规硬阻断，需整改后重新提交';
  }
  if (compliance === 'warn') return '存在风险提示，建议优化后提交';
  return '体检通过，可提交审核';
}
