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

/** 新建灵感（上传提交）：生成体检报告，状态 pending，进入审核队列 */
export async function createInspiration(
  draft: InspirationDraft,
  creator: { id: string; name: string }
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
    coverImage: draft.coverImage,
    videoUrl: draft.videoUrl,
    platform: draft.platform,
    status: 'pending',
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
          coverImage: draft.coverImage,
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

/** 仅供 auditService 调用：同步灵感审核状态 */
export async function setInspirationStatus(
  id: string,
  status: Inspiration['status']
): Promise<void> {
  await delay(80);
  db = db.map((i) =>
    i.id === id
      ? {
          ...i,
          status,
          auditStatusText:
            status === 'approved' ? STATUS_TEXT.approved : undefined,
          updatedAt: new Date().toISOString(),
        }
      : i
  );
}
