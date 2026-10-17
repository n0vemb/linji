# LinJi·灵集 后端（server/）

单进程服务：业务 API + 媒体静态 + 前端产物托管。SQLite 持久化，零外部依赖。

## 快速开始

```bash
# 开发（前端 + 后端一起起，API 走 vite proxy）
npm run dev:all

# 仅后端
npm run dev:server

# 生产（先 npm run build 构建前端）
npm start

# 测试 / 类型检查
npm test                    # 全量（含 server 集成测试）
npm run typecheck:server
```

## 部署（Docker，海外 VPS）

```bash
JWT_SECRET=<随机长字符串> docker compose up -d --build
# 访问 http://<服务器IP>:8787
```

- 数据（SQLite + 上传媒体）落在 `server/data/`，挂 volume 持久化
- 海外服务器**直连**各平台，无需代理（`COLLECT_PROXY` 留空）
- 演示账号（种子数据）：`admin / demo123`（管理员）、`xu / demo123`（创作者）

## API 一览（前缀 /api）

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| GET | /health | — | 探活 |
| POST | /auth/login | — | 登录 → {token, user} |
| POST | /auth/register | — | 注册（creator） |
| GET | /auth/me | ✅ | 恢复登录态 |
| GET | /inspirations?scope=plaza\|mine\|all | ✅ | 列表（plaza 仅已通过；all 需管理员） |
| GET | /inspirations/:id | ✅ | 详情（本人任意态 / 他人仅已通过） |
| POST | /inspirations | ✅ | 新建（asDraft 控制草稿/待审） |
| PUT | /inspirations/:id | ✅ | 编辑（仅创建者；已审内容被打回待审） |
| DELETE | /inspirations/:id | ✅ | 删除（创建者或管理员；级联清理 audit_logs / favorites） |
| POST | /inspirations/:id/submit | ✅ | 草稿提交审核 |
| POST | /inspirations/:id/favorite | ✅ | 收藏 / 取消（切换） |
| GET | /favorites | ✅ | 我的收藏 |
| GET | /audit/queue?status=pending\|all | 管理员 | 审核队列（内嵌完整灵感） |
| POST | /audit/:id/approve | 管理员 | 通过 |
| POST | /audit/:id/reject | 管理员 | 驳回（reason 必填，≥2 字） |
| POST | /collect | ✅ | 分享链接采集（见下） |
| POST | /upload | ✅ | multipart 媒体上传 → /media URL |
| GET | /media/* | — | 上传 / 采集媒体静态服务 |

## 采集能力边界（实测，2026-10）

**采集来源（2026-10 起）：小红书 / Instagram / YouTube。**

| 平台 | 能力 | 实现方式 |
|---|---|---|
| 小红书 | ✅ **完整**（实测：正文/话题/多图转存；视频笔记可拉原片） | 短链展开 + `__INITIAL_STATE__` 解析；视频签名直链失效时由 yt-dlp 兜底下载 |
| Instagram | ✅ **完整**（实测：标题/作者/正文/话题/封面/**视频**全部转存） | yt-dlp extractor，公开内容免登录 |
| YouTube | ✅ **含视频**（实测：h264+aac 720p 转存） | yt-dlp 拉元数据 + 下载；DASH 分离流由 ffmpeg 合并 |

**已下线：抖音 / TikTok**（2026-10 移除）。原因：其取流接口需登录态 cookie，
原 sidecar（Douyin_TikTok_Download_API V4.1.2）无 cookie 配置位、长期返回 403，
继续保留只会给出「采集失败」的假希望。`douyin-api` service 与 `DOUYIN_API_URL`
已从所有 compose / Dockerfile / env 中移除。

**铁律：拿不到就说拿不到。** 结果带 `completeness`（full/partial）与 `note`（缺口说明），
每个字段标注来源（`fieldSources`：share=分享文案 / platform=平台接口）。绝不伪造内容。

## 已知实现说明

- **传输用系统 curl 而非 Node fetch**：小红书短链的 JS 风控按 TLS 指纹分流，
  undici（Node fetch 底层）100% 拿到挑战页，curl 稳定 302。curl 缺失时自动降级 undici
  （YouTube/Instagram 仍可用，小红书会明示失败）。
- **yt-dlp + ffmpeg（Dockerfile 已装）** 是采集主力：Instagram / YouTube 直接走它，
  小红书视频在 SSR 签名直链失效时由它兜底下载。
  - ffmpeg 必需：YouTube 只提供 DASH 分离流（视频/音频独立），必须合并。
  - 格式选择优先 h264（`vcodec^=avc1`）+ 720p 上限，兼顾兼容与体积。
  - 只采公开内容，私密内容需 cookies——我们不做登录态采集。
- **代理按域名分流**：`COLLECT_PROXY` 只作用于海外域名；小红书恒直连
  （实测本机代理对国内域名 connection failed，海外服务器直连一切）。
- **体检报告服务端现算**：复用前端同一套 `src/data/health/` 评分器，不信任客户端分数。
- **编辑已审内容 → 回待审**：审核结论是对「那一版内容」的，内容变了结论就失效。
- 迁移文件 `migrations/database_vN_xxx.sql`（项目命名惯例），启动时自动应用。
