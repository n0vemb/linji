-- ════════════════════════════════════════════════════════════════
-- LinJi·灵集 数据库初始化（v1）
-- 对齐架构设计 §3 数据模型；SQLite 文本存 ISO 8601 UTC 时间。
-- 命名遵循项目惯例：database_vN_xxx.sql，由 server/src/db.ts 的执行器按序应用。
-- ════════════════════════════════════════════════════════════════

-- 迁移记录（执行器自建自管）
CREATE TABLE IF NOT EXISTS _migrations (
  version    TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

-- 用户：创建者 + 管理员。密码 bcrypt 哈希，绝不存明文。
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('creator', 'admin')),
  created_at    TEXT NOT NULL
);

-- 灵感：核心业务实体。
-- 体检报告全量 JSON 存 health_report_json，同时把列表页要用的字段
-- （health_score / compliance / long_tail_json）冗余出来，避免列表查询解析大 JSON。
CREATE TABLE IF NOT EXISTS inspirations (
  id                 TEXT PRIMARY KEY,
  creator_id         TEXT NOT NULL REFERENCES users(id),
  title              TEXT NOT NULL,
  copy               TEXT NOT NULL,
  tags_json          TEXT NOT NULL DEFAULT '[]',
  media_type         TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  images_json        TEXT NOT NULL DEFAULT '[]',
  video_url          TEXT,
  platform           TEXT NOT NULL CHECK (platform IN ('douyin', 'xiaohongshu')),
  status             TEXT NOT NULL CHECK (status IN ('draft', 'pending', 'approved', 'rejected')),
  reject_reason      TEXT,
  health_score       INTEGER NOT NULL DEFAULT 0,
  health_breakdown_json TEXT,
  compliance         TEXT NOT NULL DEFAULT 'pass' CHECK (compliance IN ('pass', 'warn', 'block')),
  long_tail_json     TEXT,
  health_report_json TEXT,
  submitted_at       TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inspirations_status   ON inspirations(status);
CREATE INDEX IF NOT EXISTS idx_inspirations_creator  ON inspirations(creator_id);

-- 审核流水：每次通过 / 驳回都留痕（谁、何时、为什么）。
-- 灵感表只存最终状态，流水表回答「历史」。
CREATE TABLE IF NOT EXISTS audit_logs (
  id              TEXT PRIMARY KEY,
  inspiration_id  TEXT NOT NULL REFERENCES inspirations(id),
  auditor_id      TEXT NOT NULL REFERENCES users(id),
  action          TEXT NOT NULL CHECK (action IN ('approve', 'reject')),
  reason          TEXT,
  created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_logs_inspiration ON audit_logs(inspiration_id);

-- 收藏：用户 × 灵感 多对多。isFavorite 不落灵感表（是 per-user 状态）。
CREATE TABLE IF NOT EXISTS favorites (
  user_id        TEXT NOT NULL REFERENCES users(id),
  inspiration_id TEXT NOT NULL REFERENCES inspirations(id),
  created_at     TEXT NOT NULL,
  PRIMARY KEY (user_id, inspiration_id)
);
