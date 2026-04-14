import 'dotenv/config';

/**
 * 全局配置对象，统一从环境变量中读取，避免代码中散落 process.env 调用。
 * 修改配置只需调整 .env 文件，此处集中管理所有可配置项。
 */
export const config = {
  /** 服务器基础配置 */
  server: {
    port: (() => {
      const p = Number(process.env.PORT ?? 3000);
      if (Number.isNaN(p) || p < 0 || p > 65535) {
        console.error(`[fatal] PORT 无效: "${process.env.PORT}"，需为 0-65535 的数字`);
        process.exit(1);
      }
      return p;
    })(),
    env: process.env.NODE_ENV ?? 'development',
  },

  /** 微信公众号（测试号）配置 */
  wechat: {
    /** 用于 co-wechat-api 自动获取 access_token */
    appId: process.env.WECHAT_APP_ID ?? '',
    /** 用于 co-wechat-api 自动获取 access_token */
    appSecret: process.env.WECHAT_APP_SECRET ?? '',
    /** 服务器接入验证用，在公众号后台配置（注意：与 access_token 是不同概念） */
    token: process.env.WECHAT_TOKEN ?? '',
  },

  /** 消息转发目标配置 */
  forward: {
    url: process.env.FORWARD_URL ?? '',
    /**
     * 其他后端调用 POST /wechat/send 时需在 X-Callback-Token 请求头中携带此值。
     * 未配置时 /wechat/send 端点不可用。
     */
    callbackToken: process.env.CALLBACK_TOKEN ?? '',
  },
} as const;

export type AppConfig = typeof config;
