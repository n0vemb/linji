import { describe, it, expect } from 'vitest';
import {
  fetchInspirations,
  getInspiration,
  createInspiration,
  updateInspiration,
  deleteInspiration,
} from './inspirationService.mock';
import type { InspirationDraft, InspirationStatus } from '@/data/types';
import { MOCK_INSPIRATIONS } from '@/data/mock/inspirations';

/**
 * 灵感 service 测试：验证返回 Promise + 数据符合 types.ts 的 interface，
 * 以及 create / update / delete 内存契约（setTimeout 异步）。
 */

const draft: InspirationDraft = {
  title: '测试标题',
  copy: '这是一段足够长的文案，用于验证创建灵感功能是否正常工作。',
  tags: ['#测试'],
  mediaType: 'image',
  images: ['mock:cover_test'],
  videoUrl: null,
  platform: 'douyin',
};

const VALID_STATUS: InspirationStatus[] = ['pending', 'approved', 'rejected'];

describe('inspirationService', () => {
  it('fetchInspirations 返回 Promise<Inspiration[]>，形状符合接口', async () => {
    const p = fetchInspirations();
    expect(p).toBeInstanceOf(Promise);
    const list = await p;
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBe(MOCK_INSPIRATIONS.length);
    list.forEach((i) => {
      expect(typeof i.id).toBe('string');
      expect(typeof i.creatorID).toBe('string');
      expect(VALID_STATUS).toContain(i.status);
      expect(typeof i.healthScore).toBe('number');
      expect(i.healthBreakdown).toHaveProperty('title');
      expect(i.healthBreakdown).toHaveProperty('copy');
      expect(i.healthBreakdown).toHaveProperty('topics');
      expect(i.healthBreakdown).toHaveProperty('cover');
    });
  });

  it('getInspiration 命中返回对象，未命中返回 null', async () => {
    const hit = await getInspiration('insp_001');
    expect(hit?.id).toBe('insp_001');
    const miss = await getInspiration('not_exist');
    expect(miss).toBeNull();
  });

  it('create → get → update → delete 全链路（内存 db 净归零）', async () => {
    const created = await createInspiration(draft, {
      id: 'user_qa',
      name: 'QA',
    });
    expect(created.status).toBe('pending');
    expect(created.creatorID).toBe('user_qa');
    expect(created.healthScore).toBeGreaterThanOrEqual(0);
    expect(created.healthScore).toBeLessThanOrEqual(100);

    const fetched = await getInspiration(created.id);
    expect(fetched?.id).toBe(created.id);

    const updated = await updateInspiration(created.id, {
      ...draft,
      title: '新标题',
    });
    expect(updated?.id).toBe(created.id);
    expect(updated?.title).toBe('新标题');
    expect(updated?.status).toBe('pending'); // 保留原状态

    await deleteInspiration(created.id);
    const after = await getInspiration(created.id);
    expect(after).toBeNull();
  });
});
