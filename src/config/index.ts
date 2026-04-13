import 'dotenv/config';

/**
 * 全局配置对象，统一从环境变量中读取，避免代码中散落 process.env 调用。
 * 修改配置只需调整 .env 文件，此处集中管理所有可配置项。
 */
export const config = {
  /** 服务器基础配置 */
  server: {
    port: Number(process.env.PORT ?? 3000),
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
  },
} as const;

export type AppConfig = typeof config;
