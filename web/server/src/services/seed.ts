/**
 * 种子数据：空库时灌入演示用户 + 灵感。
 *
 * 两个关键决策：
 * 1. 灵感内容复用前端 mock 的 seedData.ts（同一份内容，两个模式不 divergen）；
 *    但体检报告**不**复用前端预烘焙的 MOCK_REPORTS，而是用同一套 scorer
 *    现算 —— 后端是权威源，必须跑真实逻辑，不能复制可能过期的快照。
 * 2. 种子只在 users 表为空时执行；演示账号密码统一 demo123（见登录页提示）。
 */
import type { DB } from '../db';
import bcrypt from 'bcryptjs';
import { SEEDS as SEED_INSPIRATIONS } from '../../../src/data/mock/seedData';
import { generateReport } from '../../../src/data/health/scorer';
import { newId, nowIso } from '../lib/id';

/** 演示账号（登录页会展示，便于体验） */
const SEED_USERS: Array<{
  id: string;
  username: string;
  displayName: string;
  role: 'creator' | 'admin';
}> = [
  { id: 'user_xu', username: 'xu', displayName: '许清楚', role: 'creator' },
  { id: 'user_gao', username: 'admin', displayName: '高见远', role: 'admin' },
  { id: 'user_lin', username: 'lin', displayName: '林夕', role: 'creator' },
  { id: 'user_mu', username: 'mu', displayName: '沐沐', role: 'creator' },
];

const DEMO_PASSWORD = 'demo123';

/** 被驳回种子的驳回理由（创作者要在详情页看到「为什么」） */
const REJECT_REASON = '封面含竞品水印，且文案信息量不足，请补充搭配思路后重新提交';

export function seedIfEmpty(database: DB): void {
  const userCount = database
    .prepare('SELECT COUNT(*) AS n FROM users')
    .get() as { n: number };
  if (userCount.n > 0) return;

  const now = nowIso();
  const hash = bcrypt.hashSync(DEMO_PASSWORD, 10);

  const insertUser = database.prepare(`
    INSERT INTO users (id, username, password_hash, display_name, role, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertInsp = database.prepare(`
    INSERT INTO inspirations (
      id, creator_id, title, copy, tags_json, media_type, images_json,
      video_url, platform, status, reject_reason, health_score,
      health_breakdown_json, compliance, long_tail_json, health_report_json,
      submitted_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertAudit = database.prepare(`
    INSERT INTO audit_logs (id, inspiration_id, auditor_id, action, reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertFav = database.prepare(`
    INSERT INTO favorites (user_id, inspiration_id, created_at) VALUES (?, ?, ?)
  `);

  const run = database.transaction(() => {
    for (const u of SEED_USERS) {
      insertUser.run(u.id, u.username, hash, u.displayName, u.role, now);
    }

    let decidedCount = 0;
    for (const seed of SEED_INSPIRATIONS) {
      // 用真实 scorer 现算报告（与前端上传时同一套逻辑）
      const report = generateReport({
        inspirationID: seed.id,
        title: seed.title,
        copy: seed.copy,
        tags: seed.tags,
        mediaType: seed.mediaType,
        images: seed.images,
        platform: seed.platform,
      });

      const decided = seed.status === 'approved' || seed.status === 'rejected';
      const submittedAt = decided || seed.status === 'pending' ? seed.createdAt : null;
      const rejectReason = seed.status === 'rejected' ? REJECT_REASON : null;

      insertInsp.run(
        seed.id,
        seed.creatorID,
        seed.title,
        seed.copy,
        JSON.stringify(seed.tags),
        seed.mediaType,
        JSON.stringify(seed.images),
        seed.videoUrl,
        seed.platform,
        seed.status,
        rejectReason,
        report.totalScore,
        JSON.stringify(report.dimensions),
        report.compliance.level,
        JSON.stringify(report.longTailWords),
        JSON.stringify(report),
        submittedAt,
        seed.createdAt,
        seed.updatedAt
      );

      if (decided) {
        decidedCount += 1;
        insertAudit.run(
          newId('audit'),
          seed.id,
          'user_gao',
          seed.status === 'approved' ? 'approve' : 'reject',
          rejectReason,
          seed.updatedAt
        );
      }
    }

    // 给默认演示账号（许清楚）预置两条收藏，收藏页不为空
    const favs = SEED_INSPIRATIONS.filter(
      (s) => s.creatorID !== 'user_xu' && s.status === 'approved'
    ).slice(0, 2);
    for (const f of favs) {
      insertFav.run('user_xu', f.id, now);
    }

    console.log(
      `[seed] 已灌入 ${SEED_USERS.length} 个用户 / ${SEED_INSPIRATIONS.length} 条灵感（含 ${decidedCount} 条已审）/ ${favs.length} 条收藏`
    );
  });

  run();
}
