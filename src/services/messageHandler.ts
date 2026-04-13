import { parseStringPromise } from 'xml2js';
import type { WechatIncomingMessage, WechatReply } from '../types/wechat.js';
import { buildReplyXml } from './replyBuilder.js';
import { wechatApi } from './wechatApi.js';

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

  const reply = resolveReply(msg, msgType);
  if (!reply) return 'success';

  return buildReplyXml(to, from, reply);
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
  switch (reply.type) {
    case 'text':
      await wechatApi.sendText(openid, reply.content);
      break;
    case 'markdown':
      await wechatApi.sendText(openid, reply.content);
      break;
    case 'code':
      await wechatApi.sendText(openid, `\`\`\`${reply.language}\n${reply.code}\n\`\`\``);
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
  }
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
      if (content.startsWith('/md ')) {
        return { type: 'markdown', content: content.slice(4) };
      }
      if (content.startsWith('/code ')) {
        return { type: 'code', language: 'typescript', code: content.slice(6) };
      }
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
