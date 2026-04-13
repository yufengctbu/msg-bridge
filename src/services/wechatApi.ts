import WechatAPI from 'co-wechat-api';
import { config } from '../config/index.js';

/**
 * 微信公众号 API 单例。
 *
 * co-wechat-api 内置了完整的 access_token 管理机制：
 *   - 首次调用任何 API 方法时，自动用 appId + appSecret 请求 access_token
 *   - token 过期前自动刷新（有效期 7200s，提前 10s 续期）
 *   - 收到 40001 / 42001 错误码时自动重试（最多 3 次）
 *
 * ── 单进程模式 ──────────────────────────────────────────────────────────────
 * 当前使用内存存储 token，适合单实例部署。
 *
 * ── 多实例部署 ──────────────────────────────────────────────────────────────
 * 如需集群 / 多机部署，传入 getToken / saveToken 回调，将 token 持久化到
 * Redis / 数据库中，示例：
 *
 * ```
 * const api = new WechatAPI(appId, appSecret,
 *   async () => JSON.parse(await redis.get('wechat_token') ?? 'null'),
 *   async (token) => { await redis.set('wechat_token', JSON.stringify(token), 'EX', 7000); }
 * );
 * ```
 *
 * 主要能力：
 *   api.sendText(openid, text)     — 客服文本消息（不受 5s 被动回复时限）
 *   api.sendImage(openid, mediaId) — 客服图片消息
 *   api.sendVoice(openid, mediaId) — 客服语音消息
 *   api.sendNews(openid, articles) — 客服图文消息
 *   api.uploadMedia(path, type)    — 上传临时素材（image / voice / video / thumb）
 *
 * 完整 API 参见：https://github.com/node-webot/co-wechat-api
 */
export const wechatApi = new WechatAPI(config.wechat.appId, config.wechat.appSecret);

// 设置合理的请求超时，防止微信侧慢响应拖垮服务
wechatApi.setOpts({ timeout: 10_000 });
