import { config } from './config/index.js';
import app from './app.js';

// ── 必填配置校验 ─────────────────────────────────────────────
if (!config.wechat.token) {
  console.error('[fatal] WECHAT_TOKEN 未配置，无法验证微信签名，进程退出');
  process.exit(1);
}
if (!config.wechat.appId || !config.wechat.appSecret) {
  console.error(
    '[fatal] WECHAT_APP_ID / WECHAT_APP_SECRET 未配置，无法获取 access_token，进程退出',
  );
  process.exit(1);
}

// ── 启动服务 ─────────────────────────────────────────────────
const server = app.listen(config.server.port, () => {
  console.info(`[server] msg-bridge running on port ${config.server.port} (${config.server.env})`);
});

// ── 优雅停机（Docker / K8s / PM2 会发送 SIGTERM）────────────
function gracefulShutdown(signal: string): void {
  console.info(`[server] 收到 ${signal}，正在关闭…`);
  server.close(() => {
    console.info('[server] 所有连接已关闭，进程退出');
    process.exit(0);
  });
  // 10 秒后强制退出，防止连接泄漏导致进程挂起
  setTimeout(() => {
    console.warn('[server] 强制退出（超时 10s）');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
