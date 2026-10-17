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
| DELETE | /inspirations/:id | ✅ | 删除（仅创建者） |
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

| 平台 | 能力 | 实现方式 |
|---|---|---|
| Instagram | ✅ **完整**（实测：标题/作者/正文/话题/封面/**视频**全部转存） | yt-dlp extractor，公开内容免登录 |
| 小红书 | ✅ **完整**（实测：正文/话题/9 图转存） | 短链展开 + `__INITIAL_STATE__` 解析 |
| YouTube | ✅ 标题/作者/封面 | 官方 oEmbed |
| TikTok | ✅ 配置 sidecar 后完整；否则 oEmbed 标题/作者/封面 | sidecar / oEmbed |
| 抖音 | ⚠️ **配置 sidecar 后完整**（推荐）；未配置时仅 itemId + 分享文案线索 | sidecar（X-Bogus/a_bogus 签名）→ 分享页 SSR → iteminfo |

### 抖音的三条通道（按优先级）

1. **Douyin_TikTok_Download_API sidecar**（推荐，`DOUYIN_API_URL` 配置时启用）
   —— 上游项目（20k+ star，Apache-2.0）纯 Python 实现 X-Bogus/a_bogus 签名，
   签名的风控演进成本由上游承担。compose 已内置 `douyin-api` service。
2. **分享页 SSR**（无 cookie 无签名，`_ROUTER_DATA` 的 videoInfoRes）
   —— 实测部分网络/UA 下服务端不吐数据（videoInfoRes=null），作为零依赖尝试保留。
3. **iteminfo 接口** —— 实测对无签名请求返回空 200（风控），兼容保留。

**铁律：拿不到就说拿不到。** 结果带 `completeness`（full/partial）与 `note`（缺口说明），
每个字段标注来源（`fieldSources`：share=分享文案 / platform=平台接口）。绝不伪造内容。

## 已知实现说明

- **传输用系统 curl 而非 Node fetch**：抖音/小红书短链的 JS 风控按 TLS 指纹分流，
  undici（Node fetch 底层）100% 拿到挑战页，curl 稳定 302。curl 缺失时自动降级 undici
  （YouTube/TikTok 仍可用，国内平台会明示失败）。
- **Instagram 用 yt-dlp**（Dockerfile 已装）：公开 reel/帖子免登录，直接读页面内嵌 JSON；
  视频 / 封面转存到本地。私密内容才需 cookies——我们只采公开内容。
- **抖音签名不手搓**：X-Bogus/a_bogus 交给 Douyin_TikTok_Download_API sidecar
  （`DOUYIN_API_URL`，compose 内置）；未配置时走分享页/iteminfo 降级链。
- **代理按域名分流**：`COLLECT_PROXY` 只作用于海外域名；国内平台（抖音/小红书）恒直连
  （实测本机代理对国内域名 connection failed，海外服务器直连一切）。
- **体检报告服务端现算**：复用前端同一套 `src/data/health/` 评分器，不信任客户端分数。
- **编辑已审内容 → 回待审**：审核结论是对「那一版内容」的，内容变了结论就失效。
- 迁移文件 `migrations/database_vN_xxx.sql`（项目命名惯例），启动时自动应用。
