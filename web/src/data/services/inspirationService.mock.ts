import type {
  Inspiration,
  InspirationDraft,
  HealthReport,
  HealthBreakdown,
} from '../types';
import { MOCK_INSPIRATIONS } from '../mock/inspirations';
import { generateReport } from '../health/scorer';
import { STATUS_TEXT } from '@/styles/tokens';

/**
 * 灵感 service 层（全 Promise 化 + setTimeout 模拟异步）。
 * 模块内持有内存 db（初版 mock 数据，刷新重置）。后续接真实后端只换实现，不改调用方。
 */

const delay = (ms = 300): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** 深拷贝，避免调用方修改内部状态 */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

let db: Inspiration[] = clone(MOCK_INSPIRATIONS);

function breakdownFromReport(report: HealthReport): HealthBreakdown {
  const find = (key: 'title' | 'copy' | 'topics' | 'cover'): number =>
    report.dimensions.find((d) => d.key === key)?.score ?? 0;
  return {
    title: find('title'),
    copy: find('copy'),
    topics: find('topics'),
    cover: find('cover'),
  };
}

export async function fetchInspirations(): Promise<Inspiration[]> {
  await delay();
  return clone(db);
}

export async function getInspiration(id: string): Promise<Inspiration | null> {
  await delay(150);
  const found = db.find((i) => i.id === id) ?? null;
  return found ? clone(found) : null;
}

/**
 * 新建灵感：
 * - asDraft = true → 状态 draft（半成品，只有创建者可见，不进审核队列）
 * - asDraft = false → 状态 pending（进入审核队列）
 * 体检报告两种情况都生成（草稿也能看到体检结果，便于继续优化）。
 */
export async function createInspiration(
  draft: InspirationDraft,
  creator: { id: string; name: string },
  asDraft = false
): Promise<Inspiration> {
  await delay();
  const id = `insp_${Date.now().toString(36)}`;
  const report = generateReport({ inspirationID: id, ...draft });
  const now = new Date().toISOString();
  const inspiration: Inspiration = {
    id,
    creatorID: creator.id,
    creatorName: creator.name,
    title: draft.title,
    copy: draft.copy,
    tags: draft.tags,
    mediaType: draft.mediaType,
    images: draft.images,
    videoUrl: draft.videoUrl,
    platform: draft.platform,
    status: asDraft ? 'draft' : 'pending',
    healthScore: report.totalScore,
    healthBreakdown: breakdownFromReport(report),
    compliance: report.compliance.level,
    longTailWords: report.longTailWords,
    isFavorite: false,
    createdAt: now,
    updatedAt: now,
  };
  db = [...db, inspiration];
  return clone(inspiration);
}

/** 编辑灵感（创建者二次编辑）：重新生成体检报告，保留原状态 */
export async function updateInspiration(
  id: string,
  draft: InspirationDraft
): Promise<Inspiration | null> {
  await delay();
  const report = generateReport({ inspirationID: id, ...draft });
  db = db.map((i) =>
    i.id === id
      ? {
          ...i,
          title: draft.title,
          copy: draft.copy,
          tags: draft.tags,
          mediaType: draft.mediaType,
          images: draft.images,
          videoUrl: draft.videoUrl,
          platform: draft.platform,
          healthScore: report.totalScore,
          healthBreakdown: breakdownFromReport(report),
          compliance: report.compliance.level,
          longTailWords: report.longTailWords,
          updatedAt: new Date().toISOString(),
        }
      : i
  );
  const found = db.find((i) => i.id === id) ?? null;
  return found ? clone(found) : null;
}

export async function deleteInspiration(id: string): Promise<void> {
  await delay();
  db = db.filter((i) => i.id !== id);
}

/** 仅供 auditService 调用：同步灵感审核状态（可带驳回理由） */
export async function setInspirationStatus(
  id: string,
  status: Inspiration['status'],
  rejectReason?: string
): Promise<void> {
  await delay(80);
  db = db.map((i) =>
    i.id === id
      ? {
          ...i,
          status,
          auditStatusText:
            status === 'approved' ? STATUS_TEXT.approved : undefined,
          rejectReason:
            status === 'rejected' ? (rejectReason ?? '未填写理由') : undefined,
          updatedAt: new Date().toISOString(),
        }
      : i
  );
}

/** 草稿提交审核：draft → pending（mock 模式本地状态切换） */
export async function submitDraft(id: string): Promise<Inspiration> {
  await delay(120);
  const target = db.find((i) => i.id === id);
  if (!target) throw new Error(`Inspiration ${id} not found`);
  if (target.status !== 'draft') {
    throw new Error('只有草稿状态可以提交审核');
  }
  db = db.map((i) =>
    i.id === id
      ? {
          ...i,
          status: 'pending' as Inspiration['status'],
          auditStatusText: undefined,
          updatedAt: new Date().toISOString(),
        }
      : i
  );
  return clone(db.find((i) => i.id === id)!);
}
