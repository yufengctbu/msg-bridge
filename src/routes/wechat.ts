import { Router, Request, Response, NextFunction } from 'express';
import { verifySignature } from '../middleware/verifySignature';
import { handleMessage, sendCustomerServiceMessage } from '../services/messageHandler';
import { isDuplicate } from '../queue/dedupCache';
import { config } from '../config';
import type { WechatReply } from '../types/wechat';

export const wechatRouter: Router = Router();

/**
 * GET /wechat - 微信服务器接入验证
 */
wechatRouter.get('/', verifySignature, (req: Request, res: Response) => {
  res.send(req.query.echostr as string);
});

/**
 * POST /wechat - 接收微信推送消息
 *
 * 去重逻辑：微信在 5s 超时后最多重试 3 次，使用 MsgId 去重避免重复处理。
 * 事件消息（如关注）没有 MsgId，使用 FromUserName + Event 构造唯一键。
 */
wechatRouter.post('/', verifySignature, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as string;

    // 快速提取 MsgId 用于去重（正则比完整解析更轻量）
    // 普通消息有 MsgId；事件消息用 FromUserName + CreateTime + Event 构造唯一键
    const msgIdMatch = body.match(/<MsgId>(\d+)<\/MsgId>/)?.[1];
    const msgId =
      msgIdMatch ??
      [
        body.match(/<FromUserName><!\[CDATA\[(.+?)]]>/)?.[1],
        body.match(/<CreateTime>(\d+)<\/CreateTime>/)?.[1],
        body.match(/<Event><!\[CDATA\[(.+?)]]>/)?.[1],
      ]
        .filter(Boolean)
        .join('-');

    // key 为空说明消息格式完全无法识别，跳过去重直接处理
    if (msgId && isDuplicate(msgId)) {
      // 重复消息：直接返回 success，不再处理
      res.send('success');
      return;
    }

    const reply = await handleMessage(body);

    // handleMessage 返回 'success' 时是纯文本，非 XML
    if (reply === 'success') {
      res.send('success');
    } else {
      res.set('Content-Type', 'text/xml');
      res.send(reply);
    }
  } catch (err) {
    next(err);
  }
});

/**
 * POST /wechat/send - 其他后端通过客服接口异步回复微信用户
 *
 * 鉴权：请求头 X-Callback-Token 必须与环境变量 CALLBACK_TOKEN 一致。
 *
 * 请求体：
 * {
 *   "openid": "用户 OpenID",
 *   "type": "text" | "image" | "voice" | "video" | "music" | "news" | "markdown" | "code",
 *   ... 对应 WechatReply 的其他字段
 * }
 *
 * 响应：{ "ok": true } 或 错误 JSON
 */
wechatRouter.post(
  '/send',
  (req: Request, res: Response, next: NextFunction) => {
    const token = config.forward.callbackToken;
    if (!token) {
      res.status(503).json({ error: 'CALLBACK_TOKEN 未配置，/wechat/send 端点不可用' });
      return;
    }
    if (req.headers['x-callback-token'] !== token) {
      res.status(401).json({ error: '鉴权失败' });
      return;
    }
    next();
  },
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { openid, ...replyFields } = req.body as { openid?: string } & WechatReply;

      if (!openid || typeof openid !== 'string') {
        res.status(400).json({ error: 'openid 必填' });
        return;
      }
      if (!replyFields.type) {
        res.status(400).json({ error: 'type 必填' });
        return;
      }

      await sendCustomerServiceMessage(openid, replyFields as WechatReply);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);
