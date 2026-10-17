// @vitest-environment node
/**
 * 后端集成测试：fastify.inject + 临时 SQLite 库。
 * 覆盖：认证 / 权限门控 / 灵感 CRUD / 草稿闭环 / 审核流（驳回必填理由）/ 收藏。
 *
 * 注意：必须在设置 DATA_DIR 之后动态 import 业务模块（env.ts 在加载时读取）。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linji-test-'));
process.env.DATA_DIR = tmpDir;
process.env.JWT_SECRET = 'test-secret-not-for-prod';

const { buildServer } = await import('./index');
const { closeDb } = await import('./db');
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

/** 登录拿 token */
async function login(username: string, password = 'demo123'): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username, password },
  });
  const body = res.json();
  return body.token as string;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

beforeAll(async () => {
  // initDb 由 main() 调用；测试里手动初始化（灌种子）
  const { initDb } = await import('./db');
  initDb();
  app = await buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  closeDb();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('健康检查与认证', () => {
  it('GET /api/health 无需登录', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });

  it('未登录访问业务接口 → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/inspirations' });
    expect(res.statusCode).toBe(401);
  });

  it('登录成功返回 token 与用户', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'xu', password: 'demo123' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.token).toBeTruthy();
    expect(body.user.role).toBe('creator');
  });

  it('错误密码 → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'xu', password: 'wrong' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('注册新用户（creator）→ 自动登录', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'tester01', password: 'secret6', displayName: '测试' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.role).toBe('creator');
  });

  it('凭 token 恢复登录态', async () => {
    const token = await login('xu');
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: auth(token),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.username).toBe('xu');
  });
});

describe('灵感列表与权限', () => {
  it('广场仅返回已通过', async () => {
    const token = await login('xu');
    const res = await app.inject({
      method: 'GET',
      url: '/api/inspirations?scope=plaza',
      headers: auth(token),
    });
    const list = res.json().inspirations;
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((i: { status: string }) => i.status === 'approved')).toBe(true);
  });

  it('我的仅返回本人', async () => {
    const token = await login('xu');
    const res = await app.inject({
      method: 'GET',
      url: '/api/inspirations?scope=mine',
      headers: auth(token),
    });
    const list = res.json().inspirations;
    expect(list.every((i: { creatorID: string }) => i.creatorID === 'user_xu')).toBe(true);
  });

  it('scope=all 仅管理员可用', async () => {
    const creator = await login('xu');
    const res = await app.inject({
      method: 'GET',
      url: '/api/inspirations?scope=all',
      headers: auth(creator),
    });
    expect(res.statusCode).toBe(403);
  });

  it('他人已通过内容可看；他人待审内容 404', async () => {
    const token = await login('xu');
    // insp_001 是许清楚自己的已通过内容
    const own = await app.inject({
      method: 'GET',
      url: '/api/inspirations/insp_001',
      headers: auth(token),
    });
    expect(own.statusCode).toBe(200);
    // insp_004 是许清楚的待审内容（本人可看）
    const ownPending = await app.inject({
      method: 'GET',
      url: '/api/inspirations/insp_004',
      headers: auth(token),
    });
    expect(ownPending.statusCode).toBe(200);
    // insp_005 是林夕的待审内容（他人不可看）
    const otherPending = await app.inject({
      method: 'GET',
      url: '/api/inspirations/insp_005',
      headers: auth(token),
    });
    expect(otherPending.statusCode).toBe(404);
  });
});

describe('草稿闭环：创建 → 提交', () => {
  it('草稿不进审核队列，提交后进队列', async () => {
    const token = await login('xu');
    const create = await app.inject({
      method: 'POST',
      url: '/api/inspirations',
      headers: auth(token),
      payload: {
        asDraft: true,
        draft: {
          title: '测试草稿',
          copy: '通勤穿搭分享，学生党适用。',
          tags: ['#通勤'],
          mediaType: 'image',
          images: [],
          videoUrl: null,
          platform: 'xiaohongshu',
        },
      },
    });
    expect(create.statusCode).toBe(200);
    const id = create.json().inspiration.id;
    expect(create.json().inspiration.status).toBe('draft');

    // 队列里没有它
    const adminToken = await login('admin');
    const queueBefore = await app.inject({
      method: 'GET',
      url: '/api/audit/queue',
      headers: auth(adminToken),
    });
    expect(
      queueBefore.json().queue.some((a: { inspirationID: string }) => a.inspirationID === id)
    ).toBe(false);

    // 提交
    const submit = await app.inject({
      method: 'POST',
      url: `/api/inspirations/${id}/submit`,
      headers: auth(token),
    });
    expect(submit.json().inspiration.status).toBe('pending');

    const queueAfter = await app.inject({
      method: 'GET',
      url: '/api/audit/queue',
      headers: auth(adminToken),
    });
    expect(
      queueAfter.json().queue.some((a: { inspirationID: string }) => a.inspirationID === id)
    ).toBe(true);
  });
});

describe('审核流：通过 / 驳回（理由必填）', () => {
  it('驳回无理由 → 400', async () => {
    const adminToken = await login('admin');
    const res = await app.inject({
      method: 'POST',
      url: '/api/audit/insp_004/reject',
      headers: auth(adminToken),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('驳回带理由 → 灵感 rejected 且理由留存', async () => {
    const adminToken = await login('admin');
    const res = await app.inject({
      method: 'POST',
      url: '/api/audit/insp_004/reject',
      headers: auth(adminToken),
      payload: { reason: '封面含竞品水印，请更换' },
    });
    expect(res.statusCode).toBe(200);
    const audit = res.json().audit;
    expect(audit.status).toBe('rejected');
    expect(audit.inspiration.rejectReason).toBe('封面含竞品水印，请更换');
  });

  it('创作者无权审核 → 401/403', async () => {
    const token = await login('xu');
    const res = await app.inject({
      method: 'GET',
      url: '/api/audit/queue',
      headers: auth(token),
    });
    expect([401, 403]).toContain(res.statusCode);
  });

  it('已驳回的项不能重复驳回', async () => {
    const adminToken = await login('admin');
    const res = await app.inject({
      method: 'POST',
      url: '/api/audit/insp_004/reject',
      headers: auth(adminToken),
      payload: { reason: '再驳一次' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('编辑与删除权限', () => {
  it('编辑他人灵感 → 403', async () => {
    const token = await login('xu');
    const res = await app.inject({
      method: 'PUT',
      url: '/api/inspirations/insp_002',
      headers: auth(token),
      payload: {
        draft: {
          title: 'x',
          copy: 'y',
          tags: [],
          mediaType: 'image',
          images: [],
          videoUrl: null,
          platform: 'xiaohongshu',
        },
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it('删除他人灵感 → 403', async () => {
    const token = await login('xu');
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/inspirations/insp_002',
      headers: auth(token),
    });
    expect(res.statusCode).toBe(403);
  });

  it('编辑已通过灵感 → 回到待审', async () => {
    const token = await login('xu');
    const res = await app.inject({
      method: 'PUT',
      url: '/api/inspirations/insp_001',
      headers: auth(token),
      payload: {
        draft: {
          title: '夏日清凉穿搭 vlog 实测分享（改）',
          copy: '今天分享 3 套清凉穿搭，通勤约会都能穿。',
          tags: ['#穿搭'],
          mediaType: 'video',
          images: [],
          videoUrl: null,
          platform: 'douyin',
        },
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().inspiration.status).toBe('pending');
  });

  it('删除自己的灵感成功', async () => {
    const token = await login('xu');
    // 先建一个再删
    const create = await app.inject({
      method: 'POST',
      url: '/api/inspirations',
      headers: auth(token),
      payload: {
        asDraft: true,
        draft: {
          title: '待删除',
          copy: '随手记录。',
          tags: [],
          mediaType: 'image',
          images: [],
          videoUrl: null,
          platform: 'xiaohongshu',
        },
      },
    });
    const id = create.json().inspiration.id;
    const del = await app.inject({
      method: 'DELETE',
      url: `/api/inspirations/${id}`,
      headers: auth(token),
    });
    expect(del.statusCode).toBe(200);
  });
});

describe('收藏', () => {
  it('切换收藏 → 列表可见', async () => {
    const token = await login('xu');
    // 注意：种子数据已给 xu 预置了 insp_002 / insp_003 两条收藏，
    // 所以第一次 toggle 是「取消」，第二次才是「收藏」。
    // insp_002 是林夕的已通过内容
    const off = await app.inject({
      method: 'POST',
      url: '/api/inspirations/insp_002/favorite',
      headers: auth(token),
    });
    expect(off.json().isFavorite).toBe(false);

    const on = await app.inject({
      method: 'POST',
      url: '/api/inspirations/insp_002/favorite',
      headers: auth(token),
    });
    expect(on.json().isFavorite).toBe(true);

    const list = await app.inject({
      method: 'GET',
      url: '/api/favorites',
      headers: auth(token),
    });
    expect(
      list.json().inspirations.some((i: { id: string }) => i.id === 'insp_002')
    ).toBe(true);

    const offAgain = await app.inject({
      method: 'POST',
      url: '/api/inspirations/insp_002/favorite',
      headers: auth(token),
    });
    expect(offAgain.json().isFavorite).toBe(false);

    const listAfter = await app.inject({
      method: 'GET',
      url: '/api/favorites',
      headers: auth(token),
    });
    expect(
      listAfter.json().inspirations.some((i: { id: string }) => i.id === 'insp_002')
    ).toBe(false);
  });
});

describe('采集', () => {
  it('无效输入 → ok:false + 可操作提示', async () => {
    const token = await login('xu');
    const res = await app.inject({
      method: 'POST',
      url: '/api/collect',
      headers: auth(token),
      payload: { raw: '今天天气不错' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(false);
    expect(body.reason).toBe('invalid-link');
  });

  it('小红书分享文案：完整抓取（标题/正文/话题/图片转存）', async () => {
    const token = await login('xu');
    const res = await app.inject({
      method: 'POST',
      url: '/api/collect',
      headers: auth(token),
      payload: {
        raw: '林小牙TinyTooth｜面包师 这衣服也太适合zsiga可动三... https://xhslink.cn/o/w0nan3JwTt 去【小红书】看看这篇宝藏笔记吧！',
      },
    });
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.source).toBe('xiaohongshu');
    // 分享文案线索
    expect(body.authorName).toBe('林小牙TinyTooth');
    // 平台抓取（网络可达时）
    if (body.completeness === 'full') {
      expect(body.title).toContain('zsiga');
      expect(body.copy).toContain('大人也要玩玩具');
      expect(body.images.length).toBeGreaterThan(0);
      expect(body.images[0]).toMatch(/^\/media\//);
      // 转存的媒体真实可访问
      const media = await app.inject({
        method: 'GET',
        url: body.images[0],
      });
      expect(media.statusCode).toBe(200);
    }
  });
});
