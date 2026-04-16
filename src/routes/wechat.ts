import os from 'node:os';
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { verifySignature } from '../middleware/verifySignature';
import { callbackAuth } from '../middleware/callbackAuth';
import {
  handleMessage,
  sendCustomerServiceMessage,
  sendBatchMessages,
} from '../services/messageHandler';
import { uploadTempMedia, cleanupTempFile } from '../services/mediaService';
import type { MediaType } from '../services/mediaService';
import { isDuplicate } from '../queue/dedupCache';
import { extractMsgKey } from '../utils/xml';
import { sendSuccess, sendFail } from '../utils/response';
import type { WechatReply } from '../types/wechat';

const ALLOWED_TYPES: MediaType[] = ['image', 'voice', 'video', 'thumb'];

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = /^(image|audio|video)\//;
    if (allowed.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型：${file.mimetype}`));
    }
  },
});

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

/**
 * POST /upload - 上传临时素材到微信，返回 media_id
 * 鉴权：X-Callback-Token 请求头必须与 CALLBACK_TOKEN 环境变量一致。
 * 请求体（multipart/form-data）：
 *   file  - 文件字段（必填）
 *   type  - 素材类型：image（默认）/ voice / video / thumb
 *
 * 返回：{ mediaId, type }
 * media_id 有效期 3 天，可直接用于 /send 的 image / voice / video 消息。
 */
wechatRouter.post(
  '/upload',
  callbackAuth,
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file || req.file.size === 0) {
        if (req.file) await cleanupTempFile(req.file.path);
        sendFail(res, '请上传文件，字段名：file');
        return;
      }

      const rawType = (req.body as Record<string, string>).type ?? 'image';
      if (!ALLOWED_TYPES.includes(rawType as MediaType)) {
        await cleanupTempFile(req.file.path);
        sendFail(res, `type 必须为 ${ALLOWED_TYPES.join(' / ')}`);
        return;
      }

      const type = rawType as MediaType;
      const mediaId = await uploadTempMedia(req.file.path, type);
      sendSuccess(res, { mediaId, type });
    } catch (err) {
      next(err);
    }
  },
);
