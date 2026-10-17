# LinJi·灵集 后端镜像
# 采集功能依赖系统 curl（实测：抖音/小红书短链的 JS 风控按 TLS 指纹分流，
# undici 100% 被拦，curl 稳定通过），slim 镜像默认不带 curl，需显式安装。
FROM node:22-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

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
