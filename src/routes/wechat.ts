import { Router, Request, Response, NextFunction } from 'express';
import { verifySignature } from '../middleware/verifySignature.js';
import { handleMessage } from '../services/messageHandler.js';

export const wechatRouter: Router = Router();

/**
 * GET /wechat - 微信服务器接入验证
 */
wechatRouter.get('/', verifySignature, (req: Request, res: Response) => {
  res.send(req.query.echostr as string);
});

/**
 * POST /wechat - 接收微信推送消息
 */
wechatRouter.post('/', verifySignature, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reply = await handleMessage(req.body as string);
    res.set('Content-Type', 'text/xml');
    res.send(reply);
  } catch (err) {
    next(err);
  }
});
