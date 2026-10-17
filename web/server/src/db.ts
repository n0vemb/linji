/**
 * SQLite 连接 + 迁移执行器。
 *
 * 设计要点：
 * - better-sqlite3 同步 API，无连接池问题；WAL 模式提升并发读。
 * - 迁移按文件名排序执行，已应用的记入 _migrations，幂等可重跑。
 * - 迁移文件名遵循项目惯例 database_vN_xxx.sql。
 */
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './env';
import { seedIfEmpty } from './services/seed';

const here = path.dirname(fileURLToPath(import.meta.url));
// db.ts 位于 server/src/，迁移目录是 server/migrations/（向上一级）
const MIGRATIONS_DIR = path.resolve(here, '..', 'migrations');

export type DB = Database.Database;

let db: DB | null = null;

export function getDb(): DB {
  if (!db) {
    throw new Error('数据库尚未初始化（先调用 initDb）');
  }
  return db;
}

/** 建目录 + 开库 + 跑迁移 + 灌种子。重复调用安全（幂等）。 */
export function initDb(): DB {
  if (db) return db;

  fs.mkdirSync(config.dataDir, { recursive: true });
  const dbFile = path.join(config.dataDir, 'linji.db');

  db = new Database(dbFile);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations(db);

  // 种子数据放这里而不是迁移里：迁移只负责结构，
  // 种子是「空库时补演示数据」，改了种子不该重跑迁移。
  seedIfEmpty(db);

  return db;
}

function runMigrations(database: DB): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version    TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const applied = new Set(
    database.prepare('SELECT version FROM _migrations').all().map(
      (r) => (r as { version: string }).version
    )
  );

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const run = database.transaction(() => {
      database.exec(sql);
      database
        .prepare('INSERT INTO _migrations (version, applied_at) VALUES (?, ?)')
        .run(file, new Date().toISOString());
    });
    run();
    console.log(`[db] 已应用迁移 ${file}`);
  }
}

/** 测试用：关库句柄（不影响磁盘文件） */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
