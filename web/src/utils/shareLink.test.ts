import { describe, it, expect } from 'vitest';
import {
  parseShareText,
  extractUrl,
  extractContentId,
  extractTags,
  detectPlatform,
  detectRetiredPlatform,
  normalizeUrl,
  cleanShareText,
  isShortLink,
} from './shareLink';

/**
 * 分享链接解析测试。
 * 用线上真实的分享文案格式（不是理想化的纯 URL），因为这正是用户的核心痛点：
 * 「小红书分享链接格式非纯网址」。
 *
 * 采集来源（2026-10 起）：小红书 / Instagram / YouTube。
 * 抖音 / TikTok 已下线，其链接应识别为「不支持」而非解析成功。
 */

describe('真实分享文案解析（核心场景）', () => {
  it('小红书：【标题 - 作者 | 小红书】格式，标题作者都能提取', () => {
    const text =
      '31 【小个子显高穿搭 - 小鹿 | 小红书 - 你的生活指南】😆 xhslink.com/a/AbCdEf123 复制本条信息，打开【小红书】App查看精彩内容！';
    const r = parseShareText(text)!;
    expect(r.platform).toBe('xiaohongshu');
    expect(r.url).toBe('https://xhslink.com/a/AbCdEf123');
    expect(r.isShortLink).toBe(true);
    expect(r.titleHint).toBe('小个子显高穿搭');
    expect(r.authorHint).toBe('小鹿');
  });

  it('小红书：链接省略 https://，需自动补全', () => {
    const r = parseShareText('看这个 xhslink.com/a/XyZ789 复制打开小红书')!;
    expect(r.url).toBe('https://xhslink.com/a/XyZ789');
    expect(r.platform).toBe('xiaohongshu');
  });

  it('Instagram：reel 链接提取短码', () => {
    const text =
      'Check out this reel by @nickname: https://www.instagram.com/reel/AbCdEfGhIj/';
    const r = parseShareText(text)!;
    expect(r.platform).toBe('instagram');
    expect(r.contentId).toBe('AbCdEfGhIj');
  });

  it('YouTube：youtu.be 短链与 watch?v= 长链都能解析', () => {
    const a = parseShareText('https://youtu.be/dQw4w9WgXcQ')!;
    expect(a.platform).toBe('youtube');
    expect(a.contentId).toBe('dQw4w9WgXcQ');

    const b = parseShareText('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30')!;
    expect(b.contentId).toBe('dQw4w9WgXcQ');
  });

  it('YouTube：shorts 链接', () => {
    const r = parseShareText('https://www.youtube.com/shorts/abc123XYZ')!;
    expect(r.platform).toBe('youtube');
    expect(r.contentId).toBe('abc123XYZ');
  });
});

describe('已下线平台：抖音 / TikTok 不再支持（2026-10 移除）', () => {
  it('抖音短链 → 识别不出平台，返回 null（而不是误判成别的平台）', () => {
    const text =
      '7.85 复制打开抖音，看看【夏日穿搭分享】的作品 #穿搭 https://v.douyin.com/iRNBho6u/ 复制此链接，打开Dou音搜索，直接观看视频！';
    expect(parseShareText(text)).toBeNull();
  });

  it('抖音长链 → 返回 null', () => {
    expect(
      parseShareText('https://www.douyin.com/video/7298145681699622182')
    ).toBeNull();
  });

  it('TikTok 链接 → 返回 null', () => {
    expect(
      parseShareText('https://www.tiktok.com/@creator/video/7123456789012345678')
    ).toBeNull();
  });

  it('detectPlatform 不再命中 douyin / tiktok', () => {
    expect(detectPlatform('https://www.douyin.com/video/1')).toBeNull();
    expect(detectPlatform('https://www.tiktok.com/@u/video/1')).toBeNull();
  });

  it('detectRetiredPlatform：链接有效但平台已下线，能单独识别出来', () => {
    // 目的：提示「平台已下线」而不是「没识别出链接」，避免用户白检查文案格式
    expect(
      detectRetiredPlatform(
        '7.85 复制打开抖音，看看【夏日穿搭分享】的作品 https://v.douyin.com/iRNBho6u/'
      )
    ).toBe('抖音');
    expect(detectRetiredPlatform('https://www.douyin.com/video/123')).toBe('抖音');
    expect(detectRetiredPlatform('https://www.tiktok.com/@u/video/123')).toBe(
      'TikTok'
    );
    // 支持的平台不被误判为已下线
    expect(detectRetiredPlatform('https://xhslink.com/a/abc')).toBeNull();
    expect(detectRetiredPlatform('https://youtu.be/dQw4w9WgXcQ')).toBeNull();
  });
});

describe('健壮性：脏输入不能崩', () => {
  it('空字符串 / 纯空格 / null → 返回 null', () => {
    expect(parseShareText('')).toBeNull();
    expect(parseShareText('   ')).toBeNull();
  });

  it('不含任何链接的普通文案 → null（不误判）', () => {
    expect(parseShareText('今天天气不错，适合出门拍照')).toBeNull();
  });

  it('不认识平台的链接 → null', () => {
    expect(parseShareText('https://www.weibo.com/abc/def')).toBeNull();
  });

  it('URL 尾部粘连中文引导语，正确剥离', () => {
    const r = parseShareText('看这里 https://xhslink.com/a/xyz123复制此链接')!;
    expect(r.url).toBe('https://xhslink.com/a/xyz123');
  });

  it('URL 尾部标点（句号/逗号）正确剥离', () => {
    const r = parseShareText('见 https://www.instagram.com/reel/AbCdEf.')!;
    expect(r.contentId).toBe('AbCdEf');
  });

  it('含表情 / 零宽字符 / 全角空格不破坏解析', () => {
    const text =
      '【测试 - 作者 | 小红书】😆 xhslink.com/a/ZZZ999​ 复制打开小红书';
    const r = parseShareText(text);
    expect(r).not.toBeNull();
    expect(r!.platform).toBe('xiaohongshu');
    expect(r!.contentId).toBe('ZZZ999');
  });

  it('一条文案里多个链接，优先取可识别平台的', () => {
    const text =
      '参考这个 https://www.weibo.com/x/1 还有这个 https://xhslink.com/a/abc/';
    const r = parseShareText(text)!;
    expect(r.platform).toBe('xiaohongshu');
  });
});

describe('标签提取', () => {
  it('提取多个 #话题，标签内允许中文与下划线', () => {
    const tags = extractTags('分享 #穿搭 #夏日穿搭 #vlog_日常 #OOTD');
    expect(tags).toEqual(['#穿搭', '#夏日穿搭', '#vlog_日常', '#OOTD']);
  });

  it('标签去重', () => {
    expect(extractTags('#穿搭 #穿搭 #显高')).toEqual(['#穿搭', '#显高']);
  });

  it('无话题 → 空数组', () => {
    expect(extractTags('纯文案没有话题')).toEqual([]);
  });

  it('话题尾部标点不计入标签名', () => {
    expect(extractTags('试试 #穿搭，和 #显高。')).toEqual(['#穿搭', '#显高']);
  });
});

describe('⭐ 真实分享样本（用户提供，2026-10）—— 最高优先级回归', () => {
  it('小红书：昵称｜身份 + 标题 + xhslink.cn/o/ 短链', () => {
    const text =
      '林小牙TinyTooth｜面包师 这衣服也太适合zsiga可动三... https://xhslink.cn/o/w0nan3JwTt 去【小红书】看看这篇宝藏笔记吧！';
    const r = parseShareText(text)!;
    expect(r).not.toBeNull();
    // 域名是 xhslink.cn 而非 .com —— 初版漏配导致整条解析失败
    expect(r.platform).toBe('xiaohongshu');
    expect(r.url).toBe('https://xhslink.cn/o/w0nan3JwTt');
    expect(r.contentId).toBe('w0nan3JwTt');
    expect(r.isShortLink).toBe(true);
    // 竖线前是昵称
    expect(r.authorHint).toBe('林小牙TinyTooth');
    // 标题不能混入身份标签「面包师」，也不能把截断的「...」当标题
    expect(r.titleHint).toBe('这衣服也太适合zsiga可动三');
    expect(r.titleHint).not.toContain('面包师');
  });

  it('平台截断话题「#...」不是真话题，必须被过滤（不回填到表单）', () => {
    const text =
      '0.00 分享一篇笔记 中雨+夜间 无剪辑效果实录#... https://xhslink.com/a/SoOXb6aP3c0/ :2pm 08/01';
    const r = parseShareText(text)!;
    expect(r.platform).toBe('xiaohongshu');
    expect(r.url).toBe('https://xhslink.com/a/SoOXb6aP3c0/');
    expect(r.contentId).toBe('SoOXb6aP3c0');
    expect(r.tagHints).toEqual([]);
  });

  it('Instagram：纯 URL 的 reels 链接', () => {
    const r = parseShareText('https://www.instagram.com/reels/DcZ9HDKzX3y/')!;
    expect(r.platform).toBe('instagram');
    expect(r.contentId).toBe('DcZ9HDKzX3y');
    expect(r.isShortLink).toBe(false);
  });

  it('小红书：没有身份标签时（竖线后直接是标题）也能解析', () => {
    const r = parseShareText(
      '某用户｜ 这是一个标题 https://xhslink.cn/o/abc123 去【小红书】看看'
    )!;
    expect(r.authorHint).toBe('某用户');
    expect(r.titleHint).toBe('这是一个标题');
  });

  it('Instagram：reels 复数路径也能提取 ID', () => {
    expect(extractContentId(
      'https://www.instagram.com/reels/DcZ9HDKzX3y/',
      'instagram'
    )).toBe('DcZ9HDKzX3y');
  });
});

describe('extractContentId 各平台 ID 提取', () => {
  it('小红书短链只能拿到短码（需服务端展开）', () => {
    expect(
      extractContentId('https://xhslink.com/a/iRNBho6u/', 'xiaohongshu')
    ).toBe('iRNBho6u');
  });

  it('小红书 explore / discovery 两种路径', () => {
    expect(
      extractContentId('https://www.xiaohongshu.com/explore/abc123', 'xiaohongshu')
    ).toBe('abc123');
    expect(
      extractContentId(
        'https://www.xiaohongshu.com/discovery/item/xyz789',
        'xiaohongshu'
      )
    ).toBe('xyz789');
  });

  it('YouTube watch?v= / shorts / embed 都能取到 ID', () => {
    expect(
      extractContentId('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube')
    ).toBe('dQw4w9WgXcQ');
    expect(
      extractContentId('https://www.youtube.com/shorts/abc123', 'youtube')
    ).toBe('abc123');
    expect(
      extractContentId('https://www.youtube.com/embed/xyz789', 'youtube')
    ).toBe('xyz789');
  });

  it('Instagram 非内容路径返回空串', () => {
    expect(
      extractContentId('https://www.instagram.com/stories/someone/', 'instagram')
    ).toBe('');
  });
});

describe('底层工具函数', () => {
  it('normalizeUrl：裸域名补 https://，已有协议不重复补', () => {
    expect(normalizeUrl('xhslink.com/a/x')).toBe('https://xhslink.com/a/x');
    expect(normalizeUrl('https://a.com/b')).toBe('https://a.com/b');
    expect(normalizeUrl('http://a.com/b')).toBe('http://a.com/b');
  });

  it('cleanShareText：全角空格转普通空格、零宽字符删除', () => {
    // 输入 a + U+3000(全角空格) + b + U+200B(零宽) + c
    // 期望：全角空格 → 普通空格(U+0020)，零宽字符直接删除
    expect(cleanShareText('a\u3000b\u200bc')).toBe('a bc');
    // 连续空白折叠为单个空格
    expect(cleanShareText('a   b')).toBe('a b');
    // emoji 被替换掉而不是留下乱码
    expect(cleanShareText('看这个 😆 内容')).toBe('看这个 内容');
  });

  it('detectPlatform：子域名也算命中', () => {
    expect(detectPlatform('https://www.xiaohongshu.com/explore/x')).toBe(
      'xiaohongshu'
    );
    expect(detectPlatform('https://www.instagram.com/p/x')).toBe('instagram');
    expect(detectPlatform('https://evil-xiaohongshu.com/x')).toBeNull();
  });

  it('isShortLink：区分短链与长链', () => {
    expect(isShortLink('https://xhslink.com/a/abc/', 'xiaohongshu')).toBe(true);
    expect(
      isShortLink('https://www.xiaohongshu.com/explore/7123', 'xiaohongshu')
    ).toBe(false);
  });

  it('extractUrl 只取第一个可识别平台的链接', () => {
    const r = extractUrl(
      'foo https://weibo.com/a 和 https://www.instagram.com/reel/AbC'
    );
    expect(r!.platform).toBe('instagram');
  });
});
