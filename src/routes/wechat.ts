import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { verifySignature } from '../middleware/verifySignature';
import { callbackAuth } from '../middleware/callbackAuth';
import {
  handleMessage,
  sendCustomerServiceMessage,
  sendBatchMessages,
} from '../services/messageHandler';
import { isDuplicate } from '../queue/dedupCache';
import { extractMsgKey } from '../utils/xml';
import { sendSuccess, sendFail } from '../utils/response';
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
    const msgKey = extractMsgKey(body);

    if (msgKey && isDuplicate(msgKey)) {
      res.send('success');
      return;
    }

    const reply = await handleMessage(body);
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
 * POST /send - 其他后端通过客服接口异步回复微信用户
 * 鉴权：X-Callback-Token 请求头必须与 CALLBACK_TOKEN 环境变量一致。
 * 请求体：{ openid, type, ...WechatReply 其余字段 }
 */
wechatRouter.post(
  '/send',
  callbackAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { openid, ...replyFields } = req.body as { openid?: string | string[] } & WechatReply;

      if (!openid || (Array.isArray(openid) && openid.length === 0)) {
        sendFail(res, 'openid 必填');
        return;
      }
      if (!Array.isArray(openid) && typeof openid !== 'string') {
        sendFail(res, 'openid 必须为字符串或字符串数组');
        return;
      }
      if (!replyFields.type) {
        sendFail(res, 'type 必填');
        return;
      }

      // 批量发送
      if (Array.isArray(openid)) {
        const results = await sendBatchMessages(openid, replyFields as WechatReply);
        sendSuccess(res, { results });
        return;
      }

      // 单个发送
      await sendCustomerServiceMessage(openid, replyFields as WechatReply);
      sendSuccess(res);
    } catch (err) {
      next(err);
    }
  },
);
