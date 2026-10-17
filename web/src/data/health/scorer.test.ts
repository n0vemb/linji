import { describe, it, expect } from 'vitest';
import { generateReport, type ScoreInput } from './scorer';

/**
 * 健康分评分器确定性测试。
 * 评分器必须：给定固定输入 → 输出分数与四维度稳定可复现（非随机）。
 * 边界样本（低分 / 风险 / 阻断）分支正确。
 */

function baseInput(overrides: Partial<ScoreInput> = {}): ScoreInput {
  return {
    inspirationID: 'insp_test',
    title: '教程', // 含利益点 → 加分；len=2 → 但 <=8 扣分
    copy: 'x'.repeat(80), // >=80 字 → 88
    tags: ['#a', '#b', '#c'], // 3 个 → 80
    mediaType: 'image',
    images: ['c.jpg'],
    platform: 'douyin',
    ...overrides,
  };
}

describe('generateReport 确定性', () => {
  it('同一输入两次调用结果完全一致（非随机）', () => {
    const a = generateReport(baseInput());
    const b = generateReport(baseInput());
    expect(a.totalScore).toBe(b.totalScore);
    expect(a.dimensions).toEqual(b.dimensions);
    // 只比业务字段：generatedAt 是墙钟时间戳，不能参与相等性比对
    expect({ ...a, generatedAt: '' }).toEqual({ ...b, generatedAt: '' });
  });

  it('固定样本分数可复现', () => {
    const report = generateReport(baseInput());
    const byKey = Object.fromEntries(
      report.dimensions.map((d) => [d.key, d.score])
    );
    expect(byKey).toEqual({
      title: 66,
      copy: 88,
      topics: 80,
      cover: 76, // 70 + min(1,6)*2 + image(4)
    });
    expect(report.totalScore).toBe(78);
  });
});

describe('generateReport 维度 / 合规结构', () => {
  it('四个维度齐全且 key 正确，scoreLabel 固定', () => {
    const report = generateReport(baseInput());
    expect(report.dimensions).toHaveLength(4);
    const keys = report.dimensions.map((d) => d.key).sort();
    expect(keys).toEqual(['copy', 'cover', 'title', 'topics']);
    report.dimensions.forEach((d) => {
      expect(d.score).toBeGreaterThanOrEqual(0);
      expect(d.score).toBeLessThanOrEqual(100);
      expect(d.level).toMatch(/^(pass|warn|block)$/);
      expect(typeof d.detail).toBe('string');
    });
    expect(report.scoreLabel).toBe('内部经验模型 · 非平台权威数据');
    expect(report.editableByCreator).toBe(true);
  });

  it('id 格式为 rpt_<inspirationID>', () => {
    const report = generateReport(baseInput({ inspirationID: 'insp_xyz' }));
    expect(report.id).toBe('rpt_insp_xyz');
    expect(report.inspirationID).toBe('insp_xyz');
  });

  it('多图提升封面维度分数（组图加分）', () => {
    const one = generateReport(baseInput({ images: ['a.jpg'] }));
    const many = generateReport(baseInput({ images: ['a.jpg', 'b.jpg', 'c.jpg'] }));
    const scoreOf = (r: ReturnType<typeof generateReport>) =>
      r.dimensions.find((d) => d.key === 'cover')!.score;
    expect(scoreOf(many)).toBeGreaterThan(scoreOf(one));
  });
});

describe('generateReport 边界样本', () => {
  it('阻断(block)：强违规「点击链接」→ level=block 且 blockingReason 非空', () => {
    const report = generateReport(
      baseInput({
        title: '穿搭攻略',
        copy: '点击链接领取优惠，加微信进群',
        tags: [],
        images: [],
      })
    );
    expect(report.compliance.level).toBe('block');
    expect(report.compliance.blockingReason).toBeTruthy();
    expect(report.compliance.hits.some((h) => h.severity === 'block')).toBe(true);
  });

  it('风险(warn)：维度分 < 60（无图片 + 无话题）→ level=warn', () => {
    const report = generateReport(baseInput({ tags: [], images: [] }));
    expect(report.dimensions.some((d) => d.score < 60)).toBe(true);
    expect(report.compliance.level).toBe('warn');
    expect(report.compliance.blockingReason).toBeNull();
  });

  it('通过(pass)：四维度均 >= 60 且无违规 → level=pass', () => {
    const report = generateReport(baseInput());
    expect(report.dimensions.every((d) => d.score >= 60)).toBe(true);
    expect(report.compliance.level).toBe('pass');
    expect(report.compliance.blockingReason).toBeNull();
  });
});