# LinJi·灵集 后端镜像
# 采集功能依赖两个外部工具（都是成熟开源方案，不手搓签名）：
#   1. curl   —— 小红书短链的 JS 风控按 TLS 指纹分流，
#                undici 100% 被拦，curl 稳定通过（实测）
#   2. yt-dlp —— YouTube / 小红书 / Instagram 公开内容解析（免登录）
# 采集来源平台（2026-10 起）：小红书、Instagram、YouTube。
# 抖音 / TikTok 已下线 —— 其取流接口需登录态 cookie，长期 403。
FROM node:22-slim

# ffmpeg 必需：YouTube 等平台只提供 DASH 分离流（视频/音频独立），
# 需 ffmpeg 合并为单文件；小红书 / Instagram 也借它拿到最佳画质。
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl python3 ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# yt-dlp 官方发布体（zipapp，需 python3）
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
    -o /usr/local/bin/yt-dlp \
  && chmod a+rx /usr/local/bin/yt-dlp \
  && yt-dlp --version

WORKDIR /app

# 先装依赖（layer 缓存）
COPY package.json package-lock.json ./
RUN npm ci

# 再拷贝源码并构建前端
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=8787
# 海外部署：平台直连，COLLECT_PROXY 留空。
# 如在被墙网络调试，设为本地代理（注意：代理只覆盖海外域名，国内平台自动直连）。
ENV COLLECT_PROXY=
# 生产必须改！JWT 密钥（docker-compose 会用环境变量覆盖）
ENV JWT_SECRET=change-me-in-production

EXPOSE 8787
# SQLite 库 + 上传媒体都落在 server/data，挂 volume 即持久化
VOLUME ["/app/server/data"]

# 单进程：API + /media 静态 + 前端产物托管 + SPA fallback
CMD ["npx", "tsx", "server/src/index.ts"]
