// @vitest-environment node
/**
 * 抖音作品数据提取（树遍历）单测。
 * 用夹具数据覆盖三种来源的包装结构：分享页 _ROUTER_DATA / iteminfo / sidecar 响应。
 * 这些夹具按真实结构构造 —— 解析逻辑对包装 shape 的变化免疫是核心设计目标。
 */
import { describe, it, expect } from 'vitest';
import {
  extractAweme,
  buildNoWatermarkUrl,
  douyinMediaType,
} from './douyinParse';

/** 视频作品（iteminfo 风格：item_list[0] 直接是 aweme 对象） */
const VIDEO_AWEME = {
  aweme_id: '7510572739703950632',
  desc: '中雨+夜间 无剪辑OpenPilot辅助效果实录 #自动驾驶 #科技',
  nickname: '飞翔的喵星人',
  uri: 'v0d83f8a3b2c1d4e5f6a7b8c9d0e1f2a3',
  video: {
    play_addr: {
      url_list: [
        'https://aweme.snssdk.com/aweme/v1/playwm/?video_id=v0d83f8a3b2c1d4e5f6a7b8c9d0e1f2a3&ratio=720p&line=0',
      ],
    },
  },
};

/** 图集作品（images[].url_list） */
const ALBUM_AWEME = {
  aweme_id: '7500000000000000001',
  desc: '三套夏日穿搭实测\n#穿搭 #夏日',
  nickname: '林小牙TinyTooth',
  images: [
    { url_list: ['https://p3-pc.douyinpic.com/img/tos-cn-i-3ub/aaa~noop.webp'] },
    { url_list: ['https://p3-pc.douyinpic.com/img/tos-cn-i-3ub/bbb~noop.webp'] },
    { url_list: ['https://p9-pc.douyinpic.com/img/tos-cn-i-3ub/ccc~noop.webp'] },
  ],
};

describe('extractAweme：树遍历提取', () => {
  it('从 iteminfo 结构中提取视频字段', () => {
    const ex = extractAweme({ item_list: [VIDEO_AWEME] });
    expect(ex.desc).toContain('OpenPilot');
    expect(ex.nickname).toBe('飞翔的喵星人');
    expect(ex.videoUri).toMatch(/^v[0-9a-f]+$/);
    expect(ex.playUrls.length).toBeGreaterThan(0);
    expect(ex.playUrls[0]).toContain('playwm');
  });

  it('从分享页 _ROUTER_DATA 深层结构中提取（loaderData.videoInfoRes.item_list）', () => {
    const routerData = {
      loaderData: {
        'video_(id)/page': {
          videoInfoRes: { item_list: [VIDEO_AWEME] },
        },
      },
    };
    const ex = extractAweme(routerData);
    expect(ex.desc).toContain('OpenPilot');
    expect(ex.videoUri).toMatch(/^v[0-9a-f]+$/);
  });

  it('从 sidecar 响应中提取（data.data 嵌套包装）', () => {
    const sidecar = {
      code: 200,
      message: 'success',
      data: { data: { aweme_detail: VIDEO_AWEME } },
    };
    const ex = extractAweme(sidecar.data ?? sidecar);
    expect(ex.nickname).toBe('飞翔的喵星人');
    expect(ex.playUrls.length).toBeGreaterThan(0);
  });

  it('图集：提取全部图片直链，不含播放地址', () => {
    const ex = extractAweme(ALBUM_AWEME);
    expect(ex.imageUrls).toHaveLength(3);
    expect(ex.imageUrls[0]).toContain('douyinpic.com');
    expect(ex.playUrls).toHaveLength(0);
    expect(douyinMediaType(ex)).toBe('image');
  });

  it('视频作品的素材类型为 video', () => {
    const ex = extractAweme(VIDEO_AWEME);
    expect(douyinMediaType(ex)).toBe('video');
  });

  it('空数据 / null 不崩', () => {
    const ex = extractAweme(null);
    expect(ex.desc).toBe('');
    expect(ex.playUrls).toEqual([]);
    expect(ex.imageUrls).toEqual([]);
  });

  it('uri 必须是 v 开头的十六进制才认（避免误抓普通字符串字段）', () => {
    const ex = extractAweme({ uri: 'not-a-video-id', desc: 'x' });
    expect(ex.videoUri).toBe('');
  });
});

describe('buildNoWatermarkUrl：无水印地址构造', () => {
  it('playwm → play 替换', () => {
    const url = buildNoWatermarkUrl(
      'v0d83f8a3b2c1d4e5f6a7b8c9d0e1f2a3',
      'https://aweme.snssdk.com/aweme/v1/playwm/?video_id=v0d83f8a3b2c1d4e5f6a7b8c9d0e1f2a3&ratio=720p&line=0'
    );
    expect(url).toContain('/aweme/v1/play/');
    expect(url).not.toContain('playwm');
    expect(url).toContain('video_id=v0d83f8a3b2c1d4e5f6a7b8c9d0e1f2a3');
  });

  it('无模板时用官方默认域名', () => {
    const url = buildNoWatermarkUrl('vabc123');
    expect(url).toBe(
      'https://aweme.snssdk.com/aweme/v1/play/?video_id=vabc123&ratio=default&line=0'
    );
  });

  it('保留模板里的 line 参数', () => {
    const url = buildNoWatermarkUrl(
      'vabc',
      'https://aweme.snssdk.com/aweme/v1/playwm/?video_id=vabc&line=1'
    );
    expect(url).toContain('line=1');
  });
});
