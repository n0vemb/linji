/**
 * PM2 配置（宝塔 Node 项目管理器 / 自建 PM2 均可用）。
 * 宝塔 Node 项目：项目目录指向 web/，启动选项选 ecosystem 文件或直接 npm start。
 */
module.exports = {
  apps: [
    {
      name: 'linji',
      cwd: '/www/wwwroot/linji/web', // ⚠️ 按实际部署目录修改
      script: 'server/src/index.ts',
      interpreter: 'npx',
      interpreter_args: 'tsx',
      exec_mode: 'fork', // 单实例：SQLite 多实例写会锁库
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: 8788,
        // JWT_SECRET 必须在宝塔「环境变量」或 .env 里覆盖为长随机串
        JWT_SECRET: 'change-me-in-production',
        // 海外服务器直连平台，留空；被墙网络调试才需要代理
        COLLECT_PROXY: '',
        // 抖音/TikTok 解析 sidecar（Douyin_TikTok_Download_API）
        // 未部署 sidecar 就留空，会自动走分享页/iteminfo 降级链
        DOUYIN_API_URL: 'http://127.0.0.1:80',
      },
      // 日志
      error_file: '/www/wwwroot/linji/web/server/data/logs/error.log',
      out_file: '/www/wwwroot/linji/web/server/data/logs/out.log',
      max_memory_restart: '512M',
      // 媒体上传走完整请求体，node 默认 bodyLimit 已放宽；PM2 不需要额外配置
    },
  ],
};
