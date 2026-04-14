import type { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { sendFail } from '../utils/response';

/**
 * 校验 X-Callback-Token 请求头，用于保护内部回调端点（如 POST /wechat/send）。
 *
 * 需在 .env 中配置 CALLBACK_TOKEN，未配置时端点直接返回 503。
 * Token 与请求头不匹配时返回 401，防止未授权调用。
 */
export function callbackAuth(req: Request, res: Response, next: NextFunction): void {
  const token = config.forward.callbackToken;
  if (!token) {
    sendFail(res, 'CALLBACK_TOKEN 未配置，此端点不可用', 503);
    return;
  }
  if (req.headers['x-callback-token'] !== token) {
    sendFail(res, '鉴权失败', 401);
    return;
  }
  next();
}
