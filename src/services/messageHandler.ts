import { parseStringPromise } from 'xml2js';
import type { WechatIncomingMessage, WechatReply } from '../types/wechat';
import { buildReplyXml } from './replyBuilder';
import { wechatApi } from './wechatApi';
import { config } from '../config';

/**
 * 解析微信 XML 消息，返回被动回复 XML 字符串。
 *
 * 处理策略分两层：
 *   1. 被动回复（5s 内同步 XML 回复）—— resolveReply()
 *   2. 客服消息（异步，不受 5s 限制）—— sendCustomerServiceMessage()
 *      适用于需要调用外部 API、AI 等慢操作的场景。
 *
 * 对畸形 XML 做容错处理：解析失败直接返回 'success'，
 * 避免抛错后 WeChat 反复重试（最多 3 次）。
 */
export async function handleMessage(rawXml: string): Promise<string> {
  let parsed: { xml: WechatIncomingMessage };
  try {
    parsed = (await parseStringPromise(rawXml)) as { xml: WechatIncomingMessage };
  } catch {
    console.warn('[wechat] XML 解析失败，跳过处理');
    return 'success';
  }

  const msg = parsed.xml;

  const from = msg.FromUserName?.[0] ?? '';
  const to = msg.ToUserName?.[0] ?? '';
  const msgType = msg.MsgType?.[0] ?? '';

  // 优先转发到 FORWARD_URL，以其同步响应作为被动回复
  if (config.forward.url) {
    const reply = await forwardMessage(msg);
    if (!reply) return 'success';
    return buildReplyXml(to, from, reply);
  }

  const reply = resolveReply(msg, msgType);
  if (!reply) return 'success';

  return buildReplyXml(to, from, reply);
}

/**
 * 将消息以 JSON 形式转发到 FORWARD_URL，并将同步响应解析为回复指令。
 *
 * - 超时 4s（留 1s 余量给 WeChat 5s TTL）
 * - 其他后端响应格式：返回 WechatReply JSON 对象 → 被动回复给用户
 *                    响应 null / 空 body   → 不回复（返回 'success'）
 * - 如果其他后端超时或出错，也不回复，避免 WeChat 反复重试
 *
 * 如果需要在 5s 后回复（异步），其他后端应调用：
 *   POST /wechat/send
 *   X-Callback-Token: <CALLBACK_TOKEN>
 *   { openid, type, content, ... }
 */
async function forwardMessage(msg: WechatIncomingMessage): Promise<WechatReply | null> {
  // 将 xml2js 解析的 string[] 字段展平为普通字符串
  const payload: Record<string, string> = {};
  for (const [key, val] of Object.entries(msg)) {
    if (Array.isArray(val) && val.length > 0) {
      payload[key] = val[0] as string;
    }
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(config.forward.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      console.warn(`[forward] 转发目标响应异常: ${res.status}`);
      return null;
    }

    const text = await res.text();
    if (!text || text.trim() === 'null' || text.trim() === '') return null;

    let data: WechatReply;
    try {
      data = JSON.parse(text) as WechatReply;
    } catch {
      console.warn('[forward] 转发目标响应非合法 JSON:', text.slice(0, 200));
      return null;
    }
    if (!data || !data.type) return null;
    return data;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.warn('[forward] 转发超时（>4s），将由其他后端通过 /wechat/send 异步回复');
    } else {
      console.error('[forward] 转发失败:', err);
    }
    return null;
  }
}

/**
 * 通过客服消息接口异步发送消息（不受 5s 被动回复时限）。
 * 适用于：
 *   - 需要调用外部 API / AI 再回复（耗时超过 5s）
 *   - 主动推送通知给用户
 *
 * 底层使用 co-wechat-api，access_token 自动管理（过期自动刷新）。
 */
export async function sendCustomerServiceMessage(
  openid: string,
  reply: WechatReply,
): Promise<void> {
  try {
    switch (reply.type) {
      case 'text':
        await wechatApi.sendText(openid, reply.content);
        break;
      case 'image':
        await wechatApi.sendImage(openid, reply.mediaId);
        break;
      case 'voice':
        await wechatApi.sendVoice(openid, reply.mediaId);
        break;
      case 'video':
        await wechatApi.sendVideo(openid, reply.mediaId, reply.thumbMediaId);
        break;
      case 'music':
        await wechatApi.sendMusic(openid, {
          title: reply.title,
          description: reply.description,
          musicurl: reply.musicUrl ?? '',
          hqmusicurl: reply.hqMusicUrl,
          thumb_media_id: reply.thumbMediaId,
        });
        break;
      case 'news':
        await wechatApi.sendNews(
          openid,
          reply.articles.map((a) => ({
            title: a.title,
            description: a.description,
            url: a.url,
            picurl: a.picUrl,
          })),
        );
        break;
      case 'template':
        await wechatApi.sendTemplate(
          openid,
          reply.templateId,
          reply.url ?? '',
          reply.color ?? null,
          reply.data,
          reply.miniprogram,
        );
        break;
    }
  } catch (err) {
    console.error(`[wechat] 客服消息发送失败 (openid=${openid}, type=${reply.type}):`, err);
    throw err;
  }
}

/**
 * 批量向多个用户发送客服消息，逐条发送并收集结果。
 * 不因单个失败而中断，返回每个 openid 的发送结果。
 */
export async function sendBatchMessages(
  openids: string[],
  reply: WechatReply,
): Promise<{ openid: string; ok: boolean; error?: string }[]> {
  const results = await Promise.allSettled(
    openids.map((openid) => sendCustomerServiceMessage(openid, reply)),
  );
  return results.map((result, i) => ({
    openid: openids[i],
    ok: result.status === 'fulfilled',
    error: result.status === 'rejected' ? String(result.reason) : undefined,
  }));
}

/**
 * 根据消息类型决定回复内容。
 * 返回 null 表示无需被动回复（微信服务器收到空串后不重试）。
 *
 * 支持的接收类型（官方文档全覆盖）：
 *   text / image / voice / video / shortvideo / location / link / event
 *
 * 新增处理逻辑：在此函数中添加对应 case 即可，无需改动其他文件。
 */
function resolveReply(msg: WechatIncomingMessage, msgType: string): WechatReply | null {
  switch (msgType) {
    // ── 文本消息 ────────────────────────────────────────────────────────────
    case 'text': {
      const content = msg.Content?.[0] ?? '';
      return { type: 'text', content: `[msg-bridge] ${content}` };
    }

    // ── 图片消息 ── 原图回传（复用同一 MediaId）────────────────────────────
    case 'image': {
      const mediaId = msg.MediaId?.[0] ?? '';
      return { type: 'image', mediaId };
    }

    // ── 语音消息 ── 原声回传（复用同一 MediaId）────────────────────────────
    case 'voice': {
      const mediaId = msg.MediaId?.[0] ?? '';
      return { type: 'voice', mediaId };
    }

    // ── 视频 / 小视频消息 ────────────────────────────────────────────────────
    // 被动回复不支持直接转发视频，告知用户已收到
    case 'video':
    case 'shortvideo': {
      return { type: 'text', content: '已收到您发送的视频，暂不支持视频回复。' };
    }

    // ── 地理位置消息 ─────────────────────────────────────────────────────────
    case 'location': {
      const lat = msg.Location_X?.[0] ?? '';
      const lng = msg.Location_Y?.[0] ?? '';
      const label = msg.Label?.[0] ?? '未知位置';
      return {
        type: 'text',
        content: `已收到您的位置：${label}\n纬度：${lat}\n经度：${lng}`,
      };
    }

    // ── 链接消息 ─────────────────────────────────────────────────────────────
    case 'link': {
      const title = msg.Title?.[0] ?? '（无标题）';
      const url = msg.Url?.[0] ?? '';
      return {
        type: 'text',
        content: `已收到链接消息：\n「${title}」\n${url}`,
      };
    }

    // ── 事件消息 ─────────────────────────────────────────────────────────────
    case 'event': {
      const event = msg.Event?.[0] ?? '';
      if (event === 'subscribe') {
        return { type: 'text', content: '感谢关注！欢迎使用 msg-bridge。' };
      }
      // unsubscribe / CLICK / VIEW / SCAN 等其他事件无需被动回复
      return null;
    }

    default:
      return null;
  }
}
