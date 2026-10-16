import type { Inspiration, InspirationStatus, MediaType, Platform } from '../types';
import { STATUS_TEXT } from '@/styles/tokens';
import { MOCK_REPORTS } from './reports';

/**
 * 灵感种子数据。healthScore / healthBreakdown / compliance / longTailWords 全部由
 * MOCK_REPORTS 派生，保证与体检报告一致。
 *
 * 封面 / 视频 URL 使用 `mock:` 前缀占位（运行时 MediaPreview 渲染渐变占位，不依赖真实文件）；
 * 上传页本地预览使用 `blob:` URL（真实可下载）。
 */

interface InspirationSeed {
  id: string;
  creatorID: string;
  creatorName: string;
  title: string;
  copy: string;
  tags: string[];
  mediaType: MediaType;
  coverImage: string; // mock: 占位 或 blob: 真实
  videoUrl: string | null;
  platform: Platform;
  status: InspirationStatus;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

const SEEDS: InspirationSeed[] = [
  {
    id: 'insp_001',
    creatorID: 'user_xu',
    creatorName: '许清楚',
    title: '夏日清凉穿搭 vlog 实测分享',
    copy: '今天分享 3 套清凉穿搭，通勤约会都能穿。第一套是冰丝衬衫配阔腿裤，第二套是吊带叠穿开衫，第三套是连衣裙加草帽。附上搭配思路和购买渠道，收藏不迷路～',
    tags: ['#穿搭', '#夏日', '#vlog', '#通勤'],
    mediaType: 'video',
    coverImage: 'mock:cover_001',
    videoUrl: 'mock:video_001',
    platform: 'douyin',
    status: 'approved',
    isFavorite: false,
    createdAt: '2025-01-12T10:00:00Z',
    updatedAt: '2025-01-13T09:00:00Z',
  },
  {
    id: 'insp_002',
    creatorID: 'user_lin',
    creatorName: '林夕',
    title: '小个子显高穿搭合集',
    copy: '155cm 也能穿出大长腿。高腰线、同色系、尖头鞋三个秘诀记牢。本期 5 套通勤 look，照着穿不会错。',
    tags: ['#小个子', '#穿搭', '#显高'],
    mediaType: 'image',
    coverImage: 'mock:cover_002',
    videoUrl: null,
    platform: 'xiaohongshu',
    status: 'approved',
    isFavorite: false,
    createdAt: '2025-01-11T09:30:00Z',
    updatedAt: '2025-01-11T09:30:00Z',
  },
  {
    id: 'insp_003',
    creatorID: 'user_mu',
    creatorName: '沐沐',
    title: '周末出游穿什么',
    copy: '简单三套周末出游穿搭，舒适又出片。',
    tags: ['#周末', '#出游'],
    mediaType: 'image',
    coverImage: 'mock:cover_003',
    videoUrl: null,
    platform: 'xiaohongshu',
    status: 'approved',
    isFavorite: false,
    createdAt: '2025-01-10T14:20:00Z',
    updatedAt: '2025-01-10T14:20:00Z',
  },
  {
    id: 'insp_004',
    creatorID: 'user_xu',
    creatorName: '许清楚',
    title: '职场新人通勤穿搭',
    copy: '刚入职不知道穿什么？这几套基础款通勤穿搭帮你搞定。',
    tags: ['#通勤', '#职场'],
    mediaType: 'video',
    coverImage: 'mock:cover_004',
    videoUrl: 'mock:video_004',
    platform: 'douyin',
    status: 'pending',
    isFavorite: false,
    createdAt: '2025-01-13T08:10:00Z',
    updatedAt: '2025-01-13T08:10:00Z',
  },
  {
    id: 'insp_005',
    creatorID: 'user_lin',
    creatorName: '林夕',
    title: '春季新品速递',
    copy: '春季上新啦。',
    tags: ['#春季'],
    mediaType: 'image',
    coverImage: 'mock:cover_005',
    videoUrl: null,
    platform: 'xiaohongshu',
    status: 'pending',
    isFavorite: false,
    createdAt: '2025-01-13T11:00:00Z',
    updatedAt: '2025-01-13T11:00:00Z',
  },
  {
    id: 'insp_006',
    creatorID: 'user_mu',
    creatorName: '沐沐',
    title: '随手拍穿搭',
    copy: '今天随便穿穿。',
    tags: ['#日常'],
    mediaType: 'image',
    coverImage: 'mock:cover_006',
    videoUrl: null,
    platform: 'xiaohongshu',
    status: 'rejected',
    isFavorite: false,
    createdAt: '2025-01-09T16:40:00Z',
    updatedAt: '2025-01-09T18:00:00Z',
  },
  {
    id: 'insp_007',
    creatorID: 'user_lin',
    creatorName: '林夕',
    title: '全网最全穿搭攻略', // 含敏感词「最」，硬阻断
    copy: '盘点全网最值得买的穿搭单品，点击链接领取优惠。',
    tags: ['#穿搭', '#攻略', '#优惠'],
    mediaType: 'video',
    coverImage: 'mock:cover_007',
    videoUrl: 'mock:video_007',
    platform: 'douyin',
    status: 'pending',
    isFavorite: false,
    createdAt: '2025-01-13T13:25:00Z',
    updatedAt: '2025-01-13T13:25:00Z',
  },
  {
    id: 'insp_008',
    creatorID: 'user_xu',
    creatorName: '许清楚',
    title: '梨形身材神裤实测推荐',
    copy: '试了 10 条裤子，最终留下这 3 条。显瘦、不卡裆、垂感好，梨形姐妹闭眼入。附尺码建议和搭配示范。',
    tags: ['#梨形身材', '#神裤', '#测评', '#显瘦', '#回购'],
    mediaType: 'video',
    coverImage: 'mock:cover_008',
    videoUrl: 'mock:video_008',
    platform: 'douyin',
    status: 'approved',
    isFavorite: false,
    createdAt: '2025-01-08T10:00:00Z',
    updatedAt: '2025-01-08T10:00:00Z',
  },
  {
    id: 'insp_009',
    creatorID: 'user_mu',
    creatorName: '沐沐',
    title: '平价好物盘点',
    copy: '百元内的高颜值好物，学生党也能轻松拥有。本期 8 件宝贝实测，附购买渠道。',
    tags: ['#好物', '#平价', '#学生党', '#种草'],
    mediaType: 'image',
    coverImage: 'mock:cover_009',
    videoUrl: null,
    platform: 'xiaohongshu',
    status: 'approved',
    isFavorite: true,
    createdAt: '2025-01-07T12:00:00Z',
    updatedAt: '2025-01-07T12:00:00Z',
  },
];

function buildInspiration(seed: InspirationSeed): Inspiration {
  const report = MOCK_REPORTS[seed.id];
  if (!report) {
    throw new Error(`Missing mock report for inspiration ${seed.id}`);
  }
  const scoreOf = (key: 'title' | 'copy' | 'topics' | 'cover'): number =>
    report.dimensions.find((d) => d.key === key)?.score ?? 0;

  return {
    id: seed.id,
    creatorID: seed.creatorID,
    creatorName: seed.creatorName,
    title: seed.title,
    copy: seed.copy,
    tags: seed.tags,
    mediaType: seed.mediaType,
    coverImage: seed.coverImage,
    videoUrl: seed.videoUrl,
    platform: seed.platform,
    status: seed.status,
    healthScore: report.totalScore,
    healthBreakdown: {
      title: scoreOf('title'),
      copy: scoreOf('copy'),
      topics: scoreOf('topics'),
      cover: scoreOf('cover'),
    },
    compliance: report.compliance.level,
    longTailWords: report.longTailWords,
    isFavorite: seed.isFavorite,
    createdAt: seed.createdAt,
    updatedAt: seed.updatedAt,
    auditStatusText:
      seed.status === 'approved' ? STATUS_TEXT.approved : undefined,
  };
}

/** 灵感种子（已派生 health 字段） */
export const MOCK_INSPIRATIONS: Inspiration[] = SEEDS.map(buildInspiration);
