import { describe, it, expect } from 'vitest';
import { buildReport } from './healthService';
import type { ScoreInput } from '@/data/health/scorer';

/**
 * 体检 service 测试：buildReport 应返回 Promise（setTimeout 异步），
 * 且结果符合 HealthReport 接口。
 */

const input: ScoreInput = {
  inspirationID: 't1',
  title: '教程',
  copy: 'x'.repeat(80),
  tags: ['#a'],
  mediaType: 'image',
  images: ['c.jpg'],
  platform: 'douyin',
};

describe('healthService', () => {
  it('buildReport 返回 Promise<HealthReport>', async () => {
    const p = buildReport(input);
    expect(p).toBeInstanceOf(Promise);
    const report = await p;
    expect(report.id).toBe('rpt_t1');
    expect(report.totalScore).toBeGreaterThanOrEqual(0);
    expect(report.totalScore).toBeLessThanOrEqual(100);
    expect(report.scoreLabel).toBe('内部经验模型 · 非平台权威数据');
    expect(report.dimensions).toHaveLength(4);
    expect(['pass', 'warn', 'block']).toContain(report.compliance.level);
    expect(report.editableByCreator).toBe(true);
  });
});
