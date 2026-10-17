import { describe, it, expect } from 'vitest';
import { generateLongTailWords } from './longTail';

/**
 * 长尾词生成测试。
 * 核心回归：初版用**固定词池**，导致给「数码开箱」推「夏日穿搭小个子」这类
 * 完全无关的假建议。新实现必须保证建议词**来自用户实际内容**。
 */

const words = (input: {
  title: string;
  copy: string;
  tags: string[];
}) => generateLongTailWords(input).map((s) => s.word);

describe('内容相关性（用户反馈的核心问题）', () => {
  it('穿搭内容不再被推无关的建议', () => {
    const w = words({
      title: '小个子通勤穿搭教程',
      copy: '155 也能穿出大长腿，高腰线是关键，通勤一整周不累。',
      tags: ['#穿搭'],
    });
    // 每条建议都必须能在原文里找到依据
    const hasUnrelated = w.some(
      (x) => x.includes('护肤') || x.includes('健身') || x.includes('数码')
    );
    expect(hasUnrelated).toBe(false);
  });

  it('数码内容不会得到穿搭类建议', () => {
    const w = words({
      title: '降噪耳机开箱实测',
      copy: '通勤降噪效果对比，续航 30 小时，性价比很高。',
      tags: ['#数码', '#开箱'],
    });
    const hasClothing = w.some((x) => x.includes('穿搭') || x.includes('显高'));
    expect(hasClothing).toBe(false);
    expect(w.length).toBeGreaterThan(0);
  });

  it('不同题材得到不同建议（证明不是固定词池）', () => {
    const fashion = words({
      title: '小个子通勤穿搭',
      copy: '显高显瘦技巧',
      tags: [],
    });
    const tech = words({
      title: '学生党笔记本推荐',
      copy: '预算有限也能买到好用的',
      tags: [],
    });
    expect(fashion).not.toEqual(tech);
  });
});

describe('组合策略', () => {
  it('品类 + 人群：小个子穿搭', () => {
    const w = words({
      title: '小个子穿搭合集',
      copy: '显高技巧分享',
      tags: [],
    });
    expect(w).toContain('小个子穿搭');
  });

  it('品类 + 场景：通勤穿搭', () => {
    const w = words({
      title: '通勤穿搭怎么选',
      copy: '上班族日常搭配',
      tags: [],
    });
    expect(w).toContain('通勤穿搭');
  });

  it('意图 + 品类：避坑类建议', () => {
    const w = words({
      title: '护肤避坑指南',
      copy: '敏感肌别踩这些雷',
      tags: [],
    });
    expect(w).toContain('避坑护肤');
  });
});

describe('去重与排除', () => {
  it('不推荐用户已有的话题', () => {
    const w = words({
      title: '小个子通勤穿搭',
      copy: '显高技巧',
      tags: ['#小个子穿搭'],
    });
    expect(w).not.toContain('小个子穿搭');
  });

  it('结果内部不重复', () => {
    const w = words({
      title: '学生党平价护肤',
      copy: '敏感肌护肤避坑，通勤也能用',
      tags: [],
    });
    expect(new Set(w).size).toBe(w.length);
  });

  it('最多 6 条', () => {
    const w = words({
      title: '学生党通勤穿搭避坑',
      copy: '小个子 微胖 梨形 夏日 秋冬 通勤 约会 显高 显瘦 平价',
      tags: [],
    });
    expect(w.length).toBeLessThanOrEqual(6);
  });
});

describe('复合词误命中（实测「这家居酒馆」）', () => {
  it('「这家居酒馆」不应被识别成「家居」品类', () => {
    const w = words({
      title: '周末约会探店清单',
      copy: '这家居酒馆适合聚餐，实测很稳',
      tags: [],
    });
    expect(w.some((x) => x.includes('家居'))).toBe(false);
  });

  it('同场景仍能正确识别「探店」品类', () => {
    const w = words({
      title: '周末约会探店清单',
      copy: '这家居酒馆适合聚餐，实测很稳',
      tags: [],
    });
    expect(w).toContain('约会探店');
    expect(w).toContain('周末探店');
  });

  it('真正讲家居时仍能识别（排除词不能误杀）', () => {
    const w = words({
      title: '小户型家居收纳',
      copy: '租房党必备的收纳好物',
      tags: [],
    });
    expect(w.some((x) => x.includes('家居'))).toBe(true);
  });
});

describe('信号不足时不硬凑', () => {
  it('无任何可识别信号 → 空数组（不给假建议）', () => {
    const w = words({
      title: '随手记录一下',
      copy: '今天天气不错，随便写点什么。',
      tags: [],
    });
    expect(w).toEqual([]);
  });

  it('空内容不崩', () => {
    expect(words({ title: '', copy: '', tags: [] })).toEqual([]);
  });
});

describe('可解释性', () => {
  it('每条建议都带推导依据', () => {
    const r = generateLongTailWords({
      title: '小个子通勤穿搭',
      copy: '显高显瘦技巧',
      tags: [],
    });
    expect(r.length).toBeGreaterThan(0);
    r.forEach((s) => {
      expect(s.word).toBeTruthy();
      expect(s.reason).toBeTruthy();
      expect(s.reason.length).toBeGreaterThan(4);
    });
  });
});

describe('确定性', () => {
  it('同样输入两次调用结果一致（非随机）', () => {
    const input = {
      title: '小个子通勤穿搭教程',
      copy: '显高显瘦，学生党也能穿',
      tags: ['#穿搭'],
    };
    expect(generateLongTailWords(input)).toEqual(
      generateLongTailWords(input)
    );
  });
});