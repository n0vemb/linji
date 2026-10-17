import { describe, it, expect } from 'vitest';
import { checkField, checkCompliance } from './compliance';

/**
 * 合规规则引擎测试。
 * 核心回归：**良性语境不得误判**（用户反馈「最近」被当成「最」硬阻断）。
 */

describe('良性语境豁免（用户反馈的核心回归点）', () => {
  const benign = [
    '最近入手了这套通勤穿搭，真的太好看了',
    '最新款的显高技巧分享给你',
    '最后一步是定型，喷一下就好',
    '我最爱的小个子穿搭合集',
    '最想分享的夏日避坑指南',
    '这大概是最近最实用的一篇了',
    '第一步先把基础款准备好',
    '第一次尝试这种叠穿方法',
    '第二天效果更明显',
    '极致舒适的夏日面料',
    '最大程度还原了版型',
  ];

  benign.forEach((text) => {
    it(`「${text}」不应触发硬阻断`, () => {
      const r = checkField(text);
      expect(r.level).not.toBe('block');
      expect(r.hits.filter((h) => h.severity === 'block')).toHaveLength(0);
    });
  });
});

describe('硬阻断规则（高置信、无合法用法）', () => {
  const blockers = [
    { text: '有需要加微信找我', word: '加微信' },
    { text: '更多优惠点击链接查看', word: '点击链接' },
    { text: '扫码进群领资料', word: '扫码' },
    { text: '支持私下交易更优惠', word: '私下交易' },
    { text: '国家级认证', word: '国家级' },
    { text: '批量刷单', word: '刷单' },
  ];

  blockers.forEach(({ text, word }) => {
    it(`「${text}」应硬阻断且命中「${word}」`, () => {
      const r = checkField(text);
      expect(r.level).toBe('block');
      expect(r.blockingReason).toContain(word);
      expect(r.blockingReason).toContain('需修改后提交');
    });
  });
});

describe('广告法极限词降级为风险提示', () => {
  const warns = [
    { text: '这件是全网最低价', word: '全网最低' },
    { text: '销量第一的爆款', word: '销量第一' },
    { text: '史上最全攻略', word: '史上' },
  ];

  warns.forEach(({ text, word }) => {
    it(`「${text}」应为 warn 而非 block，且带替换建议`, () => {
      const r = checkField(text);
      expect(r.level).toBe('warn');
      expect(r.blockingReason).toBeNull();
      const hit = r.hits.find((h) => h.word === word);
      expect(hit).toBeDefined();
      expect(hit!.severity).toBe('warn');
      expect(hit!.suggestion).toBeTruthy();
    });
  });
});

describe('checkCompliance 汇总', () => {
  it('三字段都干净 → overall=pass', () => {
    const r = checkCompliance({
      title: '夏日穿搭实测',
      copy: '这套搭配我最近试了一周，舒服透气。',
      tags: ['#穿搭', '#夏日'],
    });
    expect(r.overall.level).toBe('pass');
    expect(r.overall.hits).toHaveLength(0);
  });

  it('任一字段硬阻断 → overall=block', () => {
    const r = checkCompliance({
      title: '正常标题',
      copy: '有问题的都在这里，加微信聊',
      tags: ['#穿搭'],
    });
    expect(r.overall.level).toBe('block');
  });

  it('仅文案含极限词 → overall=warn（不阻断）', () => {
    const r = checkCompliance({
      title: '正常标题',
      copy: '这是史上最好的一篇',
      tags: ['#穿搭'],
    });
    expect(r.overall.level).toBe('warn');
    expect(r.overall.blockingReason).toBeNull();
  });

  it('命中明细带 reason + category，可解释', () => {
    const r = checkCompliance({
      title: '正常标题',
      copy: '扫码进群',
      tags: [],
    });
    const hit = r.overall.hits[0];
    expect(hit.category).toBe('diversion');
    expect(hit.reason).toBeTruthy();
  });
});

describe('字段级独立性', () => {
  it('title 干净但 copy 违规时，title 结果仍为 pass', () => {
    const r = checkCompliance({
      title: '最近很火的穿搭',
      copy: '加微信领取',
      tags: [],
    });
    expect(r.title.level).toBe('pass');
    expect(r.copy.level).toBe('block');
  });
});